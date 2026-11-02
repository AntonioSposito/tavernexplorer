import { afterEach, expect, it, vi } from "vitest";
import { casterLevel, classSlotTotals, pactSlots } from "./classes";
import { applyClassChanges } from "./classSync";
import { roll } from "./dice";
import { importRoll20 } from "./importer";
import { takeLongRest, takeShortRest } from "./rest";

afterEach(() => vi.restoreAllMocks());

it("livello da incantatore e slot del multiclasse 2024, patto a parte", () => {
  expect(casterLevel([{ name: "Wizard", level: 5 }, { name: "Paladin", level: 3 }])).toBe(7);
  expect(casterLevel([{ name: "Fighter", level: 7, subclass: "Eldritch Knight" }])).toBe(2);
  expect(casterLevel([{ name: "Rogue", level: 6 }], { rogue: true })).toBe(2);
  expect(classSlotTotals([{ name: "Paladin", level: 1 }])).toEqual({ level_1: 2 });
  expect(classSlotTotals([{ name: "Wizard", level: 4 }])).toEqual({ level_1: 4, level_2: 3 });
  expect(pactSlots(11)).toEqual({ count: 3, level: 5 });
  expect(classSlotTotals([{ name: "Warlock", level: 4 }, { name: "Sorcerer", level: 2 }])).toEqual({ level_1: 3, level_2: 2 });
  expect(classSlotTotals([{ name: "Wizard", level: 1 }], { slotBonus: [1, 1] })).toEqual({ level_1: 3, level_2: 1 });
});

const wizard = () => importRoll20({ character: { name: "Silmaer" }, normalized: {
  identity: { character_name: "Silmaer", class: "Wizard", level: 4 }, combat: { proficiency_bonus: 2, hit_dice: { current: 4, max: 4 } },
  abilities: { intelligence: { score: 16, mod: 3, save: 5, save_proficient: true }, wisdom: { score: 12, mod: 1, save: 3, save_proficient: true }, charisma: { score: 14, mod: 2, save: 2 } },
  spellcasting: { ability: "@{intelligence_mod}+", save_dc: 13, attack_bonus: 5, slots: { level_1: { total: 4, expended: 1 }, level_2: { total: 3, expended: 0 } } },
}, raw: { attributes: { base_level: { current: "4" }, hitdietype: { current: "6" } } } });

it("all'import le classi Roll20 accendono il calcolo automatico solo se gli slot coincidono", () => {
  const sheet = wizard();
  expect(sheet.classes).toEqual([{ name: "Wizard", level: 4 }]);
  expect(sheet.options).toMatchObject({ autoLevel: true });
  expect(sheet.spellcasting.ability).toBe("intelligence");
  const custom = importRoll20({ character: { name: "Brus" }, normalized: { identity: { character_name: "Brus", level: 4 } }, raw: { attributes: {
    custom_class: { current: "1" }, cust_classname: { current: "Monk 24" }, base_level: { current: "4" }, cust_hitdietype: { current: "8" },
    cust_strength_save_prof: { current: "(@{pb})" }, cust_dexterity_save_prof: { current: "(@{pb})" }, cust_spellslots: { current: "" },
  } } });
  expect(custom.classes).toEqual([{ name: "Monk 24", level: 4, custom: { hitDie: 8, caster: "none", saves: ["strength", "dexterity"] } }]);
});

it("multiclasse: livello, dadi vita, slot, TS e caratteristica da incantatore si aggiornano", () => {
  const sheet = wizard();
  const previous = structuredClone(sheet);
  sheet.classes = [{ name: "Cleric", level: 4 }, { name: "Paladin", level: 2 }];
  applyClassChanges(sheet, previous);
  expect(sheet.identity).toMatchObject({ level: 6, className: "Cleric", classDisplay: "Cleric 4 / Paladin 2" });
  expect(sheet.combat.hitDice).toEqual({ current: 6, max: 6, die: "d8" });
  expect(sheet.spellcasting.slots).toEqual({ level_1: { total: 4, used: 1 }, level_2: { total: 3, used: 0 }, level_3: { total: 2, used: 0 } });
  // Wizard (INT, SAG) → Cleric (SAG, CAR): TS Intelligenza perde la competenza, Carisma la prende.
  expect(sheet.abilities.intelligence).toMatchObject({ saveProficient: false, save: 3 });
  expect(sheet.abilities.charisma).toMatchObject({ saveProficient: true, save: 4 });
  // CD e attacco passano da INT (+3) a SAG (+1), tenendo il resto dei valori importati.
  expect(sheet.spellcasting).toMatchObject({ ability: "wisdom", saveDc: 11, attackBonus: 3 });
});

it("dadi vita per classe: si spendono prima i dadi grandi e il riposo lungo li ripristina", () => {
  const sheet = wizard();
  sheet.options = { ...sheet.options, trackHitDicePerClass: true };
  const previous = structuredClone(sheet);
  sheet.classes = [{ name: "Wizard", level: 4 }, { name: "Fighter", level: 1 }];
  applyClassChanges(sheet, previous);
  expect(sheet.combat.hitDicePools).toEqual([{ die: "d10", current: 1, max: 1 }, { die: "d6", current: 4, max: 4 }]);
  sheet.combat.hp = { current: 10, max: 30, temp: 0 };
  const faces: number[] = [];
  const rested = takeShortRest(sheet, 2, (value) => { faces.push(value); return 1; }).sheet;
  expect(faces).toEqual([10, 6]);
  expect(rested.combat.hitDicePools).toEqual([{ die: "d10", current: 0, max: 1 }, { die: "d6", current: 3, max: 4 }]);
  expect(takeLongRest(rested).sheet.combat.hitDicePools).toEqual([{ die: "d10", current: 1, max: 1 }, { die: "d6", current: 4, max: 4 }]);
});

it("Halfling luck: un 1 sul d20 si ritira una volta", () => {
  const values = [1, 14];
  vi.spyOn(crypto, "getRandomValues").mockImplementation(((array: Uint32Array) => { array[0] = values.shift()! - 1; return array; }) as typeof crypto.getRandomValues);
  expect(roll("1d20ro1+3", "normal")).toMatchObject({ formula: "1d20ro1+3", total: 17, dice: [14], natural: 14 });
});
