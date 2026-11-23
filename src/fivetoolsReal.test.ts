import { describe, expect, it } from "vitest";
import { classSlotTotals, preparedLimit, SUBCLASSES } from "./classes";
import { hasFiveToolsData, readFiveTools, SKIP_REASON } from "./fivetoolsData";
import { parseClass, parseProgression } from "./fivetoolsCharacter";

const CLASSES = ["barbarian", "bard", "cleric", "druid", "fighter", "monk", "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard"];
type Row = Record<string, unknown>;

describe.skipIf(!hasFiveToolsData)(`dati veri di 5e.tools${hasFiveToolsData ? "" : ` (${SKIP_REASON})`}`, () => {
  it("le 12 classi del PHB 2024 si leggono e hanno 4 sottoclassi XPHB", async () => {
    for (const name of CLASSES) {
      const file = await readFiveTools(`class/class-${name}.json`);
      expect(parseClass(file)?.name.toLowerCase()).toBe(name);
      const subclasses = (file.subclass as Row[]).filter((row) => row.source === "XPHB" && row.classSource === "XPHB");
      expect(subclasses, name).toHaveLength(4);
    }
  });

  it("level up: ogni classe e sottoclasse ha privilegi con testo e tabelle di 20 valori leggibili", async () => {
    for (const name of CLASSES) {
      const data = parseProgression(await readFiveTools(`class/class-${name}.json`))!;
      const subclasses = [...new Set(data.features.flatMap((feature) => feature.subclass ?? []))];
      expect(subclasses, name).toHaveLength(4);
      expect([...subclasses].sort(), name).toEqual([...SUBCLASSES[name[0].toUpperCase() + name.slice(1)]].sort());
      for (const feature of data.features) {
        expect(feature.description, `${name} ${feature.level} ${feature.name}`).not.toBe("");
        expect(feature.description, feature.name).not.toMatch(/\{@|\[object/);
        expect(subclasses, "introduzione della sottoclasse").not.toContain(feature.name);
      }
      for (const subclass of subclasses) expect(data.features.some((feature) => feature.subclass === subclass && feature.level === 3), subclass).toBe(true);
      for (const column of data.columns) {
        expect(column.values, column.label).toHaveLength(20);
        for (const value of [column.label, ...column.values]) expect(value, column.label).not.toMatch(/^$|\{@|\[object|undefined/);
      }
    }
  });

  it("level up: i privilegi richiamati entrano nel testo, i contenuti di altre fonti restano fuori", async () => {
    const cleric = parseProgression(await readFiveTools("class/class-cleric.json"))!;
    expect(cleric.features.find((feature) => feature.name === "Channel Divinity")?.description).toContain("Turn Undead:");
    const barbarian = parseProgression(await readFiveTools("class/class-barbarian.json"))!;
    expect(barbarian.features.filter((feature) => feature.level === 3 && (!feature.subclass || feature.subclass === "Path of the Zealot")).map((feature) => feature.name)).toEqual(["Primal Knowledge", "Divine Fury", "Warrior of the Gods"]);
    expect(barbarian.columns.map((column) => [column.label, column.values[8]])).toEqual([["Rages", "4"], ["Rage Damage", "+3"], ["Weapon Mastery", "3"]]);
  });

  it("il massimo dei preparati segue la colonna Prepared Spells di ogni classe e sottoclasse", async () => {
    let checked = 0;
    for (const name of CLASSES) {
      const data = parseProgression(await readFiveTools(`class/class-${name}.json`))!;
      const className = name[0].toUpperCase() + name.slice(1);
      for (const column of data.columns.filter((item) => /Prepared/.test(item.label))) {
        checked += 1;
        column.values.forEach((value, index) => expect(preparedLimit([{ name: className, level: index + 1, ...column.subclass && { subclass: column.subclass } }]) ?? 0, `${className} ${index + 1}`).toBe(Number(value)));
      }
    }
    expect(checked).toBe(10);
  });

  it("gli slot di Eldritch Knight e Arcane Trickster seguono la loro tabella dal 3° (la sottoclasse) al 20°", async () => {
    for (const [className, subclass] of [["Fighter", "Eldritch Knight"], ["Rogue", "Arcane Trickster"]]) {
      const file = await readFiveTools(`class/class-${className.toLowerCase()}.json`);
      const row = (file.subclass as Row[]).find((item) => item.name === subclass && item.source === "XPHB")!;
      const table = (row.subclassTableGroups as Row[]).find((group) => group.rowsSpellProgression)!.rowsSpellProgression as number[][];
      for (let level = 3; level <= 20; level += 1) {
        const expected = Object.fromEntries(table[level - 1].flatMap((count, index) => count ? [[`level_${index + 1}`, count]] : []));
        expect(classSlotTotals([{ name: className, level, subclass }]), `${subclass} ${level}`).toEqual(expected);
      }
    }
  });
});
