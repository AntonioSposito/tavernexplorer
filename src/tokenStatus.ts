import OBR, { buildLabel, buildPath, buildShape, buildText, Command, isLabel, type BoundingBox, type Item } from "@owlbear-rodeo/sdk";
import { TOKEN_STATS_META_KEY, TOKEN_STATUS_META_KEY } from "./constants";
import { armorClass, effectiveSheet } from "./effects";
import { getTurnState, onSheetsChanged, setTurnState } from "./obr";
import { storage } from "./storage";
import { linkedCharacterId } from "./tokenTurns";
import { fillTurnStats } from "./turnStats";
import type { CloudSheet, MonsterSheet, TurnEntry, TurnState } from "./types";

// Etichetta sopra il token: le condizioni. I PF sono nella barra sotto il token.
export function tokenStatusText(turn: TurnEntry | undefined, role: "GM" | "PLAYER"): string | null {
  const parts: string[] = [];
  const conditions = role === "GM" || !turn?.hidden ? turn?.conditions?.map((condition) => `${condition.name}${condition.remainingRounds ? ` ${condition.remainingRounds}r` : ""}`) ?? [] : [];
  if (conditions.length) parts.push(conditions.slice(0, 2).join(" · ") + (conditions.length > 2 ? ` +${conditions.length - 2}` : ""));
  return parts.length ? parts.join(" | ") : null;
}

// Barra della vita e CA sotto il token, disegnate in locale da ognuno: i PG a tutti, NPC e mostri solo al GM
// (il bestiario è solo nel browser del GM).
export interface TokenStats { hp?: { current: number; max: number; temp: number }; ac: number }
// NPC e mostri: PF e CA dalla loro voce del turn order, se il token ci è.
export function tokenStats(entry: CloudSheet | undefined, monster: MonsterSheet | undefined, turn?: TurnEntry): TokenStats | null {
  if (entry?.kind === "pc") {
    const view = effectiveSheet(entry.sheet);
    return { hp: view.combat.hp, ac: armorClass(entry.sheet, view.abilities.dexterity?.mod ?? 0).total };
  }
  const statblock = entry?.kind === "npc" ? entry.sheet : monster;
  if (!statblock) return null;
  return { ...turn?.hp ? { hp: { ...turn.hp, temp: 0 } } : {}, ac: turn?.ac ?? statblock.ac };
}

// Colori chiari come le barre di Roll20; il testo è bianco con il bordo scuro, leggibile su ogni colore.
const hpColor = (ratio: number) => ratio > 0.5 ? "#7bd88f" : ratio > 0.25 ? "#f6c560" : "#f08080";

