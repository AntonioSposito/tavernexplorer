import OBR from "@owlbear-rodeo/sdk";
import { EXTENSION_ID } from "./constants";
import type { AppTab } from "./types";

const OPEN_PANEL_CHANNEL = `${EXTENSION_ID}/open-panel`;

export function getFloatingPanelPosition(view: AppTab): { left: number; top: number } {
  try { const saved = localStorage.getItem(`${EXTENSION_ID}/${view}-position`); if (saved) return JSON.parse(saved) as { left: number; top: number }; } catch { /* posizione di default */ }
  return { left: 24, top: 100 };
}

export type PanelSize = { width: number; height: number };

export function getFloatingPanelSize(view: AppTab): PanelSize {
  try { const saved = localStorage.getItem(`${EXTENSION_ID}/${view}-size`); if (saved) return JSON.parse(saved) as PanelSize; } catch { /* dimensioni di default */ }
  return view === "messages" ? { width: 400, height: 620 } : view === "turns" ? { width: 340, height: 500 } : { width: 480, height: 640 };
}

export async function resizeFloatingPanel(view: AppTab, size: PanelSize, persist = false): Promise<void> {
  if (!OBR.isAvailable) return;
  if (persist) try { localStorage.setItem(`${EXTENSION_ID}/${view}-size`, JSON.stringify(size)); } catch { /* storage non disponibile */ }
  await Promise.all([OBR.popover.setWidth(`${EXTENSION_ID}/${view}-panel`, size.width), OBR.popover.setHeight(`${EXTENSION_ID}/${view}-panel`, size.height)]);
}

// L'URL resta fisso: riaprire con la stessa pagina sposta il popover senza ricaricarlo.
// token: aperto da "Apri scheda" sul token, la finestra mostra la scheda collegata (chi la sposta lo ripassa).
export async function openFloatingPanel(view: AppTab, position?: { left: number; top: number }, token?: string): Promise<void> {
  if (!OBR.isAvailable) return;
  const anchorPosition = position ?? getFloatingPanelPosition(view);
  try { localStorage.setItem(`${EXTENSION_ID}/${view}-position`, JSON.stringify(anchorPosition)); } catch { /* storage non disponibile */ }
  await OBR.popover.open({ id: `${EXTENSION_ID}/${view}-panel`, url: `/?view=${view}${token ? `&token=${encodeURIComponent(token)}` : ""}`, ...getFloatingPanelSize(view), anchorReference: "POSITION", anchorPosition, anchorOrigin: { horizontal: "LEFT", vertical: "TOP" }, transformOrigin: { horizontal: "LEFT", vertical: "TOP" }, disableClickAway: true });
}

// Il GM chiede a tutti gli altri partecipanti di aprire un pannello (es. il turn order a inizio combattimento).
export async function openPanelForPlayers(view: AppTab): Promise<void> {
  if (!OBR.isAvailable) return;
  if (await OBR.player.getRole() !== "GM") throw new Error("Solo il GM può aprire i pannelli dei giocatori");
  await OBR.broadcast.sendMessage(OPEN_PANEL_CHANNEL, { view }, { destination: "REMOTE" });
}

// Nel background: apre il pannello richiesto solo se il mittente è davvero il GM.
export function setupRemotePanelOpening(): () => void {
  return OBR.broadcast.onMessage(OPEN_PANEL_CHANNEL, (event) => {
    const view = (event.data as { view?: AppTab } | undefined)?.view;
    if (!view) return;
    void OBR.party.getPlayers().then((players) => {
      if (players.find((player) => player.connectionId === event.connectionId)?.role === "GM") return openFloatingPanel(view);
    }).catch(() => undefined);
  });
}
