import { effectPreset } from "./conditions";
import type { ActionDamage, ActionEntry, CharacterEffect, CharacterSheet, CounterRecovery, StatModifier } from "./types";

// Catalogo dei privilegi di classe (docs/classificazione-privilegi-phb2024.md): cosa diventa ognuno sulla scheda.
// Il testo arriva da 5e.tools; qui solo la parte meccanica. Un privilegio senza grant diventa un tratto di solo testo.
// Ability Score Improvement, Epic Boon e i segnaposto della sottoclasse non ci sono: li gestisce il popup (levelUp.ts).
type Mod = Omit<StatModifier, "id">;
export type FeatureEffect = { name: string; description: string; modifiers: Mod[]; defenses?: CharacterEffect["defenses"] };
// spends: l'azione consuma la risorsa dello stesso privilegio (resourceId).
export type FeatureAction = Omit<ActionEntry, "id" | "featureId" | "resourceId"> & { spends?: true };
export interface FeatureGrant {
  // Sul tratto, sempre attivi.
  modifiers?: Mod[];
  // Risorsa collegata al tratto.
  counter?: { max: number; recovery: CounterRecovery };
  // Effetto attivabile; nome di un effetto pronto (conditions.ts), di cui prende descrizione e modificatori.
  effect?: string | FeatureEffect;
  actions?: FeatureAction[];
}
// level: livello nella classe; sheet: la scheda con gli effetti applicati, per le CD (8 + caratteristica + competenza).
export interface FeatureContext { level: number; subclass?: string; sheet: CharacterSheet }
export interface ClassFeature {
  className: string;
  subclass?: string;
  level: number;
  name: string;
  grant?: (context: FeatureContext) => FeatureGrant;
}

// Valore della tabella di classe al livello: soglie [dal livello, valore] in ordine crescente.
export const byLevel = (level: number, steps: Array<[number, number]>) => steps.filter(([from]) => level >= from).at(-1)?.[1] ?? 0;
export const featureEffect = (effect: NonNullable<FeatureGrant["effect"]>): FeatureEffect => {
  if (typeof effect !== "string") return effect;
  const { name, description, modifiers, defenses } = effectPreset(effect)!;
  return { name, description, modifiers, defenses };
};

const adv = (target: string): Mod => ({ target: `adv:${target}`, amount: 0 });
// Danno extra senza caratteristica: sul critico si raddoppiano i dadi.
const extra = (dice: string, type = "", bonus = 0): ActionDamage => ({ dice, ability: "none", bonus, type, critDice: dice });
// shortcut: la CD è un numero calcolato al level up; un aumento di caratteristica fuori dal level up la aggiorna solo al livello dopo.
const dc = (sheet: CharacterSheet, ability: string) => 8 + sheet.combat.proficiencyBonus + (sheet.abilities[ability]?.mod ?? 0);
const save = (sheet: CharacterSheet, ability: Exclude<ActionEntry["save"], undefined>["ability"], dcAbility: string, effect: string) => ({ ability, dc: dc(sheet, dcAbility), effect });

// Bonus ai danni dell'Ira (+2, +3 dal 9°, +4 dal 16°): Frenzy e Vitality of the Tree tirano altrettanti d6.
const rageBonus = (level: number) => byLevel(level, [[1, 2], [9, 3], [16, 4]]);
const resist = (...names: string[]) => names.map((name) => ({ name, type: "RESISTANCE" as const }));

const barbarian = (level: number, name: string, grant?: ClassFeature["grant"], subclass?: string): ClassFeature => ({ className: "Barbarian", level, name, grant, ...subclass && { subclass } });
const berserker = (level: number, name: string, grant?: ClassFeature["grant"]) => barbarian(level, name, grant, "Path of the Berserker");
const wildHeart = (level: number, name: string, grant?: ClassFeature["grant"]) => barbarian(level, name, grant, "Path of the Wild Heart");
const worldTree = (level: number, name: string, grant?: ClassFeature["grant"]) => barbarian(level, name, grant, "Path of the World Tree");
const zealot = (level: number, name: string, grant?: ClassFeature["grant"]) => barbarian(level, name, grant, "Path of the Zealot");