// Barra in stile Roll20: larga quanto il token, poco sopra il suo bordo basso, con "PF/massimi" dentro.
// Tocca appena il nome che Owlbear disegna sotto il token. La CA è uno scudo in alto a destra.
// La barra è larga quanto il token; altezza, scritte e scudo hanno misure fisse in caselle della griglia
// (cell = DPI della scena), così un token grande non li ingrandisce.
// sig: cosa è disegnato; se cambia (PF, CA, dimensione del token o della griglia) gli elementi si ricreano.
function statsItems(tokenId: string, bounds: BoundingBox, stats: TokenStats, sig: string, cell: number): Item[] {
  const width = bounds.width * 0.9;
  const height = cell * 0.16;
  const x = bounds.center.x - width / 2;
  const y = bounds.max.y - height - cell * 0.07;
  const metadata = { [TOKEN_STATS_META_KEY]: { tokenId, sig } };
  // zIndex esplicito: creati insieme, sfondo, riempimento e testo non hanno un ordine garantito.
  const z = Date.now();
  const bar = (offset: number, size: number, color: string, level: number, opacity = 1) => buildShape().shapeType("RECTANGLE").width(size).height(height)
    .position({ x: x + offset, y }).fillColor(color).fillOpacity(opacity).strokeWidth(0).strokeOpacity(0).zIndex(z + level)
    .attachedTo(tokenId).layer("ATTACHMENT").locked(true).disableHit(true).metadata(metadata).build();
  const items: Item[] = [];
  if (stats.hp && stats.hp.max > 0) {
    const { current, max, temp } = stats.hp;
    const ratio = Math.min(1, Math.max(0, current / max));
    const extra = Math.min(1 - ratio, temp / max);
    items.push(bar(0, width, "#1f2937", 0, 0.75));
    if (ratio > 0) items.push(bar(0, width * ratio, hpColor(ratio), 1, 0.95));
    if (extra > 0) items.push(bar(width * ratio, width * extra, "#7dd3fc", 1, 0.95));
    items.push(buildText().textType("PLAIN").plainText(`${current}/${max}${temp > 0 ? ` +${temp}` : ""}`).width(width).height(height)
      .position({ x, y }).textAlign("CENTER").textAlignVertical("MIDDLE").padding(0).fontSize(height * 0.75).fontWeight(700).fillColor("#ffffff").strokeColor("#111827").strokeWidth(Math.max(1, height * 0.08))
      .zIndex(z + 2).attachedTo(tokenId).layer("ATTACHMENT").locked(true).disableHit(true).metadata(metadata).build());
  }
  // Scudo: lati dritti in alto, punta in basso; i comandi sono relativi alla posizione dello scudo.
  const size = cell * 0.32;
  // Centrato sul bordo del token in alto a destra (45°): resta attaccato anche ai token grandi e rotondi.
  const edge = (bounds.width / 2) * Math.SQRT1_2;
  const shield = { x: bounds.center.x + edge - size / 2, y: bounds.center.y - edge - size / 2 };
  items.push(buildPath().commands([
    [Command.MOVE, 0, size * 0.12], [Command.LINE, size * 0.5, 0], [Command.LINE, size, size * 0.12], [Command.LINE, size, size * 0.5],
    [Command.QUAD, size, size * 0.85, size * 0.5, size * 1.1], [Command.QUAD, 0, size * 0.85, 0, size * 0.5], [Command.CLOSE],
  ]).position(shield).fillColor("#334155").fillOpacity(0.95).strokeColor("#0f172a").strokeWidth(Math.max(1, size * 0.06)).zIndex(z + 3)
    .attachedTo(tokenId).layer("ATTACHMENT").locked(true).disableHit(true).metadata(metadata).build());
  items.push(buildText().textType("PLAIN").plainText(String(stats.ac)).width(size).height(size).position(shield)
    .textAlign("CENTER").textAlignVertical("MIDDLE").padding(0).fontSize(size * 0.5).fontWeight(700).fillColor("#ffffff")
    .zIndex(z + 4).attachedTo(tokenId).layer("ATTACHMENT").locked(true).disableHit(true).metadata(metadata).build());
  return items;
}

// Tutte le schede della stanza, lette dal server: la cache del giocatore ha solo quelle che può vedere.
let roomSheets: CloudSheet[] = [];
async function loadRoomSheets(): Promise<void> {
  const response = await fetch(`/api/sheets?room=${encodeURIComponent(OBR.room.id)}`);
  if (response.ok) roomSheets = ((await response.json()) as { sheets: CloudSheet[] }).sheets.filter((entry) => !entry.deletedAt);
}

async function syncTokenStats(tokens: Item[], role: "GM" | "PLAYER", turns: TurnState): Promise<void> {
  const entries = new Map(roomSheets.filter((entry) => entry.kind === "pc" || role === "GM").map((entry) => [entry.sheet.id, entry]));
  const monsters = role === "GM" ? new Map(storage.monsters.get().map((monster) => [monster.id, monster])) : new Map<string, MonsterSheet>();
  // Il GM carica nel turn order PF e CA dei token collegati a mostri e NPC; la scrittura riavvia la sincronizzazione.
  if (role === "GM") {
    const statblocks = new Map<string, MonsterSheet>([...monsters, ...roomSheets.flatMap((entry) => entry.kind === "npc" ? [[entry.sheet.id, entry.sheet] as const] : [])]);
    const filled = fillTurnStats(turns, tokens, statblocks);
    if (filled) { await setTurnState(filled); return; }
  }
  const turnsByToken = new Map(turns.entries.filter((entry) => entry.tokenId).map((entry) => [entry.tokenId, entry]));
  const wanted = turns.hideTokenStats ? [] : tokens.flatMap((token) => {
    const characterId = linkedCharacterId(token);
    const stats = characterId ? tokenStats(entries.get(characterId), monsters.get(characterId), turnsByToken.get(token.id)) : null;
    return stats && (role === "GM" || token.visible) ? [{ token, stats }] : [];
  });
  const cell = await OBR.scene.grid.getDpi();
  const desired = new Map(await Promise.all(wanted.map(async ({ token, stats }) => {
    const bounds = await OBR.scene.items.getItemBounds([token.id]);
    const sig = JSON.stringify([stats, Math.round(bounds.width), Math.round(bounds.height), cell]);
    return [token.id, { bounds, stats, sig }] as const;
  })));
  // Un token resta com'è solo se tutti i suoi elementi hanno la firma voluta, altrimenti si ricrea.
  const drawn = new Map<string, Item[]>();
  for (const item of await OBR.scene.local.getItems((entry) => !!entry.metadata[TOKEN_STATS_META_KEY])) {
    const { tokenId } = item.metadata[TOKEN_STATS_META_KEY] as { tokenId: string };
    drawn.set(tokenId, [...drawn.get(tokenId) ?? [], item]);
  }
  const kept = new Set<string>();
  const remove: string[] = [];
  for (const [tokenId, items] of drawn) {
    if (items.every((item) => (item.metadata[TOKEN_STATS_META_KEY] as { sig: string }).sig === desired.get(tokenId)?.sig)) kept.add(tokenId);
    else remove.push(...items.map((item) => item.id));
  }
  if (remove.length) await OBR.scene.local.deleteItems(remove);
  const additions = [...desired].filter(([tokenId]) => !kept.has(tokenId)).flatMap(([tokenId, target]) => statsItems(tokenId, target.bounds, target.stats, target.sig, cell));
  if (additions.length) await OBR.scene.local.addItems(additions);
}

