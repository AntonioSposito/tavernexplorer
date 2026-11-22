import { describe, expect, it } from "vitest";
import { classSlotTotals } from "./classes";
import { hasFiveToolsData, readFiveTools, SKIP_REASON } from "./fivetoolsData";
import { createBlankSheet } from "./blankSheet";
import { CLASS_FEATURES } from "./classFeatures";
import { parseClass, parseFeatureTexts } from "./fivetoolsCharacter";

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

  it("Barbaro: ogni privilegio XPHB ha una voce nel catalogo, con il testo, e le Ire seguono la tabella", async () => {
    const file = await readFiveTools("class/class-barbarian.json");
    const row = (file.class as Row[]).find((item) => item.source === "XPHB")!;
    // ASI, Dono epico e segnaposto della sottoclasse li gestisce il popup; i riferimenti con un'altra fonte (Totems|WoW) non sono del PHB.
    const handled = ["Ability Score Improvement", "Epic Boon", "Barbarian Subclass", "Subclass Feature"];
    const refs = (row.classFeatures as Array<string | Row>).map((ref) => String(typeof ref === "string" ? ref : ref.classFeature)).map((ref) => ref.split("|"))
      .filter((parts) => parts[2] === "XPHB" && !parts[4] && !handled.includes(parts[0])).map((parts) => `${parts[3]}:${parts[0]}`);
    expect(CLASS_FEATURES.filter((feature) => feature.className === "Barbarian" && !feature.subclass).map((feature) => `${feature.level}:${feature.name}`)).toEqual(refs);
    const texts = parseFeatureTexts(file);
    for (const ref of refs) expect(texts[ref], ref).toBeTruthy();
    const rages = ((row.classTableGroups as Row[])[0].rows as unknown[][]).map((cells) => Number(cells[0]));
    const rage = CLASS_FEATURES.find((feature) => feature.name === "Rage")!;
    const sheet = createBlankSheet("Barbaro");
    expect(rages.map((_, index) => rage.grant!({ level: index + 1, sheet }).counter!.max)).toEqual(rages);
  });

  it("Barbaro: ogni privilegio XPHB delle 4 sottoclassi ha una voce nel catalogo, con il testo", async () => {
    const file = await readFiveTools("class/class-barbarian.json");
    const texts = parseFeatureTexts(file);
    for (const subclass of (file.subclass as Row[]).filter((row) => row.source === "XPHB" && row.classSource === "XPHB")) {
      // Il primo privilegio ha il nome della sottoclasse: è solo l'introduzione.
      const rows = (file.subclassFeature as Row[]).filter((row) => row.source === "XPHB" && row.subclassShortName === subclass.shortName && row.name !== subclass.name);
      const expected = rows.map((row) => `${row.level}:${row.name}`);
      expect(CLASS_FEATURES.filter((feature) => feature.subclass === subclass.name).map((feature) => `${feature.level}:${feature.name}`), String(subclass.name)).toEqual(expected);
      for (const key of expected) expect(texts[key], key).toBeTruthy();
    }
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