export const CLASS_FEATURES: ClassFeature[] = [
  barbarian(1, "Rage", ({ level, subclass }) => {
    const rage = featureEffect("Ira");
    // Mindless Rage (Berserker 6): durante l'Ira immune ad affascinato e spaventato.
    const mindless = subclass === "Path of the Berserker" && level >= 6 ? ["Affascinato", "Spaventato"].map((name) => ({ name, type: "CONDITION" as const })) : [];
    return { counter: { max: byLevel(level, [[1, 2], [3, 3], [6, 4], [12, 5], [17, 6]]), recovery: "shortOne" }, effect: { ...rage, defenses: [...rage.defenses ?? [], ...mindless] } };
  }),
  barbarian(1, "Unarmored Defense", () => ({ modifiers: [{ target: "ac", amount: 0, ability: "constitution", when: "noArmor" }] })),
  barbarian(1, "Weapon Mastery"),
  barbarian(2, "Danger Sense", () => ({ modifiers: [adv("save:dexterity")] })),
  barbarian(2, "Reckless Attack", () => ({ effect: { name: "Attacco irruento", description: "Vantaggio ai tiri per colpire con Forza fino all'inizio del tuo prossimo turno; anche gli attacchi contro di te hanno vantaggio.", modifiers: [adv("attack")] } })),
  barbarian(3, "Primal Knowledge"),
  barbarian(5, "Extra Attack"),
  barbarian(5, "Fast Movement", () => ({ modifiers: [{ target: "speed", amount: 3, when: "noHeavyArmor" }] })),
  barbarian(7, "Feral Instinct", () => ({ modifiers: [adv("initiative")] })),
  barbarian(7, "Instinctive Pounce"),
  // Al 13 e al 17 Improved Brutal Strike: nuovi effetti nel testo, e al 17 il danno diventa 2d10.
  barbarian(9, "Brutal Strike", ({ level }) => ({ actions: [{ name: "Brutal Strike", description: "Danno extra di Colpo brutale, dello stesso tipo dell'arma. Rinunci al vantaggio di Attacco irruento.", damages: [extra(level >= 17 ? "2d10" : "1d10")] }] })),
  barbarian(11, "Relentless Rage"),
  barbarian(13, "Improved Brutal Strike"),
  barbarian(15, "Persistent Rage", () => ({ counter: { max: 1, recovery: "long" } })),
  barbarian(17, "Improved Brutal Strike"),
  barbarian(18, "Indomitable Might"),
  barbarian(20, "Primal Champion", () => ({ modifiers: [{ target: "ability:strength", amount: 4, max: 25 }, { target: "ability:constitution", amount: 4, max: 25 }] })),

  berserker(3, "Frenzy", ({ level }) => ({ actions: [{ name: "Frenzy", description: "Danno extra al primo bersaglio colpito con Attacco irruento durante l'Ira, dello stesso tipo dell'arma.", damages: [extra(`${rageBonus(level)}d6`)] }] })),
  berserker(6, "Mindless Rage"),
  berserker(10, "Retaliation"),
  berserker(14, "Intimidating Presence", ({ sheet }) => ({ counter: { max: 1, recovery: "long" }, actions: [{ name: "Intimidating Presence", spends: true, description: "Azione bonus: le creature scelte entro 9 m fanno un TS di Saggezza o sono spaventate per 1 minuto.", save: save(sheet, "wisdom", "strength", "Spaventato") }] })),

  wildHeart(3, "Animal Speaker"),
  wildHeart(3, "Rage of the Wilds"),
  wildHeart(6, "Aspect of the Wilds"),
  wildHeart(10, "Nature Speaker"),
  wildHeart(14, "Power of the Wilds"),

  worldTree(3, "Vitality of the Tree", ({ level }) => ({ actions: [{ name: "Life-Giving Force", description: "All'inizio di ogni tuo turno durante l'Ira: PF temporanei a una creatura entro 3 m.", damages: [extra(`${rageBonus(level)}d6`, "PF temporanei")] }] })),
  worldTree(6, "Branches of the Tree", ({ sheet }) => ({ actions: [{ name: "Branches of the Tree", description: "Reazione durante l'Ira: una creatura entro 9 m fa un TS di Forza o si teletrasporta entro 1,5 m da te.", save: save(sheet, "strength", "strength", "Teletrasportata vicino a te, velocità 0") }] })),
  worldTree(10, "Battering Roots"),
  worldTree(14, "Travel Along the Tree"),

  zealot(3, "Divine Fury", ({ level }) => ({ actions: [{ name: "Divine Fury", description: "Danno extra al primo bersaglio colpito in ogni turno durante l'Ira.", damages: [extra("1d6", "Necrotico o radioso", Math.floor(level / 2))] }] })),
  zealot(3, "Warrior of the Gods", ({ level }) => ({
    counter: { max: byLevel(level, [[3, 4], [6, 5], [12, 6], [17, 7]]), recovery: "long" },
    actions: [{ name: "Warrior of the Gods", spends: true, description: "Azione bonus: spendi i dadi e recuperi i PF tirati. Un dado per tiro: tira più volte per spenderne di più.", damages: [{ dice: "1d12", ability: "none", bonus: 0, type: "Cura", critDice: "" }] }],
  })),
  zealot(6, "Fanatical Focus"),
  zealot(10, "Zealous Presence", () => ({ counter: { max: 1, recovery: "long" } })),
  zealot(14, "Rage of the Gods", () => ({
    counter: { max: 1, recovery: "long" },
    effect: { name: "Furia degli dei", description: "Per 1 minuto: volo pari alla velocità, resistenza a danni necrotici, psichici e radiosi.", modifiers: [], defenses: [...resist("Necrotici", "Psichici", "Radiosi"), { name: "Volo (pari alla velocità)", type: "SPEED" }] },
  })),
];

export const classFeatures = (className: string, classLevel: number, subclass?: string) =>
  CLASS_FEATURES.filter((feature) => feature.className === className && feature.level <= classLevel && (!feature.subclass || feature.subclass === subclass));
export const hasFeatureCatalog = (className: string) => CLASS_FEATURES.some((feature) => feature.className === className);
