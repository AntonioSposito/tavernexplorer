import OBR, { type Item } from "@owlbear-rodeo/sdk";
import { PERMISSIONS_META_KEY, TURN_META_KEY } from "./constants";
import { storage } from "./storage";
import { announceInitiative, INITIATIVE_PICKER_ID, monsterTokenTurn, rollSheetInitiative, type InitiativeRolled } from "./tokenInitiative";
import { createTokenTurn, linkedCharacterId } from "./tokenTurns";
import { openFloatingPanel } from "./floatingPanels";
import { replaceTurnEntries } from "./turns";
import { writeRoomMetadata } from "./roomMetadata";
import type { TurnState } from "./types";

// Voci della tendina TavernExplorer nel menu del token.

export async function openTokenSheet(token: Item): Promise<void> {
  // Come "Apri … in finestra": pannello spostabile e chiudibile. Mostro del bestiario (solo nel browser del GM)
  // nel Bestiario, token senza scheda nella Libreria.
  const characterId = linkedCharacterId(token);
  const view = !characterId ? "library" : storage.monsters.get().some((monster) => monster.id === characterId) ? "compendium" : "sheet";
  await openFloatingPanel(view, undefined, token.id);
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
