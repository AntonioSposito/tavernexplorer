import OBR from "@owlbear-rodeo/sdk";
import { EXTENSION_ID, TOKEN_META_KEY, TURN_META_KEY } from "./constants";
import { setupTokenStatus } from "./tokenStatus";
import { setupTurnHighlight } from "./tokenHighlight";
import { setupCloudStateBridge } from "./cloudStateBridge";
import { setupRemotePanelOpening } from "./floatingPanels";
import { setupTokenHitPoints } from "./tokenMenuActions";
import type { TurnState } from "./types";

OBR.onReady(async () => {
  // Owlbear non ha sezioni nel menu: un'icona TavernExplorer apre la tendina con le nostre voci (src/TokenMenu.tsx).
  await OBR.contextMenu.create({
    id: `${EXTENSION_ID}/token-menu`,
    icons: [{
      icon: "/icon.svg",
      label: "TavernExplorer",
      filter: { every: [{ key: "layer", value: "CHARACTER" }] },
    }],
    // 7 voci da 36px (Apri scheda, 5 sezioni, iniziativa): con una voce in più o in meno va cambiata.
    embed: { url: "/?token-menu", height: 252 },
  });
  // I PF si cambiano spesso: voce propria nel menu principale, solo su un token collegato a una scheda.
  await OBR.contextMenu.create({
    id: `${EXTENSION_ID}/token-hp`,
    icons: [{
      icon: "/hp.svg",
      label: "Punti ferita",
      filter: { max: 1, every: [{ key: "layer", value: "CHARACTER" }, { key: ["metadata", TOKEN_META_KEY, "characterId"], operator: "!=", value: undefined }] },
    }],
    embed: { url: "/?token-hp", height: 44 },
  });

  setupTokenStatus();
  setupTokenHitPoints();
  setupRemotePanelOpening();
  setupTurnHighlight((metadata) => metadata[TURN_META_KEY] as TurnState | undefined);
  await setupCloudStateBridge();
});
