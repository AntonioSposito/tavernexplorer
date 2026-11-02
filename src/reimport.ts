import type { CharacterSheet } from "./types";

// Un reimport da Roll20 aggiorna i dati della scheda ma conserva id e stato di gioco già in libreria.
export function mergeReimport(existing: CharacterSheet, imported: CharacterSheet): CharacterSheet {
  const { hp, hitDice } = imported.combat;
  return {
    ...imported,
    id: existing.id,
    effects: existing.effects,
    counters: existing.counters,
    // Le opzioni della scheda sono dell'utente: il reimport aggiunge solo quelle che mancano (es. la competenza).
    options: { ...imported.options, ...existing.options },
    combat: {
      ...imported.combat,
      hp: { ...hp, current: Math.min(existing.combat.hp.current, hp.max), temp: existing.combat.hp.temp },
      hitDice: { ...hitDice, current: Math.min(existing.combat.hitDice.current, hitDice.max) },
      deathSaves: existing.combat.deathSaves,
      inspiration: existing.combat.inspiration,
    },
    spellcasting: {
      ...imported.spellcasting,
      slots: Object.fromEntries(Object.entries(imported.spellcasting.slots).map(([level, slot]) =>
        [level, { ...slot, used: Math.min(existing.spellcasting.slots[level]?.used ?? 0, slot.total) }])),
    },
  };
}

// Stessa scheda se ha lo stesso id o proviene dallo stesso personaggio Roll20.
export const isSameCharacter = (a: CharacterSheet, b: CharacterSheet) =>
  a.id === b.id || !!a.sourceId && a.sourceId === b.sourceId;
