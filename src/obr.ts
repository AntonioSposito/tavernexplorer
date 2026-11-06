import OBR, { buildImageUpload, buildSceneUpload, buildText, isImage } from "@owlbear-rodeo/sdk";
import { EXTENSION_ID, INVENTORY_META_KEY, MESSAGE_CHANNEL, SHEETS_CHANNEL, PERMISSIONS_META_KEY, ROLL_LABEL_META_KEY, TOKEN_META_KEY, TURN_META_KEY } from "./constants";
import type { ChatMessage, PermissionSettings, SharedInventoryItem, TurnEntry, TurnState } from "./types";
import { decryptGmMessage, encryptGmMessage, gmRecipients, isGmEnvelope } from "./privateMessages";
import { replaceTurnEntries } from "./turns";
import { linkedCharacterId } from "./tokenTurns";
import { writeRoomMetadata } from "./roomMetadata";

const emptyTurns = (): TurnState => ({ round: 1, activeIndex: 0, entries: [] });
export const DEFAULT_PERMISSIONS: PermissionSettings = { playersEditInventory: true, playersImportContent: false, playersManageTurns: false };

export async function getTurnState(): Promise<TurnState> {
  if (!OBR.isAvailable) return emptyTurns();
  const metadata = await OBR.room.getMetadata();
  const value = metadata[TURN_META_KEY];
  return value && typeof value === "object" ? (value as unknown as TurnState) : emptyTurns();
}

export async function setTurnState(state: TurnState): Promise<void> {
  if (!OBR.isAvailable) return;
  await writeRoomMetadata({ [TURN_META_KEY]: state });
}

export function onTurnStateChange(callback: (state: TurnState) => void): () => void {
  if (!OBR.isAvailable) return () => undefined;
  return OBR.room.onMetadataChange((metadata) => {
    const value = metadata[TURN_META_KEY];
    callback(value && typeof value === "object" ? (value as unknown as TurnState) : emptyTurns());
  });
}

// "ALL" quando invia lo script di sfondo: anche la finestra di TavernExplorer di questo browser deve riceverlo.
export async function broadcastMessage(message: ChatMessage, destination: "REMOTE" | "ALL" = "REMOTE"): Promise<void> {
  if (!OBR.isAvailable || message.visibility === "self") return;
  // Il GM che scrive "Solo GM" senza altri GM collegati: il messaggio resta solo nella sua chat.
  if (message.visibility === "gm" && await OBR.player.getRole() === "GM" && !(await gmRecipients()).length) return;
  await OBR.broadcast.sendMessage(MESSAGE_CHANNEL, message.visibility === "gm" ? await encryptGmMessage(message) : message, { destination });
}

// Avviso senza dati: chi lo riceve rilegge la libreria cloud. "ALL" include i pannelli flottanti di questo browser.
export function notifySheetsChanged(): void {
  if (OBR.isAvailable) void OBR.broadcast.sendMessage(SHEETS_CHANNEL, {}, { destination: "ALL" }).catch(() => undefined);
}

export function onSheetsChanged(callback: () => void): () => void {
  if (!OBR.isAvailable) return () => undefined;
  return OBR.broadcast.onMessage(SHEETS_CHANNEL, () => callback());
}

export function onBroadcastMessage(callback: (message: ChatMessage) => void): () => void {
  if (!OBR.isAvailable) return () => undefined;
  return OBR.broadcast.onMessage(MESSAGE_CHANNEL, (event) => {
    if (isGmEnvelope(event.data)) { void decryptGmMessage(event.data).then((message) => { if (message) callback(message); }); }
    else callback(event.data as ChatMessage);
  });
}

export async function getPlayerInfo(): Promise<{ id: string; name: string; role: "GM" | "PLAYER" }> {
  if (!OBR.isAvailable) return { id: "preview", name: "Giocatore", role: "GM" };
  return { id: await OBR.player.getId(), name: await OBR.player.getName(), role: await OBR.player.getRole() };
}

export async function setActiveCharacter(characterId: string | null): Promise<void> {
  if (!OBR.isAvailable) return;
  await OBR.player.setMetadata({ [`${EXTENSION_ID}/active-character`]: characterId });
}

export async function addSelectedTokenToTurns(characterId: string, characterName: string, initiative: number, initiativeBonus = 0): Promise<void> {
  if (!OBR.isAvailable) throw new Error("Apri TavernExplorer dentro Owlbear Rodeo");
  const selected = await OBR.player.getSelection();
  const tokenId = selected?.[0];
  if (!tokenId) throw new Error("Seleziona prima un token");
  await OBR.scene.items.updateItems([tokenId], (items) => {
    for (const item of items) item.metadata[TOKEN_META_KEY] = { characterId };
  });
  const state = await getTurnState();
  const entry: TurnEntry = { id: crypto.randomUUID(), name: characterName, initiative, initiativeBonus, tokenId, characterId };
  await setTurnState(replaceTurnEntries(state, [...state.entries.filter((item) => item.tokenId !== tokenId), entry]));
}

