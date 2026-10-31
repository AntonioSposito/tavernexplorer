import { getRuleset } from "./rulesets";
import type { ActionAbility, ActionEntry, CharacterSheet } from "./types";

export interface ResolvedAction {
  attackBonus?: number;
  damage?: string;
  critDamage?: string;
  damageType?: string;
  saveDc?: number;
  saveAbility?: string;
  saveEffect?: string;
  critRange: number;
}

const signed = (value: number) => value === 0 ? "" : `${value > 0 ? "+" : ""}${value}`;

// "spell" = modificatore della caratteristica da incantatore, ricavato dal bonus d'attacco degli incantesimi.
function abilityMod(sheet: CharacterSheet, ability: ActionAbility): number {
  if (ability === "none") return 0;
  if (ability === "spell") return sheet.spellcasting.attackBonus - sheet.combat.proficiencyBonus;
  return sheet.abilities[ability]?.mod ?? 0;
}

// Valori effettivi dell'azione per la scheda data (passare la scheda con gli effetti già applicati).
export function resolveAction(sheet: CharacterSheet, entry: ActionEntry): ResolvedAction {
  const magic = entry.magicBonus ?? 0;
  const critRange = entry.critRange ?? 20;
  const attackBonus = entry.attack
    ? abilityMod(sheet, entry.attack.ability) + (entry.attack.proficient ? sheet.combat.proficiencyBonus : 0) + entry.attack.bonus + magic
    : entry.attackBonus;
  const save = entry.save
    ? { saveDc: entry.save.dc === "spell" ? sheet.spellcasting.saveDc : entry.save.dc, saveAbility: entry.save.ability, saveEffect: entry.save.effect || undefined }
    : { saveDc: entry.saveDc };

  const parts = (entry.damages ?? []).filter((part) => part.dice.trim());
  if (!parts.length) {
    return { attackBonus, damage: entry.damage, critDamage: entry.damage && getRuleset(sheet.ruleset.id).criticalDamage(entry.damage), damageType: entry.damageType, critRange, ...save };
  }
  // Il bonus magico si somma solo al primo danno, come nel form di Roll20.
  const flat = parts.map((part, index) => abilityMod(sheet, part.ability) + part.bonus + (index === 0 ? magic : 0));
  const damage = parts.map((part, index) => `${part.dice.trim()}${signed(flat[index])}`).join("+");
  const critDamage = parts.map((part, index) => `${[part.dice.trim(), part.critDice.trim()].filter(Boolean).join("+")}${signed(flat[index])}`).join("+");
  const damageType = parts.map((part) => part.type.trim()).filter(Boolean).join(" / ") || undefined;
  return { attackBonus, damage, critDamage, damageType, critRange, ...save };
}
