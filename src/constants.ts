import type { WeaponMastery } from "./types";

export const EXTENSION_ID = "it.tavernexplorer";
export const TOKEN_META_KEY = `${EXTENSION_ID}/character`;
export const TURN_META_KEY = `${EXTENSION_ID}/turn-order`;
export const MESSAGE_CHANNEL = `${EXTENSION_ID}/messages`;
export const SHEETS_CHANNEL = `${EXTENSION_ID}/sheets-changed`;
export const GM_MESSAGE_KEY = `${EXTENSION_ID}/gm-message-public-key`;
export const STORAGE_CHARACTERS = `${EXTENSION_ID}/characters/v1`;
export const STORAGE_GM_TOKEN = `${EXTENSION_ID}/gm-token/v1`;
export const STORAGE_MESSAGES = `${EXTENSION_ID}/messages/v1`;
export const STORAGE_MESSAGES_SEEN = `${EXTENSION_ID}/messages-seen/v1`;
export const STORAGE_MONSTERS = `${EXTENSION_ID}/monsters/v1`;
export const STORAGE_CAMPAIGNS = `${EXTENSION_ID}/campaigns/v1`;
export const STORAGE_SHARED_INVENTORY = `${EXTENSION_ID}/shared-inventory/v1`;
export const STORAGE_CLOUD_CACHE = `${EXTENSION_ID}/cloud-cache/v1`;
export const STORAGE_PHONE_TABS_ON_TOP = `${EXTENSION_ID}/phone-tabs-on-top/v1`;
export const STORAGE_PHONE_SESSION = `${EXTENSION_ID}/phone-session/v1`;
export const STORAGE_CLOSED_SPELL_LEVELS = `${EXTENSION_ID}/closed-spell-levels/v1`;
export const STORAGE_CLOSED_MONSTER_SECTIONS = `${EXTENSION_ID}/closed-monster-sections/v1`;
export const STORAGE_EQUIPPED_FIRST = `${EXTENSION_ID}/inventory-equipped-first/v1`;
export const STORAGE_LIBRARY_SORT = `${EXTENSION_ID}/library-alphabetical/v1`;
export const STORAGE_LAST_SHEET = `${EXTENSION_ID}/last-sheet/v1`;
export const INVENTORY_META_KEY = `${EXTENSION_ID}/shared-inventory`;
export const PERMISSIONS_META_KEY = `${EXTENSION_ID}/permissions`;
export const ROLL_LABEL_META_KEY = `${EXTENSION_ID}/roll-label`;
export const TOKEN_STATUS_META_KEY = `${EXTENSION_ID}/token-status`;
// Barra della vita e CA disegnate in locale sotto il token.
export const TOKEN_STATS_META_KEY = `${EXTENSION_ID}/token-stats`;

export const ABILITY_LABELS: Record<string, string> = {
  strength: "Forza",
  dexterity: "Destrezza",
  constitution: "Costituzione",
  intelligence: "Intelligenza",
  wisdom: "Saggezza",
  charisma: "Carisma",
};

export const SKILL_LABELS: Record<string, string> = {
  acrobatics: "Acrobazia",
  animal_handling: "Addestrare animali",
  arcana: "Arcano",
  athletics: "Atletica",
  deception: "Inganno",
  history: "Storia",
  insight: "Intuizione",
  intimidation: "Intimidire",
  investigation: "Indagare",
  medicine: "Medicina",
  nature: "Natura",
  perception: "Percezione",
  performance: "Intrattenere",
  persuasion: "Persuasione",
  religion: "Religione",
  sleight_of_hand: "Rapidità di mano",
  stealth: "Furtività",
  survival: "Sopravvivenza",
};

// Sigle italiane delle caratteristiche mostrate nella scheda.
export const ABILITY_SHORT: Record<string, string> = { strength: "FOR", dexterity: "DES", constitution: "COS", intelligence: "INT", wisdom: "SAG", charisma: "CAR" };

