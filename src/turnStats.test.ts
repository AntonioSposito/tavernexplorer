import { expect, it } from "vitest";
import { TOKEN_META_KEY } from "./constants";
import { fillTurnStats } from "./turnStats";
import type { TurnState } from "./types";

const token = (id: string, characterId?: string) => ({ id, name: id, metadata: characterId ? { [TOKEN_META_KEY]: { characterId } } : {} });
const statblocks = new Map([["goblin", { name: "Goblin", ac: 15, hp: { average: 7, formula: "2d6" } }], ["ogre", { name: "Ogre", ac: 11, hp: { average: 59, formula: "7d10+21" } }]]);
const state = (entries: TurnState["entries"]): TurnState => ({ round: 1, activeIndex: 0, entries });

it("carica PF medi e CA quando il token è collegato a un mostro o NPC", () => {
  const next = fillTurnStats(state([{ id: "e", name: "Goblin", initiative: 12, tokenId: "t" }]), [token("t", "goblin")], statblocks);
  expect(next?.entries[0]).toMatchObject({ characterId: "goblin", hp: { current: 7, max: 7 }, ac: 15 });
});

it("conserva i danni finché il token resta collegato allo stesso mostro", () => {
  const damaged = state([{ id: "e", name: "Goblin", initiative: 12, tokenId: "t", characterId: "goblin", hp: { current: 3, max: 7 }, ac: 15 }]);
  expect(fillTurnStats(damaged, [token("t", "goblin")], statblocks)).toBeNull();
});

it("ricarica i valori se il token passa a un altro mostro e li toglie se passa a un PG o a nessuna scheda", () => {
  const damaged = state([{ id: "e", name: "Goblin", initiative: 12, tokenId: "t", characterId: "goblin", hp: { current: 3, max: 7 }, ac: 15 }]);
  expect(fillTurnStats(damaged, [token("t", "ogre")], statblocks)?.entries[0]).toMatchObject({ characterId: "ogre", hp: { current: 59, max: 59 }, ac: 11 });
  const pc = fillTurnStats(damaged, [token("t", "eroe")], statblocks)?.entries[0];
  expect(pc).toMatchObject({ characterId: "eroe" });
  expect(pc?.hp).toBeUndefined();
  expect(fillTurnStats(damaged, [token("t")], statblocks)?.entries[0].hp).toBeUndefined();
});

it("ignora le voci senza token sulla scena", () => {
  expect(fillTurnStats(state([{ id: "e", name: "Goblin", initiative: 12, tokenId: "altrove" }]), [], statblocks)).toBeNull();
});
