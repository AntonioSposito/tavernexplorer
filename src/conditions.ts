import { isEffectOn } from "./effects";
import type { CharacterEffect, RollMode, TurnCondition } from "./types";

// Condizioni (regole 2024, SRD 5.2.1): nome e regola in inglese, come le Weapon Mastery e i contenuti di 5e.tools.
// Nessun tiro cambia da solo: la regola si legge e si manda in chat.
export const CONDITIONS: Array<{ name: string; rule: string }> = [
  { name: "Blinded", rule: "Can't See. You can't see and automatically fail any ability check that requires sight.\nAttacks Affected. Attack rolls against you have Advantage, and your attack rolls have Disadvantage." },
  { name: "Charmed", rule: "Can't Harm the Charmer. You can't attack the charmer or target the charmer with damaging abilities or magical effects.\nSocial Advantage. The charmer has Advantage on any ability check to interact with you socially." },
  { name: "Deafened", rule: "Can't Hear. You can't hear and automatically fail any ability check that requires hearing." },
  { name: "Exhaustion", rule: "Exhaustion Levels. This condition is cumulative. Each time you receive it, you gain 1 Exhaustion level. You die if your Exhaustion level is 6.\nD20 Tests Affected. When you make a D20 Test, the roll is reduced by 2 times your Exhaustion level.\nSpeed Reduced. Your Speed is reduced by a number of feet equal to 5 times your Exhaustion level.\nRemoving Exhaustion Levels. Finishing a Long Rest removes 1 of your Exhaustion levels. When your Exhaustion level reaches 0, the condition ends." },
  { name: "Frightened", rule: "Ability Checks and Attacks Affected. You have Disadvantage on ability checks and attack rolls while the source of fear is within line of sight.\nCan't Approach. You can't willingly move closer to the source of fear." },
  { name: "Grappled", rule: "Speed 0. Your Speed is 0 and can't increase.\nAttacks Affected. You have Disadvantage on attack rolls against any target other than the grappler.\nMovable. The grappler can drag or carry you when it moves, but every foot of movement costs it 1 extra foot unless you are Tiny or two or more sizes smaller than it." },
  { name: "Incapacitated", rule: "Inactive. You can't take any action, Bonus Action, or Reaction.\nNo Concentration. Your Concentration is broken.\nSpeechless. You can't speak.\nSurprised. If you're Incapacitated when you roll Initiative, you have Disadvantage on the roll." },
  { name: "Invisible", rule: "Surprise. If you're Invisible when you roll Initiative, you have Advantage on the roll.\nConcealed. You aren't affected by any effect that requires its target to be seen unless the effect's creator can somehow see you. Any equipment you are wearing or carrying is also concealed.\nAttacks Affected. Attack rolls against you have Disadvantage, and your attack rolls have Advantage. If a creature can somehow see you, you don't gain this benefit against that creature." },
  { name: "Paralyzed", rule: "Incapacitated. You have the Incapacitated condition.\nSpeed 0. Your Speed is 0 and can't increase.\nSaving Throws Affected. You automatically fail Strength and Dexterity saving throws.\nAttacks Affected. Attack rolls against you have Advantage.\nAutomatic Critical Hits. Any attack roll that hits you is a Critical Hit if the attacker is within 5 feet of you." },
  { name: "Petrified", rule: "Turned to Inanimate Substance. You are transformed, along with any nonmagical objects you are wearing and carrying, into a solid inanimate substance (usually stone). Your weight increases by a factor of ten, and you cease aging.\nIncapacitated. You have the Incapacitated condition.\nSpeed 0. Your Speed is 0 and can't increase.\nAttacks Affected. Attack rolls against you have Advantage.\nSaving Throws Affected. You automatically fail Strength and Dexterity saving throws.\nResist Damage. You have Resistance to all damage.\nPoison Immunity. You have Immunity to the Poisoned condition." },
  { name: "Poisoned", rule: "Ability Checks and Attacks Affected. You have Disadvantage on attack rolls and ability checks." },
  { name: "Prone", rule: "Restricted Movement. Your only movement options are to crawl or to spend an amount of movement equal to half your Speed (round down) to right yourself and thereby end the condition. If your Speed is 0, you can't right yourself.\nAttacks Affected. You have Disadvantage on attack rolls. An attack roll against you has Advantage if the attacker is within 5 feet of you. Otherwise, that attack roll has Disadvantage." },
  { name: "Restrained", rule: "Speed 0. Your Speed is 0 and can't increase.\nAttacks Affected. Attack rolls against you have Advantage, and your attack rolls have Disadvantage.\nSaving Throws Affected. You have Disadvantage on Dexterity saving throws." },
  { name: "Stunned", rule: "Incapacitated. You have the Incapacitated condition.\nSaving Throws Affected. You automatically fail Strength and Dexterity saving throws.\nAttacks Affected. Attack rolls against you have Advantage." },
  { name: "Unconscious", rule: "Inert. You have the Incapacitated and Prone conditions, and you drop whatever you're holding. When this condition ends, you remain Prone.\nSpeed 0. Your Speed is 0 and can't increase.\nAttacks Affected. Attack rolls against you have Advantage.\nSaving Throws Affected. You automatically fail Strength and Dexterity saving throws.\nAutomatic Critical Hits. Any attack roll that hits you is a Critical Hit if the attacker is within 5 feet of you.\nUnaware. You're unaware of your surroundings." },
];

