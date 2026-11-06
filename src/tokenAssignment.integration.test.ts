import { expect, it, vi } from "vitest";
import { TOKEN_META_KEY } from "./constants";
import { importRoll20 } from "./importer";

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
