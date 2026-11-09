import OBR, { type Item } from "@owlbear-rodeo/sdk";
import { EXTENSION_ID, PERMISSIONS_META_KEY, TURN_META_KEY } from "./constants";
import { storage } from "./storage";
import { announceInitiative, INITIATIVE_PICKER_ID, monsterTokenTurn, rollSheetInitiative, type InitiativeRolled } from "./tokenInitiative";
import { createTokenTurn, linkedCharacterId } from "./tokenTurns";
import { openFloatingPanel } from "./floatingPanels";
import { replaceTurnEntries } from "./turns";
import { writeRoomMetadata } from "./roomMetadata";
import { canEditCloudSheet } from "./cloudSheets";
import { effectiveSheet } from "./effects";
import { setHitPointTotal } from "./hitPoints";
import { notifySheetsChanged } from "./obr";
import type { CharacterSheet, CloudSheet, MonsterSheet, TurnState } from "./types";

// Voci della tendina TavernExplorer nel menu del token.

export async function openTokenSheet(token: Item): Promise<void> {
  // Come "Apri … in finestra": pannello spostabile e chiudibile. Mostro del bestiario (solo nel browser del GM)
  // nel Bestiario, token senza scheda nella Libreria.
  const characterId = linkedCharacterId(token);
  const view = !characterId ? "library" : isMonster(characterId) ? "compendium" : "sheet";
  await openFloatingPanel(view, undefined, token.id);
}

// Mostro del bestiario del GM, oppure (per un giocatore) mostro che il GM gli ha condiviso.
const isMonster = (id: string) => storage.monsters.get().some((monster) => monster.id === id) || storage.cloudCache.get(OBR.room.id).some((entry) => entry.kind === "npc" && entry.sheet.id === id);

// Mostro condiviso che questo giocatore può modificare: ne cambia i PF e ne tira le azioni.
export function canEditMonster(id: string, player: { name: string; role: "GM" | "PLAYER" }): boolean {
  if (player.role === "GM") return storage.monsters.get().some((monster) => monster.id === id);
  const entry = storage.cloudCache.get(OBR.room.id).find((item) => item.kind === "npc" && item.sheet.id === id);
  return !!entry && canEditCloudSheet(entry, player);
}

// Voci del menu per il token di un mostro modificabile: tutte tranne Risorse; Magia solo se è incantatore.
export function monsterTokenSections(id: string, player: { name: string; role: "GM" | "PLAYER" }): TokenSheetSection[] {
  if (!canEditMonster(id, player)) return [];
  const monster = player.role === "GM" ? storage.monsters.get().find((item) => item.id === id) : storage.cloudCache.get(OBR.room.id).find((item) => item.kind === "npc" && item.sheet.id === id)?.sheet as MonsterSheet | undefined;
  return ["details", "actions", "abilities", "skills", ...monster?.spellcasting ? ["spells" as const] : []];
}

export const TOKEN_ACTIONS_ID = `${EXTENSION_ID}/token-actions`;
const TOKEN_ACTIONS_SIZE = { width: 360, height: 420 };
// Parti della scheda che il menu del token apre da sole nella finestra accanto al token.
// details solo per i mostri, resources solo per i PG.
export const TOKEN_SHEET_SECTIONS = { details: "Dettagli veloci", actions: "Azioni", spells: "Magia", resources: "Risorse", abilities: "Prove e tiri salvezza", skills: "Abilità" } as const;
export type TokenSheetSection = keyof typeof TOKEN_SHEET_SECTIONS;

// Finestra con una sola parte della scheda del token (azioni, prove, TS o abilità), accanto al token; si chiude cliccando fuori.
export async function openTokenActions(token: Item, section: TokenSheetSection = "actions"): Promise<void> {
  const point = await OBR.viewport.transformPoint(token.position);
  const [width, height] = await Promise.all([OBR.viewport.getWidth(), OBR.viewport.getHeight()]);
  // Un po' a destra del centro del token, dentro la vista.
  const anchorPosition = { left: Math.max(0, Math.min(point.x + 48, width - TOKEN_ACTIONS_SIZE.width)), top: Math.max(0, Math.min(point.y - 48, height - TOKEN_ACTIONS_SIZE.height)) };
  await OBR.popover.open({
    id: TOKEN_ACTIONS_ID, url: `/?view=sheet&token=${encodeURIComponent(token.id)}&section=${section}`, ...TOKEN_ACTIONS_SIZE,
    anchorReference: "POSITION", anchorPosition, anchorOrigin: { horizontal: "LEFT", vertical: "TOP" }, transformOrigin: { horizontal: "LEFT", vertical: "TOP" },
  });
}

