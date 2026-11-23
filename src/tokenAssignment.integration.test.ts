import { expect, it, vi } from "vitest";
import { TOKEN_META_KEY } from "./constants";
import { importRoll20 } from "./importer";

const bus = vi.hoisted(() => ({ send: () => undefined as void }));
const room = vi.hoisted((): { metadata: Record<string, unknown>; items: Array<{ id: string; name: string; layer: string; createdUserId: string; metadata: Record<string, unknown> }> } => ({
  metadata: {},
  items: [
    { id: "token-a", name: "Ada", layer: "CHARACTER", createdUserId: "gm", metadata: {} },
    { id: "token-b", name: "Berto", layer: "CHARACTER", createdUserId: "gm", metadata: {} },
    { id: "prop", name: "Cassa", layer: "PROP", createdUserId: "gm", metadata: {} },
  ],
}));

vi.mock("@owlbear-rodeo/sdk", () => ({ default: {
  isAvailable: true,
  player: { getRole: async () => "GM" },
  broadcast: { onMessage: (_channel: string, callback: () => void) => { bus.send = callback; return () => { bus.send = () => undefined; }; } },
  scene: { isReady: async () => true, items: {
    getItems: async (filter: string[] | ((item: typeof room.items[number]) => boolean)) => room.items.filter((item) => Array.isArray(filter) ? filter.includes(item.id) : filter(item)),
    updateItems: async (filter: string[] | ((item: typeof room.items[number]) => boolean), update: (items: typeof room.items) => void) => { update(room.items.filter((item) => Array.isArray(filter) ? filter.includes(item.id) : filter(item))); },
  } },
  room: { getMetadata: async () => room.metadata, setMetadata: async (update: Record<string, unknown>) => { room.metadata = { ...room.metadata, ...update }; } },
} }));

it("mostra i token liberi e collega soltanto il token scelto", async () => {
  const { getCharacterTokens, setTokenCharacter, setTokenOwner } = await import("./obr");
  const sheet = importRoll20({ character: { name: "Eroe" }, normalized: { identity: { character_name: "Eroe" } } });

  expect((await getCharacterTokens()).map((item) => item.tokenId)).toEqual(["token-a", "token-b"]);
  await setTokenCharacter("token-b", sheet.id, "player");
  expect(room.items[0].metadata[TOKEN_META_KEY]).toBeUndefined();
  expect(room.items[1].metadata[TOKEN_META_KEY]).toEqual({ characterId: sheet.id });
  expect(room.items[1].createdUserId).toBe("player");
  await setTokenOwner("token-b", "gm");
  expect(room.items[1].createdUserId).toBe("gm");
  expect(room.items[0].createdUserId).toBe("gm");
  await setTokenCharacter("token-b", null);
  expect(room.items[1].metadata[TOKEN_META_KEY]).toEqual({ unlinked: true });
  const unlinked = (await getCharacterTokens()).find((item) => item.tokenId === "token-b");
  expect(unlinked).toMatchObject({ unlinked: true });
  expect(unlinked?.characterId).toBeUndefined();
});

it("collega più token con una sola lettura e una sola scrittura; uno sparito dà errore senza bloccare gli altri", async () => {
  const { OBR, setTokenCharacters } = await import("./obr");
  const read = vi.spyOn(OBR.scene.items, "getItems");
  const write = vi.spyOn(OBR.scene.items, "updateItems");
  await setTokenCharacters([{ tokenId: "token-a", characterId: "a", ownerId: "p1" }, { tokenId: "token-b", characterId: "b" }]);
  expect([read.mock.calls.length, write.mock.calls.length]).toEqual([1, 1]);
  expect(room.items.slice(0, 2).map((item) => item.metadata[TOKEN_META_KEY])).toEqual([{ characterId: "a" }, { characterId: "b" }]);
  expect(room.items[0].createdUserId).toBe("p1");
  await expect(setTokenCharacters([{ tokenId: "sparito", characterId: "x" }, { tokenId: "token-a", characterId: "c" }])).rejects.toThrow("Il token non è più nella scena aperta");
  expect(room.items[0].metadata[TOKEN_META_KEY]).toEqual({ characterId: "c" });
});

it("avviso sulle schede: il primo rilegge subito, quelli a ruota in una rilettura sola, poi niente", async () => {
  vi.useFakeTimers();
  const { onSheetsChanged } = await import("./obr");
  const reload = vi.fn();
  const stop = onSheetsChanged(reload);
  bus.send();
  expect(reload).toHaveBeenCalledTimes(1);
  for (let index = 0; index < 5; index++) bus.send();
  expect(reload).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(500);
  expect(reload).toHaveBeenCalledTimes(2);
  vi.advanceTimersByTime(5000);
  expect(reload).toHaveBeenCalledTimes(2);
  bus.send();
  expect(reload).toHaveBeenCalledTimes(3);
  bus.send();
  stop();
  vi.advanceTimersByTime(5000);
  expect(reload).toHaveBeenCalledTimes(3);
  vi.useRealTimers();
});
