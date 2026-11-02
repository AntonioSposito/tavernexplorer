import { afterEach, expect, it, vi } from "vitest";
import { roll, supportsRollMode } from "./dice";
import { initiativeRoll } from "./initiative";
import { importRoll20 } from "./importer";
import { buildRollCard } from "./rollCards";

afterEach(() => vi.restoreAllMocks());
// d20 truccato: crypto.getRandomValues restituisce valori che danno i risultati voluti.
const rigD20 = (...values: number[]) => {
  let index = 0;
  vi.spyOn(crypto, "getRandomValues").mockImplementation(((array: Uint32Array) => { array[0] = values[index++] - 1; return array; }) as typeof crypto.getRandomValues);
};

it("1d20min10 porta a 10 un d20 basso, anche con vantaggio, e la card resta coerente", () => {
  expect(supportsRollMode("1d20min10+5[DEX]")).toBe(true);
  rigD20(3);
  const result = roll("1d20min10+5", "normal");
  expect(result).toMatchObject({ formula: "1d20min10+5", total: 15, dice: [10], natural: 10 });
  expect(buildRollCard("Furtività", "1d20min10+5", result, "normal").card.d20).toMatchObject({ modifier: 5, kept: 0 });
  rigD20(4, 15);
  expect(roll("1d20min10+2", "advantage")).toMatchObject({ formula: "2d20kh1min10+2", total: 17, dice: [10, 15] });
});

it("iniziativa dei turni: valore con opzioni, stile e spareggio DES/100", () => {
  const sheet = importRoll20({ character: { name: "Eroe" }, normalized: { identity: { character_name: "Eroe" }, combat: { initiative: 2 }, abilities: { dexterity: { score: 14, mod: 2 } } } });
  sheet.options = { bonuses: { initiative: 1 }, initiativeMode: "advantage", dexTiebreaker: true };
  expect(initiativeRoll(sheet)).toEqual({ formula: "1d20+3", mode: "advantage", tiebreaker: 0.14 });
});
