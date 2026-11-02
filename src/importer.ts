import { DEFAULT_RULESET } from "./rulesets";
import { ABILITY_SHORT } from "./constants";
import { autoLevelMatches } from "./classSync";
import { fixProficiencyChoice } from "./effects";
import { itemModifierList, modifiersFromText, parseItemModifiers } from "./itemModifiers";
import type { AbilityStat, ActionEntry, CharacterSheet, CharacterClass, ClassCaster, ProficiencyEntry, Roll20Export, SpellEntry, ToolEntry, ToolProficiency, TraitEntry, TraitSource } from "./types";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj => (value && typeof value === "object" ? (value as Obj) : {});
const arr = (value: unknown): Obj[] => (Array.isArray(value) ? value.map(obj) : []);
const text = (value: unknown, fallback = "") => (value == null ? fallback : String(value));
const num = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const bool = (value: unknown) => value === true || value === 1 || value === "1" || value === "on";
const uid = () => crypto.randomUUID();

// Roll20 codifica la bio con escape(): %XX sono byte latin-1 (%E0 = à), non UTF-8, e decodeURIComponent li rifiuta.
// Prima si prova UTF-8 (export più vecchi), poi la decodifica di escape().
export function decodeLegacy(value: string): string {
  try {
    const unicodeFixed = value.replace(/%u([0-9a-f]{4})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
    let decoded: string;
    try { decoded = decodeURIComponent(unicodeFixed.replace(/%(?![0-9a-f]{2})/gi, "%25")); }
    catch { decoded = unicodeFixed.replace(/%([0-9a-f]{2})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16))); }
    const documentValue = new DOMParser().parseFromString(decoded, "text/html");
    return documentValue.body.textContent?.trim() ?? "";
  } catch {
    return value;
  }
}

function parseDamage(description: string): string | undefined {
  return description.match(/\b\d+d\d+(?:\s*[+-]\s*\d+)?\b/i)?.[0].replace(/\s+/g, "");
}

function cleanDamage(value: unknown): string | undefined {
  const damage = text(value).replace(/@\{[^}]+}/g, "0").replace(/\b(forza|fuoco|fulmine|tuono|radiazione|psichici?)\b/gi, "").trim();
  return /\d+d\d+/i.test(damage) ? damage.replace(/\s+/g, "") : undefined;
}

const PROFICIENCY_TYPES: Record<string, ProficiencyEntry["type"]> = { LANGUAGE: "LANGUAGE", LINGUAGGIO: "LANGUAGE", LINGUA: "LANGUAGE", WEAPON: "WEAPON", ARMA: "WEAPON", ARMOR: "ARMOR", ARMATURA: "ARMOR" };

// L'exporter divide ogni riga in due: il nome su "<rowid>" e il tipo su "<rowid>_prof".
// Senza tipo vale il default Roll20, LANGUAGE.
function importProficiencies(value: unknown): ProficiencyEntry[] {
  const rows = arr(value);
  const types = new Map(rows.filter((row) => text(row.type)).map((row) => [text(row._rowid).replace(/_prof$/, ""), text(row.type).toUpperCase()]));
  return rows.filter((row) => text(row.name).trim()).map((row) => {
    const id = text(row._rowid, uid());
    const type = types.get(id) ?? (text(row.type).toUpperCase() || "LANGUAGE");
    return { id, name: text(row.name).trim(), type: PROFICIENCY_TYPES[type] ?? "OTHER" };
  });
}

// Campo "Modifiers" Roll20 → lista; resta come testo solo ciò che non è riconosciuto (mostrato come "Non applicati").
function itemModifierFields(value: string) {
  const unknown = parseItemModifiers(value).unknown.join(", ");
  const modifiers = modifiersFromText(value);
  return { ...modifiers.length ? { modifiers } : {}, ...unknown ? { modifiersText: unknown } : {} };
}

// Roll20 salva la caratteristica come formula: "@{intelligence_mod}+" → "intelligence", "0*" → nessuna.
const abilityFromFormula = (value: string) => /@\{(strength|dexterity|constitution|intelligence|wisdom|charisma)_mod\}/.exec(value)?.[1] ?? (value in ABILITY_SHORT ? value : "");
const CASTER_TYPES: Record<string, ClassCaster> = { full: "full", half: "half", third: "third", warlock: "pact", pact: "pact" };

