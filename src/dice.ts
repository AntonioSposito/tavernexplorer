import type { RollMode } from "./types";

export interface RollResult {
  formula: string;
  total: number;
  dice: number[];
  // d20 tenuto nei tiri che iniziano con un singolo d20 (con vantaggio/svantaggio: quello scelto).
  natural?: number;
}

function randomInt(max: number): number {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return (values[0] % max) + 1;
}

export function sanitizeFormula(formula: string): string {
  const clean = formula.replace(/\[[^\]]*]/g, "").replace(/\s+/g, "").toLowerCase();
  if (!/^[0-9d+\-()]+$/.test(clean)) throw new Error("Formula non supportata");
  return clean;
}

function rollSimple(formula: string): RollResult {
  const clean = sanitizeFormula(formula).replace(/[()]/g, "");
  const parts = clean.match(/[+-]?[^+-]+/g) ?? [];
  const dice: number[] = [];
  let total = 0;
  for (const raw of parts) {
    const sign = raw.startsWith("-") ? -1 : 1;
    const part = raw.replace(/^[+-]/, "");
    const die = /^(\d*)d(\d+)$/.exec(part);
    if (die) {
      const count = Number(die[1] || 1);
      const faces = Number(die[2]);
      if (count < 1 || count > 100 || faces < 2 || faces > 1000) throw new Error("Dadi fuori limite");
      for (let index = 0; index < count; index += 1) {
        const value = randomInt(faces);
        dice.push(value);
        total += value * sign;
      }
    } else {
      total += Number(part) * sign;
    }
  }
  if (!Number.isFinite(total)) throw new Error("Formula non valida");
  return { formula: clean, total, dice };
}

// Un tiro accetta vantaggio/svantaggio solo se e' un singolo d20 con modificatore:
// stessa condizione usata dalla UI per decidere se chiedere la modalita'.
export function supportsRollMode(formula: string): boolean {
  try { return /^1?d20([+-]\d+)*$/.test(sanitizeFormula(withoutFloor(formula).formula)); } catch { return false; }
}

// Opzioni del d20 iniziale, tolte prima del calcolo e applicate ai d20 tirati (dadi, naturale e totale coerenti):
// "min10" = vale almeno 10 (Reliable talent), "ro1" = un 1 si ritira una volta (Halfling luck).
function withoutFloor(formula: string): { formula: string; floor: number; reroll: boolean; flags: string } {
  const match = /^(\s*1?d20)((?:min\d+|ro1)+)/i.exec(formula);
  if (!match) return { formula, floor: 0, reroll: false, flags: "" };
  return { formula: match[1] + formula.slice(match[0].length), floor: Number(/min(\d+)/i.exec(match[2])?.[1] ?? 0), reroll: /ro1/i.test(match[2]), flags: match[2].toLowerCase() };
}

export function roll(formula: string, mode: RollMode = "normal"): RollResult {
  const { formula: plain, floor, reroll, flags } = withoutFloor(formula);
  const clean = sanitizeFormula(plain);
  const min = (value: number) => Math.max(reroll && value === 1 ? randomInt(20) : value, floor);
  const shown = (text: string) => flags ? text.replace(/^(1?d20|2d20k[hl]1)/, `$1${flags}`) : text;
  if (mode === "normal" || !supportsRollMode(clean)) {
    const result = rollSimple(clean);
    if (!/^1?d20(?!\d)/.test(clean)) return result;
    const natural = min(result.dice[0]);
    return { formula: shown(result.formula), total: result.total + natural - result.dice[0], dice: [natural, ...result.dice.slice(1)], natural };
  }
  const modifier = (clean.match(/[+-]\d+/g) ?? []).reduce((sum, term) => sum + Number(term), 0);
  const first = min(randomInt(20));
  const second = min(randomInt(20));
  const kept = mode === "advantage" ? Math.max(first, second) : Math.min(first, second);
  return { formula: shown(`${mode === "advantage" ? "2d20kh1" : "2d20kl1"}${modifier >= 0 ? "+" : ""}${modifier}`), total: kept + modifier, dice: [first, second], natural: kept };
}
