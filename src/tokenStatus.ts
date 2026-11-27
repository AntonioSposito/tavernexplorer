import OBR, { buildPath, buildShape, buildText, Command, type BoundingBox, type Item } from "@owlbear-rodeo/sdk";
import { TOKEN_STATS_META_KEY, TOKEN_STATUS_META_KEY } from "./constants";
import { effectEmoji, exhaustionLevel } from "./conditions";
import { armorClass, effectiveSheet, effectsTotal, isEffectOn } from "./effects";
import { canViewCloudSheet } from "./cloudSheets";
import { getTurnState, onSheetsChanged, setTurnState } from "./obr";
import { storage } from "./storage";
import { linkedCharacterId } from "./tokenTurns";
import { fillTurnStats } from "./turnStats";
import type { CharacterEffect, CharacterSheet, CloudSheet, MonsterSheet, TurnEntry, TurnState } from "./types";

// Icone degli effetti attivi in alto a sinistra del token: della scheda per i PG (anche fuori dai turni), del token per gli altri.
// Le condizioni hanno un'emoji, gli altri effetti le prime due lettere; oltre MAX_ICONS l'ultima icona è "+N".
// rounds: i turni rimasti, mostrati in un badge sull'icona.
const MAX_ICONS = 4;
const effectIcon = (name: string) => effectEmoji(name) ?? name.trim().slice(0, 2);
// successes/failures: tiri contro la morte di un PG a 0 PF, in due badge (verde e rosso).
export interface ConditionIcon { icon: string; rounds?: number; successes?: number; failures?: number; level?: number }
// seesTurnEffects: effetti del token (mostri e NPC), per il GM e per chi può vedere o modificare il mostro.
export function tokenConditionIcons(turn: TurnEntry | undefined, role: "GM" | "PLAYER", sheetEffects?: CharacterEffect[], deathSaves?: { successes: number; failures: number }, seesTurnEffects = role === "GM"): ConditionIcon[] {
  if (role !== "GM" && turn?.hidden) return [];
  const icons = [
    // Per primo, accanto al token: non finisce mai nel "+N".
    ...deathSaves ? [{ icon: "💀", successes: deathSaves.successes, failures: deathSaves.failures }] : [],
    ...(sheetEffects ?? (seesTurnEffects ? turn?.conditions : undefined) ?? []).filter(isEffectOn)
      .map((effect): ConditionIcon => ({ icon: effectIcon(effect.name), ...effect.remainingRounds ? { rounds: effect.remainingRounds } : {}, ...exhaustionLevel(effect.name) ? { level: exhaustionLevel(effect.name) } : {} })),
  ];
  return icons.length > MAX_ICONS ? [...icons.slice(0, MAX_ICONS - 1), { icon: `+${icons.length - MAX_ICONS + 1}` }] : icons;
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
  return { ...turn?.hp ? { hp: { ...turn.hp, temp: 0 } } : {}, ac: (turn?.ac ?? statblock.ac) + effectsTotal(turn?.conditions, "ac") };
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

// Icone delle condizioni: grandi come lo scudo della CA (misura fissa in caselle), la prima nel punto in alto a sinistra
// speculare allo scudo, le altre in fila verso sinistra con uno spazio tra l'una e l'altra.
// I turni rimasti sono un badge tondo in basso a destra dell'icona, che non arriva all'icona accanto.
function conditionItems(tokenId: string, bounds: BoundingBox, icons: ConditionIcon[], sig: string, cell: number): Item[] {
  const size = cell * 0.32;
  const gap = cell * 0.04;
  const edge = (bounds.width / 2) * Math.SQRT1_2;
  const metadata = { [TOKEN_STATUS_META_KEY]: { tokenId, sig } };
  const z = Date.now();
  const badge = size * 0.5;
  return icons.flatMap(({ icon, rounds, successes, failures, level }, index) => {
    const center = { x: bounds.center.x - edge - index * (size + gap), y: bounds.center.y - edge };
    // Badge tondo sul bordo destro dell'icona: dy +1 in basso, -1 in alto.
    const badgeItems = (value: number, color: string, dy: 1 | -1) => [
      buildShape().shapeType("CIRCLE").width(badge).height(badge).position({ x: center.x + size * 0.35, y: center.y + dy * size * 0.35 })
        .fillColor(color).fillOpacity(1).strokeColor("#0f172a").strokeWidth(Math.max(1, badge * 0.08)).zIndex(z + 2)
        .attachedTo(tokenId).layer("ATTACHMENT").locked(true).disableHit(true).metadata(metadata).build(),
      buildText().textType("PLAIN").plainText(String(value)).width(badge).height(badge)
        .position({ x: center.x + size * 0.35 - badge / 2, y: center.y + dy * size * 0.35 - badge / 2 })
        .textAlign("CENTER").textAlignVertical("MIDDLE").padding(0).fontSize(badge * 0.65).fontWeight(700).fillColor("#0f172a")
        .zIndex(z + 3).attachedTo(tokenId).layer("ATTACHMENT").locked(true).disableHit(true).metadata(metadata).build(),
    ];
    return [
      buildShape().shapeType("CIRCLE").width(size).height(size).position(center).fillColor("#334155").fillOpacity(0.95)
        .strokeColor("#0f172a").strokeWidth(Math.max(1, size * 0.06)).zIndex(z)
        .attachedTo(tokenId).layer("ATTACHMENT").locked(true).disableHit(true).metadata(metadata).build(),
      buildText().textType("PLAIN").plainText(icon).width(size).height(size).position({ x: center.x - size / 2, y: center.y - size / 2 })
        .textAlign("CENTER").textAlignVertical("MIDDLE").padding(0).fontSize(size * 0.5).fontWeight(700).fillColor("#ffffff")
        .zIndex(z + 1).attachedTo(tokenId).layer("ATTACHMENT").locked(true).disableHit(true).metadata(metadata).build(),
      ...rounds ? badgeItems(rounds, "#f59e0b", 1) : [],
      ...successes !== undefined ? badgeItems(successes, "#22c55e", 1) : [],
      ...failures !== undefined ? badgeItems(failures, "#ef4444", -1) : [],
      ...level ? badgeItems(level, "#ef4444", -1) : [],
    ];
  });
}

// Elementi locali attaccati ai token, marcati con key → { tokenId, sig }: un token resta com'è solo se tutti i suoi
// elementi hanno la firma voluta, altrimenti si ricrea.
async function syncAttached(key: string, desired: Map<string, { sig: string; build: () => Item[] }>): Promise<void> {
  const drawn = new Map<string, Item[]>();
  for (const item of await OBR.scene.local.getItems((entry) => !!entry.metadata[key])) {
    const { tokenId } = item.metadata[key] as { tokenId: string };
    drawn.set(tokenId, [...drawn.get(tokenId) ?? [], item]);
  }
  const kept = new Set<string>();
  const remove: string[] = [];
  for (const [tokenId, items] of drawn) {
    if (items.every((item) => (item.metadata[key] as { sig: string }).sig === desired.get(tokenId)?.sig)) kept.add(tokenId);
    else remove.push(...items.map((item) => item.id));
  }
  if (remove.length) await OBR.scene.local.deleteItems(remove);
  const additions = [...desired].filter(([tokenId]) => !kept.has(tokenId)).flatMap(([, target]) => target.build());
  if (additions.length) await OBR.scene.local.addItems(additions);
}

// Tutte le schede della stanza, lette dal server: la cache del giocatore ha solo quelle che può vedere.
let roomSheets: CloudSheet[] = [];
async function loadRoomSheets(): Promise<void> {
  const response = await fetch(`/api/sheets?room=${encodeURIComponent(OBR.room.id)}`);
  if (response.ok) roomSheets = ((await response.json()) as { sheets: CloudSheet[] }).sheets.filter((entry) => !entry.deletedAt);
}

type BoundsOf = (tokenId: string) => ReturnType<typeof OBR.scene.items.getItemBounds>;
// getItemBounds su più token dà un solo rettangolo, quindi serve una lettura per token: almeno una sola per giro, per CA/PF e icone.
function cachedBounds(): BoundsOf {
  const cache = new Map<string, ReturnType<BoundsOf>>();
  return (tokenId) => {
    const known = cache.get(tokenId) ?? OBR.scene.items.getItemBounds([tokenId]);
    cache.set(tokenId, known);
    return known;
  };
}

// NPC e mostri condivisi: PF e CA anche ai giocatori che possono vederli o modificarli.
async function syncTokenStats(tokens: Item[], role: "GM" | "PLAYER", name: string, turns: TurnState, boundsOf: BoundsOf, cell: number): Promise<void> {
  const entries = new Map(roomSheets.filter((entry) => entry.kind === "pc" || canViewCloudSheet(entry, { name, role })).map((entry) => [entry.sheet.id, entry]));
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
  const desired = new Map(await Promise.all(wanted.map(async ({ token, stats }) => {
    const bounds = await boundsOf(token.id);
    const sig = JSON.stringify([stats, Math.round(bounds.width), Math.round(bounds.height), cell]);
    return [token.id, { sig, build: () => statsItems(token.id, bounds, stats, sig, cell) }] as const;
  })));
  await syncAttached(TOKEN_STATS_META_KEY, desired);
}

async function syncTokenStatus(): Promise<void> {
  if (!(await OBR.scene.isReady())) return;
  const [tokens, turns, role, name] = await Promise.all([
    OBR.scene.items.getItems((item) => item.layer === "CHARACTER"),
    getTurnState(), OBR.player.getRole(), OBR.player.getName(),
  ]);
  const boundsOf = cachedBounds();
  const cell = await OBR.scene.grid.getDpi();
  await syncTokenStats(tokens, role, name, turns, boundsOf, cell);
  const turnsByToken = new Map(turns.entries.filter((entry) => entry.tokenId).map((entry) => [entry.tokenId, entry]));
  const wanted = tokens.flatMap((token) => {
    if (role !== "GM" && !token.visible) return [];
    const sheet = roomSheets.find((entry) => entry.kind === "pc" && entry.sheet.id === linkedCharacterId(token))?.sheet as CharacterSheet | undefined;
    const npc = roomSheets.find((entry) => entry.kind === "npc" && entry.sheet.id === linkedCharacterId(token));
    const icons = tokenConditionIcons(turnsByToken.get(token.id), role, sheet?.effects, sheet?.combat.hp.current === 0 ? sheet.combat.deathSaves : undefined, role === "GM" || (!!npc && canViewCloudSheet(npc, { name, role })));
    return icons.length ? [{ token, icons }] : [];
  });
  const desired = new Map(await Promise.all(wanted.map(async ({ token, icons }) => {
    const bounds = await boundsOf(token.id);
    const sig = JSON.stringify([icons, Math.round(bounds.width), Math.round(bounds.height), cell]);
    return [token.id, { sig, build: () => conditionItems(token.id, bounds, icons, sig, cell) }] as const;
  })));
  await syncAttached(TOKEN_STATUS_META_KEY, desired);
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
