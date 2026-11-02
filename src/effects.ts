import { parseArmor, parseItemModifiers } from "./itemModifiers";
import type { CharacterSheet, StatModifier } from "./types";

export const MODIFIER_TARGETS = [
  ["ac", "Classe armatura"], ["initiative", "Iniziativa"], ["hpMax", "PF massimi"],
  ["passivePerception", "Percezione passiva"], ["spellSaveDc", "CD incantesimi"],
  ["spellAttack", "Attacco incantesimi"], ["attack", "Tiri per colpire"], ["damage", "Danni"],
  ...["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"].flatMap((ability) => [
    [`ability:${ability}`, `Punteggio ${ability}`], [`save:${ability}`, `TS ${ability}`],
  ]),
  ...["acrobatics", "animal_handling", "arcana", "athletics", "deception", "history", "insight", "intimidation", "investigation", "medicine", "nature", "perception", "performance", "persuasion", "religion", "sleight_of_hand", "stealth", "survival"].map((skill) => [`skill:${skill}`, `Abilità ${skill}`]),
];

export function activeModifiers(sheet: CharacterSheet): StatModifier[] {
  return [
    ...(sheet.effects ?? []).filter((effect) => effect.active && (effect.remainingRounds === undefined || effect.remainingRounds > 0)).flatMap((effect) => effect.modifiers),
    ...sheet.inventory.filter((item) => item.equipped && (item.count === null || item.count > 0)).flatMap((item) => [...item.modifiers ?? [], ...parseItemModifiers(item.modifiersText).modifiers]),
    // Già inclusi nei valori importati da Roll20: si tolgono, così conta solo lo stato attuale degli oggetti.
    ...(sheet.importedItemModifiers ?? []).map((modifier) => ({ ...modifier, amount: -modifier.amount })),
  ].filter((modifier) => Number.isFinite(modifier.amount));
}

// Da dove arriva un modificatore: effetti attivi e oggetti equipaggiati, per nome (senza la correzione dell'import Roll20).
export function modifierSources(sheet: CharacterSheet, target: string): Array<{ name: string; amount: number }> {
  const sum = (mods: StatModifier[]) => mods.filter((mod) => mod.target === target && Number.isFinite(mod.amount)).reduce((total, mod) => total + mod.amount, 0);
  return [
    ...(sheet.effects ?? []).filter((effect) => effect.active && (effect.remainingRounds === undefined || effect.remainingRounds > 0)).map((effect) => ({ name: effect.name, amount: sum(effect.modifiers) })),
    ...sheet.inventory.filter((item) => item.equipped && (item.count === null || item.count > 0)).map((item) => ({ name: item.name, amount: sum([...item.modifiers ?? [], ...parseItemModifiers(item.modifiersText).modifiers]) })),
  ].filter((source) => source.amount !== 0);
}

const equippedItems = (sheet: CharacterSheet) => sheet.inventory.filter((item) => item.equipped && (item.count === null || item.count > 0));

// CA con le parti che la compongono (per il tooltip). dexMod è il modificatore di DES già con gli effetti.
export function armorClass(sheet: CharacterSheet, dexMod = sheet.abilities.dexterity?.mod ?? 0): { total: number; parts: Array<{ name: string; amount: number }> } {
  const sources = modifierSources(sheet, "ac");
  let base: Array<{ name: string; amount: number }>;
  if (sheet.combat.acMode === "auto") {
    const armor = equippedItems(sheet).map((item) => ({ item, armor: parseArmor(item.modifiersText) })).filter(({ armor }) => armor && armor.type !== "shield").sort((a, b) => b.armor!.ac - a.armor!.ac)[0];
    const dex = !armor ? dexMod : armor.armor!.type === "light" ? dexMod : armor.armor!.type === "medium" ? Math.min(dexMod, 2) : 0;
    base = [{ name: armor ? armor.item.name : "Senza armatura", amount: armor ? armor.armor!.ac : sheet.combat.acBase ?? 10 }, ...dex ? [{ name: "DES", amount: dex }] : []];
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
  sheet.importedItemModifiers = [...(sheet.importedItemModifiers ?? []).filter((mod) => mod.target !== "ac"), ...equippedItems(sheet).flatMap((item) => [...item.modifiers ?? [], ...parseItemModifiers(item.modifiersText).modifiers]).filter((mod) => mod.target === "ac")];
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
