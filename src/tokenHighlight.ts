import OBR, { buildShape } from "@owlbear-rodeo/sdk";
import { EXTENSION_ID } from "./constants";
import type { TurnState } from "./types";

const HIGHLIGHT_META_KEY = `${EXTENSION_ID}/highlight`;

// Cerchio locale che svanisce attorno al token: ogni client lo disegna per sé, la scena condivisa non cambia.
export async function highlightToken(tokenId: string, options: { hiddenFromPlayers?: boolean; hiddenEntry?: boolean } = {}): Promise<void> {
  if (!OBR.isAvailable || !(await OBR.scene.isReady())) throw new Error("Apri una scena Owlbear per trovare il token");
  const [token] = await OBR.scene.items.getItems([tokenId]);
  if (!token) throw new Error("Il token non è più nella scena aperta");
  if (options.hiddenFromPlayers && (!token.visible || options.hiddenEntry) && await OBR.player.getRole() !== "GM") return;
  const stale = await OBR.scene.local.getItems((item) => item.metadata[HIGHLIGHT_META_KEY] === true);
  if (stale.length) await OBR.scene.local.deleteItems(stale.map((item) => item.id));
  const bounds = await OBR.scene.items.getItemBounds([tokenId]);
  const size = Math.max(bounds.width, bounds.height) * 1.3;
  const ring = buildShape().shapeType("CIRCLE").width(size).height(size).position(bounds.center)
    .strokeColor("#f59e0b").strokeWidth(Math.max(4, size * 0.05)).strokeOpacity(1).fillOpacity(0)
    .layer("ATTACHMENT").locked(true).disableHit(true).metadata({ [HIGHLIGHT_META_KEY]: true }).build();
  await OBR.scene.local.addItems([ring]);
  // Durata fissa sull'orologio: se Owlbear è lento si salta un aggiornamento invece di allungare l'animazione.
  // Timer e non requestAnimationFrame: il background gira in un iframe nascosto, dove i frame possono fermarsi.
  const duration = 900; const start = performance.now(); let pending = false;
  await new Promise<void>((resolve) => {
    const timer = setInterval(() => {
      const progress = Math.min(1, (performance.now() - start) / duration);
      if (progress >= 1) { clearInterval(timer); resolve(); return; }
      if (pending) return;
      pending = true; const scale = 1 + progress * 0.25; const opacity = 1 - progress * progress;
      void OBR.scene.local.updateItems([ring.id], (items) => { for (const item of items) { item.scale = { x: scale, y: scale }; if ("style" in item) (item.style as { strokeOpacity: number }).strokeOpacity = opacity; } }).catch(() => undefined).finally(() => { pending = false; });
    }, 16);
  });
  await OBR.scene.local.deleteItems([ring.id]);
}

// Porta il token al centro della vista di chi clicca, senza cambiare lo zoom, poi lo evidenzia.
export async function focusToken(tokenId: string): Promise<void> {
  if (!OBR.isAvailable || !(await OBR.scene.isReady())) throw new Error("Apri una scena Owlbear per trovare il token");
  const [token] = await OBR.scene.items.getItems([tokenId]);
  if (!token) throw new Error("Il token non è più nella scena aperta");
  const [{ center }, scale, width, height] = await Promise.all([OBR.scene.items.getItemBounds([tokenId]), OBR.viewport.getScale(), OBR.viewport.getWidth(), OBR.viewport.getHeight()]);
  await OBR.viewport.animateTo({ scale, position: { x: width / 2 - center.x * scale, y: height / 2 - center.y * scale } });
  await highlightToken(tokenId);
}

// Ogni partecipante evidenzia il token di turno quando il GM avanza o torna indietro.
export function setupTurnHighlight(readTurn: (metadata: Record<string, unknown>) => TurnState | undefined): () => void {
  let previous: string | null = null;
  const check = (metadata: Record<string, unknown>, announce: boolean) => {
    const state = readTurn(metadata); const entry = state?.entries[state.activeIndex];
    const key = state && entry ? `${state.round}:${entry.id}` : null;
    if (key === previous) return;
    previous = key;
    if (announce && entry?.tokenId) void highlightToken(entry.tokenId, { hiddenFromPlayers: true, hiddenEntry: entry.hidden }).catch(() => undefined);
  };
  void OBR.room.getMetadata().then((metadata) => check(metadata, false));
  return OBR.room.onMetadataChange((metadata) => check(metadata, true));
}
