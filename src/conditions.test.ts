import { expect, it } from "vitest";
import { CONCENTRATION_RULE, CONDITIONS, EXHAUSTION_LEVELS, conditionRoll, conditionRule, effectRule, exhaustionLevel, startConcentration, type D20Roll } from "./conditions";
import { combineModes } from "./dice";

it("le 15 condizioni 2024 hanno una regola, trovata anche in minuscolo", () => {
  expect(CONDITIONS).toHaveLength(15);
  expect(conditionRule("poisoned")).toContain("Disadvantage on attack rolls");
  expect(conditionRule("Bless")).toBeUndefined();
});

it("le condizioni cambiano i tiri di chi le ha: vantaggio, svantaggio, fallimento e Exhaustion", () => {
  const title = (names: string[], roll: D20Roll) => conditionRoll(names.map((name, index) => ({ id: String(index), name })), roll, "T", "1d20+2").title;
  expect(title(["Poisoned", "restrained"], "attack")).toBe("T · svantaggio (Poisoned, restrained)");
  expect(title(["Poisoned"], "check:wisdom")).toBe("T · svantaggio (Poisoned)");
  expect(title(["Restrained"], "save:dexterity")).toBe("T · svantaggio (Restrained)");
  expect(title(["Restrained", "Prone", "Blinded", "Charmed", "Deafened", "Grappled"], "save:wisdom")).toBe("T");
  expect(title(["Frightened"], "initiative")).toBe("T · svantaggio (Frightened)");
  expect(title(["Incapacitated"], "initiative")).toBe("T · svantaggio (Incapacitated)");
  expect(title(["Incapacitated"], "check:dexterity")).toBe("T");
  expect(title(["Invisible"], "attack")).toBe("T · vantaggio (Invisible)");
  expect(title(["Stunned"], "save:strength")).toBe("T · fallisce (Stunned)");
  expect(title(["Unconscious"], "initiative")).toBe("T · svantaggio (Unconscious)");
  expect(title(["Paralyzed", "Petrified"], "save:wisdom")).toBe("T");
  // Effetti spenti o scaduti non contano.
  expect(conditionRoll([{ id: "x", name: "Prone", active: false }, { id: "o", name: "Restrained", remainingRounds: 0 }], "attack", "T", "1d20").title).toBe("T");

  expect(conditionRoll([{ id: "p", name: "Prone" }], "attack", "Ascia", "1d20+5", "advantage")).toEqual({ title: "Ascia · svantaggio (Prone)", formula: "1d20+5", mode: ["advantage", "disadvantage"] });
  expect(conditionRoll([{ id: "e", name: "Exhaustion 2" }, { id: "i", name: "Invisible" }], "attack", "Ascia", "1d20+5")).toEqual({ title: "Ascia · vantaggio (Invisible) · Exhaustion 2 (−4)", formula: "1d20+5-4[EXH]", mode: ["advantage"] });
  expect(conditionRoll([{ id: "e", name: "exhaustion" }], "save:wisdom", "TS", "1d20").formula).toBe("1d20-2[EXH]");
  expect(exhaustionLevel("Exhaustion 3")).toBe(3);
  expect(exhaustionLevel("Exhaustive")).toBe(0);
  // Exhaustion 1-6 tra i suggerimenti, ognuna con le penalità del suo livello in testa alla regola.
  expect(EXHAUSTION_LEVELS).toEqual(["Exhaustion 1", "Exhaustion 2", "Exhaustion 3", "Exhaustion 4", "Exhaustion 5", "Exhaustion 6"]);
  expect(conditionRule("Exhaustion 3")).toMatch(/^Exhaustion Level 3\. Your D20 Tests are reduced by 6 and your Speed by 15 feet\.\nExhaustion Levels\./);
  expect(conditionRule("Exhaustion 6")).toMatch(/^Exhaustion Level 6\. You die\.\n/);
  expect(conditionRule("Exhaustion")).toMatch(/^Exhaustion Levels\./);

  expect(combineModes("advantage", ["advantage", "disadvantage"])).toBe("normal");
  expect(combineModes(undefined, ["disadvantage"])).toBe("disadvantage");
  expect(combineModes("normal", "advantage")).toBe("advantage");
});

it("la concentrazione è una sola: la nuova sostituisce la vecchia, gli altri effetti restano", () => {
  const bless = startConcentration([{ id: "p", name: "Poisoned", active: true, modifiers: [] }], "Bless");
  expect(bless).toMatchObject([{ name: "Poisoned" }, { name: "Concentrazione: Bless", active: true, description: CONCENTRATION_RULE }]);
  expect(startConcentration([...bless, { id: "m", name: "concentrazione", active: true, modifiers: [] }], "Hold Person").map((effect) => effect.name)).toEqual(["Poisoned", "Concentrazione: Hold Person"]);
  expect(effectRule("Concentrazione")).toBe(CONCENTRATION_RULE);
  expect(CONCENTRATION_RULE).toContain("maximum DC of 30");
  expect(effectRule("Poisoned")).toContain("Disadvantage");
  expect(effectRule("Bless")).toBeUndefined();
});

it("i modificatori adv:/dis: degli effetti danno vantaggio e svantaggio ai tiri scelti", () => {
  const effects = [{ id: "a", name: "Bless", active: true, modifiers: [{ id: "m", target: "adv:skill:stealth", amount: 0 }, { id: "n", target: "dis:save", amount: 0 }] }, { id: "b", name: "Faerie Fire", active: true, modifiers: [{ id: "o", target: "adv:check:dexterity", amount: 0 }] }];
  expect(conditionRoll(effects, "check:dexterity:stealth", "Furtività", "1d20+2").mode).toEqual(["advantage"]);
  expect(conditionRoll(effects, "check:dexterity:stealth", "Furtività", "1d20+2").title).toBe("Furtività · vantaggio (Bless, Faerie Fire)");
  expect(conditionRoll(effects, "check:dexterity:acrobatics", "Acrobazia", "1d20").title).toBe("Acrobazia · vantaggio (Faerie Fire)");
  expect(conditionRoll(effects, "initiative", "Iniziativa", "1d20").mode).toEqual(["advantage"]);
  expect(conditionRoll(effects, "save:wisdom", "TS", "1d20").mode).toEqual(["disadvantage"]);
  expect(conditionRoll(effects, "attack", "Ascia", "1d20").mode).toEqual([]);
  expect(conditionRoll([{ ...effects[0], active: false }], "save:wisdom", "TS", "1d20").mode).toEqual([]);
});
