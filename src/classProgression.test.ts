import { describe, expect, it } from "vitest";
import { createBlankSheet } from "./blankSheet";
import { SUBCLASSES } from "./classes";
import { trait } from "./buildCharacter";
import { syncClassResources } from "./classResources";
import { applyClassChanges, derivedSlots } from "./classSync";
import { effectiveSheet } from "./effects";
import { hasFiveToolsData, readFiveTools, SKIP_REASON } from "./fivetoolsData";
import { parseLevelOptions } from "./fivetoolsCharacter";
import { applyLevelUp } from "./levelUp";
import type { CharacterSheet, ResourceCounter } from "./types";

// TE-75: ogni classe e sottoclasse del PHB 2024 dal 1° al 20° con scelte di default, confrontata con le tabelle di 5e.tools.
// Ogni differenza è una riga di `problems`: il test le mostra tutte insieme.
type Row = Record<string, unknown>;
const XPHB = "XPHB";
const label = (value: unknown) => String(value).replace(/^\{@\w+ ([^|}]*)[^}]*\}$/, "$1");
const num = (value: unknown) => typeof value === "object" && value ? Number((value as Row).value ?? 0) : Number.parseInt(label(value), 10) || 0;

interface Table { columns: string[]; rows: unknown[][]; slots?: number[][] }
const tables = (groups: unknown): Table[] => (Array.isArray(groups) ? groups as Row[] : []).map((group) => ({
  columns: (group.colLabels as unknown[]).map(label), rows: (group.rows ?? []) as unknown[][], slots: group.rowsSpellProgression as number[][] | undefined,
}));
// Slot attesi a un livello: tabella della classe e della sottoclasse (terzi incantatori), o colonne del patto del Warlock.
function expectedSlots(groups: Table[], level: number): Record<string, number> {
  const slots: Record<string, number> = {};
  for (const group of groups) {
    group.slots?.[level - 1]?.forEach((count, index) => { if (count) slots[`level_${index + 1}`] = count; });
    const count = group.columns.indexOf("Spell Slots"), slotLevel = group.columns.indexOf("Slot Level");
    if (count >= 0 && slotLevel >= 0) slots[`level_${num(group.rows[level - 1][slotLevel])}`] = num(group.rows[level - 1][count]);
  }
  return slots;
}
const column = (groups: Table[], name: string, level: number) => { for (const group of groups) { const index = group.columns.indexOf(name); if (index >= 0) return group.rows[level - 1][index]; } };

// Colonna della tabella → risorsa di classe (TE-85).
const COUNTERS: Record<string, ResourceCounter["classResource"]> = {
  Rages: "rage", "Channel Divinity": "channel", "Wild Shape": "wildShape", "Second Wind": "secondWind", "Focus Points": "focus",
  "Sorcery Points": "sorcery", "Favored Enemy": "favoredEnemy", Number: "psionic",
};

const cases =Object.entries(SUBCLASSES).filter(([name]) => name !== "Artificer").flatMap(([className, subclasses]) => subclasses.map((subclass) => [className, subclass]));

describe.skipIf(!hasFiveToolsData)(`classi PHB 2024 dal 1° al 20°${hasFiveToolsData ? "" : ` (${SKIP_REASON})`}`, () => {
  it.each(cases)("%s · %s", async (className, subclass) => {
    const file = await readFiveTools(`class/class-${className.toLowerCase()}.json`);
    const row = (file.class as Row[]).find((item) => item.source === XPHB)!;
    const data = (file.subclass as Row[]).find((item) => item.name === subclass && item.source === XPHB && item.classSource === XPHB);
    expect(data, `${subclass} non è una sottoclasse XPHB`).toBeDefined();
    const groups = [...tables(row.classTableGroups), ...tables(data!.subclassTableGroups)];
    const subclassFeatures = (file.subclassFeature as Row[]).filter((feature) => feature.className === className && feature.subclassShortName === data!.shortName && feature.subclassSource === XPHB);
    const die = Number((row.hd as Row).faces);
    const problems: string[] = [];

    // 1° livello come la creazione guidata (buildCharacter): classe, calcolo automatico, privilegi del 1° come tratti.
    const blank = createBlankSheet("Prova");
    let sheet: CharacterSheet = structuredClone(blank);
    sheet.classes = [{ name: className, level: 1 }];
    sheet.combat.hp = { current: die, max: die, temp: 0 };
    applyClassChanges(sheet, blank);
    sheet.traits = parseLevelOptions(file, 1).features.map((feature) => trait(feature, "Class", `${className} 1`));
    syncClassResources(sheet);
    for (let level = 1; level <= 20; level += 1) {
      if (level > 1) {
        const options = parseLevelOptions(file, level, sheet.classes?.[0]?.subclass ?? subclass);
        if (options.subclasses.length && !options.subclasses.includes(subclass)) problems.push(`${level}: ${subclass} non è tra le sottoclassi proposte`);
        const chosen = options.subclasses.length ? subclass : undefined;
        sheet = applyLevelUp(sheet, { className, subclass: chosen, subclassFeature: options.subclassFeature, hitPoints: die / 2 + 1, features: options.features, spells: [] });
      }
      const at = (what: string, actual: unknown, wanted: unknown) => { if (JSON.stringify(actual) !== JSON.stringify(wanted)) problems.push(`${level}: ${what} ${JSON.stringify(actual)}, atteso ${JSON.stringify(wanted)}`); };
      const view = effectiveSheet(sheet);

      at("livello", [sheet.identity.level, sheet.classes?.[0]?.level], [level, level]);
      at("dadi vita", [sheet.combat.hitDice.max, sheet.combat.hitDice.die], [level, `d${die}`]);
      at("competenza", view.combat.proficiencyBonus, 2 + Math.floor((level - 1) / 4));
      at("slot", derivedSlots(sheet), expectedSlots(groups, level));
      if (row.spellcastingAbility) at("CD incantesimi", view.spellcasting.saveDc, 8 + view.combat.proficiencyBonus);
      const levelTraits = sheet.traits.filter((trait) => trait.sourceType === `${className} ${level}`);
      const names = levelTraits.map((trait) => trait.name);
      const missing = subclassFeatures.filter((feature) => Number(feature.level) === level && !names.includes(String(feature.name))).map((feature) => feature.name);
      if (missing.length) problems.push(`${level}: mancano i privilegi di sottoclasse ${missing.join(", ")} (ci sono ${names.join(", ")})`);
      if (new Set(names).size !== names.length) problems.push(`${level}: tratti doppi ${names.join(", ")}`);
      // Contatori di classe (classResources.ts) contro le colonne della tabella; 0 = nessun contatore.
      for (const [name, resource] of Object.entries(COUNTERS)) {
        const value = column(groups, name, level);
        if (value !== undefined) at(name, sheet.counters?.find((counter) => counter.classResource === resource)?.max ?? 0, num(value));
      }
      const psionicDie = /^D(\d+)$/i.exec(label(column(groups, "Die Size", level)))?.[1];
      if (psionicDie) at("dado psionico", /\(d(\d+)\)/.exec(sheet.counters?.find((counter) => counter.classResource === "psionic")?.name ?? "")?.[1], psionicDie);
      const bardic = column(groups, "Bardic Die", level) as Row | undefined;
      if (bardic) at("dado Ispirazione bardica", /\(d(\d+)\)/.exec(sheet.counters?.find((counter) => counter.classResource === "bardic")?.name ?? "")?.[1], String(((bardic.toRoll as Row[])[0]).faces));
    }
    expect(problems).toEqual([]);
  });
});
