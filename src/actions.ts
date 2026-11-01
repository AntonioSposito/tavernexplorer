import { ABILITY_TAGS } from "./constants";
import { labeledBonus } from "./rollCards";
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
  // Formule con i modificatori etichettati (es. 1d20+3[STR]+2[PROF]); solo per le azioni del form.
  attackFormula?: string;
  damageFormula?: string;
  critDamageFormula?: string;
}

const signed = (value: number) => value === 0 ? "" : `${value > 0 ? "+" : ""}${value}`;
const abilityTag = (ability: ActionAbility) => ability === "spell" ? "SPELL" : ABILITY_TAGS[ability] ?? "";

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

  const attackFormula = entry.attack && attackBonus != null
    ? `1d20${labeledBonus([[abilityMod(sheet, entry.attack.ability), abilityTag(entry.attack.ability)], [entry.attack.proficient ? sheet.combat.proficiencyBonus : 0, "PROF"], [entry.attack.bonus, "BONUS"], [magic, "MAGIC"]], attackBonus)}`
    : undefined;
  const parts = (entry.damages ?? []).filter((part) => part.dice.trim());
  if (!parts.length) {
    return { attackBonus, attackFormula, damage: entry.damage, critDamage: entry.damage && getRuleset(sheet.ruleset.id).criticalDamage(entry.damage), damageType: entry.damageType, critRange, ...save };
  }
  // Il bonus magico si somma solo al primo danno, come nel form di Roll20.
  const flat = parts.map((part, index) => abilityMod(sheet, part.ability) + part.bonus + (index === 0 ? magic : 0));
  const damage = parts.map((part, index) => `${part.dice.trim()}${signed(flat[index])}`).join("+");
  const critDamage = parts.map((part, index) => `${[part.dice.trim(), part.critDice.trim()].filter(Boolean).join("+")}${signed(flat[index])}`).join("+");
  const damageType = parts.map((part) => part.type.trim()).filter(Boolean).join(" / ") || undefined;
  const labels = parts.map((part, index) => labeledBonus([[abilityMod(sheet, part.ability), abilityTag(part.ability)], [part.bonus, "BONUS"], [index === 0 ? magic : 0, "MAGIC"]], flat[index]));
  const damageFormula = parts.map((part, index) => `${part.dice.trim()}${labels[index]}`).join("+");
  const critDamageFormula = parts.map((part, index) => `${[part.dice.trim(), part.critDice.trim()].filter(Boolean).join("+")}${labels[index]}`).join("+");
  return { attackBonus, attackFormula, damage, critDamage, damageFormula, critDamageFormula, damageType, critRange, ...save };
}
