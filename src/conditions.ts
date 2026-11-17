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

// Regola di una condizione dal nome, senza badare a maiuscole (anche "poisoned" delle immunità di 5e.tools) e col livello di Exhaustion.
export const conditionRule = (name: string) => CONDITIONS.find((condition) => condition.name.toLowerCase() === (exhaustionLevel(name) ? "exhaustion" : name.trim().toLowerCase()))?.rule;

// Tiri d20 toccati dalle condizioni: attacchi, prove (anche abilità e strumenti) e TS per caratteristica, e l'iniziativa,
// che è una prova di Destrezza ma ha regole sue (Incapacitated, Invisible).
export type D20Roll = "attack" | "initiative" | `check:${string}` | `save:${string}`;

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
  const [fail, advantage, disadvantage] = [by("fail"), by("advantage"), by("disadvantage")];
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
export const CONCENTRATION_RULE = "Finisce se lanci un altro incantesimo di concentrazione, se sei Incapacitated o se muori. Quando subisci danni fai un TS su Costituzione con CD 10 o metà del danno subito, se più alta (massimo CD 30): se fallisci la perdi.";
const isConcentration = (name: string) => name.trim().toLowerCase().startsWith(CONCENTRATION.toLowerCase());

// Regola da mettere nella descrizione: quella della condizione o della concentrazione.
export const effectRule = (name: string) => conditionRule(name) ?? (isConcentration(name) ? CONCENTRATION_RULE : undefined);

export function startConcentration(effects: CharacterEffect[], spell: string): CharacterEffect[] {
  return [...effects.filter((effect) => !isConcentration(effect.name)), { id: crypto.randomUUID(), name: `${CONCENTRATION}: ${spell}`, active: true, modifiers: [], description: CONCENTRATION_RULE }];
}
