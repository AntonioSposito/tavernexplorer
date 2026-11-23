import { describe, expect, it } from "vitest";
import { classSlotTotals } from "./classes";
import { hasFiveToolsData, readFiveTools, SKIP_REASON } from "./fivetoolsData";
import { parseClass } from "./fivetoolsCharacter";

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
