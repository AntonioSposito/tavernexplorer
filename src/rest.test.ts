import { describe, expect, it } from "vitest";
import { importRoll20 } from "./importer";
import { takeLongRest, takeShortRest } from "./rest";

const hero = () => {
  const sheet = importRoll20({ character: { name: "Eroe" }, normalized: {
    identity: { character_name: "Eroe" },
    combat: { hp: { current: 5, max: 20, temp: 4 }, hit_dice: { current: 2, max: 4, die: "d8" } },
    abilities: { constitution: { score: 14, mod: 2 } },
    spellcasting: { slots: { level_1: { total: 3, expended: 2 } } },
  } });
  sheet.counters = [
    { id: "short", name: "Ki", current: 0, max: 3, recovery: "short" },
    { id: "long", name: "Ispirazione", current: 0, max: 1, recovery: "long" },
    { id: "none", name: "Ferite", current: 1, max: 3, recovery: "none" },
    { id: "rage", name: "Ira", current: 0, max: 3, recovery: "shortOne" },
  ];
  return sheet;
};

describe("riposi e risorse", () => {
  it("il riposo breve spende dadi vita e recupera solo i contatori brevi", () => {
    const original = hero();
    const result = takeShortRest(original, 1, () => 5);
    expect(result.sheet.combat.hp.current).toBe(12);
    expect(result.sheet.combat.hitDice.current).toBe(1);
    expect(result.sheet.counters?.map((counter) => counter.current)).toEqual([3, 0, 1, 1]);
    expect(original.combat.hp.current).toBe(5);
  });

  it("il riposo lungo 2024 ripristina PF, dadi, slot e contatori configurati", () => {
    const result = takeLongRest(hero());
    expect(result.sheet.combat.hp).toMatchObject({ current: 20, temp: 0 });
    expect(result.sheet.combat.hitDice.current).toBe(4);
    expect(result.sheet.spellcasting.slots.level_1.used).toBe(0);
    expect(result.sheet.counters?.map((counter) => counter.current)).toEqual([3, 1, 1, 3]);
  });

  it("1 al riposo breve, tutti al lungo: un uso per ogni riposo breve, senza superare il massimo", () => {
    const rage = (sheet: ReturnType<typeof hero>) => sheet.counters?.find((counter) => counter.id === "rage")?.current;
    let sheet = takeShortRest(hero(), 0).sheet;
    sheet = takeShortRest(sheet, 0).sheet;
    expect(rage(sheet)).toBe(2);
    sheet = takeShortRest(takeShortRest(sheet, 0).sheet, 0).sheet;
    expect(rage(sheet)).toBe(3);
    expect(takeShortRest(hero(), 0).restoredCounters).toContain("Ira");
  });

  it("recupera gli slot sul riposo breve solo se la scheda lo prevede", () => {
    const sheet = hero();
    expect(takeShortRest(sheet, 0).sheet.spellcasting.slots.level_1.used).toBe(2);
    sheet.spellcasting.slotRecovery = "short";
    expect(takeShortRest(sheet, 0).sheet.spellcasting.slots.level_1.used).toBe(0);
  });

  it("il profilo 2014 recupera metà dadi vita", () => {
    const sheet = hero(); sheet.ruleset.id = "dnd-5e-2014"; sheet.combat.hitDice.current = 0;
    expect(takeLongRest(sheet).sheet.combat.hitDice.current).toBe(2);
  });

  it("non concede riposi da 0 PF o dadi vita non disponibili", () => {
    const sheet = hero();
    expect(() => takeShortRest(sheet, 3)).toThrow("non disponibile");
    sheet.combat.hp.current = 0;
    expect(() => takeShortRest(sheet, 0)).toThrow("1 PF");
    expect(() => takeLongRest(sheet)).toThrow("1 PF");
  });
});
