import { trait } from "./buildCharacter";
import { classDisplay, classRule } from "./classes";
import { syncClassResources } from "./classResources";
import { applyClassChanges } from "./classSync";
import { ABILITY_SHORT, SKILL_LABELS } from "./constants";
import { setAbilityScore } from "./effects";
import type { Feature } from "./fivetoolsCharacter";
import type { CharacterClass, CharacterSheet, SpellEntry } from "./types";

// Scelte del popup "Sali di livello", applicate tutte insieme solo dopo la conferma del giocatore.
export interface LevelUpPlan {
  // Classe che sale: una già presente o una nuova (multiclasse, parte dal 1°).
  className: string;
  subclass?: string;
  // Privilegio che dà la sottoclasse: nella sua descrizione si scrive quale è stata scelta.
  subclassFeature?: string;
  hitPoints: number;
  features: Feature[];
  // +2 a una caratteristica o +1 a due (la stessa due volte = +2); oppure un talento.
  abilityIncrease?: string[];
  feat?: Feature;
  spells: Array<Omit<SpellEntry, "id">>;
  // Abilità scelte per il privilegio Maestria (Expertise).
  expertise?: string[];
}

// Quante abilità con Maestria dà un privilegio (Bardo e Ladro 2, Esploratore abile del Ranger 1).
export const EXPERTISE_FEATURES: Record<string, number> = { Expertise: 2, "Deft Explorer": 1 };
export const ABILITY_FEATURES = ["Ability Score Improvement", "Epic Boon"];
// Cosa ha scelto il giocatore in un privilegio, da scrivere nella descrizione del tratto.
function featureChoice(feature: Feature, plan: LevelUpPlan): string | undefined {
  if (ABILITY_FEATURES.includes(feature.name)) {
    if (plan.feat) return `talento ${plan.feat.name}`;
    const increase = plan.abilityIncrease ?? [];
    if (increase.length) return [...new Set(increase)].map((key) => `${ABILITY_SHORT[key] ?? key} +${increase.filter((item) => item === key).length}`).join(", ");
  }
  if (plan.subclass && feature.name === plan.subclassFeature) return plan.subclass;
  if (EXPERTISE_FEATURES[feature.name] && plan.expertise?.length) return `Maestria in ${plan.expertise.map((key) => SKILL_LABELS[key] ?? key).join(", ")}`;
}

// Privilegi che nella scheda sono un'opzione del tab Modifica: aggiungerli la attiva.
function featureOptions(next: CharacterSheet, features: Feature[]) {
  const names = new Set(features.map((feature) => feature.name));
  const options = { ...next.options };
  if (names.has("Jack of All Trades")) options.jackOfAllTrades = true;
  if (names.has("Reliable Talent")) options.reliableTalent = true;
  // Campione: critico con 19 (Improved Critical) e poi 18 (Superior Critical).
  if (names.has("Improved Critical")) options.critRange = Math.min(options.critRange ?? 20, 19);
  if (names.has("Superior Critical")) options.critRange = Math.min(options.critRange ?? 20, 18);
  next.options = options;
}

// Classi della scheda; una scheda importata senza elenco classi parte dalla classe e dal livello dell'identità.
export const sheetClasses = (sheet: CharacterSheet): CharacterClass[] => sheet.classes?.length ? sheet.classes
  : [{ name: sheet.identity.className || "Fighter", level: Math.max(1, sheet.identity.level), ...sheet.identity.subclass ? { subclass: sheet.identity.subclass } : {} }];

export const hitDieOf = (className: string) => classRule({ name: className, level: 1 })?.hitDie ?? 8;
// PF guadagnati: media del dado (metà + 1) o il tiro, più COS; almeno 1.
export const hitPointGain = (die: number, conMod: number, rolled?: number) => Math.max(1, (rolled ?? die / 2 + 1) + conMod);

export function applyLevelUp(sheet: CharacterSheet, plan: LevelUpPlan): CharacterSheet {
  const previous = structuredClone(sheet);
  const next = structuredClone(sheet);
  const classes = structuredClone(sheetClasses(sheet));
  const existing = classes.find((entry) => entry.name === plan.className);
  if (existing) { existing.level += 1; if (plan.subclass) existing.subclass = plan.subclass; }
  else classes.push({ name: plan.className, level: 1, ...plan.subclass ? { subclass: plan.subclass } : {} });
  next.classes = classes;
  if (next.options?.autoLevel) applyClassChanges(next, previous);
  else {
    // Senza calcolo automatico: solo livello, dadi vita e descrizione delle classi.
    next.identity.level += 1;
    next.identity.classDisplay = classDisplay(classes);
    next.combat.hitDice = { ...next.combat.hitDice, max: next.combat.hitDice.max + 1, current: next.combat.hitDice.current + 1 };
  }
  next.combat.hp = { ...next.combat.hp, max: next.combat.hp.max + plan.hitPoints, current: next.combat.hp.current + plan.hitPoints };
  for (const ability of plan.abilityIncrease ?? []) {
    const score = next.abilities[ability]?.score;
    if (score !== undefined) setAbilityScore(next, ability, Math.min(20, score + 1));
  }
  featureOptions(next, plan.features);
  if (plan.expertise?.length) next.options = { ...next.options, expertise: [...new Set([...next.options?.expertise ?? [], ...plan.expertise])] };
  const classLevel = classes.find((entry) => entry.name === plan.className)!.level;
  const featureTrait = (feature: Feature) => { const choice = featureChoice(feature, plan); return trait(choice ? { ...feature, description: `Scelta: ${choice}\n\n${feature.description}`.trim() } : feature, "Class", `${plan.className} ${classLevel}`); };
  next.traits = [...next.traits, ...plan.features.map(featureTrait), ...plan.feat ? [trait(plan.feat, "Feat", "Talento")] : []];
  next.spells = [...next.spells, ...plan.spells.map((spell) => ({ ...spell, id: crypto.randomUUID() }))];
  syncClassResources(next);
  return next;
}