// Classi dai campi Roll20: classe principale (o "custom class"), poi multiclass1..3 se attive.
function importClasses(raw: unknown, className: string, level: number, subclass: string): CharacterClass[] {
  const attributes = obj(obj(raw).attributes);
  const attr = (name: string) => text(obj(attributes[name]).current).trim();
  const classes: CharacterClass[] = [];
  const baseLevel = num(attr("base_level"), level);
  if (attr("custom_class") === "1") {
    const saves = Object.keys(ABILITY_SHORT).filter((ability) => attr(`cust_${ability}_save_prof`));
    classes.push({ name: attr("cust_classname") || "Classe personalizzata", level: baseLevel, custom: { hitDie: num(attr("cust_hitdietype"), 8), spellAbility: abilityFromFormula(attr("cust_spellcasting_ability")) || undefined, caster: CASTER_TYPES[attr("cust_spellslots").toLowerCase()] ?? "none", saves } });
  } else if (className.trim()) classes.push({ name: className.trim(), level: baseLevel, ...subclass.trim() ? { subclass: subclass.trim() } : {} });
  for (const index of [1, 2, 3]) {
    if (attr(`multiclass${index}_flag`) !== "1" || !attr(`multiclass${index}`)) continue;
    const extra = attr(`multiclass${index}_subclass`);
    classes.push({ name: attr(`multiclass${index}`), level: num(attr(`multiclass${index}_lvl`), 1), ...extra ? { subclass: extra } : {} });
  }
  return classes;
}

// SOURCE dei tratti, anche come lo salva Roll20 in italiano.
const TRAIT_SOURCES: Record<string, TraitSource> = {
  racial: "Racial", razziale: "Racial", class: "Class", classe: "Class", feat: "Feat", talento: "Feat",
  background: "Background", item: "Item", oggetto: "Item", other: "Other", altro: "Other",
};
export const traitSource = (value: string): TraitSource | undefined => TRAIT_SOURCES[value.trim().toLowerCase()];
export const traitSourceText = (kind: TraitSource | undefined, type: string | undefined) => [type?.trim(), kind].filter(Boolean).join(" • ") || undefined;

// normalized.traits unisce i due campi in "source_type • source"; quelli separati sono nelle righe raw.
function importTraits(value: unknown, raw: unknown): TraitEntry[] {
  const rawRows = new Map(arr(obj(obj(raw).repeating).repeating_traits).map((row) => [text(row._rowid), row]));
  return arr(value).filter((entry) => text(entry.name).trim()).map((entry) => {
    const id = text(entry._rowid, uid());
    const row = rawRows.get(id);
    const sourceKind = row ? traitSource(text(row.source)) : undefined;
    const sourceType = row ? text(row.source_type).trim() || undefined : undefined;
    return { id, name: text(entry.name).trim(), source: (row ? traitSourceText(sourceKind, sourceType) : undefined) ?? (text(entry.source) || undefined), sourceKind, sourceType, description: text(entry.description) };
  });
}

// Livello di competenza dal campo grezzo toolbonus_base: "(@{pb})", "(@{pb}*2)", "(floor(@{pb}/2))".
function toolProficiency(base: string): ToolProficiency {
  if (base.includes("*2")) return "expertise";
  if (base.includes("/2")) return "jack";
  return "proficient";
}