export async function toggleTokenInitiative(items: Item[]): Promise<void> {
  const roomMeta = await OBR.room.getMetadata();
  const permissions = roomMeta[PERMISSIONS_META_KEY] as { playersManageTurns?: boolean } | undefined;
  const gm = await OBR.player.getRole() === "GM";
  if (!gm && !permissions?.playersManageTurns) {
    await OBR.notification.show("Il GM gestisce l'ordine dei turni", "WARNING");
    return;
  }
  const current = (roomMeta[TURN_META_KEY] as unknown as TurnState | undefined) ?? { round: 1, activeIndex: 0, entries: [] };
  const ids = new Set(items.map((item) => item.id));
  const alreadyPresent = items.every((item) => current.entries.some((entry) => entry.tokenId === item.id));
  const entries = alreadyPresent ? current.entries.filter((entry) => !ids.has(entry.tokenId ?? "")) : [...current.entries];
  const rolled: InitiativeRolled[] = [];
  // Token senza scheda: il GM sceglie la scheda (o il valore) nel popover; gli altri scrivono il valore.
  const unlinked: string[] = [];
  if (!alreadyPresent) {
    const linkedSheets = storage.cloudCache.characters(OBR.room.id);
    // Il bestiario è nel browser del GM: solo lui tira per i token collegati a un mostro.
    const monsters = gm ? storage.monsters.get() : [];
    const pick = gm && (linkedSheets.length > 0 || monsters.length > 0);
    for (const item of items) {
      if (entries.some((entry) => entry.tokenId === item.id)) continue;
      const monster = monsters.find((entry) => entry.id === linkedCharacterId(item));
      if (monster) { const added = monsterTokenTurn(item.id, monster); entries.push(added.turn); rolled.push(added.rolled); continue; }
      const entry = createTokenTurn(item, linkedSheets,
        (_bonus, sheet) => { const roll = rollSheetInitiative(sheet); rolled.push(roll.rolled); return roll.initiative; },
        (name) => { if (pick) { unlinked.push(item.id); return null; } const value = window.prompt(`Iniziativa per ${name}`, "0"); return value === null ? null : Number(value) || 0; },
      );
      if (entry) entries.push(entry);
    }
  }
  try { await writeRoomMetadata({ [TURN_META_KEY]: replaceTurnEntries(current, entries) }); }
  catch (error) { await OBR.notification.show(error instanceof Error ? error.message : "Ordine dei turni non salvato", "ERROR"); return; }
  for (const roll of rolled) await announceInitiative(roll).catch(() => undefined);
  // La tendina si chiude dopo il clic: il popover si apre al centro della vista invece che sul pulsante.
  if (unlinked.length) await OBR.popover.open({
    id: INITIATIVE_PICKER_ID, url: `/?initiative=${unlinked.map(encodeURIComponent).join(",")}`, width: 380, height: 420,
    anchorReference: "POSITION", anchorPosition: { left: await OBR.viewport.getWidth() / 2, top: await OBR.viewport.getHeight() / 2 },
    anchorOrigin: { horizontal: "CENTER", vertical: "CENTER" }, transformOrigin: { horizontal: "CENTER", vertical: "CENTER" },
  });
}

// PF del token nella tendina: totale (attuali + temporanei) come nel turn order.
// PG: dalla scheda, per chi può modificarla. NPC e mostri: dalla voce del turn order, per il GM e chi può modificare il mostro.
// cap: il totale più alto raggiungibile curando (per i PG massimo + temporanei; NPC e mostri non hanno limite).
export interface TokenHitPoints { total: number; max: number; cap: number }

export async function getTokenHitPoints(token: Item): Promise<TokenHitPoints | null> {
  const id = linkedCharacterId(token);
  if (!id) return null;
  const role = await OBR.player.getRole();
  const pc = storage.cloudCache.get(OBR.room.id).find((entry) => entry.kind === "pc" && entry.sheet.id === id);
  if (pc) {
    if (!canEditCloudSheet(pc, { name: await OBR.player.getName(), role })) return null;
    const { hp } = effectiveSheet(pc.sheet as CharacterSheet).combat;
    return { total: hp.current + hp.temp, max: hp.max, cap: Math.max(hp.max, hp.current) + hp.temp };
  }
  if (role !== "GM" && !canEditMonster(id, { name: await OBR.player.getName(), role })) return null;
  const turn = ((await OBR.room.getMetadata())[TURN_META_KEY] as TurnState | undefined)?.entries.find((entry) => entry.tokenId === token.id);
  return turn?.hp ? { total: turn.hp.current, max: turn.hp.max, cap: Infinity } : null;
}

