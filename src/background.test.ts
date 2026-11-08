// @vitest-environment jsdom
import { beforeAll, beforeEach, expect, it, vi } from "vitest";
import { STORAGE_CLOUD_CACHE, STORAGE_MESSAGES, STORAGE_MONSTERS, TOKEN_META_KEY, TURN_META_KEY } from "./constants";
import { importRoll20 } from "./importer";
import { openTokenSheet, toggleTokenInitiative } from "./tokenMenuActions";

const mock = vi.hoisted(() => ({
  ready: null as null | (() => Promise<void>),
  menus: [] as Array<{ id: string; icons: Array<{ label: string }>; embed?: { url: string } }>,
  role: "PLAYER" as "GM" | "PLAYER",
  updateItems: vi.fn(),
  open: vi.fn(),
  setMetadata: vi.fn(),
  notify: vi.fn(),
  broadcasts: new Map<string, (event: { data: unknown; connectionId: string }) => void>(),
  send: vi.fn(),
}));

vi.mock("@owlbear-rodeo/sdk", () => ({ default: {
  isAvailable: true,
  onReady: (callback: () => Promise<void>) => { mock.ready = callback; },
  contextMenu: { create: async (menu: typeof mock.menus[number]) => { mock.menus.push(menu); } },
  player: { getRole: async () => mock.role, getMetadata: async () => ({}), getId: async () => "gm-id", getName: async () => "Master" },
  room: { id: "r1", getMetadata: async () => ({}), setMetadata: mock.setMetadata, onMetadataChange: () => () => {} },
  scene: { isReady: async () => false, onReadyChange: () => () => {}, items: { updateItems: mock.updateItems, onChange: () => () => {} } },
  notification: { show: mock.notify },
  viewport: { getWidth: async () => 1000, getHeight: async () => 800 },
  popover: { open: mock.open },
  broadcast: { sendMessage: mock.send, onMessage: (channel: string, callback: (event: { data: unknown; connectionId: string }) => void) => { mock.broadcasts.set(channel, callback); return () => {}; } },
  party: { getPlayers: async () => [{ connectionId: "conn-gm", role: "GM" }, { connectionId: "conn-player", role: "PLAYER" }] },
} }));

// GM da solo nella stanza: nessun altro GM a cui cifrare il tiro del mostro.
vi.mock("./privateMessages", () => ({ gmRecipients: async () => [], encryptGmMessage: async () => { throw new Error("Nessun GM pronto"); }, decryptGmMessage: async () => null, isGmEnvelope: () => false, publishGmMessageKey: async () => undefined }));

beforeAll(async () => { await import("./background"); await mock.ready?.(); });
beforeEach(() => { mock.updateItems.mockClear(); mock.open.mockClear(); mock.setMetadata.mockClear(); mock.notify.mockClear(); mock.send.mockClear(); mock.role = "PLAYER"; localStorage.clear(); });

it("registra una sola voce TavernExplorer che apre la tendina", () => {
  expect(mock.menus).toEqual([expect.objectContaining({ id: "it.tavernexplorer/token-menu", icons: [expect.objectContaining({ label: "TavernExplorer" })], embed: expect.objectContaining({ url: "/?token-menu" }) })]);
});

it("apre il token senza collegarlo di nascosto alla scheda attiva", async () => {
  await openTokenSheet({ id: "token-1", name: "Lupo", metadata: {} } as never);
  expect(mock.updateItems).not.toHaveBeenCalled();
  expect(mock.open).toHaveBeenCalledWith(expect.objectContaining({ id: "it.tavernexplorer/library-panel", url: "/?view=library&token=token-1", anchorReference: "POSITION" }));
});

it("apre la scheda del token in finestra: PG nella scheda, mostro nel bestiario", async () => {
  localStorage.setItem(STORAGE_MONSTERS, JSON.stringify([{ id: "goblin", name: "Goblin", challengeRating: "1/4", abilities: { dex: 14 } }]));
  await openTokenSheet({ id: "token-pg", name: "Eroe", metadata: { [TOKEN_META_KEY]: { characterId: "eroe" } } } as never);
  expect(mock.open).toHaveBeenLastCalledWith(expect.objectContaining({ id: "it.tavernexplorer/sheet-panel", url: "/?view=sheet&token=token-pg" }));
  await openTokenSheet({ id: "token-gob", name: "Goblin", metadata: { [TOKEN_META_KEY]: { characterId: "goblin" } } } as never);
  expect(mock.open).toHaveBeenLastCalledWith(expect.objectContaining({ id: "it.tavernexplorer/compendium-panel", url: "/?view=compendium&token=token-gob" }));
});

