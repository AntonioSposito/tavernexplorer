import { expect, it } from "vitest";
import { createBlankSheet } from "./blankSheet";
import { applyLevelUp, hitPointGain, sheetClasses } from "./levelUp";

const fighter = (level: number) => {
  const sheet = createBlankSheet("Eroe");
  sheet.classes = [{ name: "Fighter", level }];
  sheet.identity.level = level;
  sheet.combat.hp = { current: 20, max: 30, temp: 0 };
  sheet.combat.hitDice = { current: level, max: level, die: "d10" };
  sheet.abilities.strength = { score: 16, mod: 3, save: 3, saveProficient: false };
  return sheet;
};
const plan = { className: "Fighter", hitPoints: 8, features: [], spells: [] };

it("PF del livello: media del dado più COS, o il tiro, mai meno di 1", () => {
  expect([hitPointGain(10, 2), hitPointGain(10, 2, 3), hitPointGain(6, -3, 1)]).toEqual([8, 5, 1]);
});

it("sale di livello nella classe scelta: livello, dadi vita, PF, competenza e sottoclasse", () => {
  const next = applyLevelUp(fighter(4), { ...plan, subclass: "Champion" });
  expect(next.classes).toEqual([{ name: "Fighter", level: 5, subclass: "Champion" }]);
  expect(next.identity.level).toBe(5);
  expect(next.combat.hitDice).toMatchObject({ current: 5, max: 5, die: "d10" });
  expect(next.combat.hp).toMatchObject({ current: 28, max: 38 });
});

it("una classe nuova è una multiclasse dal 1° livello", () => {
  expect(applyLevelUp(fighter(3), { ...plan, className: "Wizard" }).classes).toEqual([{ name: "Fighter", level: 3 }, { name: "Wizard", level: 1 }]);
});

it("aggiunge privilegi, talento, incantesimi e l'aumento di caratteristica fino a 20", () => {
  const next = applyLevelUp(fighter(3), { ...plan, features: [{ name: "Extra Attack", description: "Due attacchi." }], abilityIncrease: ["strength", "strength"], feat: undefined,
    spells: [{ name: "Shield", level: 1, school: "Abjuration", prepared: false, ritual: false, concentration: false, castingTime: "1 reaction", range: "Self", duration: "1 round", components: { verbal: true, somatic: true, material: false }, description: "" }] });
  expect(next.abilities.strength).toMatchObject({ score: 18, mod: 4 });
  expect(next.traits.map((item) => [item.name, item.sourceKind])).toEqual([["Extra Attack", "Class"]]);
  expect(next.spells.map((spell) => spell.name)).toEqual(["Shield"]);
  const capped = fighter(3); capped.abilities.strength.score = 19;
  expect(applyLevelUp(capped, { ...plan, abilityIncrease: ["strength", "strength"] }).abilities.strength.score).toBe(20);
});

it("una scheda importata senza elenco classi parte da classe e livello dell'identità", () => {
  const sheet = createBlankSheet("Eroe");
  sheet.identity = { ...sheet.identity, className: "Rogue", level: 2, subclass: "" };
  expect(sheetClasses(sheet)).toEqual([{ name: "Rogue", level: 2 }]);
  sheet.options = { ...sheet.options, autoLevel: false };
  const next = applyLevelUp(sheet, { ...plan, className: "Rogue" });
  expect([next.identity.level, next.combat.hitDice.max]).toEqual([3, 2]);
});

it("i privilegi che sono opzioni del tab Modifica le attivano, e la Maestria va sulle abilità scelte", () => {
  const bard = fighter(1);
  bard.options = { ...bard.options, expertise: ["stealth"] };
  const next = applyLevelUp(bard, { ...plan, features: [{ name: "Jack of All Trades", description: "" }, { name: "Expertise", description: "" }], expertise: ["persuasion", "performance"] });
  expect(next.options).toMatchObject({ jackOfAllTrades: true, expertise: ["stealth", "persuasion", "performance"] });
  expect(applyLevelUp(fighter(2), { ...plan, features: [{ name: "Improved Critical", description: "" }] }).options?.critRange).toBe(19);
  expect(applyLevelUp(fighter(6), { ...plan, features: [{ name: "Reliable Talent", description: "" }] }).options?.reliableTalent).toBe(true);
});

it("i tratti della classe hanno il livello nel source type e la scelta fatta nella descrizione", () => {
  const asi = { name: "Ability Score Improvement", description: "Aumenta." };
  const [split] = applyLevelUp(fighter(3), { ...plan, features: [asi], abilityIncrease: ["strength", "constitution"] }).traits;
  expect([split.sourceType, split.description]).toEqual(["Fighter 4", "Scelta: FOR +1, COS +1\n\nAumenta."]);
  expect(applyLevelUp(fighter(3), { ...plan, features: [asi], abilityIncrease: ["strength", "strength"] }).traits[0].description).toMatch(/^Scelta: FOR \+2/);
  const withFeat = applyLevelUp(fighter(3), { ...plan, features: [asi], feat: { name: "Alert", description: "" } }).traits;
  expect(withFeat.map((item) => [item.name, item.description.split("\n")[0]])).toEqual([["Ability Score Improvement", "Scelta: talento Alert"], ["Alert", ""]]);
  expect(applyLevelUp(fighter(2), { ...plan, subclass: "Champion", subclassFeature: "Fighter Subclass", features: [{ name: "Fighter Subclass", description: "" }] }).traits[0].description).toBe("Scelta: Champion");
  expect(applyLevelUp(fighter(1), { ...plan, features: [{ name: "Expertise", description: "" }], expertise: ["stealth"] }).traits[0].description).toBe("Scelta: Maestria in Furtività");
});
