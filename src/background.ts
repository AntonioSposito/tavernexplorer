import OBR from "@owlbear-rodeo/sdk";
import { EXTENSION_ID, PERMISSIONS_META_KEY, TURN_META_KEY } from "./constants";
import { storage } from "./storage";
import { announceInitiative, INITIATIVE_PICKER_ID, monsterTokenTurn, rollSheetInitiative, type InitiativeRolled } from "./tokenInitiative";
import { createTokenTurn, linkedCharacterId } from "./tokenTurns";
import { setupTokenStatus } from "./tokenStatus";
import { setupTurnHighlight } from "./tokenHighlight";
import { setupCloudStateBridge } from "./cloudStateBridge";
import { openFloatingPanel, setupRemotePanelOpening } from "./floatingPanels";
import { replaceTurnEntries } from "./turns";
import { writeRoomMetadata } from "./roomMetadata";
import type { TurnState } from "./types";

OBR.onReady(async () => {
  await OBR.contextMenu.create({
    id: `${EXTENSION_ID}/token-menu`,
    icons: [{
      icon: "/icon.svg",
      label: "TavernExplorer: apri scheda",
      filter: { every: [{ key: "layer", value: "CHARACTER" }] },
    }],
    onClick: async (context) => {
      if (context.items.length !== 1) return;
      const token = context.items[0];
      // Come "Apri … in finestra": pannello spostabile e chiudibile. Mostro del bestiario (solo nel browser del GM)
      // nel Bestiario, token senza scheda nella Libreria.
      const characterId = linkedCharacterId(token);
      const view = !characterId ? "library" : storage.monsters.get().some((monster) => monster.id === characterId) ? "compendium" : "sheet";
      await openFloatingPanel(view, undefined, token.id);
    },
  });

  await OBR.contextMenu.create({
    id: `${EXTENSION_ID}/initiative-menu`,
    icons: [{
      icon: "/initiative.svg", label: "Aggiungi/rimuovi dal turn order",
      filter: { every: [{ key: "layer", value: "CHARACTER" }] },
    }],
    onClick: async (context, elementId) => {
      const roomMeta = await OBR.room.getMetadata();
      const permissions = roomMeta[PERMISSIONS_META_KEY] as { playersManageTurns?: boolean } | undefined;
      const gm = await OBR.player.getRole() === "GM";
      if (!gm && !permissions?.playersManageTurns) {
        await OBR.notification.show("Il GM gestisce l'ordine dei turni", "WARNING");
        return;
      }
      const current = (roomMeta[TURN_META_KEY] as unknown as TurnState | undefined) ?? { round: 1, activeIndex: 0, entries: [] };
      const ids = new Set(context.items.map((item) => item.id));
      const alreadyPresent = context.items.every((item) => current.entries.some((entry) => entry.tokenId === item.id));
      const entries = alreadyPresent ? current.entries.filter((entry) => !ids.has(entry.tokenId ?? "")) : [...current.entries];
      const rolled: InitiativeRolled[] = [];
      // Token senza scheda: il GM sceglie la scheda (o il valore) nel popover; gli altri scrivono il valore.
      const unlinked: string[] = [];
      if (!alreadyPresent) {
        const linkedSheets = storage.cloudCache.characters(OBR.room.id);
        // Il bestiario è nel browser del GM: solo lui tira per i token collegati a un mostro.
        const monsters = gm ? storage.monsters.get() : [];
        const pick = gm && (linkedSheets.length > 0 || monsters.length > 0);
        for (const item of context.items) {
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
      if (unlinked.length) await OBR.popover.open({ id: INITIATIVE_PICKER_ID, url: `/?initiative=${unlinked.map(encodeURIComponent).join(",")}`, width: 380, height: 420, anchorElementId: elementId });
    },
  });

  setupTokenStatus();
  setupRemotePanelOpening();
  setupTurnHighlight((metadata) => metadata[TURN_META_KEY] as TurnState | undefined);
  await setupCloudStateBridge();
});