it("blocca il menu iniziativa per un giocatore senza permesso", async () => {
  await toggleTokenInitiative([{ id: "token-1", name: "Lupo", metadata: {} }] as never);
  expect(mock.setMetadata).not.toHaveBeenCalled();
  expect(mock.notify).toHaveBeenCalled();
});

it("aggiungendo un token collegato tira l'iniziativa e la mostra in chat come dalla scheda", async () => {
  mock.role = "GM";
  const sheet = importRoll20({ character: { name: "Eroe" }, normalized: { identity: { character_name: "Eroe" }, combat: { initiative: 3 } } });
  localStorage.setItem(`${STORAGE_CLOUD_CACHE}/r1`, JSON.stringify([{ kind: "pc", sheet }]));
  await toggleTokenInitiative([{ id: "token-1", name: "Token", metadata: { [TOKEN_META_KEY]: { characterId: sheet.id } } }] as never);
  const turns = mock.setMetadata.mock.calls[0][0][TURN_META_KEY];
  expect(turns.entries).toMatchObject([{ tokenId: "token-1", characterId: sheet.id, name: "Eroe" }]);
  const message = mock.send.mock.calls[0][1];
  expect(mock.send.mock.calls[0][2]).toEqual({ destination: "ALL" });
  expect(message).toMatchObject({ kind: "roll", author: "Eroe", characterId: sheet.id, title: "Iniziativa", visibility: "everyone", total: turns.entries[0].initiative });
  expect(JSON.parse(localStorage.getItem(STORAGE_MESSAGES)!)).toMatchObject([{ id: message.id }]);
});

it("per i token senza scheda il GM sceglie la scheda nel popover invece di scrivere il valore", async () => {
  mock.role = "GM";
  const sheet = importRoll20({ character: { name: "Eroe" }, normalized: { identity: { character_name: "Eroe" } } });
  localStorage.setItem(`${STORAGE_CLOUD_CACHE}/r1`, JSON.stringify([{ kind: "pc", sheet }]));
  const prompt = vi.spyOn(window, "prompt");
  await toggleTokenInitiative([{ id: "token-2", name: "Goblin", metadata: {} }] as never);
  expect(prompt).not.toHaveBeenCalled();
  expect(mock.open).toHaveBeenCalledWith(expect.objectContaining({ id: "it.tavernexplorer/initiative-picker", url: "/?initiative=token-2", anchorReference: "POSITION" }));
  prompt.mockRestore();
});

it("un token collegato a un mostro del bestiario tira da solo e manda il tiro solo al GM", async () => {
  mock.role = "GM";
  localStorage.setItem(STORAGE_MONSTERS, JSON.stringify([{ id: "goblin", name: "Goblin", challengeRating: "1/4", abilities: { dex: 14 } }]));
  await toggleTokenInitiative([{ id: "token-3", name: "Token", metadata: { [TOKEN_META_KEY]: { characterId: "goblin" } } }] as never);
  expect(mock.open).not.toHaveBeenCalled();
  expect(mock.setMetadata.mock.calls[0][0][TURN_META_KEY].entries).toMatchObject([{ tokenId: "token-3", characterId: "goblin", name: "Goblin", initiativeBonus: 2 }]);
  // Nessun broadcast: la chat del GM lo legge dalla cronologia salvata.
  expect(mock.send).not.toHaveBeenCalled();
  expect(JSON.parse(localStorage.getItem(STORAGE_MESSAGES)!)).toMatchObject([{ author: "Goblin", visibility: "gm" }]);
});

it("apre il turn order quando lo chiede il GM", async () => {
  mock.broadcasts.get("it.tavernexplorer/open-panel")!({ data: { view: "turns" }, connectionId: "conn-gm" });
  await vi.waitFor(() => expect(mock.open).toHaveBeenCalledWith(expect.objectContaining({ id: "it.tavernexplorer/turns-panel" })));
});

it("ignora la richiesta di apertura inviata da un giocatore", async () => {
  mock.broadcasts.get("it.tavernexplorer/open-panel")!({ data: { view: "turns" }, connectionId: "conn-player" });
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(mock.open).not.toHaveBeenCalled();
});
