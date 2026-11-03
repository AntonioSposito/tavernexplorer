import { createBlankSheet } from "./blankSheet";
import { applyClassChanges } from "./classSync";
import { setAbilityScore } from "./effects";
import type { CharacterOptions, EquipmentOption, Feature } from "./fivetoolsCharacter";
import type { FiveToolsItem } from "./import5etools";
import { actionFromItem, modifiersFromText, parseItemModifiers } from "./itemModifiers";
import type { CharacterSheet, InventoryEntry, StatModifier, TraitEntry, TraitSource } from "./types";

// Scelte della creazione guidata (PHB 2024, livello 1).
export interface CharacterChoices {
  name: string;
  className: string;
  background: string;
  species: string;
  // Punteggi prima del background (serie standard, acquisto a punti o 4d6).
  scores: Record<string, number>;
  // Background: +2/+1 oppure +1/+1/+1 tra le sue tre caratteristiche.
  bonuses: Record<string, number>;
  classSkills: string[];
  speciesSkills: string[];
  // Talento d'origine scelto con la specie (Umano).
  speciesFeat?: string;
  // Strumenti "a scelta" di classe e background, nell'ordine delle loro concessioni.
  classTools: string[];
  backgroundTools: string[];
  languages: string[];
  classEquipment: string;
  backgroundEquipment: string;
  cantrips: string[];
  spells: string[];
}

const uid = () => crypto.randomUUID();
const feetToMeters = (feet: number) => `${Math.round(feet * 0.3 * 10) / 10} m`;
const modOf = (score: number) => Math.floor((score - 10) / 2);

// Meccaniche semplici di tratti e talenti, come modificatori sempre attivi.
// shortcut: valori del livello 1 (Tough +2, Alert = competenza +2); con il passaggio di livello (TE-34) vanno ricalcolati.
const TRAIT_MODIFIERS: Record<string, Array<Omit<StatModifier, "id">>> = {
  Tough: [{ target: "hpMax", amount: 2 }],
  Alert: [{ target: "initiative", amount: 2 }],
  "Dwarven Toughness": [{ target: "hpMax", amount: 1 }],
};

function trait(feature: Feature, sourceKind: TraitSource, sourceType: string): TraitEntry {
  const modifiers = TRAIT_MODIFIERS[feature.name]?.map((modifier) => ({ ...modifier, id: uid() }));
  return { id: uid(), name: feature.name, sourceKind, sourceType, source: `${sourceType} • ${sourceKind}`, description: feature.description, ...modifiers ? { modifiers } : {} };
}

// "Magic Initiate (Wizard)" → testo del talento "Magic Initiate".
function featTrait(name: string, feats: Feature[], sourceType: string): TraitEntry {
  const base = name.replace(/\s*\(.*\)$/, "");
  return trait({ name: base, description: feats.find((feat) => feat.name === base)?.description ?? "" }, "Feat", sourceType);
}

function inventoryItem(name: string, quantity: number, catalog: Map<string, FiveToolsItem>, ref?: string): InventoryEntry {
  const found = ref ? catalog.get(ref) : [...catalog.values()].find((item) => item.name.toLowerCase() === name.toLowerCase());
  if (!found) return { id: uid(), name, count: quantity, equipped: false };
  const modifiers = modifiersFromText(found.item.modifiersText);
  const unknown = parseItemModifiers(found.item.modifiersText).unknown.join(", ");
  return {
    id: uid(), name: found.item.name, count: quantity,
    // Armature e scudi indossati: la CA automatica li conta.
    equipped: modifiers.some((modifier) => modifier.target.startsWith("armor:") || modifier.target === "ac"),
    weight: found.item.weight == null ? null : found.item.weight / 2,
    ...found.item.properties ? { properties: found.item.properties } : {},
    ...found.item.description ? { description: found.item.description } : {},
    ...modifiers.length ? { modifiers } : {}, ...unknown ? { modifiersText: unknown } : {},
  };
}

// Oggetti del pacchetto scelto; gli strumenti "a scelta" sono i primi scelti per quella categoria.
function equipmentItems(option: EquipmentOption | undefined, tools: string[], catalog: Map<string, FiveToolsItem>): { items: InventoryEntry[]; copper: number } {
  if (!option) return { items: [], copper: 0 };
  const toolItems = option.tools.length && tools[0] ? [inventoryItem(tools[0], 1, catalog)] : [];
  return { items: [...option.items.map((item) => inventoryItem(item.name, item.quantity, catalog, item.ref)), ...toolItems], copper: option.copper };
}

