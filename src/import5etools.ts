import { DEFAULT_RULESET } from "./rulesets";
import { monsterDamages, monsterSpellStats } from "./monsterSheet";
import type { ActionEntry, CampaignChapter, CampaignDocument, MonsterSheet, MonsterSpellcasting, SpellEntry, TraitEntry } from "./types";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj => value && typeof value === "object" && !Array.isArray(value) ? value as Obj : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const text = (value: unknown): string => value == null ? "" : String(value);
const number = (value: unknown, fallback = 0): number => Number.isFinite(Number(value)) ? Number(value) : fallback;
const uid = () => crypto.randomUUID();

// Tag degli statblock scritti come su 5e.tools: "{@atk mw} {@hit 3} to hit … {@h}5" diventa "Melee Weapon Attack: +3 to hit … Hit: 5".
const ATTACKS: Record<string, string> = {
  mw: "Melee Weapon Attack:", rw: "Ranged Weapon Attack:", "mw,rw": "Melee or Ranged Weapon Attack:", ms: "Melee Spell Attack:", rs: "Ranged Spell Attack:", "ms,rs": "Melee or Ranged Spell Attack:",
  m: "Melee Attack Roll:", r: "Ranged Attack Roll:", "m,r": "Melee or Ranged Attack Roll:",
};
const SAVES: Record<string, string> = { str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma" };
const LABELS: Record<string, string> = { h: "Hit:", m: "Miss:", hom: "Hit or Miss:", actSaveFail: "Failure:", actSaveSuccess: "Success:", actSaveSuccessOrFail: "Failure or Success:", actTrigger: "Trigger:", actResponse: "Response:" };

function stripTags(value: string): string {
  return value
    .replace(/\{@atkr? ([^}|]+)}/g, (_, kind: string) => ATTACKS[kind.replace(/\s/g, "")] ?? "Attack:")
    .replace(/\{@hit ([+-]?\d+)(?:\|[^}]*)?}/g, (_, bonus: string) => `${Number(bonus) < 0 ? "" : "+"}${Number(bonus)}`)
    .replace(/\{@dc ([^}|]+)(?:\|[^}]*)?}/g, "DC $1")
    .replace(/\{@recharge(?: (\d))?}/g, (_, from?: string) => from ? `(Recharge ${from}–6)` : "(Recharge 6)")
    .replace(/\{@actSave (\w+)}/g, (_, ability: string) => `${SAVES[ability] ?? ability} Saving Throw:`)
    .replace(/\{@(\w+)}/g, (tag, name: string) => LABELS[name] ? `${LABELS[name]} ` : tag)
    .replace(/\{@hit ([^}|]+)(?:\|[^}]*)?}/g, "$1")
    .replace(/\{@(?:damage|dice) ([^}|]+)(?:\|[^}]*)?}/g, "$1")
    .replace(/\{@\w+ ([^}|]+)(?:\|[^}]*)?}/g, "$1")
    .replace(/\{@\w+}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function renderEntries(entries: unknown): string {
  if (typeof entries === "string") return stripTags(entries);
  if (typeof entries === "number") return String(entries);
  if (Array.isArray(entries)) return entries.map(renderEntries).filter(Boolean).join("\n\n");
  const entry = obj(entries);
  if (!Object.keys(entry).length) return "";
  if (entry.type === "list") return array(entry.items).map((item) => `• ${renderEntries(item)}`).join("\n");
  if (entry.type === "table") {
    const header = array(entry.colLabels).map(text).join(" | ");
    const rows = array(entry.rows).map((row) => array(row).map(renderEntries).join(" | ")).join("\n");
    return [header, rows].filter(Boolean).join("\n");
  }
  const name = text(entry.name);
  const body = renderEntries(entry.entries ?? entry.entry ?? entry.items);
  return [name && `${stripTags(name)}:`, body].filter(Boolean).join(" ").trim();
}

function firstRollFormula(value: string): string | undefined {
  return value.match(/\b\d+d\d+(?:\s*[+-]\s*\d+)?\b/i)?.[0].replace(/\s+/g, "");
}

function parseAttackBonus(raw: unknown, rendered: string): number | undefined {
  const serialized = JSON.stringify(raw);
  const tagged = /\{@hit\s+([+-]?\d+)/.exec(serialized);
  const plain = /(?:Melee|Ranged|Spell) Attack:\s*([+-]\d+)/i.exec(rendered);
  const value = tagged?.[1] ?? plain?.[1];
  return value == null ? undefined : number(value);
}

// "Hit: 5 (1d6 + 4) piercing damage plus 10 (3d6) necrotic damage" → "1d6+4+3d6", "piercing / necrotic".
// Si sommano solo i danni uniti da "plus": "or 8 (1d10 + 3) … if used with two hands" è un'alternativa.
function parseDamage(description: string): Pick<ActionEntry, "damage" | "damageType" | "damages"> | undefined {
  const hit = description.slice(Math.max(0, description.search(/\b(?:Hit|Failure):/)));
  const parts: Array<{ dice: string; type: string }> = []; let end = 0;
  // Anche "(1d12 + 4 plus 1d8) slashing damage" (Orc War Chief).
  for (const match of hit.matchAll(/\((\d+d\d+(?:\s*(?:[+-]|plus)\s*\d+(?:d\d+)?)*)\)\s*([a-z]+) damage/gi)) {
    if (parts.length && !/\bplus\b/i.test(hit.slice(end, match.index))) break;
    parts.push({ dice: match[1].replace(/\s*plus\s*/gi, "+").replace(/\s+/g, ""), type: match[2] }); end = match.index + match[0].length;
  }
  return parts.length ? monsterDamages(parts.map((part) => ({ damage: part.dice, type: part.type }))) : undefined;
}

function importEntries(value: unknown, source: string): ActionEntry[] {
  return array(value).map((raw) => {
    const entry = obj(raw);
    const description = renderEntries(entry.entries ?? entry.entry);
    const damageMatches = [...description.matchAll(/\b\d+d\d+(?:\s*[+-]\s*\d+)?\b/gi)];
    return {
      id: uid(), name: stripTags(text(entry.name)) || "Azione", source,
      attackBonus: parseAttackBonus(raw, description), damage: damageMatches.at(-1)?.[0].replace(/\s+/g, "") ?? firstRollFormula(description),
      ...parseDamage(description),
      saveDc: number(JSON.stringify(raw).match(/\{@dc\s+(\d+)/)?.[1]) || undefined,
      description,
    };
  });
}

function importTraits(value: unknown): TraitEntry[] {
  return array(value).map((raw) => { const entry = obj(raw); return { id: uid(), name: stripTags(text(entry.name)) || "Tratto", description: renderEntries(entry.entries), source: "5e.tools" }; });
}

const ordinal = (level: number) => ["", "1st", "2nd", "3rd"][level] ?? `${level}th`;
const spellNames = (value: unknown) => array(value).map((spell) => typeof spell === "string" ? spell : text(obj(spell).entry)).join(", ");

// "spellcasting" di 5e.tools come voce dello statblock: intestazione e righe "At will", "1/day each", "1st level (4 slots)".
// displayAs dice in che sezione va (tratto se assente, "action" nei mostri 2024).
function spellcasting(value: unknown): Array<Obj & { displayAs: string }> {
  return array(value).map((raw) => {
    const cast = obj(raw); const items: string[] = [];
    if (cast.will) items.push(`At will: ${spellNames(cast.will)}`);
    if (cast.ritual) items.push(`Rituals: ${spellNames(cast.ritual)}`);
    const uses: Array<[string, (n: number) => string]> = [["daily", (n) => `${n}/day`], ["rest", (n) => `${n}/rest`], ["restLong", (n) => `${n}/long rest`], ["weekly", (n) => `${n}/week`],
      ["recharge", (n) => `(Recharge ${n}–6)`], ["charges", (n) => `${n} charge${n === 1 ? "" : "s"}`], ["legendary", (n) => `Legendary Action (costs ${n})`]];
    for (const [period, label] of uses) {
      for (const [count, spells] of Object.entries(obj(cast[period]))) items.push(`${label(parseInt(count))}${count.endsWith("e") ? " each" : ""}: ${spellNames(spells)}`);
    }
    for (const [level, raw] of Object.entries(obj(cast.spells))) {
      const slots = obj(raw); const n = Number(level);
      const label = n === 0 ? "Cantrips (at will)" : `${slots.lower ? `${ordinal(number(slots.lower))}–` : ""}${ordinal(n)} level${slots.slots ? ` (${text(slots.slots)} slot${number(slots.slots) === 1 ? "" : "s"})` : ""}`;
      items.push(`${label}: ${spellNames(slots.spells)}`);
    }
    return { name: cast.name || "Spellcasting", entries: [...array(cast.headerEntries), ...(items.length ? [{ type: "list", items }] : []), ...array(cast.footerEntries)], displayAs: text(cast.displayAs) || "trait" };
  });
}

// "resist": ["fire", { resist: ["bludgeoning", …], note: "from nonmagical attacks" }, { special: "…" }] → testo come su 5e.tools.
function readDefenses(value: unknown, key: string): string {
  return array(value).map((item) => {
    if (typeof item === "string") return stripTags(item);
    const group = obj(item);
    return group.special ? stripTags(text(group.special)) : [stripTags(text(group.preNote)), readDefenses(group[key], key), stripTags(text(group.note))].filter(Boolean).join(" ");
  }).filter(Boolean).join(", ");
}

// Stessi blocchi "spellcasting" come sezione Magia: caratteristica, CD e attacco dall'intestazione, slot e incantesimi.
// Gli incantesimi hanno solo nome, livello e usi: i dati veri arrivano dal catalogo 5e.tools (importMonsters).
const INNATE: Array<[string, (n: number) => string]> = [["daily", (n) => `${n}/giorno`], ["rest", (n) => `${n}/riposo`], ["restLong", (n) => `${n}/riposo lungo`], ["weekly", (n) => `${n}/settimana`],
  ["recharge", (n) => `ricarica ${n}–6`], ["charges", (n) => `${n} ${n === 1 ? "carica" : "cariche"}`], ["legendary", (n) => `azione leggendaria (costo ${n})`]];
function importSpellcasting(sheet: MonsterSheet, value: unknown): MonsterSheet {
  const blocks = array(value).map(obj);
  if (!blocks.length) return sheet;
  const raw = JSON.stringify(blocks);
  const ability = text(blocks.find((block) => block.ability)?.ability);
  const cast: MonsterSpellcasting = { ability: (SAVES[ability] ?? "Intelligence").toLowerCase(), attackModifier: 0, dcModifier: 0, casterLevel: number(/(\d+)(?:st|nd|rd|th)-level spellcaster/.exec(raw)?.[1]), slots: {} };
  const stats = monsterSpellStats(sheet, cast);
  const dc = /\{@dc (\d+)/.exec(raw)?.[1]; const hit = /\{@hit (\d+)/.exec(raw)?.[1];
  if (dc) cast.dcModifier = Number(dc) - stats.saveDc;
  if (hit) cast.attackModifier = Number(hit) - stats.attackBonus;
  const spells: SpellEntry[] = [];
  const add = (list: unknown, level: number, extra: Partial<SpellEntry> = {}) => {
    for (const item of array(list)) {
      const entry = typeof item === "string" ? item : text(obj(item).entry);
      const name = /\{@spell ([^}|]+)/.exec(entry)?.[1] ?? stripTags(entry);
      if (name) spells.push({ id: uid(), name, level, prepared: true, ritual: false, concentration: false, description: "", ...extra });
    }
  };
  for (const block of blocks) {
    add(block.will, 0, { innate: "a volontà" });
    add(block.ritual, 0, { innate: "solo rituale", ritual: true });
    for (const [key, label] of INNATE) for (const [count, list] of Object.entries(obj(block[key]))) add(list, 0, { innate: `${label(parseInt(count))}${count.endsWith("e") ? " ciascuno" : ""}` });
    for (const [level, group] of Object.entries(obj(block.spells))) {
      const slots = number(obj(group).slots);
      if (slots) cast.slots[`level_${level}`] = { total: slots, used: 0 };
      add(obj(group).spells, Number(level));
    }
  }
  return { ...sheet, spellcasting: cast, spells };
}

function readAc(value: unknown): number {
  const first = array(value)[0] ?? value;
  return typeof first === "number" ? first : number(obj(first).ac);
}

function readSpeed(value: unknown): string {
  const speed = obj(value);
  return Object.entries(speed).map(([key, raw]) => {
    const amount = typeof raw === "object" ? obj(raw).number : raw;
    return `${key === "walk" ? "" : `${key} `}${text(amount)} ft.`.trim();
  }).filter((entry) => !entry.includes("undefined")).join(", ");
}

function readType(value: unknown): string {
  if (typeof value === "string") return value;
  const type = obj(value);
  return [text(type.type), array(type.tags).map((tag) => typeof tag === "string" ? tag : text(obj(tag).tag)).filter(Boolean).join(", ")].filter(Boolean).join(" (") + (array(type.tags).length ? ")" : "");
}

function imageUrl(monster: Obj): string | undefined {
  const token = obj(monster.tokenUrl ?? monster.token);
  const direct = text(monster.tokenUrl || monster.image);
  if (direct || text(token.url)) return direct || text(token.url);
  if (monster.hasToken) return `https://raw.githubusercontent.com/5etools-mirror-3/5etools-img/main/bestiary/tokens/${encodeURIComponent(text(monster.source))}/${encodeURIComponent(text(monster.name))}.webp`;
  return undefined;
}

export function import5eToolsMonsters(source: unknown): MonsterSheet[] {
  const root = obj(source);
  const monsters = array(root.monster);
  if (!monsters.length) throw new Error("Il JSON 5e.tools non contiene un array monster");
  return monsters.map((raw) => {
    const monster = obj(raw); const hp = obj(monster.hp);
    const abilities = Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map((key) => [key, number(monster[key])]));
    const casting = spellcasting(monster.spellcasting);
    const withCasting = (entries: unknown, displayAs: string) => [...array(entries), ...casting.filter((cast) => cast.displayAs === displayAs)];
    return importSpellcasting({
      schemaVersion: 1, id: uid(), ruleset: { id: DEFAULT_RULESET.id, version: DEFAULT_RULESET.version },
      name: text(monster.name) || "Mostro senza nome", source: text(monster.source), size: array(monster.size).map(text).join("/") || text(monster.size),
      creatureType: readType(monster.type), alignment: array(monster.alignment).map(text).join(" "), challengeRating: text(typeof monster.cr === "object" ? obj(monster.cr).cr : monster.cr),
      ac: readAc(monster.ac), hp: { average: number(hp.average), formula: text(hp.formula) }, speed: readSpeed(monster.speed), abilities,
      saves: Object.fromEntries(Object.entries(obj(monster.save)).map(([key, value]) => [key, number(value)])),
      skills: Object.fromEntries(Object.entries(obj(monster.skill)).map(([key, value]) => [key, number(value)])), passivePerception: number(monster.passive),
      ...Object.fromEntries(Object.entries({
        vulnerabilities: readDefenses(monster.vulnerable, "vulnerable"), resistances: readDefenses(monster.resist, "resist"), immunities: readDefenses(monster.immune, "immune"),
        conditionImmunities: readDefenses(monster.conditionImmune, "conditionImmune"), senses: array(monster.senses).map((sense) => stripTags(text(sense))).join(", "), languages: array(monster.languages).map((language) => stripTags(text(language))).join(", "),
      }).filter(([, value]) => value)),
      xp: number(obj(monster.cr).xp) || undefined,
      traits: importTraits(withCasting(monster.trait, "trait")), actions: importEntries(withCasting(monster.action, "action"), "action"),
      bonusActions: importEntries(withCasting(monster.bonus, "bonus"), "bonus"), reactions: importEntries(withCasting(monster.reaction, "reaction"), "reaction"),
      legendaryActions: importEntries(withCasting(monster.legendary, "legendary"), "legendary"), image: imageUrl(monster), importWarnings: array(monster._teWarnings).map(text),
    }, monster.spellcasting);
  });
}

function collectImages(value: unknown): Array<{ title: string; url: string; kind: "map" | "mapPlayer" | "image" }> {
  const found: Array<{ title: string; url: string; kind: "map" | "mapPlayer" | "image" }> = [];
  const visit = (node: unknown) => {
    if (Array.isArray(node)) { node.forEach(visit); return; }
    const entry = obj(node); if (!Object.keys(entry).length) return;
    if (entry.type === "image") {
      const href = obj(entry.href); const rawUrl = text(href.url || href.path);
      const url = href.type === "internal" || (!/^https?:/i.test(rawUrl) && rawUrl) ? `https://raw.githubusercontent.com/5etools-mirror-3/5etools-img/main/${rawUrl.replace(/^img\//, "")}` : rawUrl;
      const imageType = text(entry.imageType); const kind = imageType === "map" || imageType === "mapPlayer" ? imageType : "image";
      if (url) found.push({ title: text(entry.title || entry.name) || (kind === "image" ? "Immagine" : "Mappa"), url, kind });
    }
    Object.values(entry).forEach(visit);
  };
  visit(value); return found;
}

function toChapter(raw: unknown, index: number): CampaignChapter {
  const entry = obj(raw);
  const nested = array(entry.entries).filter((child) => ["section", "entries", "chapter"].includes(text(obj(child).type)) && text(obj(child).name));
  return { id: uid(), title: stripTags(text(entry.name)) || `Capitolo ${index + 1}`, body: renderEntries(entry.entries), children: nested.map(toChapter), images: collectImages(entry) };
}

export function import5eToolsCampaign(source: unknown): CampaignDocument {
  const root = obj(source);
  const data = array(root.data);
  if (!data.length) throw new Error("Il JSON 5e.tools non contiene dati di avventura (`data`)");
  const metadata = obj(array(root.adventure)[0] ?? array(root.book)[0]);
  return { schemaVersion: 1, id: uid(), title: text(metadata.name) || text(root.name) || "Avventura importata", source: text(metadata.source), ruleset: { id: DEFAULT_RULESET.id, version: DEFAULT_RULESET.version }, chapters: data.map(toChapter), importedAt: Date.now() };
}

// --- Oggetti (items-base.json + items.json) ---

export interface FiveToolsItem {
  id: string;
  name: string;
  source: string;
  detail: string;
  // Campi pronti per il form "Nuovo oggetto" dello zaino.
  item: { name: string; weight: number | null; properties?: string; modifiersText?: string; description?: string };
}

const ITEM_TYPES: Record<string, string> = {
  LA: "Light Armor", MA: "Medium Armor", HA: "Heavy Armor", S: "Shield", M: "Melee Weapon", R: "Ranged Weapon", A: "Ammunition",
  G: "Adventuring Gear", AT: "Artisan's Tools", T: "Tools", INS: "Instrument", GS: "Gaming Set", P: "Potion", RG: "Ring", RD: "Rod",
  WD: "Wand", SC: "Scroll", SCF: "Spellcasting Focus", W: "Wondrous Item", MNT: "Mount", VEH: "Vehicle", TG: "Trade Good", FD: "Food and Drink", "$": "Treasure",
};
const PROPERTIES: Record<string, string> = {
  A: "Ammunition", F: "Finesse", H: "Heavy", L: "Light", LD: "Loading", R: "Reach", RLD: "Reload", S: "Special", T: "Thrown", "2H": "Two-Handed", V: "Versatile", BF: "Burst Fire",
};
export const DAMAGE_TYPES: Record<string, string> = {
  A: "Acido", B: "Contundente", C: "Freddo", F: "Fuoco", O: "Forza", L: "Fulmine", N: "Necrotico", P: "Perforante", I: "Veleno", Y: "Psichico", R: "Radioso", T: "Tuono", S: "Tagliente",
};
const ARMOR_ITEM_TYPES: Record<string, string> = { LA: "Light Armor", MA: "Medium Armor", HA: "Heavy Armor" };
// Codici 5e.tools come "F|XPHB" o { uid: "F|XPHB" }: conta solo la parte prima di "|".
const code = (value: unknown) => text(typeof value === "object" ? obj(value).uid : value).split("|")[0];

function itemModifiers(row: Obj, type: string): string | undefined {
  const parts: string[] = [];
  if (ARMOR_ITEM_TYPES[type] && row.ac != null) parts.push(`Item Type: ${ARMOR_ITEM_TYPES[type]}`, `AC ${number(row.ac)}`);
  if (type === "S") parts.push("Item Type: Shield", `AC +${number(row.ac, 2)}`);
  const bonus = (key: string, label: string) => { if (row[key] != null) parts.push(`${label} ${text(row[key]).startsWith("-") ? "" : "+"}${text(row[key]).replace(/^\+/, "")}`); };
  bonus("bonusAc", "AC"); bonus("bonusSavingThrow", "Saving Throws"); bonus("bonusSpellAttack", "Spell Attack"); bonus("bonusSpellSaveDc", "Spell DC");
  return parts.join(", ") || undefined;
}

function itemProperties(row: Obj): string | undefined {
  const parts = array(row.property).map(code).map((key) => PROPERTIES[key] ?? key);
  if (row.dmg1) parts.unshift(`${text(row.dmg1)}${row.dmgType ? ` ${DAMAGE_TYPES[text(row.dmgType)] ?? text(row.dmgType)}` : ""}${row.dmg2 ? ` (${text(row.dmg2)} a due mani)` : ""}`);
  if (row.range) parts.push(`Gittata ${text(row.range)}`);
  array(row.mastery).map(code).forEach((mastery) => parts.push(`Mastery: ${mastery}`));
  return parts.join(", ") || undefined;
}

// Edizione 2024 prima: gli oggetti ristampati (reprintedAs) sono nascosti, resta la versione nuova.
// Gli oggetti "_copy" ereditano i dati da un altro: si scartano (prima versione).
export function import5eToolsItems(baseFile: unknown, itemsFile: unknown): FiveToolsItem[] {
  const rows = [...array(obj(baseFile).baseitem), ...array(obj(itemsFile).item)].map(obj)
    .filter((row) => text(row.name) && !row._copy && !array(row.reprintedAs).length);
  return rows.map((row) => {
    const type = code(row.type);
    const name = text(row.name);
    const source = text(row.source);
    const weight = row.weight == null ? null : number(row.weight);
    const kind = ITEM_TYPES[type] ?? (row.wondrous ? "Wondrous Item" : "");
    const rarity = text(row.rarity);
    return {
      id: `${name}|${source}`, name, source,
      detail: [source, kind, rarity && rarity !== "none" && rarity, weight != null && `${weight} lb`].filter(Boolean).join(" · "),
      item: { name, weight, properties: itemProperties(row), modifiersText: itemModifiers(row, type), description: renderEntries(row.entries) || undefined },
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}
