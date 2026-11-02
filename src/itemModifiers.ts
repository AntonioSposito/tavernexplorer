import type { ActionEntry, CharacterSheet, InventoryEntry, StatModifier } from "./types";

const ABILITIES: Record<string, string> = {
  strength: "strength", forza: "strength", str: "strength", for: "strength",
  dexterity: "dexterity", destrezza: "dexterity", dex: "dexterity", des: "dexterity",
  constitution: "constitution", costituzione: "constitution", con: "constitution", cos: "constitution",
  intelligence: "intelligence", intelligenza: "intelligence", int: "intelligence",
  wisdom: "wisdom", saggezza: "wisdom", wis: "wisdom", sag: "wisdom",
  charisma: "charisma", carisma: "charisma", cha: "charisma", car: "charisma",
};
const SKILLS = ["acrobatics", "animal handling", "arcana", "athletics", "deception", "history", "insight", "intimidation", "investigation", "medicine", "nature", "perception", "performance", "persuasion", "religion", "sleight of hand", "stealth", "survival"];
const SIMPLE: Record<string, string[]> = {
  "ac": ["ac"], "armor class": ["ac"], "ca": ["ac"], "classe armatura": ["ac"],
  "initiative": ["initiative"], "iniziativa": ["initiative"],
  "spell attack": ["spellAttack"], "spell attacks": ["spellAttack"], "spell dc": ["spellSaveDc"], "spell save dc": ["spellSaveDc"],
  "melee attacks": ["attack"], "ranged attacks": ["attack"], "attacks": ["attack"], "attack": ["attack"],
  "melee damage": ["damage"], "ranged damage": ["damage"], "damage": ["damage"],
  "saving throws": Object.values(ABILITIES).filter((value, index, all) => all.indexOf(value) === index).map((ability) => `save:${ability}`),
  "hp": ["hpMax"], "hit points": ["hpMax"], "pf": ["hpMax"],
  ...Object.fromEntries(SKILLS.map((skill) => [skill, [`skill:${skill.replaceAll(" ", "_")}`]])),
};

function targets(name: string): string[] {
  const key = name.trim().toLowerCase().replace(/\s+/g, " ");
  if (SIMPLE[key]) return SIMPLE[key];
  if (ABILITIES[key]) return [`ability:${ABILITIES[key]}`];
  const save = /^(?:(\w+) (?:save|saving throw)s?|ts (\w+))$/.exec(key);
  const ability = save && ABILITIES[save[1] ?? save[2]];
  return ability ? [`save:${ability}`] : [];
}

export type ArmorType = "light" | "medium" | "heavy" | "shield";
const ARMOR_TYPES: Record<string, ArmorType> = {
  "light armor": "light", "armatura leggera": "light", "medium armor": "medium", "armatura media": "medium",
  "heavy armor": "heavy", "armatura pesante": "heavy", "shield": "shield", "scudo": "shield",
};

// "Item Type: Light Armor, AC 11" → armatura leggera con CA base 11 (calcolo automatico della CA, come Roll20).
export function parseArmor(text: string | undefined): { type: ArmorType; ac: number } | null {
  const parts = (text ?? "").split(",").map((item) => item.trim().toLowerCase());
  const type = parts.map((part) => /^item type:\s*(.+)$/.exec(part)?.[1]).map((name) => name && ARMOR_TYPES[name]).find(Boolean);
  const ac = parts.map((part) => /^(?:ac|ca)\s+(\d+)$/.exec(part)?.[1]).find(Boolean);
  return type && ac ? { type, ac: Number(ac) } : null;
}

// Campo "Modifiers" degli oggetti Roll20, es. "AC +1, Strength Save +2, Item Type: Light Armor".
// Solo i bonus con segno: "AC 11" (CA base dell'armatura) e "Item Type" sono ignorati.
export function parseItemModifiers(text: string | undefined): { modifiers: StatModifier[]; unknown: string[] } {
  const modifiers: StatModifier[] = [];
  const unknown: string[] = [];
  // Uno scudo con "AC 2" senza segno vale come "AC +2".
  const shield = parseArmor(text)?.type === "shield";
  for (const part of (text ?? "").split(",").map((item) => item.trim()).filter(Boolean)) {
    if (shield && /^(?:ac|ca)\s+\d+$/i.test(part)) { modifiers.push({ id: `ac:${part}`, target: "ac", amount: Number(part.replace(/\D/g, "")) }); continue; }
    const match = /^(.*?)\s*([+-]\s*\d+)$/.exec(part);
    const found = match ? targets(match[1]) : [];
    if (!match || !found.length) { if (!/^item type:/i.test(part) && !/^(?:ac|ca) \d+$/i.test(part)) unknown.push(part); continue; }
    const amount = Number(match[2].replace(/\s/g, ""));
    for (const target of found) modifiers.push({ id: `${target}:${part}`, target, amount });
  }
  return { modifiers, unknown };
}

// Azione precompilata da un oggetto (come "Has an attack" di Roll20). Le Proprietà vengono dall'import 5e.tools,
// es. "1d8 Tagliente (1d10 a due mani), Versatile, Mastery: Sap": dado e tipo, Finesse, munizioni (a distanza), gittata.
export function actionFromItem(item: InventoryEntry, sheet: CharacterSheet): ActionEntry {
  const properties = (item.properties ?? "").split(",").map((part) => part.trim());
  const damage = /^(\d+d\d+)\s*([^\s(]*)/i.exec(properties[0] ?? "");
  const has = (name: string) => properties.some((part) => part.toLowerCase() === name);
  const mod = (ability: string) => sheet.abilities[ability]?.mod ?? 0;
  const ability = has("ammunition") ? "dexterity" : has("finesse") && mod("dexterity") > mod("strength") ? "dexterity" : "strength";
  const range = properties.find((part) => /^gittata /i.test(part))?.replace(/^gittata /i, "");
  return {
    id: crypto.randomUUID(), name: item.name, description: item.description, range,
    attack: { ability, bonus: 0, proficient: true }, critRange: 20,
    damages: damage ? [{ dice: damage[1], ability, bonus: 0, type: damage[2], critDice: damage[1] }] : [],
  };
}
