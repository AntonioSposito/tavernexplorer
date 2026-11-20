import { expect, it } from "vitest";
import { createBlankSheet } from "./blankSheet";
import { attacksPerAction, sneakAttackDice, sneakEligible } from "./classAttacks";

const withTraits = (...names: string[]) => {
  const sheet = createBlankSheet("Eroe");
  sheet.traits = names.map((name) => ({ id: name, name, description: "" }));
  return sheet;
};

it("attacchi per azione dai privilegi Extra Attack", () => {
  expect([attacksPerAction(withTraits()), attacksPerAction(withTraits("Extra Attack")), attacksPerAction(withTraits("Extra Attack", "Two Extra Attacks")), attacksPerAction(withTraits("Three Extra Attacks"))]).toEqual([1, 2, 3, 4]);
});

it("Attacco furtivo: d6 per metà del livello da ladro, solo con armi accurate o a distanza", () => {
  const rogue = withTraits("Sneak Attack");
  rogue.classes = [{ name: "Rogue", level: 5 }];
  expect(sneakAttackDice(rogue)).toBe(3);
  expect(sneakAttackDice(withTraits())).toBeNull();
  expect([sneakEligible({ id: "a", name: "Rapier", weapon: "Rapier" }), sneakEligible({ id: "b", name: "Greataxe", weapon: "Greataxe" }), sneakEligible({ id: "c", name: "Colpo", attack: { ability: "dexterity", bonus: 0, proficient: true } })]).toEqual([true, false, true]);
});
