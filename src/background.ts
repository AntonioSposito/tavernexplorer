import OBR from "@owlbear-rodeo/sdk";
import { EXTENSION_ID, PERMISSIONS_META_KEY, TURN_META_KEY } from "./constants";
import { roll } from "./dice";
import { storage } from "./storage";
import { createTokenTurn } from "./tokenTurns";
import { setupTokenStatus } from "./tokenStatus";
import { setupTurnHighlight } from "./tokenHighlight";
import { setupRemotePanelOpening } from "./floatingPanels";
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
    onClick: async (context, elementId) => {
      if (context.items.length !== 1) return;
      const token = context.items[0];
      await OBR.popover.open({
        id: `${EXTENSION_ID}/sheet-popover`, url: `/?token=${encodeURIComponent(token.id)}`,
        width: 480, height: 720, anchorElementId: elementId,
      });
    },
  });

  await OBR.contextMenu.create({
    id: `${EXTENSION_ID}/initiative-menu`,
    icons: [{
      icon: "/initiative.svg", label: "Aggiungi/rimuovi dal turn order",
      filter: { every: [{ key: "layer", value: "CHARACTER" }] },
    }],
    onClick: async (context) => {
      const roomMeta = await OBR.room.getMetadata();
      const permissions = roomMeta[PERMISSIONS_META_KEY] as { playersManageTurns?: boolean } | undefined;
      if (await OBR.player.getRole() !== "GM" && !permissions?.playersManageTurns) {
        await OBR.notification.show("Il GM gestisce l'ordine dei turni", "WARNING");
        return;
      }
      const current = (roomMeta[TURN_META_KEY] as unknown as TurnState | undefined) ?? { round: 1, activeIndex: 0, entries: [] };
      const ids = new Set(context.items.map((item) => item.id));
      const alreadyPresent = context.items.every((item) => current.entries.some((entry) => entry.tokenId === item.id));
      const entries = alreadyPresent ? current.entries.filter((entry) => !ids.has(entry.tokenId ?? "")) : [...current.entries];
      if (!alreadyPresent) {
        const linkedSheets = storage.characters.get();
        for (const item of context.items) {
          if (entries.some((entry) => entry.tokenId === item.id)) continue;
          const entry = createTokenTurn(item, linkedSheets,
            (bonus) => roll(`1d20${bonus >= 0 ? "+" : ""}${bonus}`, "normal").total,
            (name) => { const value = window.prompt(`Iniziativa per ${name}`, "0"); return value === null ? null : Number(value) || 0; },
          );
          if (entry) entries.push(entry);
        }
      }
      try { await writeRoomMetadata({ [TURN_META_KEY]: replaceTurnEntries(current, entries) }); }
      catch (error) { await OBR.notification.show(error instanceof Error ? error.message : "Ordine dei turni non salvato", "ERROR"); }
    },
  });

  setupTokenStatus();
  setupRemotePanelOpening();
  setupTurnHighlight((metadata) => metadata[TURN_META_KEY] as TurnState | undefined);
});
