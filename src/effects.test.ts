import { describe, expect, it } from "vitest";
import { effectiveSheet, modifierTags, modifierTotal } from "./effects";
import type { CharacterSheet, StatModifier } from "./types";

const sheet = (): CharacterSheet => ({
  schemaVersion: 1, id: "hero", name: "Eroe", ruleset: { id: "dnd-5.5", version: "2024.1" },
  identity: { race: "", className: "", subclass: "", classDisplay: "", level: 1, background: "", alignment: "", experience: "" },
  abilities: { dexterity: { score: 14, mod: 2, save: 4, saveProficient: true } },
  skills: { acrobatics: { ability: "dexterity", bonus: 4, proficient: true } },
  combat: { ac: 15, initiative: 2, hp: { current: 10, max: 10, temp: 0 }, passivePerception: 12, speed: "30 ft", proficiencyBonus: 2, inspiration: false, hitDice: { current: 1, max: 1, die: "d8" }, deathSaves: { successes: 0, failures: 0 } },
  spellcasting: { ability: "intelligence", saveDc: 13, attackBonus: 5, slots: {} },
  inventory: [{ id: "armor", name: "Armatura", count: 1, equipped: false, modifiers: [{ id: "ac", target: "ac", amount: 2 }] }],
  effects: [{ id: "bless", name: "Destrezza", active: true, modifiers: [{ id: "dex", target: "ability:dexterity", amount: 2 }, { id: "skill", target: "skill:acrobatics", amount: -1 }] }],
  actions: [], spells: [], traits: [], currency: {}, biography: "", importWarnings: [],
});

describe("effetti di oggetti e condizioni", () => {
  it("applica solo oggetti equipaggiati ed effetti attivi senza cambiare la base", () => {
    const original = sheet();
    expect(effectiveSheet(original).combat.ac).toBe(15);
    original.inventory[0].equipped = true;
    const effective = effectiveSheet(original);
    expect(effective.combat.ac).toBe(17);
    expect(effective.abilities.dexterity).toMatchObject({ score: 16, mod: 3, save: 5 });
    expect(effective.skills.acrobatics.bonus).toBe(4);
    expect(original.abilities.dexterity.score).toBe(14);
  });
  it("ignora effetti disattivi e oggetti esauriti", () => {
    const original = sheet(); original.effects![0].active = false; original.inventory[0].equipped = true; original.inventory[0].count = 0;
    expect(modifierTotal(original, "ac")).toBe(0);
    expect(effectiveSheet(original).abilities.dexterity.mod).toBe(2);
  });
});

it("i tag di vantaggio e svantaggio non hanno valore; i modificatori senza voce non compaiono", () => {
  expect(modifierTags([{ id: "a", target: "adv:attack", amount: 1 }, { id: "b", target: "", amount: 1 }, { id: "c", target: "speed", amount: 3 }])).toEqual(["Vantaggio: tiri per colpire", "Velocità (m) +3"]);
});

it("i danni dell'Ira crescono col livello da barbaro, o col livello del personaggio senza classi", () => {
  const raging = (level: number, classes?: CharacterSheet["classes"]) => { const hero = sheet(); hero.identity.level = level; hero.classes = classes; hero.effects = [{ id: "ira", name: "Ira", active: true, modifiers: [{ id: "d", target: "damage", amount: 0, scale: "rage" }] }]; return modifierTotal(hero, "damage"); };
  expect([raging(1), raging(9), raging(16)]).toEqual([2, 3, 4]);
  expect(raging(12, [{ name: "Barbarian", level: 8 }, { name: "Fighter", level: 4 }])).toBe(2);
  expect(modifierTags([{ id: "d", target: "damage", amount: 0, scale: "rage" }])).toEqual(["Danni +Ira"]);
});

it("i modificatori scale level crescono col livello del personaggio (Tough, Dwarven Toughness); Alert segue la competenza", () => {
  const at = (level: number, target: string, modifier: Omit<StatModifier, "id">) => { const hero = sheet(); hero.identity.level = level; hero.options = { proficiency: "level" }; hero.traits = [{ id: "t", name: "T", description: "", modifiers: [{ id: "m", ...modifier }] }]; return modifierTotal(hero, target); };
  const tough = { target: "hpMax", amount: 2, scale: "level" } as const;
  expect([at(1, "hpMax", tough), at(5, "hpMax", tough), at(20, "hpMax", tough)]).toEqual([2, 10, 40]);
  expect(at(5, "hpMax", { target: "hpMax", amount: 1, scale: "level" })).toBe(5);
  const alert = { target: "initiative", amount: 0, proficient: true };
  expect([at(1, "initiative", alert), at(5, "initiative", alert), at(17, "initiative", alert)]).toEqual([2, 3, 6]);
  expect(modifierTags([{ id: "m", ...tough }])).toEqual(["PF massimi +2 × livello"]);
});