// Regola di una condizione dal nome, senza badare a maiuscole (anche "poisoned" delle immunità di 5e.tools) e col livello di Exhaustion:
// "Exhaustion 3" ha in testa le penalità del suo livello.
export const conditionRule = (name: string) => {
  const level = exhaustionLevel(name);
  const rule = CONDITIONS.find((condition) => condition.name.toLowerCase() === (level ? "exhaustion" : name.trim().toLowerCase()))?.rule;
  if (!level || !/\d/.test(name)) return rule;
  return `${level >= 6 ? "Exhaustion Level 6. You die." : `Exhaustion Level ${level}. Your D20 Tests are reduced by ${2 * level} and your Speed by ${5 * level} feet.`}\n${rule}`;
};

// Suggerimenti per il nome di un effetto: le condizioni, con Exhaustion da 1 a 6, e la concentrazione.
export const EXHAUSTION_LEVELS = [1, 2, 3, 4, 5, 6].map((level) => `Exhaustion ${level}`);

// Tiri d20 toccati dalle condizioni: attacchi, prove (anche abilità e strumenti) e TS per caratteristica, e l'iniziativa,
// che è una prova di Destrezza ma ha regole sue (Incapacitated, Invisible).
export type D20Roll = "attack" | "initiative" | `check:${string}` | `save:${string}`;

// Voci dei modificatori adv:/dis: che valgono per un tiro. Le prove di abilità sono "check:<caratteristica>:<abilità>";
// l'iniziativa è una prova di Destrezza.
function rollTargets(roll: D20Roll): string[] {
  if (roll === "attack") return ["attack"];
  if (roll === "initiative") return ["initiative", "check", "check:dexterity"];
  const [kind, ability, skill] = roll.split(":");
  return [kind, `${kind}:${ability}`, ...skill ? [`skill:${skill}`] : []];
}

const isCheck = (roll: D20Roll) => roll === "initiative" || roll.startsWith("check:");
const failsStrDex = (roll: D20Roll) => roll === "save:strength" || roll === "save:dexterity";
type Rule = { advantage?: (roll: D20Roll) => boolean; disadvantage?: (roll: D20Roll) => boolean; fail?: (roll: D20Roll) => boolean };
const incapacitated: Rule = { disadvantage: (roll) => roll === "initiative" };
const helpless: Rule = { ...incapacitated, fail: failsStrDex };

