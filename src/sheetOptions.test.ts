import { expect, it } from "vitest";
import { resolveAction } from "./actions";
import { effectiveSheet, explainCheck, explainValue } from "./effects";
import { applyDeathSave } from "./hitPoints";
import { importRoll20 } from "./importer";

const base = () => {
  const sheet = importRoll20({ character: { name: "Eroe" }, normalized: {
    identity: { character_name: "Eroe", level: 5 }, combat: { proficiency_bonus: 3, initiative: 2 },
    abilities: { wisdom: { score: 12, mod: 1, save: 1 }, dexterity: { score: 14, mod: 2, save: 2 } },
    skills: { stealth: { ability: "dexterity", bonus: 5, proficient: true }, insight: { ability: "wisdom", bonus: 1, proficient: false } },
  } });
  return sheet;
};

it("le opzioni sommano bonus, TS globale, Maestria e Jack of all trades", () => {
  const sheet = base();
  sheet.options = { bonuses: { "save:wisdom": 1, saveAll: 2, initiative: 1 }, expertise: ["stealth", "insight"], jackOfAllTrades: true };
  const view = effectiveSheet(sheet);
  expect(view.abilities.wisdom.save).toBe(4);
  expect(view.abilities.dexterity.save).toBe(4);
  expect(view.skills.stealth.bonus).toBe(8);
  // Maestria senza competenza non conta; Jack of all trades sì (metà di 3 per difetto).
  expect(view.skills.insight.bonus).toBe(2);
  expect(view.combat.initiative).toBe(4);
  expect(explainValue(sheet, view, "initiative", "Iniziativa", view.combat.initiative)).toBe("Iniziativa +4\nBase +2\nOpzioni +1\nJack of all trades +1");
});

it("la gamma del critico delle opzioni allarga quella delle azioni", () => {
  const sheet = base();
  sheet.options = { critRange: 19 };
  expect(resolveAction(sheet, { id: "a", name: "Spada", critRange: 20 }).critRange).toBe(19);
  expect(resolveAction(sheet, { id: "b", name: "Falcione", critRange: 18 }).critRange).toBe(18);
});

it("il modificatore dei TS contro la morte conta, ma 1 naturale resta due fallimenti", () => {
  const combat = base().combat;
  expect(applyDeathSave(combat, 8, 2).deathSaves).toEqual({ successes: 1, failures: 0 });
  expect(applyDeathSave(combat, 1, 10).deathSaves).toEqual({ successes: 0, failures: 2 });
});

it("competenza per livello: salendo di livello cambiano i valori con competenza, e si può personalizzare", () => {
  const sheet = base();
  expect(sheet.options).toEqual({ proficiency: "level" });
  sheet.identity.level = 9; // per livello +4, importato +3 → +1 a ciò che usa la competenza
  sheet.skills.stealth.proficient = true;
  sheet.abilities.wisdom.saveProficient = true;
  const view = effectiveSheet(sheet);
  expect(view.combat.proficiencyBonus).toBe(4);
  expect(view.skills.stealth.bonus).toBe(6);
  expect(view.skills.insight.bonus).toBe(1);
  expect(view.abilities.wisdom.save).toBe(2);
  expect(explainValue(sheet, view, "skill:stealth", "Furtività", view.skills.stealth.bonus)).toBe("Furtività +6\nBase +5\nCompetenza +1");
  sheet.options = { proficiency: 3 };
  expect(effectiveSheet(sheet).skills.stealth.bonus).toBe(5);
});

it("un bonus importato diverso da quello per livello resta personalizzato anche salendo di livello", () => {
  const sheet = importRoll20({ character: { name: "Eroe" }, normalized: { identity: { character_name: "Eroe", level: 1 }, combat: { proficiency_bonus: 3 } } });
  expect(sheet.options).toEqual({ proficiency: 3 });
  sheet.identity.level = 9;
  expect(effectiveSheet(sheet).combat.proficiencyBonus).toBe(3);
});

it("tooltip di iniziativa, TS e abilità: caratteristica, competenza se si applica, fonti e Altro", () => {
  const sheet = base();
  sheet.abilities.wisdom.saveProficient = true;
  sheet.abilities.wisdom.save = 4;
  sheet.options = { proficiency: "level", jackOfAllTrades: true };
  const view = effectiveSheet(sheet);
  expect(explainCheck(sheet, view, "initiative", "Iniziativa", view.combat.initiative)).toBe("Iniziativa +3\nDestrezza +2\nJack of all trades +1");
  expect(explainCheck(sheet, view, "save:wisdom", "TS Saggezza", view.abilities.wisdom.save)).toBe("TS Saggezza +4\nSaggezza +1\nCompetenza +3");
  expect(explainCheck(sheet, view, "skill:stealth", "Furtività", view.skills.stealth.bonus)).toBe("Furtività +5\nDestrezza +2\nCompetenza +3");
  expect(explainCheck(sheet, view, "skill:insight", "Intuizione", view.skills.insight.bonus)).toBe("Intuizione +2\nSaggezza +1\nJack of all trades +1");
  expect(explainCheck(sheet, view, "passivePerception", "Percezione passiva", 11)).toBe("Percezione passiva 11\nBase 10\nSaggezza +1");
});
