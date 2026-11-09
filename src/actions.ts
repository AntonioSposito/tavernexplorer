import { ABILITY_TAGS } from "./constants";
import { labeledBonus } from "./rollCards";
import { getRuleset } from "./rulesets";
import type { ActionAbility, ActionEntry, CharacterSheet, SpellEntry } from "./types";

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
  // Solo incantesimi: cura, con e senza etichette.
  healing?: string;
  healingFormula?: string;
  // Con più danni: ognuno a parte (formula, critico e tipo), per tirarli in righe separate.
  damageParts?: Array<{ damage: string; critDamage: string; type?: string }>;
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
export function resolveAction(sheet: CharacterSheet, entry: ActionEntry | SpellEntry): ResolvedAction {
  const magic = entry.magicBonus ?? 0;
  // Incantesimo con caratteristica scelta: CD 8 + competenza + modificatore invece della CD della scheda.
  const casting = "castingAbility" in entry && entry.castingAbility && entry.castingAbility !== "spell" && entry.castingAbility !== "none" ? entry.castingAbility : null;
  const spellDc = casting ? 8 + sheet.combat.proficiencyBonus + abilityMod(sheet, casting) : sheet.spellcasting.saveDc;
  const healAbility: ActionAbility = "healing" in entry && entry.addAbilityMod ? entry.castingAbility ?? "spell" : "none";
  const heal = "healing" in entry && entry.healing?.trim()
    ? { healing: `${entry.healing.trim()}${signed(abilityMod(sheet, healAbility))}`, healingFormula: `${entry.healing.trim()}${labeledBonus([[abilityMod(sheet, healAbility), abilityTag(healAbility)]], abilityMod(sheet, healAbility))}` }
    : {};
  // Critical range globale delle opzioni: vale il più ampio tra quello dell'azione e quello della scheda.
  const critRange = Math.min(entry.critRange ?? 20, sheet.options?.critRange ?? 20);
  const attackBonus = entry.attack
    ? abilityMod(sheet, entry.attack.ability) + (entry.attack.proficient ? sheet.combat.proficiencyBonus : 0) + entry.attack.bonus + magic
    : entry.attackBonus;
  const save = entry.save
    ? { saveDc: entry.save.dc === "spell" ? spellDc : entry.save.dc, saveAbility: entry.save.ability, saveEffect: entry.save.effect || undefined }
    : { saveDc: entry.saveDc };

  const attackFormula = entry.attack && attackBonus != null
    ? `1d20${labeledBonus([[abilityMod(sheet, entry.attack.ability), abilityTag(entry.attack.ability)], [entry.attack.proficient ? sheet.combat.proficiencyBonus : 0, "PROF"], [entry.attack.bonus, "BONUS"], [magic, "MAGIC"]], attackBonus)}`
    : undefined;
  const parts = (entry.damages ?? []).filter((part) => part.dice.trim());
  if (!parts.length) {
    return { attackBonus, attackFormula, damage: entry.damage, critDamage: entry.damage && getRuleset(sheet.ruleset.id).criticalDamage(entry.damage), damageType: entry.damageType, critRange, ...save, ...heal };
  }
  // Il bonus magico si somma solo al primo danno, come nel form di Roll20.
  const flat = parts.map((part, index) => abilityMod(sheet, part.ability) + part.bonus + (index === 0 ? magic : 0));
  const damage = parts.map((part, index) => `${part.dice.trim()}${signed(flat[index])}`).join("+");
  const critDamage = parts.map((part, index) => `${[part.dice.trim(), part.critDice.trim()].filter(Boolean).join("+")}${signed(flat[index])}`).join("+");
  const damageType = parts.map((part) => part.type.trim()).filter(Boolean).join(" / ") || undefined;
  const labels = parts.map((part, index) => labeledBonus([[abilityMod(sheet, part.ability), abilityTag(part.ability)], [part.bonus, "BONUS"], [index === 0 ? magic : 0, "MAGIC"]], flat[index]));
  const damageFormula = parts.map((part, index) => `${part.dice.trim()}${labels[index]}`).join("+");
  const critDamageFormula = parts.map((part, index) => `${[part.dice.trim(), part.critDice.trim()].filter(Boolean).join("+")}${labels[index]}`).join("+");
  const damageParts = parts.length > 1 ? parts.map((part, index) => ({ damage: `${part.dice.trim()}${labels[index]}`, critDamage: `${[part.dice.trim(), part.critDice.trim()].filter(Boolean).join("+")}${labels[index]}`, type: part.type.trim() || undefined })) : undefined;
  return { attackBonus, attackFormula, damage, critDamage, damageFormula, critDamageFormula, damageType, damageParts, critRange, ...save, ...heal };
}