async function syncTokenStatus(): Promise<void> {
  if (!(await OBR.scene.isReady())) return;
  const [tokens, labels, turns, role] = await Promise.all([
    OBR.scene.items.getItems((item) => item.layer === "CHARACTER"),
    OBR.scene.local.getItems((item) => typeof item.metadata[TOKEN_STATUS_META_KEY] === "string"),
    getTurnState(), OBR.player.getRole(),
  ]);
  await syncTokenStats(tokens, role, turns);
  const turnsByToken = new Map(turns.entries.filter((entry) => entry.tokenId).map((entry) => [entry.tokenId, entry]));
  const desired = new Map<string, { text: string; position: { x: number; y: number } }>();
  for (const token of tokens) {
    if (role !== "GM" && !token.visible) continue;
    const text = tokenStatusText(turnsByToken.get(token.id), role);
    if (text) desired.set(token.id, { text, position: { x: token.position.x, y: token.position.y - 48 } });
  }

  const existing = new Set<string>();
  const remove: string[] = [];
  const change = new Map<string, string>();
  for (const label of labels) {
    const tokenId = label.metadata[TOKEN_STATUS_META_KEY];
    if (typeof tokenId !== "string") continue;
    const target = desired.get(tokenId);
    if (!target || existing.has(tokenId) || !isLabel(label)) { remove.push(label.id); continue; }
    existing.add(tokenId);
    if (label.text.plainText !== target.text) change.set(label.id, target.text);
  }
  if (remove.length) await OBR.scene.local.deleteItems(remove);
  if (change.size) await OBR.scene.local.updateItems([...change.keys()], (items) => {
    for (const item of items) if (isLabel(item)) item.text.plainText = change.get(item.id) ?? item.text.plainText;
  });
  const additions = [...desired].filter(([tokenId]) => !existing.has(tokenId)).map(([tokenId, target]) =>
    buildLabel().plainText(target.text).attachedTo(tokenId).position(target.position)
      .fontSize(14).fontWeight(700).fillColor("#f8fafc").backgroundColor("#18181b")
      .backgroundOpacity(0.9).cornerRadius(8).padding(5).locked(true).disableHit(true)
      .metadata({ [TOKEN_STATUS_META_KEY]: tokenId }).build(),
  );
  if (additions.length) await OBR.scene.local.addItems(additions);
}

export function setupTokenStatus(): void {
  let running = false;
  let pending = false;
  const schedule = () => {
    pending = true;
    if (running) return;
    running = true;
    void (async () => {
      while (pending) {
        pending = false;
        try { await syncTokenStatus(); } catch { /* La scena può chiudersi durante un aggiornamento. */ }
      }
      running = false;
    })();
  };
  OBR.room.onMetadataChange(schedule);
  // Le schede arrivano dalla cache cloud scritta dall'app: ogni aggiornamento è un evento storage.
  window.addEventListener("storage", schedule);
  OBR.scene.items.onChange(schedule);
  OBR.scene.onReadyChange(schedule);
  // Ogni salvataggio di una scheda avvisa tutti: si rileggono PF e CA.
  const reload = () => { void loadRoomSheets().then(schedule, () => undefined); };
  onSheetsChanged(reload);
  reload();
  schedule();
}