export async function uploadMapAsScene(file: File, sceneName: string): Promise<void> {
  if (!OBR.isAvailable) throw new Error("Il caricamento scene è disponibile solo dentro Owlbear Rodeo");
  const copy = new File([await file.arrayBuffer()], file.name, { type: file.type });
  const image = buildImageUpload(copy).name(sceneName).build();
  const scene = buildSceneUpload().name(sceneName).baseMap(image).build();
  await OBR.assets.uploadScenes([scene]);
}

export async function uploadRemoteMapAsScene(url: string, sceneName: string): Promise<void> {
  const response = await fetch(url); if (!response.ok) throw new Error(`Download mappa fallito (${response.status})`);
  const blob = await response.blob(); const extension = blob.type.split("/")[1]?.replace("jpeg", "jpg") || "webp";
  await uploadMapAsScene(new File([blob], `${sceneName}.${extension}`, { type: blob.type || "image/webp" }), sceneName);
}

// Token di riserva: iniziali del mostro su disco colorato, cosi' ogni import produce comunque un token.
function fallbackTokenFile(name: string): File {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase() ?? "").join("") || "?";
  let hash = 0; for (let index = 0; index < name.length; index += 1) hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150"><circle cx="75" cy="75" r="72" fill="hsl(${hash % 360},55%,32%)" stroke="#0b0b0d" stroke-width="6"/><text x="75" y="75" fill="#f5f5f4" font-family="Georgia,serif" font-size="58" font-weight="bold" text-anchor="middle" dominant-baseline="central">${initials.replace(/[<>&]/g, "")}</text></svg>`;
  return new File([svg], `${name}.svg`, { type: "image/svg+xml" });
}

// Selettore immagini di Owlbear: URL dell'immagine scelta, null se si chiude senza scegliere.
export async function pickOwlbearImage(search?: string): Promise<string | null> {
  if (!OBR.isAvailable) throw new Error("Apri TavernExplorer dentro Owlbear Rodeo per scegliere un'immagine");
  const [picked] = await OBR.assets.downloadImages(false, search, "CHARACTER");
  return picked?.image.url ?? null;
}

export async function uploadMonsterTokens(monsters: Array<{ name: string; source: string; image?: string }>): Promise<number> {
  if (!OBR.isAvailable) return 0; let uploaded = 0;
  for (let offset = 0; offset < monsters.length; offset += 20) {
    const batch = monsters.slice(offset, offset + 20); const assets = [];
    for (const monster of batch) {
      let file: File | null = null;
      if (monster.image) {
        try { const response = await fetch(monster.image); if (response.ok) { const blob = await response.blob(); file = new File([blob], `${monster.name}.webp`, { type: blob.type || "image/webp" }); } }
        catch { /* Un token mancante non deve annullare l'intero manuale. */ }
      }
      if (!file) file = fallbackTokenFile(monster.name);
      assets.push(buildImageUpload(file).name(`beasts/${monster.name}`).description(`beasts · ${monster.source} · TavernExplorer`).build());
    }
    if (assets.length) { await OBR.assets.uploadImages(assets, "CHARACTER"); uploaded += assets.length; }
  }
  return uploaded;
}

export interface CharacterToken { tokenId: string; tokenName: string; characterId?: string; ownerId: string; unlinked?: boolean }

export async function setTokenCharacter(tokenId: string, characterId: string | null, ownerId?: string): Promise<void> {
  if (!OBR.isAvailable || !(await OBR.scene.isReady())) throw new Error("Apri una scena Owlbear per collegare il token");
  if (await OBR.player.getRole() !== "GM") throw new Error("Solo il GM può collegare i token alle schede");
  const token = (await OBR.scene.items.getItems([tokenId]))[0];
  if (!token || token.layer !== "CHARACTER") throw new Error("Il token non è più nella scena aperta");
  await OBR.scene.items.updateItems([tokenId], (items) => {
    for (const item of items) {
      if (characterId) item.metadata[TOKEN_META_KEY] = { characterId };
      // Il GM l'ha scollegato a mano: l'abbinamento automatico per nome non deve ricollegarlo.
      else item.metadata[TOKEN_META_KEY] = { unlinked: true };
      if (ownerId) item.createdUserId = ownerId;
    }
  });
}

export async function setTokenOwner(tokenId: string, ownerId: string): Promise<void> {
  if (!OBR.isAvailable || !(await OBR.scene.isReady())) throw new Error("Apri una scena Owlbear per assegnare il token");
  if (await OBR.player.getRole() !== "GM") throw new Error("Solo il GM può assegnare i token");
  const token = (await OBR.scene.items.getItems([tokenId]))[0];
  if (!token || token.layer !== "CHARACTER") throw new Error("Il token non è più nella scena aperta");
  await OBR.scene.items.updateItems([tokenId], (items) => {
    for (const item of items) item.createdUserId = ownerId;
  });
}

