import { expect, it } from "vitest";
import { adjustHitPoints, applyDeathSave } from "./hitPoints";
import type { CharacterSheet } from "./types";

const combat = (): CharacterSheet["combat"] => ({
  ac: 12, hp: { current: 8, max: 20, temp: 5 }, speed: "30 ft", initiative: 1,
  proficiencyBonus: 2, passivePerception: 10, inspiration: false,
  hitDice: { current: 1, max: 1, die: "d8" }, deathSaves: { successes: 1, failures: 2 },
});

it("i PF attuali restano tra 0 e il massimo effettivo e non mutano la scheda originale", () => {
  const original = combat();
  expect(adjustHitPoints(original, "current", 1).hp).toEqual({ current: 9, max: 20, temp: 5 });
  expect(adjustHitPoints(original, "current", -20).hp.current).toBe(0);
  expect(adjustHitPoints(original, "current", 30, 24).hp.current).toBe(24);
  expect(original.hp.current).toBe(8);
});

it("sopra il massimo i PF attuali non vengono abbassati salendo", () => {
  const aboveMax = { ...combat(), hp: { current: 25, max: 20, temp: 0 } };
  expect(adjustHitPoints(aboveMax, "current", 1).hp.current).toBe(25);
});

it("tornare sopra 0 PF azzera i tiri salvezza contro la morte", () => {
  const down = { ...combat(), hp: { current: 0, max: 20, temp: 0 } };
  expect(adjustHitPoints(down, "current", 1).deathSaves).toEqual({ successes: 0, failures: 0 });
  expect(adjustHitPoints(combat(), "current", 1).deathSaves).toEqual({ successes: 1, failures: 2 });
});

it("temporanei non negativi, massimo almeno 1 e PF attuali ridotti col massimo", () => {
  expect(adjustHitPoints(combat(), "temp", -9).hp.temp).toBe(0);
  expect(adjustHitPoints(combat(), "max", -30).hp).toEqual({ current: 1, max: 1, temp: 5 });
  // Effetti +4 al massimo: base 20 → 10 porta il massimo effettivo a 14, gli attuali (8) restano.
  expect(adjustHitPoints(combat(), "max", -10, 24).hp).toEqual({ current: 8, max: 10, temp: 5 });
  expect(() => adjustHitPoints(combat(), "current", 1.5)).toThrow();
});

it("TS contro la morte: successo da 10, 1 vale due fallimenti, 20 riporta a 1 PF, massimo 3", () => {
  const down = { ...combat(), hp: { current: 0, max: 20, temp: 0 }, deathSaves: { successes: 0, failures: 0 } };
  expect(applyDeathSave(down, 10).deathSaves).toEqual({ successes: 1, failures: 0 });
  expect(applyDeathSave(down, 9).deathSaves).toEqual({ successes: 0, failures: 1 });
  expect(applyDeathSave(down, 1).deathSaves).toEqual({ successes: 0, failures: 2 });
  expect(applyDeathSave({ ...down, deathSaves: { successes: 0, failures: 2 } }, 1).deathSaves.failures).toBe(3);
  expect(applyDeathSave({ ...down, deathSaves: { successes: 2, failures: 1 } }, 20)).toMatchObject({ hp: { current: 1 }, deathSaves: { successes: 0, failures: 0 } });
});
