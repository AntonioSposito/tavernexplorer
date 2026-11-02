import { roll } from "./dice";
import { effectiveSheet } from "./effects";
import { syncCountersFromItems, syncItemsFromCounters } from "./resources";
import { getRuleset } from "./rulesets";
import type { CharacterSheet, CounterRecovery, ResourceCounter } from "./types";

export type RestKind = "short" | "long";
export interface RestResult { sheet: CharacterSheet; healed: number; spentDice: number; rolls: number[]; restoredCounters: string[] }

export function restoreCounters(counters: ResourceCounter[], kind: RestKind): { counters: ResourceCounter[]; restored: string[] } {
  const restored: string[] = [];
  return { counters: counters.map((counter) => {
    const shouldRestore = counter.recovery === "short" || kind === "long" && counter.recovery === "long";
    if (!shouldRestore || counter.current >= counter.max) return counter;
    restored.push(counter.name);
    return { ...counter, current: counter.max };
  }), restored };
}

export function isCounterRecovery(value: string): value is CounterRecovery {
  return value === "none" || value === "short" || value === "long";
}

export function takeShortRest(sheet: CharacterSheet, diceToSpend: number, rollDie: (faces: number) => number = (faces) => roll(`1d${faces}`).total): RestResult {
  if (sheet.combat.hp.current < 1) throw new Error("Per iniziare un riposo breve servono almeno 1 PF");
  if (!Number.isInteger(diceToSpend) || diceToSpend < 0 || diceToSpend > sheet.combat.hitDice.current) throw new Error("Numero di dadi vita non disponibile");
  const faces = Number(/^d?(\d+)$/i.exec(sheet.combat.hitDice.die)?.[1]);
  // Con i dadi vita per classe si spendono prima i dadi più grandi (i gruppi sono già in ordine decrescente).
  const pools = structuredClone(sheet.combat.hitDicePools ?? []);
  const spendFaces: number[] = [];
  for (let index = 0; index < diceToSpend; index += 1) {
    const pool = pools.find((item) => item.current > 0);
    if (pool) { pool.current -= 1; spendFaces.push(Number(pool.die.slice(1))); } else spendFaces.push(faces);
  }
  if (spendFaces.some((value) => !Number.isInteger(value) || value < 2 || value > 1000)) throw new Error("Tipo di dado vita non valido");
  const rules = getRuleset(sheet.ruleset.id);
  const constitution = effectiveSheet(sheet).abilities.constitution?.mod ?? 0;
  const rolls = spendFaces.map((value) => rollDie(value));
  if (rolls.some((value, index) => !Number.isInteger(value) || value < 1 || value > spendFaces[index])) throw new Error("Risultato del dado vita non valido");
  const recovered = rolls.reduce((sum, value) => sum + Math.max(rules.shortRestMinimumHealing, value + constitution), 0);
  const next = structuredClone(sheet);
  const maximum = Math.max(0, effectiveSheet(sheet).combat.hp.max);
  next.combat.hp.current = Math.min(maximum, next.combat.hp.current + recovered);
  next.combat.hitDice.current -= diceToSpend;
  if (pools.length) next.combat.hitDicePools = pools;
  if (next.spellcasting.slotRecovery === "short") for (const slot of Object.values(next.spellcasting.slots)) slot.used = 0;
  syncCountersFromItems(next);
  const counters = restoreCounters(next.counters ?? [], "short");
  next.counters = counters.counters;
  syncItemsFromCounters(next);
  return { sheet: next, healed: Math.max(0, next.combat.hp.current - sheet.combat.hp.current), spentDice: diceToSpend, rolls, restoredCounters: counters.restored };
}

export function takeLongRest(sheet: CharacterSheet): RestResult {
  if (sheet.combat.hp.current < 1) throw new Error("Per iniziare un riposo lungo servono almeno 1 PF");
  const next = structuredClone(sheet);
  const maximum = Math.max(0, effectiveSheet(sheet).combat.hp.max);
  next.combat.hp.current = maximum;
  next.combat.hp.temp = 0;
  next.combat.deathSaves = { successes: 0, failures: 0 };
  const hitDice = next.combat.hitDice;
  hitDice.current = Math.min(hitDice.max, hitDice.current + getRuleset(sheet.ruleset.id).hitDiceRecoveredOnLongRest(hitDice.max));
  for (const pool of next.combat.hitDicePools ?? []) pool.current = Math.min(pool.max, pool.current + getRuleset(sheet.ruleset.id).hitDiceRecoveredOnLongRest(pool.max));
  for (const slot of Object.values(next.spellcasting.slots)) slot.used = 0;
  syncCountersFromItems(next);
  const counters = restoreCounters(next.counters ?? [], "long");
  next.counters = counters.counters;
  syncItemsFromCounters(next);
  return { sheet: next, healed: Math.max(0, maximum - sheet.combat.hp.current), spentDice: 0, rolls: [], restoredCounters: counters.restored };
}
