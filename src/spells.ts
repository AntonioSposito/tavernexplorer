import { sanitizeFormula } from "./dice";
import type { ActionAbility, ActionDamage, SpellEntry } from "./types";

export type SaveAbility = NonNullable<SpellEntry["save"]>["ability"];
export const SPELL_SCHOOLS = ["Abiurazione", "Ammaliamento", "Divinazione", "Evocazione", "Illusione", "Invocazione", "Necromanzia", "Trasmutazione"];
export const HIGHER_DICE = ["d4", "d6", "d8", "d10", "d12"];

// Bozza piatta come il form incantesimi di Roll20; toSpell la traduce nei campi che resolveAction già capisce.
export interface SpellDraft {
  name: string; school: string; ritual: boolean; castingTime: string; range: string; target: string;
  verbal: boolean; somatic: boolean; material: boolean; materials: string; concentration: boolean; duration: string;
  castingAbility: ActionAbility; innate: string; output: "attack" | "spellcard"; spellAttack: "none" | "melee" | "ranged";
  damage: string; damageType: string; damage2: string; damage2Type: string; healing: string; addAbilityMod: boolean;
  saveAbility: SaveAbility | ""; saveEffect: string; higherCount: number; higherDie: string; higherBonus: number;
  includeDescription: boolean; description: string; higherLevelText: string; spellClass: string; spellType: string;
}

const cleanFormula = (formula: string) => formula.replace(/\s+/g, "").toLowerCase();
const diceOnly = (formula: string) => formula.match(/\d*d\d+/gi)?.join("+") ?? "";

// Gli incantesimi importati hanno valori fissi: attacco e TS diventano quelli dell'incantatore, il danno resta.
export function toSpellDraft(spell: SpellEntry | null): SpellDraft {
  const [first, second] = spell?.damages ?? (spell?.damage ? [{ dice: spell.damage, type: spell.damageType ?? "" }] : []);
  return {
    name: spell?.name ?? "", school: spell?.school ?? "", ritual: spell?.ritual ?? false, castingTime: spell?.castingTime ?? "", range: spell?.range ?? "", target: spell?.target ?? "",
    verbal: spell?.components?.verbal ?? false, somatic: spell?.components?.somatic ?? false, material: spell?.components?.material ?? false, materials: spell?.components?.materials ?? "",
    concentration: spell?.concentration ?? false, duration: spell?.duration ?? "", castingAbility: spell?.castingAbility ?? "spell", innate: spell?.innate ?? "",
    output: spell?.output ?? "attack", spellAttack: spell?.spellAttack ?? (spell?.attack || spell?.attackBonus != null ? "ranged" : "none"),
    damage: first?.dice ?? "", damageType: first?.type ?? "", damage2: second?.dice ?? "", damage2Type: second?.type ?? "", healing: spell?.healing ?? "", addAbilityMod: spell?.addAbilityMod ?? false,
    saveAbility: spell?.save?.ability ?? (spell?.saveDc != null ? "dexterity" : ""), saveEffect: spell?.save?.effect ?? "",
    higherCount: spell?.higherLevel?.count ?? 1, higherDie: spell?.higherLevel?.die ?? "", higherBonus: spell?.higherLevel?.bonus ?? 0,
    includeDescription: spell?.includeDescription ?? false, description: spell?.description ?? "", higherLevelText: spell?.higherLevelText ?? "", spellClass: spell?.spellClass ?? "", spellType: spell?.spellType ?? "",
  };
}

// Salva solo i campi del form: i valori fissi importati (attackBonus, damage, saveDc) vengono tolti.
export function toSpell(draft: SpellDraft, base: { id: string; level: number; prepared: boolean; source?: string }): SpellEntry {
  const text = (value: string) => value.trim() || undefined;
  const ability = draft.castingAbility;
  const damages: ActionDamage[] = [[draft.damage, draft.damageType], [draft.damage2, draft.damage2Type]]
    .filter(([dice]) => dice.trim())
    .map(([dice, type], index) => ({ dice: cleanFormula(dice), ability: index === 0 && draft.addAbilityMod ? ability : "none", bonus: 0, type: type.trim(), critDice: diceOnly(cleanFormula(dice)) }));
  return {
    ...base, name: draft.name.trim(), school: text(draft.school), ritual: draft.ritual, concentration: draft.concentration,
    castingTime: text(draft.castingTime), range: text(draft.range), target: text(draft.target), duration: text(draft.duration),
    components: { verbal: draft.verbal, somatic: draft.somatic, material: draft.material, materials: draft.material ? text(draft.materials) : undefined },
    castingAbility: ability, innate: text(draft.innate), output: draft.output,
    spellAttack: draft.spellAttack === "none" ? undefined : draft.spellAttack,
    attack: draft.spellAttack === "none" ? undefined : { ability, bonus: 0, proficient: true },
    damages, healing: draft.healing.trim() ? cleanFormula(draft.healing) : undefined, addAbilityMod: draft.addAbilityMod,
    save: draft.saveAbility ? { ability: draft.saveAbility, dc: "spell", effect: draft.saveEffect.trim() } : undefined,
    higherLevel: draft.higherDie || draft.higherBonus ? { count: draft.higherDie ? Math.max(1, draft.higherCount) : 0, die: draft.higherDie, bonus: draft.higherBonus } : undefined,
    includeDescription: draft.includeDescription, description: text(draft.description), higherLevelText: text(draft.higherLevelText),
    spellClass: text(draft.spellClass), spellType: text(draft.spellType),
  };
}

export function validateSpell(draft: SpellDraft): string {
  if (!draft.name.trim()) return "Inserisci un nome";
  for (const formula of [draft.damage, draft.damage2, draft.healing]) {
    if (!formula.trim()) continue;
    try { sanitizeFormula(formula); } catch { return `Formula non valida: ${formula}`; }
  }
  return "";
}