// Solo i tiri di chi ha la condizione: quelli "contro di te" li fa un altro e restano manuali.
// shortcut: Blinded, Frightened e Invisible valgono sempre (vista e linea di vista non si conoscono); Grappled resta
// manuale perché lo svantaggio non vale contro chi ti afferra. Charmed e Deafened non toccano i tuoi tiri.
const CONDITION_RULES: Record<string, Rule> = {
  blinded: { disadvantage: (roll) => roll === "attack" },
  frightened: { disadvantage: (roll) => roll === "attack" || isCheck(roll) },
  incapacitated,
  invisible: { advantage: (roll) => roll === "attack" || roll === "initiative" },
  paralyzed: helpless,
  petrified: helpless,
  poisoned: { disadvantage: (roll) => roll === "attack" || isCheck(roll) },
  prone: { disadvantage: (roll) => roll === "attack" },
  restrained: { disadvantage: (roll) => roll === "attack" || roll === "save:dexterity" },
  stunned: helpless,
  unconscious: helpless,
};

// Exhaustion col livello nel nome ("Exhaustion 3"); senza numero è il livello 1.
export const exhaustionLevel = (name: string) => { const match = /^exhaustion(?:\s+(\d+))?$/i.exec(name.trim()); return match ? Math.max(1, Number(match[1] ?? 1)) : 0; };

// Titolo, formula e modalità di un tiro d20 con le condizioni attive: "TS Forza · fallisce (Stunned) · svantaggio (Poisoned)".
// mode resta una lista: la combina chi tira, insieme al menu Normale/Vantaggio/Svantaggio.
export function conditionRoll(effects: TurnCondition[] | undefined, roll: D20Roll, title: string, formula: string, mode?: RollMode): { title: string; formula: string; mode: RollMode[] } {
  const active = (effects ?? []).filter(isEffectOn);
  const by = (kind: keyof Rule) => active.filter((effect) => CONDITION_RULES[effect.name.trim().toLowerCase()]?.[kind]?.(roll)).map((effect) => effect.name);
  const targets = rollTargets(roll);
  const byModifier = (prefix: string) => active.filter((effect) => effect.modifiers?.some((mod) => mod.target.startsWith(prefix) && targets.includes(mod.target.slice(prefix.length)))).map((effect) => effect.name);
  const unique = (names: string[]) => [...new Set(names)];
  const [fail, advantage, disadvantage] = [by("fail"), unique([...by("advantage"), ...byModifier("adv:")]), unique([...by("disadvantage"), ...byModifier("dis:")])];
  const exhaustion = active.reduce((level, effect) => level + exhaustionLevel(effect.name), 0);
  const notes = [fail.length > 0 && `fallisce (${fail.join(", ")})`, advantage.length > 0 && `vantaggio (${advantage.join(", ")})`, disadvantage.length > 0 && `svantaggio (${disadvantage.join(", ")})`, exhaustion > 0 && `Exhaustion ${exhaustion} (−${2 * exhaustion})`].filter(Boolean);
  return {
    title: [title, ...notes].join(" · "),
    formula: exhaustion > 0 ? `${formula}-${2 * exhaustion}[EXH]` : formula,
    mode: [...mode ? [mode] : [], ...advantage.length ? ["advantage" as const] : [], ...disadvantage.length ? ["disadvantage" as const] : []],
  };
}

// Concentrazione: un effetto come gli altri, col nome dell'incantesimo ("Concentrazione: Bless"); se ne ha una sola alla volta.
export const CONCENTRATION = "Concentrazione";
export const CONCENTRATION_RULE = "Another Concentration Effect. You lose Concentration the moment you start casting another spell that requires Concentration or activate another effect that requires Concentration.\nIncapacitated or Dead. Your Concentration ends if you have the Incapacitated condition or you die.\nTaking Damage. If you take damage, you must succeed on a Constitution saving throw to maintain Concentration. The DC equals 10 or half the damage taken (round down), whichever number is higher, up to a maximum DC of 30.";
const isConcentration = (name: string) => name.trim().toLowerCase().startsWith(CONCENTRATION.toLowerCase());

// Regola da mettere nella descrizione: quella della condizione o della concentrazione.
export const effectRule = (name: string) => conditionRule(name) ?? (isConcentration(name) ? CONCENTRATION_RULE : undefined);

export function startConcentration(effects: CharacterEffect[], spell: string): CharacterEffect[] {
  return [...effects.filter((effect) => !isConcentration(effect.name)), { id: crypto.randomUUID(), name: `${CONCENTRATION}: ${spell}`, active: true, modifiers: [], description: CONCENTRATION_RULE }];
}
