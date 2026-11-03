import { expect, it } from "vitest";
import { createBlankSheet } from "./blankSheet";
import { SKILL_LABELS } from "./constants";
import { effectiveSheet, setAbilityScore } from "./effects";
import { createTavernPack, parseCharacterSheet, parseTavernPack } from "./tavernpack";

it("crea una scheda valida che passa dal TavernPack senza perdite", () => {
  const sheet = createBlankSheet("Lia");
  expect(parseCharacterSheet(sheet)).toBe(sheet);
  expect(Object.keys(sheet.skills).sort()).toEqual(Object.keys(SKILL_LABELS).sort());
  expect(sheet.skills.stealth.ability).toBe("dexterity");
  const pack = createTavernPack({ characters: [sheet], monsters: [], campaigns: [], sharedInventory: [] });
  const back = parseTavernPack(JSON.parse(JSON.stringify(pack))).data.characters[0];
  expect(back).toEqual(sheet);
});

it("ricalcola i derivati: DES 14, livello 5, competente in Furtività", () => {
  const sheet = createBlankSheet("Lia");
  setAbilityScore(sheet, "dexterity", 14);
  sheet.identity.level = 5;
  // Come la spunta di competenza nella tab Modifica.
  sheet.skills.stealth.proficient = true;
  sheet.skills.stealth.bonus += sheet.combat.proficiencyBonus;
  const view = effectiveSheet(sheet);
  expect(view.combat.initiative).toBe(2);
  expect(view.combat.proficiencyBonus).toBe(3);
  expect(view.skills.stealth.bonus).toBe(5);
  expect(view.abilities.dexterity.save).toBe(2);
  expect(view.skills.acrobatics.bonus).toBe(2);
});

it("cambiare il punteggio conserva i bonus importati", () => {
  const sheet = createBlankSheet("Lia");
  sheet.spellcasting.ability = "wisdom";
  sheet.combat.passivePerception = 13;
  sheet.abilities.wisdom.save = 3;
  setAbilityScore(sheet, "wisdom", 16);
  expect(sheet.abilities.wisdom).toMatchObject({ score: 16, mod: 3, save: 6 });
  expect(sheet.combat.passivePerception).toBe(16);
  expect(sheet.skills.insight.bonus).toBe(3);
  expect(sheet.spellcasting).toMatchObject({ saveDc: 13, attackBonus: 5 });
});