export async function getCharacterTokens(): Promise<CharacterToken[]> {
  if (!OBR.isAvailable || !(await OBR.scene.isReady())) return [];
  return (await OBR.scene.items.getItems((item) => item.layer === "CHARACTER"))
    .map((item) => ({ tokenId: item.id, tokenName: item.name || "Token senza nome", characterId: linkedCharacterId(item), ownerId: item.createdUserId, unlinked: (item.metadata[TOKEN_META_KEY] as { unlinked?: boolean } | undefined)?.unlinked === true }))
    .sort((a, b) => Number(Boolean(a.characterId)) - Number(Boolean(b.characterId)) || a.tokenName.localeCompare(b.tokenName, "it"));
}

export async function getTokenImages(tokenIds: string[]): Promise<Record<string, string>> {
  if (!OBR.isAvailable || !tokenIds.length || !(await OBR.scene.isReady())) return {};
  const items = await OBR.scene.items.getItems(tokenIds);
  return Object.fromEntries(items.filter(isImage).map((item) => [item.id, item.image.url]));
}

export { focusToken, highlightToken } from "./tokenHighlight";

// Mostra il risultato sulla mappa attaccato al token del personaggio; sparisce da solo.
export async function showRollOnMap(characterId: string, label: string, total: number): Promise<void> {
  if (!OBR.isAvailable || !(await OBR.scene.isReady())) return;
  const items = await OBR.scene.items.getItems();
  const token = items.find((item) => (item.metadata[TOKEN_META_KEY] as { characterId?: string } | undefined)?.characterId === characterId);
  if (!token) return;
  const text = buildText().plainText(`${label}: ${total}`).attachedTo(token.id).position({ x: token.position.x, y: token.position.y - 60 })
    .fontSize(28).fontWeight(700).strokeColor("#000000").strokeWidth(2).fillOpacity(1).disableHit(true).locked(true).layer("TEXT")
    .metadata({ [ROLL_LABEL_META_KEY]: true }).build();
  await OBR.scene.items.addItems([text]);
  setTimeout(() => { void OBR.scene.items.deleteItems([text.id]).catch(() => undefined); }, 6000);
}

export { getFloatingPanelPosition, getFloatingPanelSize, openFloatingPanel, openPanelForPlayers, resizeFloatingPanel, type PanelSize } from "./floatingPanels";

export async function getPartyMembers(): Promise<Array<{ id: string; name: string; role: "GM" | "PLAYER" }>> {
  if (!OBR.isAvailable) return [];
  return (await OBR.party.getPlayers()).map((member) => ({ id: member.id, name: member.name, role: member.role }));
}

export async function getSharedInventory(): Promise<SharedInventoryItem[]> {
  if (!OBR.isAvailable) return [];
  const metadata = await OBR.room.getMetadata();
  return Array.isArray(metadata[INVENTORY_META_KEY]) ? metadata[INVENTORY_META_KEY] as unknown as SharedInventoryItem[] : [];
}

export async function setSharedInventory(items: SharedInventoryItem[]): Promise<void> {
  if (OBR.isAvailable) await writeRoomMetadata({ [INVENTORY_META_KEY]: items });
}

export function onSharedInventoryChange(callback: (items: SharedInventoryItem[]) => void): () => void {
  if (!OBR.isAvailable) return () => undefined;
  return OBR.room.onMetadataChange((metadata) => callback(Array.isArray(metadata[INVENTORY_META_KEY]) ? metadata[INVENTORY_META_KEY] as unknown as SharedInventoryItem[] : []));
}

export async function getPermissions(): Promise<PermissionSettings> {
  if (!OBR.isAvailable) return DEFAULT_PERMISSIONS;
  const metadata = await OBR.room.getMetadata(); const value = metadata[PERMISSIONS_META_KEY];
  return value && typeof value === "object" ? { ...DEFAULT_PERMISSIONS, ...value as Partial<PermissionSettings> } : DEFAULT_PERMISSIONS;
}
export async function setPermissions(value: PermissionSettings): Promise<void> { if (OBR.isAvailable) await writeRoomMetadata({ [PERMISSIONS_META_KEY]: value }); }
export function onPermissionsChange(callback: (value: PermissionSettings) => void): () => void { if (!OBR.isAvailable) return () => undefined; return OBR.room.onMetadataChange((metadata) => { const value = metadata[PERMISSIONS_META_KEY]; callback(value && typeof value === "object" ? { ...DEFAULT_PERMISSIONS, ...value as Partial<PermissionSettings> } : DEFAULT_PERMISSIONS); }); }

export { OBR };
