import { effectiveSheet } from "./effects";
import type { CharacterSheet, RollMode } from "./types";

// Tiro di iniziativa di un personaggio per la tab Turni: valore con effetti e opzioni, stile
// (vantaggio/svantaggio) e spareggio DEX/100 come l'opzione Roll20 "Add DEX tiebreaker".
export function initiativeRoll(sheet: CharacterSheet): { formula: string; mode: RollMode; tiebreaker: number } {
  const view = effectiveSheet(sheet);
  const bonus = view.combat.initiative;
  return {
    formula: `1d20${sheet.options?.halflingLuck ? "ro1" : ""}${bonus >= 0 ? "+" : ""}${bonus}`,
    mode: sheet.options?.initiativeMode ?? "normal",
    tiebreaker: sheet.options?.dexTiebreaker ? (view.abilities.dexterity?.score ?? 10) / 100 : 0,
  };
}
