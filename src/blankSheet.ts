import { ABILITY_LABELS, SKILL_ABILITIES } from "./constants";
import { DEFAULT_RULESET, getRuleset } from "./rulesets";
import type { CharacterSheet } from "./types";

// Scheda di livello 1 senza import: caratteristiche a 10, nessuna competenza. Bonus di competenza per livello
// e calcolo automatico dei livelli acceso, così scegliere la classe nella tab Modifica imposta dadi vita, slot e TS.
export function createBlankSheet(name: string, rulesetId = DEFAULT_RULESET.id): CharacterSheet {
  const ruleset = getRuleset(rulesetId);
  const pb = ruleset.proficiencyBonus(1);
  return {
    schemaVersion: 1, id: crypto.randomUUID(), name,
    ruleset: { id: ruleset.id, version: ruleset.version },
    identity: { race: "", className: "", subclass: "", classDisplay: "", level: 1, background: "", alignment: "", experience: "" },
    combat: {
      ac: 10, acMode: "auto", acBase: 10,
      // PF da impostare nella tab Modifica; 1 invece di 0 per non partire con i TS contro la morte.
      hp: { current: 1, max: 1, temp: 0 },
      speed: "9 m", initiative: 0, proficiencyBonus: pb, passivePerception: 10, inspiration: false,
      hitDice: { current: 1, max: 1, die: "d8" }, deathSaves: { successes: 0, failures: 0 },
    },
    abilities: Object.fromEntries(Object.keys(ABILITY_LABELS).map((key) => [key, { score: 10, mod: 0, save: 0, saveProficient: false }])),
    skills: Object.fromEntries(Object.entries(SKILL_ABILITIES).map(([key, ability]) => [key, { ability, bonus: 0, proficient: false }])),
    spellcasting: { ability: "", saveDc: ruleset.spellSaveDc(0, pb), attackBonus: pb, slots: {} },
    actions: [], spells: [], inventory: [], effects: [], counters: [], traits: [], proficiencies: [], tools: [], classes: [],
    options: { proficiency: "level", autoLevel: true },
    currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    biography: "", importWarnings: [],
  };
}
