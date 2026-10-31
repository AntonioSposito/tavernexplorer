import OBR, { buildLabel, isLabel } from "@owlbear-rodeo/sdk";
import { TOKEN_STATUS_META_KEY } from "./constants";
import { effectiveSheet } from "./effects";
import { getTurnState } from "./obr";
import { storage } from "./storage";
import { linkedCharacterId } from "./tokenTurns";
import type { CharacterSheet, TurnEntry } from "./types";

export function tokenStatusText(sheet: CharacterSheet | undefined, turn: TurnEntry | undefined, role: "GM" | "PLAYER"): string | null {
  const parts: string[] = [];
  if (sheet) {
    const hp = effectiveSheet(sheet).combat.hp;
    if (hp.current < hp.max || hp.temp > 0) parts.push(`PF ${hp.current}/${hp.max}${hp.temp > 0 ? ` +${hp.temp}` : ""}`);
  }
  const conditions = role === "GM" || !turn?.hidden ? turn?.conditions?.map((condition) => `${condition.name}${condition.remainingRounds ? ` ${condition.remainingRounds}r` : ""}`) ?? [] : [];
  if (conditions.length) parts.push(conditions.slice(0, 2).join(" · ") + (conditions.length > 2 ? ` +${conditions.length - 2}` : ""));
  return parts.length ? parts.join(" | ") : null;
}

async function syncTokenStatus(): Promise<void> {
  if (!(await OBR.scene.isReady())) return;
  const [tokens, labels, sheets, turns, role] = await Promise.all([
    OBR.scene.items.getItems((item) => item.layer === "CHARACTER"),
    OBR.scene.local.getItems((item) => typeof item.metadata[TOKEN_STATUS_META_KEY] === "string"),
    storage.characters.get(), getTurnState(), OBR.player.getRole(),
  ]);
  const sheetsById = new Map(sheets.map((sheet) => [sheet.id, sheet]));
  const turnsByToken = new Map(turns.entries.filter((entry) => entry.tokenId).map((entry) => [entry.tokenId, entry]));
  const desired = new Map<string, { text: string; position: { x: number; y: number } }>();
  for (const token of tokens) {
    if (role !== "GM" && !token.visible) continue;
    const characterId = linkedCharacterId(token);
    const text = tokenStatusText(characterId ? sheetsById.get(characterId) : undefined, turnsByToken.get(token.id), role);
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
  // Le schede ora sono solo locali: le modifiche arrivano dall'app come evento storage.
  window.addEventListener("storage", schedule);
  OBR.scene.items.onChange(schedule);
  OBR.scene.onReadyChange(schedule);
  schedule();
}
