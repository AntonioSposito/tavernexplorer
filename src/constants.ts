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

export const SKILL_ABILITIES: Record<string, string> = {
  acrobatics: "dexterity", animal_handling: "wisdom", arcana: "intelligence", athletics: "strength", deception: "charisma", history: "intelligence",
  insight: "wisdom", intimidation: "charisma", investigation: "intelligence", medicine: "wisdom", nature: "intelligence", perception: "wisdom",
  performance: "charisma", persuasion: "charisma", religion: "intelligence", sleight_of_hand: "dexterity", stealth: "dexterity", survival: "wisdom",
};
