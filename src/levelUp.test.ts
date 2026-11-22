import { describe, expect, it } from "vitest";
import { createBlankSheet } from "./blankSheet";
import { effectiveSheet } from "./effects";
import { applyLevel, featLevel, levelSummary, multiclassBlock } from "./levelUp";
import type { CharacterSheet } from "./types";

function character(className: string, level: number, scores: Record<string, number> = {}): CharacterSheet {
  const sheet = createBlankSheet("Eroe");
  sheet.classes = [{ name: className, level }];
  sheet.identity.level = level;
  sheet.combat.hitDice = { current: level, max: level, die: "d10" };
  for (const [key, score] of Object.entries(scores)) sheet.abilities[key] = { ...sheet.abilities[key], score, mod: Math.floor((score - 10) / 2) };
  return sheet;
}

describe("applyLevel", () => {
  it("Guerriero 1 → 4: PF, dadi vita, competenza, sottoclasse al 3 e ASI al 4", () => {
    let sheet = character("Fighter", 1, { constitution: 14, strength: 15 });
    sheet.combat.hp = { current: 12, max: 12, temp: 0 };
    sheet = applyLevel(sheet, "Fighter", 2, {});
    sheet = applyLevel(sheet, "Fighter", 3, { subclass: "Champion", hpRoll: 3 });
    sheet = applyLevel(sheet, "Fighter", 4, { feat: { kind: "asi", abilities: ["strength", "strength"] } });
    const view = effectiveSheet(sheet);
    // 12 + (6+2) + (3+2) + (6+2)
    expect(sheet.combat.hp).toEqual({ current: 33, max: 33, temp: 0 });
    expect(sheet.combat.hitDice).toMatchObject({ current: 4, max: 4, die: "d10" });
    expect(sheet.identity).toMatchObject({ level: 4, subclass: "Champion", classDisplay: "Champion Fighter 4" });
    expect(view.combat.proficiencyBonus).toBe(2);
    expect(view.abilities.strength.score).toBe(17);
    expect(sheet.traits).toMatchObject([{ name: "Ability Score Improvement", featureId: "Fighter:4:feat", sourceKind: "Feat", description: "FOR +2 (massimo 20)" }]);
    expect(effectiveSheet(applyLevel(sheet, "Fighter", 5, {})).combat.proficiencyBonus).toBe(3);
  });

  it("Mago 4 → 5 con COS +2, valore fisso: +6 PF, competenza +3, slot 4/3/2", () => {
    const sheet = character("Wizard", 4, { constitution: 14 });
    sheet.combat.hp = { current: 20, max: 26, temp: 0 };
    const next = applyLevel(sheet, "Wizard", 5, {});
    expect(next.combat.hp).toMatchObject({ current: 26, max: 32 });
    expect(effectiveSheet(next).combat.proficiencyBonus).toBe(3);
    expect(next.spellcasting.slots).toEqual({ level_1: { total: 4, used: 0 }, level_2: { total: 3, used: 0 }, level_3: { total: 2, used: 0 } });
    expect(levelSummary(sheet, next)).toEqual(["Livello 4 → 5: Wizard 5", "PF massimi 26 → 32", "Dadi vita 4 → 5", "Competenza +2 → +3", "Slot 1°: 4, 2°: 3 → 1°: 4, 2°: 3, 3°: 2"]);
  });

  it("almeno 1 PF col tiro più basso e COS negativa", () => {
    const sheet = character("Wizard", 1, { constitution: 6 });
    expect(applyLevel(sheet, "Wizard", 2, { hpRoll: 1 }).combat.hp.max).toBe(2);
  });

  it("ASI in COS: +1 PF anche per i livelli passati; FOR 19 + 2 → 20", () => {
    const sheet = character("Fighter", 3, { constitution: 15, strength: 19 });
    sheet.combat.hp = { current: 28, max: 28, temp: 0 };
    const next = applyLevel(sheet, "Fighter", 4, { feat: { kind: "asi", abilities: ["constitution", "strength"] } });
    // 6 + COS 2 del livello, +1 per i 4 livelli col nuovo modificatore 3
    expect(next.combat.hp.max).toBe(28 + 8 + 4);
    expect(levelSummary(sheet, next)).toContain("FOR 19 → 20");
    const capped = applyLevel(sheet, "Fighter", 4, { feat: { kind: "asi", abilities: ["strength", "strength"] } });
    expect(effectiveSheet(capped).abilities.strength.score).toBe(20);
  });

  it("talento al posto dell'ASI e Dono epico al 19 (massimo 30)", () => {
    const feat = applyLevel(character("Wizard", 3), "Wizard", 4, { feat: { kind: "feat", name: "War Caster" } });
    expect(feat.traits).toMatchObject([{ name: "War Caster", featureId: "Wizard:4:feat", sourceKind: "Feat" }]);
    const boon = applyLevel(character("Fighter", 18, { strength: 20 }), "Fighter", 19, { feat: { kind: "boon", name: "Boon of Fortitude", ability: "strength" } });
    expect(effectiveSheet(boon).abilities.strength.score).toBe(21);
  });

  it("lo stesso livello aggiorna il suo tratto invece di duplicarlo, ma non quello modificato a mano", () => {
    const sheet = character("Wizard", 3);
    const first = applyLevel(sheet, "Wizard", 4, { feat: { kind: "feat", name: "Alert" } });
    const again = applyLevel(first, "Wizard", 4, { feat: { kind: "feat", name: "Lucky" } });
    expect(again.traits.map((trait) => [trait.id, trait.name])).toEqual([[first.traits[0].id, "Lucky"]]);
    first.traits[0] = { ...first.traits[0], description: "mia nota", edited: true };
    expect(applyLevel(first, "Wizard", 4, { feat: { kind: "feat", name: "Lucky" } }).traits).toMatchObject([{ name: "Alert", description: "mia nota" }]);
  });

  it("multiclasse: nuova classe al livello 1 con il suo dado vita", () => {
    const sheet = character("Fighter", 2, { constitution: 12, strength: 13, wisdom: 13 });
    sheet.combat.hp = { current: 20, max: 20, temp: 0 };
    const next = applyLevel(sheet, "Cleric", 1, {});
    expect(next.classes).toEqual([{ name: "Fighter", level: 2 }, { name: "Cleric", level: 1 }]);
    expect(next.combat.hp.max).toBe(20 + 5 + 1);
    expect(next.identity).toMatchObject({ level: 3, classDisplay: "Fighter 2 / Cleric 1" });
  });

  it("senza calcolo automatico: livello, classi e un dado vita in più", () => {
    const sheet = character("Fighter", 2);
    sheet.options = { proficiency: "level" };
    const next = applyLevel(sheet, "Fighter", 3, { subclass: "Champion" });
    expect(next.identity).toMatchObject({ level: 3, subclass: "Champion", classDisplay: "Champion Fighter 3" });
    expect(next.combat.hitDice).toMatchObject({ current: 3, max: 3 });
  });
});