// Sigle in stile Roll20 per le etichette dei modificatori nelle formule (es. 1d20+2[DEX]+2[PROF]).
export const ABILITY_TAGS: Record<string, string> = { strength: "STR", dexterity: "DEX", constitution: "CON", intelligence: "INT", wisdom: "WIS", charisma: "CHA" };

// Weapon Mastery (regole 2024): nome e regola in inglese, come deciso con l'utente.
export const WEAPON_MASTERIES: Record<WeaponMastery, { name: string; rule: string }> = {
  cleave: { name: "Cleave", rule: "If you hit a creature with a melee attack roll using this weapon, you can make a melee attack roll with the weapon against a second creature within 5 feet of the first that is also within your reach. On a hit, the second creature takes the weapon's damage, but don't add your ability modifier to that damage unless that modifier is negative. You can make this extra attack only once per turn." },
  graze: { name: "Graze", rule: "If your attack roll with this weapon misses a creature, you can deal damage to that creature equal to the ability modifier you used to make the attack roll. This damage is the same type dealt by the weapon, and the damage can be increased only by increasing the ability modifier." },
  nick: { name: "Nick", rule: "When you make the extra attack of the Light property, you can make it as part of the Attack action instead of as a Bonus Action. You can make this extra attack only once per turn." },
  push: { name: "Push", rule: "If you hit a creature with this weapon, you can push the creature up to 10 feet straight away from yourself if it is Large or smaller." },
  sap: { name: "Sap", rule: "If you hit a creature with this weapon, that creature has Disadvantage on its next attack roll before the start of your next turn." },
  slow: { name: "Slow", rule: "If you hit a creature with this weapon and deal damage to it, you can reduce its Speed by 10 feet until the start of your next turn. If the creature is hit more than once by weapons that have this property, the Speed reduction doesn't exceed 10 feet." },
  topple: { name: "Topple", rule: "If you hit a creature with this weapon, you can force the creature to make a Constitution saving throw (DC 8 plus the ability modifier used to make the attack roll and your Proficiency Bonus). On a failed save, the creature has the Prone condition." },
  vex: { name: "Vex", rule: "If you hit a creature with this weapon and deal damage to the creature, you have Advantage on your next attack roll against that creature before the end of your next turn." },
};

// Armi del PHB 2024 e la loro maestria (da 5e.tools items-base.json, XPHB). Il privilegio Weapon Mastery sceglie tra queste.
export const MASTERY_WEAPONS: Record<string, WeaponMastery> = {
  Battleaxe: "topple", Blowgun: "vex", Club: "slow", Dagger: "nick", Dart: "vex", Flail: "sap", Glaive: "graze", Greataxe: "cleave",
  Greatclub: "push", Greatsword: "graze", Halberd: "cleave", "Hand Crossbow": "vex", Handaxe: "vex", "Heavy Crossbow": "push", Javelin: "slow",
  Lance: "topple", "Light Crossbow": "slow", "Light Hammer": "nick", Longbow: "slow", Longsword: "sap", Mace: "sap", Maul: "topple",
  Morningstar: "sap", Musket: "slow", Pike: "push", Pistol: "vex", Quarterstaff: "topple", Rapier: "vex", Scimitar: "nick", Shortbow: "vex",
  Shortsword: "vex", Sickle: "nick", Sling: "slow", Spear: "sap", Trident: "topple", "War Pick": "sap", Warhammer: "push", Whip: "slow",
};

export const SKILL_ABILITIES: Record<string, string> = {
  acrobatics: "dexterity", animal_handling: "wisdom", arcana: "intelligence", athletics: "strength", deception: "charisma", history: "intelligence",
  insight: "wisdom", intimidation: "charisma", investigation: "intelligence", medicine: "wisdom", nature: "intelligence", perception: "wisdom",
  performance: "charisma", persuasion: "charisma", religion: "intelligence", sleight_of_hand: "dexterity", stealth: "dexterity", survival: "wisdom",
};
// Sangue disegnato in locale sui token feriti di mostri e NPC.
export const TOKEN_BLOOD_META_KEY = `${EXTENSION_ID}/token-blood`;
