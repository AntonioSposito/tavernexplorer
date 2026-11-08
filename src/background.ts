import OBR from "@owlbear-rodeo/sdk";
import { EXTENSION_ID, TURN_META_KEY } from "./constants";
import { setupTokenStatus } from "./tokenStatus";
import { setupTurnHighlight } from "./tokenHighlight";
import { setupCloudStateBridge } from "./cloudStateBridge";
import { setupRemotePanelOpening } from "./floatingPanels";
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
    embed: { url: "/?token-menu", height: 72 },
  });

  setupTokenStatus();
  setupRemotePanelOpening();
  setupTurnHighlight((metadata) => metadata[TURN_META_KEY] as TurnState | undefined);
  await setupCloudStateBridge();
});