describe("privilegi di classe", () => {
  const climb = (sheet: CharacterSheet, from: number, to: number, texts?: Record<string, string>) => {
    for (let level = from + 1; level <= to; level += 1) sheet = applyLevel(sheet, "Barbarian", level, { texts, ...level === 3 && { subclass: "Path of the Berserker" } });
    return sheet;
  };
  const counter = (sheet: CharacterSheet, name: string) => sheet.counters?.find((item) => item.name === name);

  it("Barbaro 1 → 2: il tratto Rage della creazione guidata diventa il privilegio, con risorsa ed effetto", () => {
    const sheet = character("Barbarian", 1);
    sheet.traits = [{ id: "rage", name: "Rage", description: "testo della creazione guidata", sourceKind: "Class" }];
    const next = climb(sheet, 1, 2, { "2:Danger Sense": "Vantaggio ai TS di Destrezza." });
    const rage = next.traits.find((trait) => trait.name === "Rage")!;
    expect(rage).toMatchObject({ id: "rage", featureId: "Barbarian:1:Rage", description: "testo della creazione guidata" });
    expect(counter(next, "Rage")).toMatchObject({ current: 2, max: 2, recovery: "shortOne", traitId: "rage" });
    expect(next.effects?.map((effect) => [effect.name, effect.active, effect.featureId])).toEqual([["Ira", false, "Barbarian:1:Rage"], ["Attacco irruento", false, "Barbarian:2:Reckless Attack"]]);
    expect(next.traits.map((trait) => trait.name)).toEqual(["Rage", "Unarmored Defense", "Weapon Mastery", "Danger Sense", "Reckless Attack"]);
    expect(next.traits.find((trait) => trait.name === "Danger Sense")).toMatchObject({ description: "Vantaggio ai TS di Destrezza.", sourceType: "Barbarian 2", modifiers: [{ target: "adv:save:dexterity" }] });
    expect(levelSummary(sheet, next)).toEqual(expect.arrayContaining(["Nuova risorsa: Rage (2)", "Nuovo effetto: Ira", "Nuovo tratto: Danger Sense"]));
  });

  it("le Ire crescono con il livello e gli usi rimasti salgono della stessa differenza, senza duplicare tratti ed effetti", () => {
    let sheet = climb(character("Barbarian", 1), 1, 2);
    counter(sheet, "Rage")!.current = 1;
    sheet = climb(sheet, 2, 3);
    expect(counter(sheet, "Rage")).toMatchObject({ current: 2, max: 3 });
    sheet = climb(sheet, 3, 17);
    expect(counter(sheet, "Rage")).toMatchObject({ max: 6 });
    expect(sheet.traits.filter((trait) => trait.name === "Rage")).toHaveLength(1);
    expect(sheet.effects?.filter((effect) => effect.name === "Ira")).toHaveLength(1);
    expect(counter(sheet, "Persistent Rage")).toMatchObject({ max: 1, recovery: "long" });
  });

  it("un effetto Ira già sulla scheda si collega invece di duplicarsi e resta acceso", () => {
    const sheet = character("Barbarian", 1);
    sheet.effects = [{ id: "mia-ira", name: "Ira", active: true, modifiers: [] }];
    const next = climb(sheet, 1, 2);
    expect(next.effects?.find((effect) => effect.name === "Ira")).toMatchObject({ id: "mia-ira", active: true, featureId: "Barbarian:1:Rage" });
  });

  it("modificatori: Unarmored Defense, Fast Movement, Feral Instinct e Primal Champion (massimo 25)", () => {
    const sheet = climb(character("Barbarian", 1, { strength: 23, constitution: 16, dexterity: 14 }), 1, 20);
    const view = effectiveSheet(sheet);
    expect(view.abilities.strength.score).toBe(25);
    expect(view.abilities.constitution.score).toBe(20);
    // 10 + DES 2 + COS 5 senza armatura
    expect(view.combat.ac).toBe(17);
    expect(view.combat.speed).toBe("12 m");
    expect(sheet.traits.find((trait) => trait.name === "Feral Instinct")?.modifiers).toMatchObject([{ target: "adv:initiative" }]);
    expect(sheet.traits.filter((trait) => trait.name === "Improved Brutal Strike").map((trait) => trait.featureId)).toEqual(["Barbarian:13:Improved Brutal Strike", "Barbarian:17:Improved Brutal Strike"]);
  });
});