const TOKEN_HP_CHANNEL = `${EXTENSION_ID}/token-hp`;

// La voce del menu muore appena il menu si chiude: chiede il salvataggio al background, che resta aperto.
export async function requestTokenHitPoints(tokenId: string, total: number): Promise<void> {
  await OBR.broadcast.sendMessage(TOKEN_HP_CHANNEL, { tokenId, total }, { destination: "LOCAL" });
}

// Nel background: solo richieste di questo stesso browser (un altro partecipante non scrive con i permessi del GM).
export function setupTokenHitPoints(): () => void {
  return OBR.broadcast.onMessage(TOKEN_HP_CHANNEL, (event) => {
    const { tokenId, total } = (event.data ?? {}) as { tokenId?: unknown; total?: unknown };
    if (typeof tokenId !== "string" || typeof total !== "number" || !Number.isSafeInteger(total)) return;
    void (async () => {
      if (event.connectionId !== await OBR.player.getConnectionId()) return;
      const [token] = await OBR.scene.items.getItems([tokenId]);
      if (token) await setTokenHitPoints(token, total);
    })().catch((error) => OBR.notification.show(error instanceof Error ? error.message : "PF non salvati", "ERROR"));
  });
}

const sheetsUrl = "/api/sheets";

// Salva con la scheda già in cache (un solo invio); se il server ne ha una più nuova la usa e riprova una volta.
// Restituisce il nuovo totale: per i PG la cura non supera il massimo.
export async function setTokenHitPoints(token: Item, total: number): Promise<number> {
  const id = linkedCharacterId(token);
  const room = OBR.room.id;
  const role = await OBR.player.getRole();
  const isPc = (item: CloudSheet) => item.kind === "pc" && item.sheet.id === id && !item.deletedAt;
  let entry = storage.cloudCache.get(room).find(isPc);
  const turns = (await OBR.room.getMetadata())[TURN_META_KEY] as TurnState | undefined;
  if (!entry && (role === "GM" || (!!id && canEditMonster(id, { name: await OBR.player.getName(), role }))) && turns?.entries.some((item) => item.tokenId === token.id && item.hp)) {
    await writeRoomMetadata({ [TURN_META_KEY]: { ...turns, entries: turns.entries.map((item) => item.tokenId === token.id && item.hp ? { ...item, hp: { ...item.hp, current: Math.max(0, total) } } : item) } });
    return Math.max(0, total);
  }
  if (!entry) {
    const response = await fetch(`${sheetsUrl}?room=${encodeURIComponent(room)}`);
    if (!response.ok) throw new Error("Server non raggiungibile: PF non salvati");
    entry = ((await response.json()) as { sheets: CloudSheet[] }).sheets.find(isPc);
    if (!entry) throw new Error(role === "GM" ? "Il token non è nel turn order" : "Non puoi cambiare i PF di questo mostro");
  }
  const name = await OBR.player.getName();
  const put = async (current: CloudSheet) => {
    if (!canEditCloudSheet(current, { name, role })) throw new Error("Non hai il permesso di modificare questa scheda");
    const sheet = structuredClone(current.sheet as CharacterSheet);
    sheet.combat = setHitPointTotal(sheet.combat, total, effectiveSheet(sheet).combat.hp.max);
    const response = await fetch(sheetsUrl, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ room, rev: current.rev, entry: { kind: current.kind, sheet, acl: current.acl, updatedBy: name } }) });
    const body = await response.json().catch(() => null) as { entry?: CloudSheet | null } | null;
    return { status: response.status, entry: body?.entry ?? null };
  };
  let result = await put(entry);
  if (result.status === 409 && result.entry) result = await put(result.entry);
  if (result.status !== 200 || !result.entry) throw new Error(result.status === 409 ? "La scheda è appena cambiata: riprova" : "PF non salvati");
  const saved = result.entry;
  storage.cloudCache.set(room, storage.cloudCache.get(room).map((item) => item.sheet.id === saved.sheet.id ? saved : item));
  notifySheetsChanged();
  const { hp } = (saved.sheet as CharacterSheet).combat;
  return hp.current + hp.temp;
}
