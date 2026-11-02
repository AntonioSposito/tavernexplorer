import { expect, it } from "vitest";
import { resolveAction } from "./actions";
import { effectiveSheet, explainValue } from "./effects";
import { applyDeathSave } from "./hitPoints";
import { importRoll20 } from "./importer";

const base = () => {
  const sheet = importRoll20({ character: { name: "Eroe" }, normalized: {
    identity: { character_name: "Eroe" }, combat: { proficiency_bonus: 3, initiative: 2 },
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
