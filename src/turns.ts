import type { CharacterSheet, TurnEntry, TurnState } from "./types";

export function replaceTurnEntries(state: TurnState, entries: TurnEntry[]): TurnState {
  const activeId = state.entries[state.activeIndex]?.id;
  const sorted = entries.map((entry, index) => ({ entry, index }))
    .sort((a, b) => b.entry.initiative - a.entry.initiative || a.index - b.index)
    .map(({ entry }) => entry);
  const activeIndex = sorted.findIndex((entry) => entry.id === activeId);
  return { ...state, entries: sorted, activeIndex: activeIndex >= 0 ? activeIndex : Math.min(state.activeIndex, Math.max(0, sorted.length - 1)) };
}

export function setTurnInitiative(state: TurnState, entryId: string, initiative: number): TurnState {
  return replaceTurnEntries(state, state.entries.map((entry) => entry.id === entryId ? { ...entry, initiative } : entry));
}

export function stepTurn(state: TurnState, direction: 1 | -1): TurnState {
  if (!state.entries.length) return state;
  if (direction === -1 && state.round <= 1 && state.activeIndex <= 0) return state;
  const count = state.entries.length;
  const activeIndex = (state.activeIndex + direction + count) % count;
  const round = state.round + (direction === 1 && activeIndex === 0 ? 1 : direction === -1 && state.activeIndex === 0 ? -1 : 0);
  if (direction === -1) return { ...state, round, activeIndex };
  return {
    ...state, round, activeIndex,
    entries: state.entries.map((entry, index) => {
      if (index !== activeIndex || !entry.conditions?.length) return entry;
      const conditions = entry.conditions.flatMap((condition) => tickEffect(condition, round) ?? []);
      return { ...entry, conditions };
    }),
  };
}

// Durata: scende di 1 al turno della creatura, una volta per round; null = scaduto. Gli effetti spenti non scendono.
export function tickEffect<T extends { active?: boolean; remainingRounds?: number; lastTickRound?: number }>(effect: T, round: number): T | null {
  if (effect.active === false || effect.remainingRounds == null || effect.lastTickRound === round) return effect;
  const remainingRounds = effect.remainingRounds - 1;
  return remainingRounds > 0 ? { ...effect, remainingRounds, lastTickRound: round } : null;
}

// Turno di un PG: le durate dei suoi effetti scendono. Uno scaduto resta sulla scheda spento, pronto da riattivare.
// null se non cambia nulla, così non si scrive la scheda a ogni turno.
export function tickSheetEffects(sheet: CharacterSheet, round: number): CharacterSheet | null {
  const effects = (sheet.effects ?? []).map((effect) => tickEffect(effect, round) ?? { ...effect, active: false, remainingRounds: undefined, lastTickRound: round });
  return effects.some((effect, index) => effect !== sheet.effects?.[index]) ? { ...sheet, effects } : null;
}