describe("sottoclassi del Barbaro", () => {
  const climb = (subclass: string, to: number, scores: Record<string, number> = {}) => {
    let sheet = character("Barbarian", 1, scores);
    for (let level = 2; level <= to; level += 1) sheet = applyLevel(sheet, "Barbarian", level, level === 3 ? { subclass } : {});
    return sheet;
  };
  const action = (sheet: CharacterSheet, name: string) => sheet.actions.find((item) => item.name === name);

  it("Berserker: Frenzy 2d6 → 4d6, Mindless Rage nell'Ira, Intimidating Presence con CD e risorsa", () => {
    expect(action(climb("Path of the Berserker", 3), "Frenzy")?.damages?.[0].dice).toBe("2d6");
    const sheet = climb("Path of the Berserker", 16, { strength: 18 });
    expect(action(sheet, "Frenzy")?.damages?.[0].dice).toBe("4d6");
    expect(sheet.actions.filter((item) => item.name === "Frenzy")).toHaveLength(1);
    expect(sheet.effects?.find((effect) => effect.name === "Ira")?.defenses?.map((entry) => entry.name)).toEqual(["Contundenti", "Perforanti", "Taglienti", "Affascinato", "Spaventato"]);
    const presence = action(sheet, "Intimidating Presence")!;
    // 8 + FOR 4 + competenza 5
    expect(presence.save).toEqual({ ability: "wisdom", dc: 17, effect: "Spaventato" });
    expect(presence.resourceId).toBe(sheet.counters?.find((counter) => counter.name === "Intimidating Presence")?.id);
    expect(action(sheet, "Brutal Strike")?.damages?.[0].dice).toBe("1d10");
    expect(action(climb("Path of the Berserker", 17), "Brutal Strike")?.damages?.[0].dice).toBe("2d10");
  });

  it("Zealot: Divine Fury 1d6 + metà livello, dadi di Warrior of the Gods 4 → 7, Rage of the Gods con le sue difese", () => {
    const sheet = climb("Path of the Zealot", 17);
    expect(action(sheet, "Divine Fury")?.damages?.[0]).toMatchObject({ dice: "1d6", bonus: 8 });
    expect(sheet.counters?.find((counter) => counter.name === "Warrior of the Gods")).toMatchObject({ max: 7, recovery: "long" });
    expect(sheet.effects?.find((effect) => effect.name === "Furia degli dei")?.defenses).toHaveLength(4);
    expect(sheet.effects?.find((effect) => effect.name === "Ira")?.defenses).toHaveLength(3);
  });

  it("un'azione modificata a mano non viene sovrascritta dal livello dopo", () => {
    const sheet = climb("Path of the Berserker", 8);
    const frenzy = action(sheet, "Frenzy")!;
    frenzy.description = "mia";
    frenzy.edited = true;
    expect(action(applyLevel(sheet, "Barbarian", 9, {}), "Frenzy")).toMatchObject({ description: "mia", damages: [{ dice: "2d6" }] });
  });
});

