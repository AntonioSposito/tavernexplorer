import { ABILITY_LABELS, SKILL_LABELS } from "./constants";
import { itemModifierList } from "./itemModifiers";
import type { CharacterSheet, StatModifier } from "./types";

export const MODIFIER_TARGETS = [
  ["ac", "Classe armatura"],
  // CA base dell'armatura indossata: la usa solo il calcolo automatico della CA.
  ["armor:light", "Armatura leggera (CA base)"], ["armor:medium", "Armatura media (CA base)"], ["armor:heavy", "Armatura pesante (CA base)"], ["initiative", "Iniziativa"], ["hpMax", "PF massimi"],
  ["passivePerception", "Percezione passiva"], ["spellSaveDc", "CD incantesimi"],
  ["spellAttack", "Attacco incantesimi"], ["attack", "Tiri per colpire"], ["damage", "Danni"],
  ...["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"].flatMap((ability) => [
    [`ability:${ability}`, ABILITY_LABELS[ability]], [`save:${ability}`, `TS ${ABILITY_LABELS[ability]}`],
  ]),
  ...["acrobatics", "animal_handling", "arcana", "athletics", "deception", "history", "insight", "intimidation", "investigation", "medicine", "nature", "perception", "performance", "persuasion", "religion", "sleight_of_hand", "stealth", "survival"].map((skill) => [`skill:${skill}`, SKILL_LABELS[skill]]),
];

const ABILITY_KEYS = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];

// Opzioni della tab "Modifica (prova)" come gruppi di modificatori con un nome (per i tooltip).
function optionSources(sheet: CharacterSheet): Array<{ name: string; modifiers: StatModifier[] }> {
  const options = sheet.options;
  if (!options) return [];
  const pb = sheet.combat.proficiencyBonus;
  const bonuses = Object.entries(options.bonuses ?? {}).filter(([, amount]) => amount).flatMap(([target, amount]) =>
    (target === "saveAll" ? ABILITY_KEYS.map((ability) => `save:${ability}`) : [target]).map((item) => ({ id: `option:${item}`, target: item, amount })));
  const expertise = (options.expertise ?? []).filter((skill) => sheet.skills[skill]?.proficient).map((skill) => ({ id: `expertise:${skill}`, target: `skill:${skill}`, amount: pb }));
  // Jack of all trades (2024): metà competenza, per difetto, alle prove senza competenza, iniziativa compresa.
  const jack = options.jackOfAllTrades ? [...Object.entries(sheet.skills).filter(([, skill]) => !skill.proficient).map(([key]) => `skill:${key}`), "initiative"].map((target) => ({ id: `jack:${target}`, target, amount: Math.floor(pb / 2) })) : [];
  return [{ name: "Opzioni", modifiers: bonuses }, { name: "Maestria", modifiers: expertise }, { name: "Jack of all trades", modifiers: jack }];
}

export function activeModifiers(sheet: CharacterSheet): StatModifier[] {
  return [
    ...optionSources(sheet).flatMap((source) => source.modifiers),
    ...(sheet.effects ?? []).filter((effect) => effect.active && (effect.remainingRounds === undefined || effect.remainingRounds > 0)).flatMap((effect) => effect.modifiers),
    ...sheet.inventory.filter((item) => item.equipped && (item.count === null || item.count > 0)).flatMap((item) => itemModifierList(item)),
    ...sheet.traits.flatMap((trait) => trait.modifiers ?? []),
    // Già inclusi nei valori importati da Roll20: si tolgono, così conta solo lo stato attuale degli oggetti.
    ...(sheet.importedItemModifiers ?? []).map((modifier) => ({ ...modifier, amount: -modifier.amount })),
  ].filter((modifier) => Number.isFinite(modifier.amount));
}

// Da dove arriva un modificatore: effetti attivi e oggetti equipaggiati, per nome (senza la correzione dell'import Roll20).
export function modifierSources(sheet: CharacterSheet, target: string): Array<{ name: string; amount: number }> {
  const sum = (mods: StatModifier[]) => mods.filter((mod) => mod.target === target && Number.isFinite(mod.amount)).reduce((total, mod) => total + mod.amount, 0);
  return [
    ...(sheet.effects ?? []).filter((effect) => effect.active && (effect.remainingRounds === undefined || effect.remainingRounds > 0)).map((effect) => ({ name: effect.name, amount: sum(effect.modifiers) })),
    ...sheet.inventory.filter((item) => item.equipped && (item.count === null || item.count > 0)).map((item) => ({ name: item.name, amount: sum(itemModifierList(item)) })),
    ...sheet.traits.map((trait) => ({ name: trait.name, amount: sum(trait.modifiers ?? []) })),
    ...optionSources(sheet).map((source) => ({ name: source.name, amount: sum(source.modifiers) })),
  ].filter((source) => source.amount !== 0);
}

const equippedItems = (sheet: CharacterSheet) => sheet.inventory.filter((item) => item.equipped && (item.count === null || item.count > 0));

