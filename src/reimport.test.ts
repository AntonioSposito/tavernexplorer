// @vitest-environment jsdom
import { expect, it } from "vitest";
import { importRoll20 } from "./importer";
import { isSameCharacter, mergeReimport } from "./reimport";

const roll20 = (maxHp: number) => importRoll20({ character: { id: "r20-ada", name: "Ada" }, normalized: { identity: { character_name: "Ada" }, combat: { hp: { current: maxHp, max: maxHp }, hit_dice: { current: 3, max: 3, die: "d8" } } } });

it("riconosce lo stesso personaggio Roll20 e conserva lo stato di gioco", () => {
  const existing = roll20(20);
  existing.combat.hp = { current: 25, max: 30, temp: 4 };
  existing.combat.hitDice.current = 1;
  existing.combat.inspiration = true;
  existing.spellcasting.slots = { level_1: { total: 4, used: 3 } };
  existing.counters = [{ id: "c", name: "Ki", current: 1, max: 3, recovery: "short" }];
  const imported = roll20(22);
  imported.spellcasting.slots = { level_1: { total: 2, used: 0 }, level_2: { total: 2, used: 0 } };

  expect(isSameCharacter(existing, imported)).toBe(true);
  expect(isSameCharacter(existing, roll20(1))).toBe(true);
  expect(isSameCharacter(existing, { ...imported, sourceId: undefined })).toBe(false);

  const merged = mergeReimport(existing, imported);
  expect(merged.id).toBe(existing.id);
  expect(merged.combat.hp).toEqual({ current: 22, max: 22, temp: 4 });
  expect(merged.combat.hitDice.current).toBe(1);
  expect(merged.combat.inspiration).toBe(true);
  expect(merged.spellcasting.slots).toEqual({ level_1: { total: 2, used: 2 }, level_2: { total: 2, used: 0 } });
  expect(merged.counters).toEqual(existing.counters);
});