// normalized.tools ha solo il bonus totale; il livello di competenza è nelle righe raw.
// MODS = totale − caratteristica − competenza. Con caratteristica "QUERY" il bonus è una query che termina con "+mod+competenza".
function importTools(value: unknown, raw: unknown, abilities: Record<string, AbilityStat>, pb: number): ToolEntry[] {
  const rawRows = new Map(arr(obj(obj(raw).repeating).repeating_tool).map((row) => [text(row._rowid), row]));
  return arr(value).filter((row) => text(row.name).trim()).map((row) => {
    const id = text(row._rowid, uid());
    const ability = text(row.ability).toLowerCase();
    const proficiency = toolProficiency(text(rawRows.get(id)?.toolbonus_base));
    const profValue = proficiency === "expertise" ? pb * 2 : proficiency === "jack" ? Math.floor(pb / 2) : pb;
    const bonus = text(row.bonus);
    const total = /^[+-]?\d+$/.test(bonus.trim()) ? Number(bonus) : (bonus.match(/[+-]\d+/g) ?? []).map(Number).reduce((sum, item) => sum + item, 0);
    const known = ability in ABILITY_SHORT;
    return { id, name: text(row.name).trim(), ability: known ? ability : "", proficiency, mods: total - profValue - (known ? abilities[ability]?.mod ?? 0 : 0) };
  });
}

function importAbilities(value: unknown): Record<string, AbilityStat> {
  return Object.fromEntries(Object.entries(obj(value)).map(([key, raw]) => {
    const stat = obj(raw);
    return [key, { score: num(stat.score), mod: num(stat.mod), save: num(stat.save), saveProficient: bool(stat.save_proficient) }];
  }));
}

function importActions(value: unknown, spellSaveDc: number): ActionEntry[] {
  return arr(value).filter((entry) => text(entry.name).trim()).map((entry) => ({
    id: text(entry._rowid, uid()),
    name: text(entry.name).trim(),
    attackBonus: /^[-+]?\d+$/.test(text(entry.attack_bonus)) ? num(entry.attack_bonus) : undefined,
    damage: cleanDamage(entry.damage),
    damageType: text(entry.damage_type).trim() || undefined,
    saveDc: text(entry.save_dc).trim() ? spellSaveDc : undefined,
    description: text(entry.description).trim() || undefined,
    source: text(entry.from_spell).trim() ? "spell" : "attack",
  }));
}

function importSpells(spellcasting: Obj, attacks: ActionEntry[], warnings: string[]): SpellEntry[] {
  const spells = obj(spellcasting.spells);
  const result: SpellEntry[] = [];
  for (const [group, values] of Object.entries(spells)) {
    const level = group === "cantrips" ? 0 : num(group.match(/\d+/)?.[0]);
    for (const entry of arr(values)) {
      const name = text(entry.name).trim();
      if (!name) continue;
      const linked = attacks.find((attack) => attack.name.toLowerCase() === name.toLowerCase());
      const description = text(entry.description);
      const directDamage = cleanDamage(entry.damage);
      const inferredDamage = directDamage ?? linked?.damage ?? parseDamage(description);
      if (!directDamage && !linked?.damage && inferredDamage) warnings.push(`${name}: formula ${inferredDamage} ricavata dalla descrizione.`);
      result.push({
        id: text(entry._rowid, uid()), name, level, prepared: bool(entry.prepared), ritual: bool(entry.ritual),
        concentration: bool(entry.concentration) || /concentrazione/i.test(description), school: text(entry.school).trim() || undefined,
        attackBonus: linked?.attackBonus, damage: inferredDamage, damageType: text(entry.damage_type).trim() || linked?.damageType,
        saveDc: /tiro salvezza/i.test(description) ? num(spellcasting.save_dc) : linked?.saveDc,
        description, source: "spell",
      });
    }
  }
  return result;
}