// CA con le parti che la compongono (per il tooltip). dexMod è il modificatore di DES già con gli effetti.
export function armorClass(sheet: CharacterSheet, dexMod = sheet.abilities.dexterity?.mod ?? 0): { total: number; parts: Array<{ name: string; amount: number }> } {
  const sources = modifierSources(sheet, "ac");
  let base: Array<{ name: string; amount: number }>;
  if (sheet.combat.acMode === "auto") {
    const armor = equippedItems(sheet).flatMap((item) => itemModifierList(item).filter((mod) => mod.target.startsWith("armor:")).map((mod) => ({ item, type: mod.target.slice(6), ac: mod.amount }))).sort((a, b) => b.ac - a.ac)[0];
    const dex = !armor || armor.type === "light" ? dexMod : armor.type === "medium" ? Math.min(dexMod, 2) : 0;
    base = [{ name: armor ? armor.item.name : "Senza armatura", amount: armor ? armor.ac : sheet.combat.acBase ?? 10 }, ...dex ? [{ name: "DES", amount: dex }] : []];
  } else {
    // Manuale: ac comprende già gli oggetti equipaggiati all'import (o quando è stata scritta), che vanno tolti.
    const included = (sheet.importedItemModifiers ?? []).filter((mod) => mod.target === "ac").reduce((sum, mod) => sum + mod.amount, 0);
    base = [{ name: "Base", amount: sheet.combat.ac - included }];
  }
  const parts = [...base, ...sources];
  return { total: parts.reduce((sum, part) => sum + part.amount, 0), parts };
}

// CA scritta a mano: è la CA attuale, quindi gli oggetti ora equipaggiati sono già compresi.
export function setManualArmorClass(sheet: CharacterSheet, value: number) {
  sheet.combat.ac = value;
  sheet.importedItemModifiers = [...(sheet.importedItemModifiers ?? []).filter((mod) => mod.target !== "ac"), ...equippedItems(sheet).flatMap((item) => itemModifierList(item)).filter((mod) => mod.target === "ac")];
}

// Caratteristica da cui un valore deriva: se un modificatore ne cambia il punteggio, cambia anche il valore.
function derivedAbility(sheet: CharacterSheet, target: string): string | undefined {
  if (target.startsWith("save:")) return target.slice(5);
  if (target.startsWith("skill:")) return sheet.skills[target.slice(6)]?.ability;
  if (target === "initiative") return "dexterity";
  if (target === "passivePerception") return sheet.skills.perception?.ability;
  if (target === "spellSaveDc" || target === "spellAttack") return sheet.spellcasting.ability;
  return undefined;
}

// Tooltip "da cosa è dato" come quello della CA: totale, base e ogni effetto/oggetto che lo cambia.
// sheet è la scheda salvata, view quella con gli effetti; undefined se nulla modifica il valore.
export function explainValue(sheet: CharacterSheet, view: CharacterSheet, target: string, label: string, total: number, withSign = true): string | undefined {
  const targets = target === "passivePerception" ? ["passivePerception", "skill:perception"] : [target];
  const parts = targets.flatMap((item) => modifierSources(sheet, item));
  const ability = derivedAbility(sheet, target);
  const delta = ability ? (view.abilities[ability]?.mod ?? 0) - (sheet.abilities[ability]?.mod ?? 0) : 0;
  if (delta) parts.unshift({ name: `Mod. ${ABILITY_LABELS[ability!] ?? ability}`, amount: delta });
  if (!parts.length) return undefined;
  const format = (value: number) => withSign ? `${value >= 0 ? "+" : ""}${value}` : String(value);
  const base = total - parts.reduce((sum, part) => sum + part.amount, 0);
  return [`${label} ${format(total)}`, `Base ${format(base)}`, ...parts.map((part) => `${part.name} ${part.amount >= 0 ? "+" : ""}${part.amount}`)].join("\n");
}

const TARGET_LABELS: Record<string, string> = Object.fromEntries(MODIFIER_TARGETS);
// Etichette dei modificatori mostrate sotto il nome di oggetti e tratti. La CA base di un'armatura non è un bonus: niente segno.
export function modifierTags(modifiers: StatModifier[]): string[] {
  return modifiers.map((mod) => `${TARGET_LABELS[mod.target] ?? mod.target} ${mod.target.startsWith("armor:") || mod.amount < 0 ? mod.amount : `+${mod.amount}`}`);
}

export function modifierTotal(sheet: CharacterSheet, target: string): number {
  return activeModifiers(sheet).filter((modifier) => modifier.target === target).reduce((sum, modifier) => sum + modifier.amount, 0);
}

export function effectiveSheet(sheet: CharacterSheet): CharacterSheet {
  const result = structuredClone(sheet);
  const mods = activeModifiers(sheet);
  const total = (target: string) => mods.filter((mod) => mod.target === target).reduce((sum, mod) => sum + mod.amount, 0);
  for (const [key, ability] of Object.entries(result.abilities)) {
    const previousMod = ability.mod;
    ability.score += total(`ability:${key}`);
    ability.mod = Math.floor((ability.score - 10) / 2);
    ability.save += ability.mod - previousMod + total(`save:${key}`);
    for (const skill of Object.values(result.skills)) if (skill.ability === key) skill.bonus += ability.mod - previousMod;
    if (key === "dexterity") result.combat.initiative += ability.mod - previousMod;
    if (result.skills.perception?.ability === key) result.combat.passivePerception += ability.mod - previousMod;
    if (result.spellcasting.ability === key) { result.spellcasting.saveDc += ability.mod - previousMod; result.spellcasting.attackBonus += ability.mod - previousMod; }
  }
  for (const [key, skill] of Object.entries(result.skills)) skill.bonus += total(`skill:${key}`);
  result.combat.ac = armorClass(sheet, result.abilities.dexterity?.mod).total;
  result.combat.initiative += total("initiative");
  result.combat.hp.max += total("hpMax");
  result.combat.passivePerception += total("passivePerception") + total("skill:perception");
  result.spellcasting.saveDc += total("spellSaveDc");
  result.spellcasting.attackBonus += total("spellAttack");
  return result;
}
