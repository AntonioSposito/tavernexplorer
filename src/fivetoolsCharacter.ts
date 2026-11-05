import { renderEntries } from "./import5etools";
import type { ActionAbility, SpellEntry } from "./types";

// Dati 5e.tools del PHB 2024 (sorgente XPHB) ridotti a quanto serve alla creazione guidata di livello 1.

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj => value && typeof value === "object" && !Array.isArray(value) ? value as Obj : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const text = (value: unknown): string => value == null ? "" : String(value);
const SOURCE = "XPHB";

const ABILITIES: Record<string, string> = { str: "strength", dex: "dexterity", con: "constitution", int: "intelligence", wis: "wisdom", cha: "charisma" };
const ALL_SKILLS = ["acrobatics", "animal_handling", "arcana", "athletics", "deception", "history", "insight", "intimidation", "investigation", "medicine", "nature", "perception", "performance", "persuasion", "religion", "sleight_of_hand", "stealth", "survival"];
// "animal handling" → "animal_handling", come le chiavi di sheet.skills.
const skillKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, "_");
const titleCase = (value: string) => value.replace(/(^|[\s(-])(\w)/g, (_, before: string, letter: string) => before + letter.toUpperCase());

// Categorie di strumenti "a scelta" (anyArtisansTool, equipmentType toolArtisan…).
export type ToolKind = "artisan" | "instrument" | "gaming";
const TOOL_KINDS: Record<string, ToolKind> = {
  anyArtisansTool: "artisan", anyMusicalInstrument: "instrument", anyGamingSet: "gaming",
  toolArtisan: "artisan", instrumentMusical: "instrument", setGaming: "gaming",
};
// Strumenti fissi oppure da scegliere tra una o più categorie.
export type ToolGrant = { name: string } | { kinds: ToolKind[]; count: number };
export interface Feature { name: string; description: string }
export interface EquipmentOption {
  key: string;
  // ref = "dagger|xphb", da cercare tra gli oggetti 5e.tools; name è il nome mostrato se manca.
  items: Array<{ ref?: string; name: string; quantity: number }>;
  // Uno strumento della categoria (es. lo strumento musicale scelto).
  tools: ToolKind[];
  // Monete in monete di rame, come in 5e.tools.
  copper: number;
}
export interface ClassOption {
  name: string;
  hitDie: number;
  saves: string[];
  skills: { from: string[]; count: number };
  armor: string[];
  weapons: string[];
  tools: ToolGrant[];
  equipment: EquipmentOption[];
  spellAbility?: string;
  cantrips: number;
  // Incantesimi di livello 1 da scegliere: per il Mago quelli del libro (6), preparati solo `prepared`.
  spells: number;
  prepared: number;
  features: Feature[];
}
export interface BackgroundOption {
  name: string;
  // Le tre caratteristiche a cui dare +2/+1 oppure +1/+1/+1.
  abilities: string[];
  feat: string;
  skills: string[];
  tools: ToolGrant[];
  equipment: EquipmentOption[];
}
export interface SpeciesOption {
  name: string;
  sizes: string[];
  speed: number;
  skills?: { from: string[]; count: number };
  originFeat: boolean;
  traits: Feature[];
}
export interface SpellOption { name: string; level: number; classes: string[]; spell: Omit<SpellEntry, "id"> }
export interface CharacterOptions {
  classes: ClassOption[];
  backgrounds: BackgroundOption[];
  species: SpeciesOption[];
  feats: Feature[];
  spells: SpellOption[];
}

function equipmentOptions(value: unknown): EquipmentOption[] {
  const groups = obj(array(value)[0]);
  return Object.entries(groups).map(([key, rows]) => {
    const option: EquipmentOption = { key, items: [], tools: [], copper: 0 };
    for (const raw of array(rows)) {
      const row = obj(raw);
      if (row.value != null) option.copper += Number(row.value) || 0;
      else if (row.item) option.items.push({ ref: text(row.item).toLowerCase(), name: text(row.displayName) || titleCase(text(row.item).split("|")[0]), quantity: Number(row.quantity) || 1 });
      else if (row.special) option.items.push({ name: text(row.special), quantity: Number(row.quantity) || 1 });
      else option.tools.push(...[row.equipmentType, ...array(row.equipmentTypes)].flatMap((type) => TOOL_KINDS[text(type)] ?? []));
    }
    return option;
  });
}

// [{ "thieves' tools": true }] → nome fisso; [{ anyArtisansTool: 1 }, { anyMusicalInstrument: 1 }] → una scelta tra le due categorie.
function toolGrants(value: unknown): ToolGrant[] {
  const rows = array(value).map(obj);
  const fixed = rows.flatMap((row) => Object.entries(row).filter(([key, flag]) => flag === true && !TOOL_KINDS[key]).map(([key]) => ({ name: titleCase(key) })));
  const kinds = rows.flatMap((row) => Object.keys(row).flatMap((key) => TOOL_KINDS[key] ?? []));
  const count = rows.flatMap((row) => Object.entries(row).filter(([key]) => TOOL_KINDS[key]).map(([, amount]) => Number(amount) || 1));
  return kinds.length ? [...fixed, { kinds, count: rows.length > 1 ? 1 : count[0] ?? 1 }] : fixed;
}

// { choose: { from, count } } oppure { any: 3 }: scelta tra le abilità indicate (tutte con any).
function skillChoice(value: unknown): { from: string[]; count: number } | undefined {
  const row = obj(array(value)[0]);
  if (row.any != null) return { from: ALL_SKILLS, count: Number(row.any) || 1 };
  const choose = obj(row.choose);
  return choose.from ? { from: array(choose.from).map((skill) => skillKey(text(skill))), count: Number(choose.count) || 1 } : undefined;
}

export function parseClass(file: unknown): ClassOption | undefined {
  const data = obj(file);
  const row = array(data.class).map(obj).find((item) => item.source === SOURCE);
  if (!row) return undefined;
  const name = text(row.name);
  const start = obj(row.startingProficiencies);
  const featureNames = array(row.classFeatures).filter((ref): ref is string => typeof ref === "string" && ref.endsWith("|1")).map((ref) => ref.split("|")[0]);
  const featureRows = array(data.classFeature).map(obj).filter((feature) => feature.source === SOURCE && feature.className === name && feature.level === 1);
  const fixedSpells = array(row.spellsKnownProgressionFixed)[0];
  const prepared = Number(array(row.preparedSpellsProgression)[0]) || 0;
  return {
    name, hitDie: Number(obj(row.hd).faces) || 8,
    saves: array(row.proficiency).map((ability) => ABILITIES[text(ability)]).filter(Boolean),
    skills: skillChoice(start.skills) ?? { from: [], count: 0 },
    armor: array(start.armor).map((armor) => renderEntries(text(armor))),
    weapons: array(start.weapons).map((weapon) => renderEntries(text(weapon))),
    tools: toolGrants(start.toolProficiencies),
    equipment: equipmentOptions(obj(row.startingEquipment).defaultData),
    spellAbility: ABILITIES[text(row.spellcastingAbility)],
    cantrips: Number(array(row.cantripProgression)[0]) || 0,
    spells: Number(fixedSpells) || prepared, prepared,
    features: featureNames.flatMap((featureName) => featureRows.filter((feature) => feature.name === featureName).map((feature) => ({ name: featureName, description: renderEntries(feature.entries) }))),
  };
}

// "magic initiate; wizard|xphb" → "Magic Initiate (Wizard)".
const featName = (ref: string) => { const [base, detail] = ref.split("|")[0].split(";").map((part) => titleCase(part.trim())); return detail ? `${base} (${detail})` : base; };

export function parseBackgrounds(file: unknown): BackgroundOption[] {
  return array(obj(file).background).map(obj).filter((row) => row.source === SOURCE).map((row) => ({
    name: text(row.name),
    abilities: array(obj(obj(obj(array(row.ability)[0]).choose).weighted).from).map((ability) => ABILITIES[text(ability)]).filter(Boolean),
    feat: featName(Object.keys(obj(array(row.feats)[0]))[0] ?? ""),
    skills: Object.keys(obj(array(row.skillProficiencies)[0])).map(skillKey),
    tools: toolGrants(row.toolProficiencies),
    equipment: equipmentOptions(row.startingEquipment),
  }));
}

export function parseSpecies(file: unknown): SpeciesOption[] {
  return array(obj(file).race).map(obj).filter((row) => row.source === SOURCE).map((row) => ({
    name: text(row.name),
    sizes: array(row.size).map(text),
    speed: typeof row.speed === "number" ? row.speed : Number(obj(row.speed).walk) || 30,
    skills: skillChoice(row.skillProficiencies),
    originFeat: array(row.feats).some((feat) => obj(feat).anyFromCategory),
    traits: array(row.entries).map(obj).filter((entry) => entry.name).map((entry) => ({ name: renderEntries(text(entry.name)), description: renderEntries(entry.entries) })),
  }));
}

export function parseOriginFeats(file: unknown): Feature[] {
  return array(obj(file).feat).map(obj).filter((row) => row.source === SOURCE && row.category === "O").map((row) => ({ name: text(row.name), description: renderEntries(row.entries) }));
}

const SCHOOLS: Record<string, string> = { A: "Abjuration", C: "Conjuration", D: "Divination", E: "Enchantment", V: "Evocation", I: "Illusion", N: "Necromancy", T: "Transmutation" };
const DAMAGE: Record<string, string> = { acid: "Acido", bludgeoning: "Contundente", cold: "Freddo", fire: "Fuoco", force: "Forza", lightning: "Fulmine", necrotic: "Necrotico", piercing: "Perforante", poison: "Veleno", psychic: "Psichico", radiant: "Radioso", thunder: "Tuono", slashing: "Tagliente" };

function spellRange(value: unknown): string {
  const range = obj(value);
  const distance = obj(range.distance);
  const base = distance.amount != null ? `${text(distance.amount)} ${text(distance.type)}` : titleCase(text(distance.type));
  return range.type === "point" || !range.type ? base : `${base} (${text(range.type)})`;
}

function spellDuration(value: unknown): { duration: string; concentration: boolean } {
  const row = obj(array(value)[0]);
  const amount = obj(row.duration);
  const timed = row.type === "timed" ? `${row.concentration ? "Concentration, up to " : ""}${text(amount.amount)} ${text(amount.type)}${Number(amount.amount) > 1 ? "s" : ""}` : titleCase(text(row.type)).replace("Instant", "Instantaneous");
  return { duration: timed, concentration: !!row.concentration };
}

// Incantesimo 5e.tools → voce della scheda: attacco e CD con i campi del form, così si calcolano dalla scheda.
export function toSpellEntry(row: Obj): Omit<SpellEntry, "id"> {
  const description = renderEntries(row.entries);
  const time = obj(array(row.time)[0]);
  const components = obj(row.components);
  const material = components.m;
  const dice = /\{@damage ([^}|]+)/.exec(JSON.stringify(row.entries))?.[1];
  const damageType = DAMAGE[text(array(row.damageInflict)[0])] ?? titleCase(text(array(row.damageInflict)[0]));
  const save = ABILITIES[text(array(row.savingThrow)[0]).slice(0, 3)] as Exclude<ActionAbility, "spell" | "none"> | undefined;
  const attack = text(array(row.spellAttack)[0]);
  const { duration, concentration } = spellDuration(row.duration);
  return {
    name: text(row.name), level: Number(row.level) || 0, school: SCHOOLS[text(row.school)] ?? text(row.school),
    prepared: Number(row.level) === 0, ritual: !!obj(row.meta).ritual, concentration,
    castingTime: `${text(time.number)} ${text(time.unit)}`.trim(), range: spellRange(row.range), duration,
    components: { verbal: !!components.v, somatic: !!components.s, material: !!material, ...material ? { materials: typeof material === "string" ? material : text(obj(material).text) } : {} },
    description, ...row.entriesHigherLevel ? { higherLevelText: renderEntries(row.entriesHigherLevel) } : {},
    source: "spell", castingAbility: "spell",
    output: attack || save || dice ? "attack" : "spellcard",
    ...attack ? { spellAttack: attack === "M" ? "melee" as const : "ranged" as const, attack: { ability: "spell" as const, bonus: 0, proficient: true } } : {},
    ...dice ? { damages: [{ dice, ability: "none" as const, bonus: 0, type: damageType, critDice: "" }] } : {},
    ...save ? { save: { ability: save, dc: "spell" as const, effect: "" } } : {},
  };
}

// Di default solo trucchetti e incantesimi di 1° livello (creazione guidata); le classi vengono da gendata-spell-source-lookup.json.
export function parseSpells(file: unknown, lookup: unknown, maxLevel = 1): SpellOption[] {
  const classesOf = obj(obj(lookup).xphb);
  return array(obj(file).spell).map(obj).filter((row) => row.source === SOURCE && Number(row.level) <= maxLevel).map((row) => ({
    name: text(row.name), level: Number(row.level) || 0,
    classes: Object.keys(obj(obj(obj(classesOf[text(row.name).toLowerCase()]).class)[SOURCE])),
    spell: toSpellEntry(row),
  })).filter((spell) => spell.classes.length).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}

// Lingue standard del PHB 2024: oltre al Comune se ne scelgono due.
export const STANDARD_LANGUAGES = ["Common Sign Language", "Draconic", "Dwarvish", "Elvish", "Giant", "Gnomish", "Goblin", "Halfling", "Orc"];