export function importRoll20(source: Roll20Export): CharacterSheet {
  if (!source || typeof source !== "object") throw new Error("Il file non contiene un oggetto JSON");
  const normalized = obj(source.normalized);
  if (!Object.keys(normalized).length) throw new Error("Export Roll20 non supportato: manca il blocco normalized");
  if (source._meta?.sheet && source._meta.sheet !== "ogl5e") {
    throw new Error(`Scheda Roll20 non supportata: ${source._meta.sheet}. Questa versione importa ogl5e.`);
  }
  const character = obj(source.character);
  const identity = obj(normalized.identity);
  const combat = obj(normalized.combat);
  const hp = obj(combat.hp);
  const hitDice = obj(combat.hit_dice);
  const deathSaves = obj(combat.death_saves);
  const spellcasting = obj(normalized.spellcasting);
  const warnings: string[] = [];
  if (source._meta?.version && source._meta.version !== "1.2") warnings.push(`Exporter Roll20 ${source._meta.version}: verificare il risultato (testato con 1.2).`);
  const name = text(identity.character_name).trim() || text(character.name).trim() || "Personaggio senza nome";
  if (!text(identity.character_name).trim() && text(character.name).trim()) warnings.push("Nome recuperato da character.name perché identity.character_name era vuoto.");
  const actions = importActions(normalized.attacks, num(spellcasting.save_dc));
  const rawSlots = obj(spellcasting.slots);
  const slots = Object.fromEntries(Object.entries(rawSlots).map(([key, value]) => {
    const slot = obj(value);
    return [key, { total: num(slot.total), used: Math.min(num(slot.expended), num(slot.total)) }];
  }));
  if (Object.keys(slots).length) warnings.push("Controllare gli slot: il campo Roll20 'expended' è stato interpretato come slot utilizzati.");
  const sheet: CharacterSheet = {
    schemaVersion: 1, id: uid(), sourceId: text(character.id) || undefined, name, avatar: text(character.avatar) || undefined,
    ruleset: { id: DEFAULT_RULESET.id, version: DEFAULT_RULESET.version },
    identity: { race: text(identity.race), className: text(identity.class), subclass: text(identity.subclass), classDisplay: text(identity.class_display), level: num(identity.level, 1), background: text(identity.background), alignment: text(identity.alignment), experience: text(identity.experience) },
    combat: { ac: num(combat.ac), hp: { current: num(hp.current), max: num(hp.max), temp: num(hp.temp) }, speed: text(combat.speed), initiative: num(combat.initiative), proficiencyBonus: num(combat.proficiency_bonus), passivePerception: num(combat.passive_perception), inspiration: bool(combat.inspiration), hitDice: { current: num(hitDice.current), max: num(hitDice.max), die: text(hitDice.die) }, deathSaves: { successes: num(deathSaves.successes), failures: num(deathSaves.failures) } },
    abilities: importAbilities(normalized.abilities),
    skills: Object.fromEntries(Object.entries(obj(normalized.skills)).map(([key, raw]) => { const skill = obj(raw); return [key, { ability: text(skill.ability), bonus: num(skill.bonus), proficient: bool(skill.proficient) }]; })),
    spellcasting: { ability: abilityFromFormula(text(spellcasting.ability)), saveDc: num(spellcasting.save_dc), attackBonus: num(spellcasting.attack_bonus), slots },
    actions, spells: [],
    inventory: arr(normalized.inventory).filter((entry) => text(entry.name).trim()).map((entry) => ({ id: text(entry._rowid, uid()), name: text(entry.name).trim(), count: entry.count == null ? null : num(entry.count, 1), equipped: bool(entry.equipped), description: text(entry.description) || undefined, weight: entry.weight == null || entry.weight === "" ? null : num(entry.weight), properties: text(entry.properties) || undefined, ...itemModifierFields(text(entry.modifiers)) })),
    proficiencies: importProficiencies(normalized.proficiencies),
    traits: importTraits(normalized.traits, source.raw),
    currency: Object.fromEntries(Object.entries(obj(normalized.currency)).map(([key, value]) => [key, num(value)])),
    biography: decodeLegacy(text(character.bio_text) || text(character.bio_html)), importWarnings: warnings,
  };
  sheet.spells = importSpells(spellcasting, actions, warnings);
  sheet.importWarnings.push(...DEFAULT_RULESET.normalizeAfterImport(sheet));
  fixProficiencyChoice(sheet);
  sheet.classes = importClasses(source.raw, text(identity.class), num(identity.level, 1), text(identity.subclass));
  if (sheet.classes.length) sheet.options = { ...sheet.options, autoLevel: autoLevelMatches(sheet) };
  sheet.importedItemModifiers = sheet.inventory.filter((item) => item.equipped && (item.count === null || item.count > 0)).flatMap((item) => itemModifierList(item));
  sheet.tools = importTools(normalized.tools, source.raw, sheet.abilities, sheet.combat.proficiencyBonus);
  return sheet;
}
