import { expect, it, vi } from "vitest";
import { TOKEN_META_KEY, TURN_META_KEY } from "./constants";
import type { TurnState } from "./types";

const room = vi.hoisted(() => ({ metadata: {} as Record<string, unknown>, setMetadata: vi.fn() }));
const tokens = [
  { id: "t1", layer: "CHARACTER", metadata: { [TOKEN_META_KEY]: { characterId: "ada" } } },
  { id: "t2", layer: "CHARACTER", metadata: { [TOKEN_META_KEY]: { characterId: "ada" } } },
  { id: "t3", layer: "CHARACTER", metadata: { [TOKEN_META_KEY]: { characterId: "bob" } } },
];
vi.mock("@owlbear-rodeo/sdk", () => ({
  default: {
    isAvailable: true,
    scene: { isReady: async () => true, items: { getItems: async (filter: (item: unknown) => boolean) => tokens.filter(filter) } },
    room: { getMetadata: async () => room.metadata, setMetadata: room.setMetadata },
  },
  buildImageUpload: vi.fn(), buildText: vi.fn(), isImage: vi.fn(),
}));

it("iniziativa dalla scheda: i token del PG entrano nei turni o prendono il nuovo valore", async () => {
  room.metadata = { [TURN_META_KEY]: { round: 1, activeIndex: 0, entries: [{ id: "e1", name: "Ada", initiative: 5, tokenId: "t1", characterId: "ada" }] } satisfies TurnState };
  const { setCharacterTokensInitiative } = await import("./obr");
  await setCharacterTokensInitiative("ada", "Ada", 17, 3);
  const entries = (room.setMetadata.mock.lastCall?.[0][TURN_META_KEY] as TurnState).entries;
  expect(entries.map((entry) => [entry.id === "e1" ? "e1" : "new", entry.tokenId, entry.initiative])).toEqual([["e1", "t1", 17], ["new", "t2", 17]]);
  expect(entries[1]).toMatchObject({ name: "Ada", characterId: "ada", initiativeBonus: 3 });
});
