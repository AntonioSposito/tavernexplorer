import { expect, it } from "vitest";
import { import5eToolsMonsters } from "./import5etools";
import { monsterProficiency, monsterTokenSize, monsterXp } from "./monsterSheet";

const describe = (entries: string[], section = "action") => import5eToolsMonsters({ monster: [{ name: "Noble", source: "MM", [section]: [{ name: "Voce", entries }] }] })[0];

it("scrive attacchi, colpi, CD e ricariche come su 5e.tools", () => {
  const legacy = describe(["{@atk mw} {@hit 3} to hit, reach 5 ft., one target. {@h}5 ({@damage 1d8 + 1}) piercing damage."]).actions[0];
  expect(legacy).toMatchObject({ description: "Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 5 (1d8 + 1) piercing damage.", attackBonus: 3, damage: "1d8+1" });
  expect(describe(["{@atkr m} {@hit 3}, reach 5 ft. {@h}5 ({@damage 1d8 + 1}) Piercing damage."]).actions[0].description).toBe("Melee Attack Roll: +3, reach 5 ft. Hit: 5 (1d8 + 1) Piercing damage.");
  expect(describe(["{@actSave dex} {@dc 13}, each creature in a 15-foot cone. {@actSaveFail} 14 ({@damage 4d6}) Fire damage. {@actSaveSuccess} Half damage. {@recharge 5}"]).actions[0])
    .toMatchObject({ description: "Dexterity Saving Throw: DC 13, each creature in a 15-foot cone. Failure: 14 (4d6) Fire damage. Success: Half damage. (Recharge 5–6)", saveDc: 13 });
  expect(describe(["{@actTrigger} The noble is hit by a melee attack roll. {@actResponse} The noble adds 2 to its AC."], "reaction").reactions[0].description).toBe("Trigger: The noble is hit by a melee attack roll. Response: The noble adds 2 to its AC.");
});

it("importa azioni bonus e incantesimi nella sezione indicata da displayAs", () => {
  const [mage] = import5eToolsMonsters({ monster: [{
    name: "Mage", source: "MM", trait: [{ name: "Tratto", entries: ["Testo."] }], bonus: [{ name: "Misty Step", entries: ["Teleport."] }],
    spellcasting: [
      { name: "Spellcasting", headerEntries: ["The mage casts spells (spell save {@dc 14}, {@hit 6} to hit with spell attacks):"], spells: { 0: { spells: ["{@spell fire bolt}", "{@spell light}"] }, 1: { slots: 4, spells: ["{@spell shield}"] } } },
      { name: "Innate Spellcasting", displayAs: "bonus", headerEntries: ["The mage casts:"], will: ["{@spell mage hand|xphb}"], daily: { "2e": ["{@spell fly}", "{@spell blink}"], 1: ["{@spell fireball}"] } },
    ],
  }] });
  expect(mage.traits.map((trait) => trait.name)).toEqual(["Tratto", "Spellcasting"]);
  expect(mage.traits[1].description).toBe("The mage casts spells (spell save DC 14, +6 to hit with spell attacks):\n\n• Cantrips (at will): fire bolt, light\n• 1st level (4 slots): shield");
  expect(mage.bonusActions?.map((action) => action.name)).toEqual(["Misty Step", "Innate Spellcasting"]);
  expect(mage.bonusActions?.[1].description).toBe("The mage casts:\n\n• At will: mage hand\n• 1/day: fireball\n• 2/day each: fly, blink");
});

