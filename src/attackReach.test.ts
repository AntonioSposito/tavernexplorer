import { expect, it } from "vitest";
import { attackReach, reachLabel } from "./attackReach";
import type { ActionEntry } from "./types";

const entry = (patch: Partial<ActionEntry>): ActionEntry => ({ id: "a", name: "Attacco", attackBonus: 5, ...patch });

it("ricava tipo e portata dallo statblock 2014 e 2024", () => {
  expect(reachLabel(entry({ description: "Melee Weapon Attack: +4 to hit, reach 10 ft., one target. Hit: 4 (1d4 + 2) damage." }))).toBe("Mischia 10 ft");
  expect(reachLabel(entry({ description: "Melee or Ranged Attack Roll: +4 (with Advantage if the target is Grappled by the bugbear), reach 10 ft. or range 20/60 ft. Hit: 9." }))).toBe("Mischia o a distanza 10 ft o 20/60 ft");
  expect(reachLabel(entry({ description: "Ranged Spell Attack: +5 to hit, range 150 ft., one target. Hit: 10." }))).toBe("A distanza 150 ft");
  expect(reachLabel(entry({ description: "Melee Attack Roll: +5. Hit: the target is pushed, range 30 ft." }))).toBe("Mischia");
});

it("ricava tipo e portata dall'arma o dalla gittata, solo per chi attacca", () => {
  expect(reachLabel(entry({ name: "Longbow +1" }))).toBe("A distanza 150/600 ft");
  expect(reachLabel(entry({ weapon: "Whip" }))).toBe("Mischia 10 ft");
  expect(reachLabel(entry({ weapon: "Dagger", range: "20/60" }))).toBe("Mischia o a distanza 5 ft o 20/60 ft");
  expect(reachLabel(entry({ range: "1,5 m" }))).toBe("Mischia 1,5 m");
  expect(reachLabel(entry({ range: "36 m" }))).toBe("A distanza 36 m");
  expect(reachLabel(entry({}))).toBeUndefined();
  expect(reachLabel(entry({ name: "Mace", attackBonus: undefined }))).toBeUndefined();
  expect(reachLabel(entry({ attackBonus: undefined, range: "36 m" }))).toBe("Gittata 36 m");
});

it("i valori scritti nella voce prevalgono", () => {
  expect(attackReach(entry({ weapon: "Longbow", attackType: "melee" }))).toEqual({ type: "melee", range: undefined });
  expect(reachLabel(entry({ description: "Melee Attack Roll: +5, reach 5 ft. Hit: 1.", attackType: "ranged", range: "18 m" }))).toBe("A distanza 18 m");
});

it("gli incantesimi usano il loro campo, non l'arma", () => {
  const spell = { ...entry({ name: "Spear of light", range: "120 feet" }), level: 1, prepared: true, ritual: false, concentration: false };
  expect(reachLabel(spell)).toBe("Gittata 120 feet");
  expect(reachLabel({ ...spell, spellAttack: "ranged" as const })).toBe("A distanza 120 feet");
});
