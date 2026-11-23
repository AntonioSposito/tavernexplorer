import { describe, expect, it } from "vitest";
import { createBlankSheet } from "./blankSheet";
import { effectiveSheet } from "./effects";
import type { ClassProgression } from "./fivetoolsCharacter";
import { applyLevel, featLevel, levelSummary, manualSteps, multiclassBlock, newFeatures, tableChanges } from "./levelUp";
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
    expect(levelSummary(sheet, next)).toEqual(["Livello 4 → 5: Wizard 5", "PF massimi 26 → 32", "Dadi vita 4 → 5", "Competenza +2 → +3", "Slot 1°: 4, 2°: 3 → 1°: 4, 2°: 3, 3°: 2", "Preparati al massimo 7 → 9"]);
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

describe("privilegi e tabelle da 5e.tools", () => {
  const data: ClassProgression = {
    features: [
      { name: "Expertise", level: 1, description: "due" }, { name: "Cunning Action", level: 2, description: "Azione bonus" },
      { name: "Steady Aim", level: 3, description: "" }, { name: "Assassinate", level: 3, description: "", subclass: "Assassin" }, { name: "Fast Hands", level: 3, description: "", subclass: "Thief" },
      { name: "Expertise", level: 6, description: "altre due" },
    ],
    columns: [{ label: "Sneak Attack", values: ["1d6", "1d6", "2d6"] }, { label: "Cantrips", values: ["3", "3", "4"], subclass: "Thief" }],
  };
  it("solo i privilegi del livello, della classe e della propria sottoclasse", () => {
    expect(newFeatures(data, 3, "Thief").map((feature) => feature.name)).toEqual(["Steady Aim", "Fast Hands"]);
  });

  it("un tratto già presente con lo stesso nome resta com'è e il nuovo si aggiunge accanto", () => {
    const sheet = character("Rogue", 1);
    sheet.traits = [{ id: "a", name: "Cunning Action", description: "mio" }];
    const next = applyLevel(sheet, "Rogue", 2, { features: newFeatures(data, 2) });
    expect(next.traits).toMatchObject([{ id: "a", description: "mio" }, { name: "Cunning Action", description: "Azione bonus", featureId: "Rogue:2:Cunning Action", sourceType: "Rogue 2" }]);
    expect(levelSummary(sheet, next)).toContain("Nuovo tratto: Cunning Action");
  });

  it("rifare lo stesso livello non duplica il privilegio e non tocca quello che c'è", () => {
    const next = applyLevel(character("Rogue", 1), "Rogue", 2, { features: newFeatures(data, 2) });
    next.traits[0] = { ...next.traits[0], description: "mio" };
    expect(applyLevel(next, "Rogue", 2, { features: newFeatures(data, 2) }).traits).toEqual(next.traits);
  });

  it("promemoria: solo le colonne che cambiano, della propria sottoclasse", () => {
    expect(tableChanges(data, 3, "Thief")).toEqual(["Sneak Attack 1d6 → 2d6", "Trucchetti 3 → 4"]);
    expect(tableChanges(data, 3)).toEqual(["Sneak Attack 1d6 → 2d6"]);
    expect(tableChanges(data, 2)).toEqual([]);
    expect(tableChanges(data, 1)).toEqual(["Sneak Attack 0 → 1d6"]);
  });
});

describe("cose da sistemare a mano", () => {
  it("col massimo dei preparati automatico il promemoria diventa la scelta degli incantesimi", () => {
    const sheet = { ...character("Cleric", 1), options: { autoLevel: true, preparedBonus: 1 } };
    const choices = { features: [{ name: "Channel Divinity", level: 2, description: "" }] };
    const after = applyLevel(sheet, "Cleric", 2, choices);
    expect(levelSummary(sheet, after)).toContain("Preparati al massimo 5 → 6");
    expect(manualSteps(sheet, after, choices, ["Channel Divinity 0 → 2", "Incantesimi preparati 4 → 5"])).toEqual([
      "Channel Divinity 0 → 2", "Incantesimi nuovi da scegliere (preparati al massimo 5 → 6)",
      "Privilegi da impostare se hanno modificatori, risorse, azioni o effetti: Channel Divinity",
    ]);
  });

  it("col calcolo automatico spento resta il promemoria della tabella; talento e privilegi mancanti si ricordano", () => {
    const sheet = { ...character("Cleric", 3), options: { autoLevel: false } };
    const choices = { feat: { kind: "feat" as const, name: "War Caster" } };
    expect(manualSteps(sheet, applyLevel(sheet, "Cleric", 4, choices), choices, ["Incantesimi preparati 6 → 7"], "Forge Domain")).toEqual([
      "Incantesimi preparati 6 → 7", "Privilegi di Forge Domain da aggiungere ai tratti", "War Caster: descrizione ed effetti del talento",
    ]);
  });

  it("l'avviso si salva sulla scheda; senza cose da fare non c'è, e quelli non chiusi si accumulano", () => {
    let sheet = applyLevel(character("Fighter", 1), "Fighter", 2, { reminders: ["A"] });
    expect(sheet.levelUpNotes).toEqual([{ title: "Livello 2 (Fighter 2)", lines: ["A"] }]);
    sheet = applyLevel(sheet, "Fighter", 3, { reminders: [] });
    sheet = applyLevel(sheet, "Fighter", 4, { reminders: ["B"] });
    expect(sheet.levelUpNotes?.map((note) => note.lines[0])).toEqual(["A", "B"]);
  });
});