describe("featLevel", () => {
  it("ASI ai livelli della classe e Dono epico al 19", () => {
    expect([4, 6, 8, 10, 14, 19].map((level) => featLevel("Fighter", level))).toEqual(["asi", "asi", "asi", undefined, "asi", "boon"]);
    expect([6, 10].map((level) => featLevel("Rogue", level))).toEqual([undefined, "asi"]);
    expect(featLevel("Wizard", 3)).toBeUndefined();
  });
});

describe("multiclassBlock", () => {
  it("Bardo con FOR 8 non può prendere Barbarian; serve anche 13 nella classe attuale", () => {
    expect(multiclassBlock(character("Bard", 3, { strength: 8, charisma: 16 }), "Barbarian")).toBe("serve FOR 13 (Barbarian)");
    expect(multiclassBlock(character("Bard", 3, { strength: 14, charisma: 12 }), "Barbarian")).toBe("serve CAR 13 (Bard)");
    expect(multiclassBlock(character("Bard", 3, { strength: 14, charisma: 16 }), "Barbarian")).toBeUndefined();
    expect(multiclassBlock(character("Bard", 3, { dexterity: 13, charisma: 13 }), "Fighter")).toBeUndefined();
    expect(multiclassBlock(character("Bard", 3, { dexterity: 13, charisma: 13 }), "Monk")).toBe("serve SAG 13 (Monk)");
  });
});
