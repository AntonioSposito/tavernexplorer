import { describe, expect, it } from "vitest";
import { hasFiveToolsData, readFiveTools, SKIP_REASON } from "./fivetoolsData";
import { parseClass, parseLevelFeats, parseLevelOptions } from "./fivetoolsCharacter";

const CLASSES = ["barbarian", "bard", "cleric", "druid", "fighter", "monk", "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard"];

describe.skipIf(!hasFiveToolsData)(`dati veri di 5e.tools${hasFiveToolsData ? "" : ` (${SKIP_REASON})`}`, () => {
  it("le 12 classi del PHB 2024 si leggono e hanno 4 sottoclassi XPHB", async () => {
    for (const name of CLASSES) {
      const file = await readFiveTools(`class/class-${name}.json`);
      expect(parseClass(file)?.name.toLowerCase()).toBe(name);
      const subclasses = (file.subclass as Array<{ source: string; classSource?: string }>).filter((row) => row.source === "XPHB" && row.classSource === "XPHB");
      expect(subclasses, name).toHaveLength(4);
    }
  });

  it("i talenti per l'aumento caratteristiche comprendono quelli d'origine", async () => {
    const names = parseLevelFeats(await readFiveTools("feats.json")).map((feat) => feat.name);
    expect(names).toEqual(expect.arrayContaining(["Alert", "Great Weapon Master", "Boon of Fate"]));
  });

  it("la sottoclasse con lo stesso nome nel PHB 2014 e 2024 dà i privilegi 2024 (TE-76)", async () => {
    const bard = await readFiveTools("class/class-bard.json");
    expect(parseLevelOptions(bard, 6, "College of Lore").features.map((feature) => feature.name)).toEqual(["Magical Discoveries"]);
  });
});
