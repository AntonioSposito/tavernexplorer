import type { CharacterClass, ClassCaster } from "./types";

// Classi D&D 2024 (più Artificer, presente nel menu di Roll20) con i valori usati dal calcolo automatico.
export interface ClassRule { hitDie: number; caster: ClassCaster; spellAbility?: string; saves: [string, string] }
export const CLASSES: Record<string, ClassRule> = {
  Artificer: { hitDie: 8, caster: "half", spellAbility: "intelligence", saves: ["constitution", "intelligence"] },
  Barbarian: { hitDie: 12, caster: "none", saves: ["strength", "constitution"] },
  Bard: { hitDie: 8, caster: "full", spellAbility: "charisma", saves: ["dexterity", "charisma"] },
  Cleric: { hitDie: 8, caster: "full", spellAbility: "wisdom", saves: ["wisdom", "charisma"] },
  Druid: { hitDie: 8, caster: "full", spellAbility: "wisdom", saves: ["intelligence", "wisdom"] },
  Fighter: { hitDie: 10, caster: "none", saves: ["strength", "constitution"] },
  Monk: { hitDie: 8, caster: "none", saves: ["strength", "dexterity"] },
  Paladin: { hitDie: 10, caster: "half", spellAbility: "charisma", saves: ["wisdom", "charisma"] },
  Ranger: { hitDie: 10, caster: "half", spellAbility: "wisdom", saves: ["strength", "dexterity"] },
  Rogue: { hitDie: 8, caster: "none", saves: ["dexterity", "intelligence"] },
  Sorcerer: { hitDie: 6, caster: "full", spellAbility: "charisma", saves: ["constitution", "charisma"] },
  Warlock: { hitDie: 8, caster: "pact", spellAbility: "charisma", saves: ["wisdom", "charisma"] },
  Wizard: { hitDie: 6, caster: "full", spellAbility: "intelligence", saves: ["intelligence", "wisdom"] },
};
// Sottoclassi "terzo incantatore" (Roll20: Arcane Fighter / Arcane Rogue).
export const THIRD_CASTER_SUBCLASSES: Record<string, string> = { "Eldritch Knight": "Fighter", "Arcane Trickster": "Rogue" };

// Slot per livello da incantatore (tabella del multiclasse, PHB 2024), livelli 1–9.
const SLOTS: number[][] = [
  [], [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1],
];
export const slotsForCasterLevel = (level: number) => SLOTS[Math.min(20, Math.max(0, level))];

// Magia del patto (Warlock 2024): numero di slot e loro livello.
export function pactSlots(level: number): { count: number; level: number } {
  if (level < 1) return { count: 0, level: 0 };
  const count = level === 1 ? 1 : level <= 10 ? 2 : level <= 16 ? 3 : 4;
  return { count, level: Math.min(5, Math.ceil(level / 2)) };
}

export function classRule(entry: CharacterClass): ClassRule | undefined {
  if (entry.custom) return { hitDie: entry.custom.hitDie, caster: entry.custom.caster, spellAbility: entry.custom.spellAbility, saves: [entry.custom.saves[0] ?? "", entry.custom.saves[1] ?? ""] };
  return CLASSES[entry.name];
}

// Tipo di incantatore di una classe, contando le sottoclassi terzo incantatore e le opzioni Arcane Fighter/Rogue.
function casterOf(entry: CharacterClass, arcane: { fighter?: boolean; rogue?: boolean }): ClassCaster {
  const rule = classRule(entry);
  if (!rule) return "none";
  if (rule.caster !== "none") return rule.caster;
  const third = THIRD_CASTER_SUBCLASSES[entry.subclass?.trim() ?? ""] === entry.name || (entry.name === "Fighter" && arcane.fighter) || (entry.name === "Rogue" && arcane.rogue);
  return third ? "third" : "none";
}

// Livello da incantatore del multiclasse 2024: pieni per intero, mezzi arrotondati per eccesso, terzi per difetto.
// Il Warlock (patto) resta separato.
export function casterLevel(classes: CharacterClass[], arcane: { fighter?: boolean; rogue?: boolean } = {}): number {
  return classes.reduce((total, entry) => {
    const caster = casterOf(entry, arcane);
    return total + (caster === "full" ? entry.level : caster === "half" ? Math.ceil(entry.level / 2) : caster === "third" ? Math.floor(entry.level / 3) : 0);
  }, 0);
}

// Totali degli slot ("level_1"…) come li salva la scheda; gli slot del patto si sommano al loro livello, come in Roll20.
export function classSlotTotals(classes: CharacterClass[], options: { arcane?: { fighter?: boolean; rogue?: boolean }; casterLevel?: number; slotBonus?: number[] } = {}): Record<string, number> {
  const totals: Record<string, number> = {};
  slotsForCasterLevel(options.casterLevel || casterLevel(classes, options.arcane)).forEach((count, index) => { totals[`level_${index + 1}`] = count; });
  const pactLevel = classes.filter((entry) => casterOf(entry, options.arcane ?? {}) === "pact").reduce((sum, entry) => sum + entry.level, 0);
  const pact = pactSlots(pactLevel);
  if (pact.count) totals[`level_${pact.level}`] = (totals[`level_${pact.level}`] ?? 0) + pact.count;
  (options.slotBonus ?? []).forEach((bonus, index) => { if (bonus) totals[`level_${index + 1}`] = Math.max(0, (totals[`level_${index + 1}`] ?? 0) + bonus); });
  return Object.fromEntries(Object.entries(totals).filter(([, total]) => total > 0));
}

// "Monk 4 / Rogue 1" (con la sottoclasse davanti, come class_display di Roll20).
export const classDisplay = (classes: CharacterClass[]) => classes.map((entry) => `${entry.subclass ? `${entry.subclass} ` : ""}${entry.name} ${entry.level}`).join(" / ");