it("importa difese, sensi e linguaggi; PE, bonus competenza e taglia token si calcolano da GS e taglia", () => {
  const [lich] = import5eToolsMonsters({ monster: [{
    name: "Lich", source: "MM", size: ["M"], cr: { cr: "21", xp: 33000 },
    resist: ["cold", "lightning"], immune: ["poison", { immune: ["bludgeoning", "piercing"], note: "from nonmagical attacks" }],
    conditionImmune: ["{@condition charmed}", "poisoned"], senses: ["truesight 120 ft."], languages: ["Common plus up to five other languages"],
  }] });
  expect(lich).toMatchObject({ resistances: "cold, lightning", immunities: "poison, bludgeoning, piercing from nonmagical attacks", conditionImmunities: "charmed, poisoned", senses: "truesight 120 ft.", languages: "Common plus up to five other languages", xp: 33000 });
  expect(lich.vulnerabilities).toBeUndefined();
  expect([monsterXp(lich), monsterProficiency(lich), monsterTokenSize(lich)]).toEqual([33000, 7, 1]);
  const goblin = { ...lich, challengeRating: "1/4", size: "L", xp: undefined };
  expect([monsterXp(goblin), monsterProficiency(goblin), monsterTokenSize(goblin), monsterTokenSize({ size: "G", tokenSize: 3 })]).toEqual([50, 2, 2, 3]);
});

it("i blocchi spellcasting diventano la sezione Magia: caratteristica, CD e attacco come nell'intestazione, slot e incantesimi", () => {
  const [mage] = import5eToolsMonsters({ monster: [{
    name: "Mage", source: "MM", cr: "6", int: 17,
    spellcasting: [
      { name: "Spellcasting", ability: "int", headerEntries: ["The mage is a 9th-level spellcaster (spell save {@dc 14}, {@hit 6} to hit with spell attacks):"], spells: { 0: { spells: ["{@spell fire bolt}"] }, 3: { slots: 3, spells: ["{@spell fireball|xphb}"] } } },
      { name: "Innate Spellcasting", ability: "cha", headerEntries: ["The mage casts:"], will: ["{@spell mage hand}"], daily: { "1e": ["{@spell fly} (self only)"] } },
    ],
  }] });
  // INT 17 (+3), competenza +3 a GS 6: CD 8+3+3 = 14 e attacco +6, quindi nessun modificatore extra.
  expect(mage.spellcasting).toEqual({ ability: "intelligence", attackModifier: 0, dcModifier: 0, casterLevel: 9, slots: { level_3: { total: 3, used: 0 } } });
  expect(mage.spells?.map((spell) => [spell.name, spell.level, spell.innate])).toEqual([["fire bolt", 0, undefined], ["fireball", 3, undefined], ["mage hand", 0, "a volontà"], ["fly", 0, "1/giorno ciascuno"]]);
});

it("somma i danni uniti da \"plus\" con i loro tipi; le alternative \"or\" restano fuori", () => {
  const bite = describe(["{@atk mw} {@hit 9} to hit, reach 5 ft. {@h}7 ({@damage 1d6 + 4}) piercing damage plus 10 ({@damage 3d6}) necrotic damage."]).actions[0];
  expect(bite).toMatchObject({ damage: "1d6+4+3d6", damageType: "piercing / necrotic", damages: [
    { dice: "1d6", bonus: 4, ability: "none", type: "piercing", critDice: "1d6" }, { dice: "3d6", bonus: 0, ability: "none", type: "necrotic", critDice: "3d6" }] });
  const sword = describe(["{@atkr m} {@hit 5}, reach 5 ft. {@h}7 ({@damage 1d8 + 3}) Slashing damage, or 8 ({@damage 1d10 + 3}) Slashing damage if used with two hands."]).actions[0];
  expect(sword).toMatchObject({ damage: "1d8+3", damageType: "Slashing" });
  expect(describe(["{@atk mw} {@hit 6} to hit. {@h}15 ({@damage 1d12 + 4} plus {@damage 1d8}) slashing damage."]).actions[0]).toMatchObject({ damage: "1d12+4+1d8", damageType: "slashing" });
  expect(describe(["{@actSave dex} {@dc 13}. {@actSaveFail} 14 ({@damage 4d6}) Fire damage. {@actSaveSuccess} Half damage."]).actions[0]).toMatchObject({ damage: "4d6", damageType: "Fire" });
});
