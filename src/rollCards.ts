import { roll, type RollResult } from "./dice";
import type { RollCard, RollMode } from "./types";

// Dati dell'azione che accompagnano il tiro: con un d20 è un attacco con danno automatico,
// senza d20 è un tiro di danno. critRange decide il critico sul d20 naturale.
export type AttackRoll = { label?: string; alert?: string; critRange: number; damage?: string; critDamage?: string; damageType?: string; subtitle?: string; save?: RollCard["save"]; description?: string };

// shortcut: descrizione troncata per tenere piccolo il broadcast Owlbear; il testo completo resta nella scheda.
export const DESCRIPTION_LIMIT = 2000;
const D20_FORMULA = /^(1?d20|2d20k[hl]1)((?:min\d+|ro1)*)([+-]\d+)*$/;

// Modificatori con etichetta in stile Roll20: "+2[DEX]+2[PROF]". Salta gli zeri; la differenza dal totale va in [BONUS].
export function labeledBonus(parts: Array<[number, string]>, total: number): string {
  const rest = total - parts.reduce((sum, [value]) => sum + value, 0);
  return [...parts, [rest, "BONUS"] as [number, string]].filter(([value]) => value !== 0)
    .map(([value, tag]) => `${value > 0 ? "+" : ""}${value}${tag ? `[${tag}]` : ""}`).join("");
}

// Tooltip del tiro: "Roll 1d20 + 2[DEX] + 2[PROF] = (10) + 2 + 2". I dadi si consumano in ordine di formula.
export function describeRoll(formula: string, dice: number[]): string {
  const terms = formula.replace(/\s+/g, "").match(/[+-]?[^+-]+/g) ?? [];
  let next = 0;
  const left: string[] = [];
  const right: string[] = [];
  terms.forEach((raw, index) => {
    const sign = raw.startsWith("-") ? "-" : "+";
    const term = raw.replace(/^[+-]/, "");
    const glue = index === 0 ? (sign === "-" ? "-" : "") : ` ${sign} `;
    const die = /^(\d*)d\d+/i.exec(term);
    left.push(glue + term);
    if (die) {
      const count = Number(die[1] || 1);
      right.push(`${glue}(${dice.slice(next, next + count).join(" + ")})`);
      next += count;
    } else right.push(glue + term.replace(/\[[^\]]*]/g, ""));
  });
  return `Roll ${left.join("")} = ${right.join("")}`;
}

// Card del tiro più titolo e testo semplice, usati per la mappa e come ripiego nei client senza card.
// Con un 1 naturale l'attacco manca e non tira il danno, salvo critRange 1 (impossibile in pratica).
export function buildRollCard(name: string, formula: string, result: RollResult, mode: RollMode, attack?: AttackRoll): { card: RollCard; title: string; body: string } {
  const card: RollCard = { name, subtitle: attack?.subtitle, rolls: [], alert: attack?.alert, save: attack?.save, description: attack?.description?.slice(0, DESCRIPTION_LIMIT) || undefined };
  let title = name;
  let body = `${result.formula} → ${result.total}`;
  if (result.natural == null || !D20_FORMULA.test(result.formula)) {
    card.rolls.push({ label: attack?.label ?? (attack ? "Danno" : "Risultato"), formula, total: result.total, dice: result.dice, type: attack?.damageType });
    return { card, title, body };
  }
  const critRange = attack?.critRange ?? 20;
  card.d20 = { label: attack ? "Colpire" : "Tiro", formula, dice: result.dice, modifier: result.total - result.natural, kept: result.dice.indexOf(result.natural), mode, critRange };
  if (!attack) return { card, title, body };
  const critical = result.natural >= critRange;
  if (result.natural === 1 && !critical) {
    title += " — 1 naturale, mancato";
    card.note = "1 naturale: l'attacco manca.";
    return { card, title, body };
  }
  if (critical) title += " — CRITICO!";
  const damageFormula = critical ? attack.critDamage ?? attack.damage : attack.damage;
  if (damageFormula) {
    const damage = roll(damageFormula);
    card.rolls.push({ label: critical ? "Danno critico" : "Danno", formula: damageFormula, total: damage.total, dice: damage.dice, type: attack.damageType, critical });
    body += ` · ${critical ? "Danno critico" : "Danno"} ${damage.formula} → ${damage.total}${attack.damageType ? ` ${attack.damageType}` : ""}`;
  }
  return { card, title, body };
}
