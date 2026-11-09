import { createBlankSheet } from "./blankSheet";
import { slotsForCasterLevel } from "./classes";
import { SKILL_LABELS } from "./constants";
import { DEFAULT_RULESET } from "./rulesets";
import type { ActionDamage, ActionEntry, CharacterSheet, MonsterSheet, MonsterSpellcasting } from "./types";

// Statblock dei mostri: caratteristiche con le sigle di 5e.tools, abilità con i nomi di 5e.tools ("sleight of hand").
export const MONSTER_ABILITIES = [["str", "strength"], ["dex", "dexterity"], ["con", "constitution"], ["int", "intelligence"], ["wis", "wisdom"], ["cha", "charisma"]] as const;
export const monsterSkillLabel = (key: string) => SKILL_LABELS[key.replace(/ /g, "_")] ?? key;
export const MONSTER_SKILLS = Object.keys(SKILL_LABELS).map((key) => key.replace(/_/g, " "));

// Righe di testo dello statblock sotto le abilità, nell'ordine di 5e.tools.
export const MONSTER_DETAILS = [["vulnerabilities", "Vulnerabilità ai danni"], ["resistances", "Resistenze ai danni"], ["immunities", "Immunità ai danni"], ["conditionImmunities", "Immunità alle condizioni"], ["senses", "Sensi"], ["languages", "Linguaggi"]] as const;

// GS "1/8" → 0.125; PE e bonus competenza dalle tabelle del Manuale dei Mostri.
const crNumber = (cr: string) => { const [top, bottom] = cr.split("/").map(Number); return bottom ? top / bottom : top || 0; };
const CR_XP: Record<string, number> = { 0: 10, 0.125: 25, 0.25: 50, 0.5: 100, 1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800, 6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900, 11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000, 16: 15000, 17: 18000, 18: 20000, 19: 22000, 20: 25000, 21: 33000, 22: 41000, 23: 50000, 24: 62000, 25: 75000, 26: 90000, 27: 105000, 28: 120000, 29: 135000, 30: 155000 };
export const monsterXp = (monster: MonsterSheet) => monster.xp ?? CR_XP[crNumber(monster.challengeRating)] ?? 0;
export const monsterProficiency = (monster: MonsterSheet) => monster.proficiencyBonus ?? 2 + Math.floor((Math.max(1, crNumber(monster.challengeRating)) - 1) / 4);
// Quadretti occupati dal token, dalla taglia (prima lettera: "M", "L/H"…).
const TOKEN_SIZES: Record<string, number> = { T: 0.5, S: 1, M: 1, L: 2, H: 3, G: 4 };
export const monsterTokenSize = (monster: Pick<MonsterSheet, "size" | "tokenSize">) => monster.tokenSize ?? TOKEN_SIZES[monster.size.trim()[0]?.toUpperCase()] ?? 1;

export function blankMonster(): MonsterSheet {
  return {
    schemaVersion: 1, id: crypto.randomUUID(), ruleset: { id: DEFAULT_RULESET.id, version: DEFAULT_RULESET.version }, name: "", source: "Personalizzato",
    size: "M", creatureType: "", alignment: "", challengeRating: "0", ac: 10, hp: { average: 1, formula: "" }, speed: "30 ft.",
    abilities: Object.fromEntries(MONSTER_ABILITIES.map(([key]) => [key, 10])), saves: {}, skills: {}, passivePerception: 10,
    traits: [], actions: [], bonusActions: [], reactions: [], legendaryActions: [], importWarnings: [],
  };
}

// Liste di voci dello statblock, ognuna con titolo e testo del pulsante per aggiungere.
export type MonsterSection = "traits" | "actions" | "bonusActions" | "reactions" | "legendaryActions";
export const MONSTER_SECTIONS: Array<[MonsterSection, string, string]> = [["traits", "Tratti", "Nuovo tratto"], ["actions", "Azioni", "Nuova azione"], ["bonusActions", "Azioni bonus", "Nuova azione bonus"],["reactions", "Reazioni", "Nuova reazione"], ["legendaryActions", "Azioni leggendarie", "Nuova azione leggendaria"]];

// Mostro incantatore: CD e attacco come il "Spellcasting NPC" di Roll20.
export function monsterSpellStats(monster: MonsterSheet, cast: MonsterSpellcasting) {
  const short = MONSTER_ABILITIES.find(([, long]) => long === cast.ability)?.[0];
  const mod = short ? Math.floor(((monster.abilities[short] ?? 10) - 10) / 2) : 0;
  const pb = monsterProficiency(monster);
  return { saveDc: 8 + pb + mod + cast.dcModifier, attackBonus: pb + mod + cast.attackModifier };
}

// Slot di un incantatore completo del livello dato; gli slot già spesi restano spesi.
export function monsterSlots(casterLevel: number, previous: MonsterSpellcasting["slots"] = {}): MonsterSpellcasting["slots"] {
  return Object.fromEntries(slotsForCasterLevel(casterLevel).flatMap((total, index) => total ? [[`level_${index + 1}`, { total, used: Math.min(previous[`level_${index + 1}`]?.used ?? 0, total) }]] : []));
}

// Scheda PG con i valori del mostro: per la sezione Magia (quella delle schede PG) e per risolvere le voci con più danni.
export function monsterCasterSheet(monster: MonsterSheet, cast?: MonsterSpellcasting): CharacterSheet {
  const sheet = createBlankSheet(monster.name, monster.ruleset.id);
  const pb = monsterProficiency(monster);
  sheet.id = monster.id;
  sheet.combat.proficiencyBonus = pb;
  for (const [short, long] of MONSTER_ABILITIES) {
    const score = monster.abilities[short] ?? 10; const mod = Math.floor((score - 10) / 2);
    sheet.abilities[long] = { score, mod, save: monster.saves[short] ?? mod, saveProficient: monster.saves[short] != null };
  }
  if (cast) sheet.spellcasting = { ability: cast.ability, ...monsterSpellStats(monster, cast), slots: cast.slots };
  sheet.spells = monster.spells ?? [];
  return sheet;
}

// Danni di una voce del mostro, come "Danno" e "Danno 2" di Roll20: "1d12+4+1d8" → dadi "1d12+1d8", bonus 4.
// Il critico raddoppia i dadi. Con un solo danno bastano damage e damageType; con più danni si tirano a parte (damages).
export function monsterDamages(parts: Array<{ damage: string; type: string }>): Pick<ActionEntry, "damage" | "damageType" | "damages"> {
  const filled = parts.map((part) => ({ damage: part.damage.replace(/\s+/g, ""), type: part.type.trim() })).filter((part) => part.damage);
  const split = (part: { damage: string; type: string }): ActionDamage => {
    const terms = part.damage.match(/[+-]?[^+-]+/g) ?? [];
    const dice = terms.filter((term) => /d/i.test(term)).join("").replace(/^\+/, "");
    return { dice, bonus: terms.filter((term) => !/d/i.test(term)).reduce((sum, term) => sum + (Number(term) || 0), 0), ability: "none", type: part.type, critDice: dice };
  };
  return {
    damage: filled.map((part) => part.damage).join("+") || undefined,
    damageType: [...new Set(filled.map((part) => part.type).filter(Boolean))].join(" / ") || undefined,
    damages: filled.length > 1 ? filled.map(split) : undefined,
  };
}