it("i modificatori con condizione valgono solo con l'equipaggiamento giusto (armatura, scudo)", () => {
  const worn = (items: Array<[name: string, target: string, amount: number]>) => {
    const hero = sheet();
    hero.inventory = items.map(([name, target, amount], index) => ({ id: `i${index}`, name, count: 1, equipped: true, modifiers: [{ id: `m${index}`, target, amount }] }));
    hero.traits = [
      { id: "barbaro", name: "Unarmored Defense", description: "", modifiers: [{ id: "con", target: "ac", amount: 3, when: "noArmor" }] },
      { id: "monaco", name: "Unarmored Movement", description: "", modifiers: [{ id: "mov", target: "speed", amount: 3, when: "noArmorNoShield" }] },
      { id: "fast", name: "Fast Movement", description: "", modifiers: [{ id: "fast", target: "speed", amount: 3, when: "noHeavyArmor" }] },
      { id: "defense", name: "Defense", description: "", modifiers: [{ id: "def", target: "initiative", amount: 1, when: "armor" }] },
    ];
    return { unarmored: modifierTotal(hero, "ac") - items.filter(([, target]) => target === "ac").reduce((sum, [, , amount]) => sum + amount, 0), speed: modifierTotal(hero, "speed"), armor: modifierTotal(hero, "initiative") };
  };
  expect(worn([])).toEqual({ unarmored: 3, speed: 6, armor: 0 });
  expect(worn([["Shield", "ac", 2]])).toEqual({ unarmored: 3, speed: 3, armor: 0 });
  expect(worn([["Scale Mail", "armor:medium", 14]])).toEqual({ unarmored: 0, speed: 3, armor: 1 });
  expect(worn([["Plate Armor", "armor:heavy", 18]])).toEqual({ unarmored: 0, speed: 0, armor: 1 });
  expect(modifierTags([{ id: "c", target: "ac", amount: 0, ability: "constitution", when: "noArmor" }])).toEqual(["Classe armatura +Costituzione (senza armatura)"]);
});

it("minimo +1: il bonus da caratteristica non scende sotto 1 (Aura of Protection)", () => {
  const aura = (charisma: number) => { const hero = sheet(); hero.abilities.charisma = { score: 10 + 2 * charisma, mod: charisma, save: charisma, saveProficient: false }; hero.traits = [{ id: "a", name: "Aura of Protection", description: "", modifiers: [{ id: "m", target: "save:dexterity", amount: 0, ability: "charisma", min: 1 }] }]; return modifierTotal(hero, "save:dexterity"); };
  expect([aura(-1), aura(0), aura(3)]).toEqual([1, 1, 3]);
  expect(modifierTags([{ id: "m", target: "save:dexterity", amount: 0, ability: "charisma", min: 1 }])).toEqual(["TS Destrezza +Carisma (minimo +1)"]);
});

it("tetto dei punteggi: ogni bonus si ferma al suo massimo, i tetti più bassi prima, senza abbassare il punteggio", () => {
  const strength = (score: number, modifiers: Array<Omit<StatModifier, "id">>) => {
    const hero = sheet();
    hero.abilities.strength = { score, mod: Math.floor((score - 10) / 2), save: 0, saveProficient: false };
    hero.traits = modifiers.map((modifier, index) => ({ id: `t${index}`, name: `T${index}`, description: "", modifiers: [{ id: `m${index}`, ...modifier }] }));
    return effectiveSheet(hero).abilities.strength.score;
  };
  const asi = { target: "ability:strength", amount: 2, max: 20 };
  const champion = { target: "ability:strength", amount: 4, max: 25 };
  const boon = { target: "ability:strength", amount: 1, max: 30 };
  expect([strength(17, [asi]), strength(19, [asi]), strength(20, [asi]), strength(22, [asi])]).toEqual([19, 20, 20, 22]);
  // Primal Champion dopo l'ASI anche se scritto prima.
  expect(strength(19, [champion, asi])).toBe(24);
  expect(strength(23, [champion])).toBe(25);
  expect([strength(29, [boon]), strength(30, [boon])]).toEqual([30, 30]);
  // Un oggetto senza tetto si somma dopo.
  expect(strength(19, [{ target: "ability:strength", amount: 2 }, asi])).toBe(22);
  expect(modifierTags([{ id: "m", ...asi }])).toEqual(["Forza +2 (fino a 20)"]);
});

it("i modificatori \"+ caratteristica\" usano il punteggio con i bonus (Unarmored Defense con un ASI alla COS)", () => {
  const hero = sheet();
  hero.abilities.constitution = { score: 14, mod: 2, save: 2, saveProficient: false };
  hero.traits = [
    { id: "ud", name: "Unarmored Defense", description: "", modifiers: [{ id: "ac", target: "ac", amount: 0, ability: "constitution" }] },
    { id: "asi", name: "ASI", description: "", modifiers: [{ id: "con", target: "ability:constitution", amount: 2 }] },
  ];
  expect(modifierTotal(hero, "ac")).toBe(3);
});
