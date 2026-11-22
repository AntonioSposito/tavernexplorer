import { effectPreset } from "./conditions";
import type { CounterRecovery, StatModifier } from "./types";

// Catalogo dei privilegi di classe (docs/classificazione-privilegi-phb2024.md): cosa diventa ognuno sulla scheda.
// Il testo arriva da 5e.tools; qui solo la parte meccanica. Un privilegio senza grant diventa un tratto di solo testo.
// Ability Score Improvement, Epic Boon e i segnaposto della sottoclasse non ci sono: li gestisce il popup (levelUp.ts).
type Mod = Omit<StatModifier, "id">;
export interface FeatureGrant {
  // Sul tratto, sempre attivi.
  modifiers?: Mod[];
  // Risorsa collegata al tratto.
  counter?: { max: number; recovery: CounterRecovery };
  // Effetto attivabile; nome di un effetto pronto (conditions.ts), di cui prende descrizione e modificatori.
  effect?: string | { name: string; description: string; modifiers: Mod[] };
}
export interface ClassFeature {
  className: string;
  subclass?: string;
  level: number;
  name: string;
  // classLevel: livello attuale nella classe, per ciò che cresce (usi, dadi).
  grant?: (classLevel: number) => FeatureGrant;
}

// Valore della tabella di classe al livello: soglie [dal livello, valore] in ordine crescente.
export const byLevel = (level: number, steps: Array<[number, number]>) => steps.filter(([from]) => level >= from).at(-1)?.[1] ?? 0;
export const featureEffect = (effect: NonNullable<FeatureGrant["effect"]>) => typeof effect === "string" ? effectPreset(effect)! : effect;

const adv = (target: string): Mod => ({ target: `adv:${target}`, amount: 0 });
const barbarian = (level: number, name: string, grant?: ClassFeature["grant"]): ClassFeature => ({ className: "Barbarian", level, name, grant });

export const CLASS_FEATURES: ClassFeature[] = [
  barbarian(1, "Rage", (level) => ({ counter: { max: byLevel(level, [[1, 2], [3, 3], [6, 4], [12, 5], [17, 6]]), recovery: "shortOne" }, effect: "Ira" })),
  barbarian(1, "Unarmored Defense", () => ({ modifiers: [{ target: "ac", amount: 0, ability: "constitution", when: "noArmor" }] })),
  barbarian(1, "Weapon Mastery"),
  barbarian(2, "Danger Sense", () => ({ modifiers: [adv("save:dexterity")] })),
  barbarian(2, "Reckless Attack", () => ({ effect: { name: "Attacco irruento", description: "Vantaggio ai tiri per colpire con Forza fino all'inizio del tuo prossimo turno; anche gli attacchi contro di te hanno vantaggio.", modifiers: [adv("attack")] } })),
  barbarian(3, "Primal Knowledge"),
  barbarian(5, "Extra Attack"),
  barbarian(5, "Fast Movement", () => ({ modifiers: [{ target: "speed", amount: 3, when: "noHeavyArmor" }] })),
  barbarian(7, "Feral Instinct", () => ({ modifiers: [adv("initiative")] })),
  barbarian(7, "Instinctive Pounce"),
  barbarian(9, "Brutal Strike"),
  barbarian(11, "Relentless Rage"),
  barbarian(13, "Improved Brutal Strike"),
  barbarian(15, "Persistent Rage", () => ({ counter: { max: 1, recovery: "long" } })),
  barbarian(17, "Improved Brutal Strike"),
  barbarian(18, "Indomitable Might"),
  barbarian(20, "Primal Champion", () => ({ modifiers: [{ target: "ability:strength", amount: 4, max: 25 }, { target: "ability:constitution", amount: 4, max: 25 }] })),
];

export const classFeatures = (className: string, classLevel: number, subclass?: string) =>
  CLASS_FEATURES.filter((feature) => feature.className === className && feature.level <= classLevel && (!feature.subclass || feature.subclass === subclass));
export const hasFeatureCatalog = (className: string) => CLASS_FEATURES.some((feature) => feature.className === className);
