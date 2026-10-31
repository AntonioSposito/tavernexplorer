// @vitest-environment jsdom
import { expect, it } from "vitest";
import { resolveAction } from "./actions";
import { importRoll20 } from "./importer";
import type { ActionEntry } from "./types";

const sheet = importRoll20({ character: { name: "Ada" }, normalized: { identity: { character_name: "Ada" } } });
sheet.abilities.strength = { score: 16, mod: 3, save: 3, saveProficient: false };
sheet.abilities.dexterity = { score: 14, mod: 2, save: 2, saveProficient: false };
sheet.combat.proficiencyBonus = 2;
sheet.spellcasting = { ...sheet.spellcasting, attackBonus: 6, saveDc: 14 };

it("calcola attacco, danni, critico e TS come il form di Roll20", () => {
  const sword: ActionEntry = {
    id: "a", name: "Spada lunga +1", attack: { ability: "strength", bonus: 0, proficient: true }, magicBonus: 1, critRange: 19,
    damages: [{ dice: "1d8", ability: "strength", bonus: 0, type: "Tagliente", critDice: "1d8" }, { dice: "1d6", ability: "none", bonus: 0, type: "Fuoco", critDice: "1d6" }],
  };
  expect(resolveAction(sheet, sword)).toMatchObject({ attackBonus: 6, damage: "1d8+4+1d6", critDamage: "1d8+1d8+4+1d6+1d6", damageType: "Tagliente / Fuoco", critRange: 19 });

  const breath: ActionEntry = { id: "b", name: "Soffio", damages: [{ dice: "2d6", ability: "none", bonus: 0, type: "Fuoco", critDice: "" }], save: { ability: "dexterity", dc: "spell", effect: "metà danni" } };
  expect(resolveAction(sheet, breath)).toMatchObject({ attackBonus: undefined, damage: "2d6", saveDc: 14, saveAbility: "dexterity", saveEffect: "metà danni" });

  const bolt: ActionEntry = { id: "c", name: "Dardo", attack: { ability: "spell", bonus: 0, proficient: true }, damages: [{ dice: "1d10", ability: "none", bonus: 0, type: "", critDice: "1d10" }], save: { ability: "wisdom", dc: 12, effect: "" } };
  expect(resolveAction(sheet, bolt)).toMatchObject({ attackBonus: 6, damage: "1d10", saveDc: 12, damageType: undefined });
});

it("le azioni importate senza form mantengono i valori fissi", () => {
  expect(resolveAction(sheet, { id: "d", name: "Pugnale", attackBonus: 5, damage: "1d4+3", damageType: "Perforante", saveDc: 13 }))
    .toMatchObject({ attackBonus: 5, damage: "1d4+3", critDamage: "2d4+3", damageType: "Perforante", saveDc: 13, critRange: 20 });
});