export function buildCharacter(choices: CharacterChoices, options: CharacterOptions, items: FiveToolsItem[]): CharacterSheet {
  const cls = options.classes.find((item) => item.name === choices.className);
  const background = options.backgrounds.find((item) => item.name === choices.background);
  const species = options.species.find((item) => item.name === choices.species);
  if (!cls || !background || !species) throw new Error("Scegli classe, background e specie");
  const catalog = new Map(items.map((item) => [item.id.toLowerCase(), item]));
  const sheet = createBlankSheet(choices.name);
  const pb = sheet.combat.proficiencyBonus;

  for (const key of Object.keys(sheet.abilities)) setAbilityScore(sheet, key, Math.min(20, (choices.scores[key] ?? 10) + (choices.bonuses[key] ?? 0)));
  for (const key of cls.saves) { sheet.abilities[key].saveProficient = true; sheet.abilities[key].save += pb; }
  for (const key of new Set([...choices.classSkills, ...background.skills, ...choices.speciesSkills])) {
    if (!sheet.skills[key] || sheet.skills[key].proficient) continue;
    sheet.skills[key].proficient = true;
    sheet.skills[key].bonus += pb;
  }

  const blank = structuredClone(sheet);
  sheet.classes = [{ name: cls.name, level: 1 }];
  // Dadi vita, caratteristica da incantatore, CD e slot dalla classe (calcolo automatico dei livelli).
  applyClassChanges(sheet, blank);
  sheet.identity = { ...sheet.identity, race: species.name, background: background.name };
  sheet.combat.speed = feetToMeters(species.speed);
  sheet.combat.hp = { current: cls.hitDie + modOf(sheet.abilities.constitution.score), max: cls.hitDie + modOf(sheet.abilities.constitution.score), temp: 0 };

  const fixedTools = [...cls.tools, ...background.tools].flatMap((grant) => "name" in grant ? [grant.name] : []);
  sheet.tools = [...new Set([...fixedTools, ...choices.classTools, ...choices.backgroundTools])].map((name) => ({ id: uid(), name, ability: "", proficiency: "proficient", mods: 0 }));
  sheet.proficiencies = [
    ...["Common", ...choices.languages].map((name) => ({ id: uid(), name, type: "LANGUAGE" as const })),
    ...cls.armor.map((name) => ({ id: uid(), name: name === "shield" ? "Shields" : `${name} armor`, type: "ARMOR" as const })),
    ...cls.weapons.map((name) => ({ id: uid(), name: /weapon/i.test(name) ? name : `${name} weapons`, type: "WEAPON" as const })),
  ];

  sheet.traits = [
    ...cls.features.map((feature) => trait(feature, "Class", cls.name)),
    ...species.traits.map((feature) => trait(feature, "Racial", species.name)),
    featTrait(background.feat, options.feats, background.name),
    ...choices.speciesFeat ? [featTrait(choices.speciesFeat, options.feats, species.name)] : [],
  ];
  if (species.name === "Halfling") sheet.options = { ...sheet.options, halflingLuck: true };
  const hpBonus = sheet.traits.flatMap((entry) => entry.modifiers ?? []).filter((modifier) => modifier.target === "hpMax").reduce((sum, modifier) => sum + modifier.amount, 0);
  sheet.combat.hp.current += hpBonus;

  const classPack = equipmentItems(cls.equipment.find((option) => option.key === choices.classEquipment), choices.classTools, catalog);
  const backgroundPack = equipmentItems(background.equipment.find((option) => option.key === choices.backgroundEquipment), choices.backgroundTools, catalog);
  // Lo stesso oggetto da classe e background (es. Quarterstaff del Mago e del Saggio) diventa una riga sola.
  sheet.inventory = [...classPack.items, ...backgroundPack.items].reduce<InventoryEntry[]>((list, entry) => {
    const same = list.find((item) => item.name === entry.name);
    if (same) same.count = (same.count ?? 0) + (entry.count ?? 0); else list.push(entry);
    return list;
  }, []);
  const copper = classPack.copper + backgroundPack.copper;
  sheet.currency = { cp: copper % 10, sp: Math.floor(copper / 10) % 10, ep: 0, gp: Math.floor(copper / 100), pp: 0 };
  // Armi (proprietà con il dado di danno) → attacchi del form, come "Crea azione" dallo zaino.
  sheet.actions = sheet.inventory.filter((item) => /^\d+d\d+/.test(item.properties ?? "")).map((item) => actionFromItem(item, sheet));

  const chosen = (names: string[]) => names.flatMap((name) => options.spells.find((spell) => spell.name === name) ?? []);
  sheet.spells = [
    ...chosen(choices.cantrips).map((option) => ({ ...option.spell, id: uid(), prepared: true })),
    // Il Mago sceglie 6 incantesimi per il libro e ne prepara 4: i primi.
    ...chosen(choices.spells).map((option, index) => ({ ...option.spell, id: uid(), prepared: index < cls.prepared })),
  ];
  return sheet;
}

// Valori per la scelta dei punteggi.
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
// Acquisto a punti: costo per punteggio (8–15), 27 punti in tutto.
export const POINT_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
export const POINT_BUDGET = 27;
