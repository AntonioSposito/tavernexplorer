import { classDisplay, classRule } from "./classes";
import { applyClassChanges, derivedSlots } from "./classSync";
import { ABILITY_SHORT } from "./constants";
import { effectiveSheet, fixProficiencyChoice } from "./effects";
import type { CharacterClass, CharacterSheet, TraitEntry } from "./types";

// Regole comuni a tutte le classi (PHB 2024, docs/classificazione-privilegi-phb2024.md): PF, dadi vita, competenza,
// slot, sottoclasse e Ability Score Improvement. I privilegi delle singole classi arrivano negli step successivi.

// Al posto dell'ASI: +1 per voce (la stessa due volte = +2, massimo 20), un talento, o al 19 un Dono epico (+1, massimo 30).
export type FeatChoice = { kind: "asi"; abilities: string[] } | { kind: "feat"; name: string } | { kind: "boon"; name: string; ability: string };
export interface LevelChoices {
  // Dado vita tirato; assente = valore fisso (metà del dado + 1).
  hpRoll?: number;
  subclass?: string;
  feat?: FeatChoice;
}

export const SUBCLASS_LEVEL = 3;

// Classi della scheda; una scheda importata senza elenco classi parte dalla classe e dal livello dell'identità.
export const sheetClasses = (sheet: CharacterSheet): CharacterClass[] => sheet.classes?.length ? sheet.classes
  : [{ name: sheet.identity.className || "Fighter", level: Math.max(1, sheet.identity.level), ...sheet.identity.subclass ? { subclass: sheet.identity.subclass } : {} }];

export const hitDieOf = (className: string) => classRule({ name: className, level: 1 })?.hitDie ?? 8;
// PF del livello: valore fisso o tiro, più COS; almeno 1.
export const hitPointGain = (die: number, conMod: number, rolled?: number) => Math.max(1, (rolled ?? die / 2 + 1) + conMod);

// Livelli con Ability Score Improvement (Guerriero anche 6 e 14, Ladro anche 10); al 19 il Dono epico.
export function featLevel(className: string, level: number): "asi" | "boon" | undefined {
  if (level === 19) return "boon";
  const extra = className === "Fighter" ? [6, 14] : className === "Rogue" ? [10] : [];
  return [4, 8, 12, 16, ...extra].includes(level) ? "asi" : undefined;
}

// Multiclasse PHB 2024: 13 nella caratteristica principale della classe nuova e di quelle che si hanno.
// Ogni gruppo deve essere soddisfatto; dentro un gruppo basta una caratteristica (Guerriero: FOR o DES).
const MULTICLASS: Record<string, string[][]> = {
  Barbarian: [["strength"]], Bard: [["charisma"]], Cleric: [["wisdom"]], Druid: [["wisdom"]], Fighter: [["strength", "dexterity"]],
  Monk: [["dexterity"], ["wisdom"]], Paladin: [["strength"], ["charisma"]], Ranger: [["dexterity"], ["wisdom"]], Rogue: [["dexterity"]],
  Sorcerer: [["charisma"]], Warlock: [["charisma"]], Wizard: [["intelligence"]],
};
// Motivo per cui non si può prendere className come nuova classe, es. "serve FOR 13 (Barbarian)".
export function multiclassBlock(sheet: CharacterSheet, className: string): string | undefined {
  const scores = effectiveSheet(sheet).abilities;
  for (const name of new Set([className, ...sheetClasses(sheet).map((entry) => entry.name)])) {
    const missing = (MULTICLASS[name] ?? []).find((group) => !group.some((ability) => (scores[ability]?.score ?? 10) >= 13));
    if (missing) return `serve ${missing.map((ability) => ABILITY_SHORT[ability]).join(" o ")} 13 (${name})`;
  }
}

function featTrait(className: string, level: number, choice: FeatChoice): TraitEntry {
  const base = { id: crypto.randomUUID(), featureId: `${className}:${level}:feat`, sourceKind: "Feat" as const, sourceType: `${className} ${level}`, source: `${className} ${level} • Feat` };
  if (choice.kind === "feat") return { ...base, name: choice.name, description: "" };
  const counts = choice.kind === "boon" ? { [choice.ability]: 1 } : choice.abilities.reduce<Record<string, number>>((sum, key) => ({ ...sum, [key]: (sum[key] ?? 0) + 1 }), {});
  const max = choice.kind === "boon" ? 30 : 20;
  return {
    ...base, name: choice.kind === "boon" ? choice.name : "Ability Score Improvement",
    description: `${Object.entries(counts).map(([key, amount]) => `${ABILITY_SHORT[key] ?? key} +${amount}`).join(", ")} (massimo ${max})`,
    modifiers: Object.entries(counts).map(([key, amount]) => ({ id: crypto.randomUUID(), target: `ability:${key}`, amount, max })),
  };
}

