import { describe, expect, it } from "vitest";
import { effectiveSheet, modifierTags, modifierTotal } from "./effects";
import type { CharacterSheet } from "./types";

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