// Stesso privilegio d'origine: si aggiorna la voce invece di duplicarla, salvo che l'utente l'abbia modificata.
function upsertTrait(sheet: CharacterSheet, trait: TraitEntry) {
  const index = sheet.traits.findIndex((item) => item.featureId === trait.featureId);
  if (index < 0) sheet.traits.push(trait);
  else if (!sheet.traits[index].edited) sheet.traits[index] = { ...trait, id: sheet.traits[index].id };
}

// className sale al livello di classe level (1 = nuova classe). Funzione pura: restituisce una scheda nuova.
export function applyLevel(sheet: CharacterSheet, className: string, level: number, choices: LevelChoices): CharacterSheet {
  const previous = structuredClone(sheet);
  const next = structuredClone(sheet);
  // Il bonus di competenza segue il livello solo se coincideva prima del cambio (come all'import).
  fixProficiencyChoice(next);
  const classes = structuredClone(sheetClasses(sheet));
  let entry = classes.find((item) => item.name === className);
  if (!entry) { entry = { name: className, level: 0 }; classes.push(entry); }
  entry.level = level;
  if (choices.subclass) entry.subclass = choices.subclass;
  next.classes = classes;
  if (next.options?.autoLevel) applyClassChanges(next, previous);
  else {
    // Senza calcolo automatico: livello, descrizione delle classi e un dado vita in più; slot e TS restano a mano.
    next.identity.level += 1;
    if (classes[0] === entry && entry.subclass) next.identity.subclass = entry.subclass;
    next.identity.classDisplay = classDisplay(classes);
    next.combat.hitDice = { ...next.combat.hitDice, max: next.combat.hitDice.max + 1, current: next.combat.hitDice.current + 1 };
  }
  if (choices.feat) upsertTrait(next, featTrait(className, level, choices.feat));
  // PF del livello con la COS di prima; se l'ASI alza il modificatore di COS, +1 PF per livello anche per quelli passati.
  const conBefore = effectiveSheet(sheet).abilities.constitution?.mod ?? 0;
  const conAfter = effectiveSheet(next).abilities.constitution?.mod ?? 0;
  const gain = hitPointGain(hitDieOf(className), conBefore, choices.hpRoll) + (conAfter - conBefore) * next.identity.level;
  next.combat.hp = { ...next.combat.hp, max: next.combat.hp.max + gain, current: next.combat.hp.current + gain };
  return next;
}

const signed = (value: number) => `${value >= 0 ? "+" : ""}${value}`;
const slotText = (slots: Record<string, number>) => Object.entries(slots).sort().map(([key, total]) => `${key.replace("level_", "")}°: ${total}`).join(", ") || "nessuno";

// Cosa cambia, sui valori calcolati della scheda (prima → dopo): per il riepilogo del popup e il messaggio in chat.
export function levelSummary(before: CharacterSheet, after: CharacterSheet): string[] {
  const [a, b] = [effectiveSheet(before), effectiveSheet(after)];
  const lines = [`Livello ${a.identity.level} → ${b.identity.level}: ${b.identity.classDisplay}`, `PF massimi ${a.combat.hp.max} → ${b.combat.hp.max}`, `Dadi vita ${a.combat.hitDice.max} → ${b.combat.hitDice.max}`];
  if (a.combat.proficiencyBonus !== b.combat.proficiencyBonus) lines.push(`Competenza ${signed(a.combat.proficiencyBonus)} → ${signed(b.combat.proficiencyBonus)}`);
  if (after.options?.autoLevel) {
    const [slotsA, slotsB] = [slotText(derivedSlots(before)), slotText(derivedSlots(after))];
    if (slotsA !== slotsB) lines.push(`Slot ${slotsA} → ${slotsB}`);
  }
  for (const [key, ability] of Object.entries(b.abilities)) {
    const old = a.abilities[key]?.score;
    if (old !== ability.score) lines.push(`${ABILITY_SHORT[key] ?? key} ${old} → ${ability.score}`);
  }
  const ids = new Set(before.traits.map((trait) => trait.id));
  for (const trait of after.traits) if (!ids.has(trait.id)) lines.push(`Nuovo tratto: ${trait.name}`);
  return lines;
}
