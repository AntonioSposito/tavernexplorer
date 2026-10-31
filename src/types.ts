export type RollMode = "normal" | "advantage" | "disadvantage";
export type Visibility = "everyone" | "self" | "gm";
export type AppTab = "sheet" | "turns" | "messages" | "notes" | "library" | "compendium" | "campaigns" | "shared" | "party" | "settings";
export interface PermissionSettings { playersEditInventory: boolean; playersImportContent: boolean; playersManageTurns: boolean }

export interface AbilityStat {
  score: number;
  mod: number;
  save: number;
  saveProficient: boolean;
}

export interface SkillStat {
  ability: string;
  bonus: number;
  proficient: boolean;
}

export interface ActionEntry {
  id: string;
  name: string;
  attackBonus?: number;
  damage?: string;
  damageType?: string;
  saveDc?: number;
  description?: string;
  source?: string;
}

export interface SpellEntry extends ActionEntry {
  level: number;
  prepared: boolean;
  ritual: boolean;
  concentration: boolean;
  school?: string;
}

export interface InventoryEntry {
  id: string;
  name: string;
  count: number | null;
  equipped: boolean;
  description?: string;
  modifiers?: StatModifier[];
}

export interface StatModifier {
  id: string;
  target: string;
  amount: number;
}

export interface CharacterEffect {
  id: string;
  name: string;
  active: boolean;
  modifiers: StatModifier[];
  remainingRounds?: number;
}

export type CounterRecovery = "none" | "short" | "long";
export interface ResourceCounter {
  id: string;
  name: string;
  current: number;
  max: number;
  recovery: CounterRecovery;
}

export interface TraitEntry {
  id: string;
  name: string;
  source?: string;
  description: string;
}

export interface CharacterSheet {
  schemaVersion: 1;
  id: string;
  sharing?: "private" | "party";
  sourceId?: string;
  name: string;
  avatar?: string;
  ruleset: { id: string; version: string };
  identity: {
    race: string;
    className: string;
    subclass: string;
    classDisplay: string;
    level: number;
    background: string;
    alignment: string;
    experience: string;
  };
  combat: {
    ac: number;
    hp: { current: number; max: number; temp: number };
    speed: string;
    initiative: number;
    proficiencyBonus: number;
    passivePerception: number;
    inspiration: boolean;
    hitDice: { current: number; max: number; die: string };
    deathSaves: { successes: number; failures: number };
  };
  abilities: Record<string, AbilityStat>;
  skills: Record<string, SkillStat>;
  spellcasting: {
    ability: string;
    saveDc: number;
    attackBonus: number;
    slotRecovery?: "short" | "long";
    slots: Record<string, { total: number; used: number }>;
  };
  actions: ActionEntry[];
  spells: SpellEntry[];
  inventory: InventoryEntry[];
  effects?: CharacterEffect[];
  counters?: ResourceCounter[];
  traits: TraitEntry[];
  currency: Record<string, number>;
  biography: string;
  importWarnings: string[];
}

export interface TurnEntry {
  id: string;
  name: string;
  initiative: number;
  tokenId?: string;
  characterId?: string;
  hidden?: boolean;
  initiativeBonus?: number;
  conditions?: TurnCondition[];
}

export interface TurnCondition {
  id: string;
  name: string;
  remainingRounds?: number;
  lastTickRound?: number;
}

export interface TurnState {
  round: number;
  activeIndex: number;
  entries: TurnEntry[];
}

export interface ChatMessage {
  id: string;
  kind: "text" | "roll" | "share" | "system";
  author: string;
  authorId?: string;
  characterId?: string;
  title?: string;
  body: string;
  formula?: string;
  total?: number;
  dice?: number[];
  visibility: Visibility;
  createdAt: number;
}

export interface Roll20Export {
  _meta?: { sheet?: string; version?: string };
  character?: Record<string, unknown>;
  normalized?: Record<string, unknown>;
  raw?: Record<string, unknown>;
}

export interface MonsterSheet {
  schemaVersion: 1;
  id: string;
  ruleset: { id: string; version: string };
  name: string;
  source: string;
  size: string;
  creatureType: string;
  alignment: string;
  challengeRating: string;
  ac: number;
  hp: { average: number; formula: string };
  speed: string;
  abilities: Record<string, number>;
  saves: Record<string, number>;
  skills: Record<string, number>;
  passivePerception: number;
  traits: TraitEntry[];
  actions: ActionEntry[];
  reactions: ActionEntry[];
  legendaryActions: ActionEntry[];
  image?: string;
  importWarnings: string[];
}

export interface CampaignChapter {
  id: string;
  title: string;
  body: string;
  children: CampaignChapter[];
  images: Array<{ title: string; url: string; kind: "map" | "mapPlayer" | "image" }>;
}

// Scheda condivisa nella room: visibile a tutti, scrivibile da owner, GM e delegati.
// Copia di una scheda salvata nel cloud per una stanza.
// Libreria cloud: "pc" = personaggi del party, "npc" = statblock dal bestiario.
export type CloudSheet = {
  rev: number;
  updatedAt: number;
  updatedBy: string;
  deletedAt?: number;
  acl: { view: string[]; edit: string[] };
} & ({ kind: "pc"; sheet: CharacterSheet } | { kind: "npc"; sheet: MonsterSheet });

export interface PartyCharacterSummary {
  id: string; ownerId: string; ownerName: string; name: string; avatar?: string;
  classDisplay: string; race: string; level: number; ruleset: { id: string; version: string };
  ac: number; hp: { current: number; max: number; temp: number }; initiative: number;
  abilities: Record<string, AbilityStat>; spellSaveDc: number; spellAttackBonus: number;
}

export interface CampaignDocument {
  schemaVersion: 1;
  id: string;
  title: string;
  source: string;
  ruleset: { id: string; version: string };
  chapters: CampaignChapter[];
  importedAt: number;
}

export interface SharedInventoryItem {
  id: string;
  name: string;
  quantity: number;
  description: string;
  assignedTo?: string;
  updatedAt: number;
}

export interface PlayerNote {
  id: string;
  title: string;
  body: string;
  updatedAt: number;
}

export interface NoteOrganization {
  folders: Array<{ id: string; name: string }>;
  placements: Record<string, string>;
}

export type NoteWritePermission = "owner" | "owner-gm" | "party";
export interface SharedNote extends PlayerNote {
  ownerId: string;
  ownerName: string;
  writePermission: NoteWritePermission;
}

export interface TavernPack {
  $schema: "https://tavernexplorer.vercel.app/tavernpack.schema.json";
  format: "tavernpack";
  formatVersion: "1.0.0";
  exportedAt: string;
  rulesets: Array<{ id: string; version: string }>;
  data: {
    characters: CharacterSheet[];
    monsters: MonsterSheet[];
    campaigns: CampaignDocument[];
    sharedInventory: SharedInventoryItem[];
    notes?: PlayerNote[];
    noteOrganization?: NoteOrganization;
    session?: { messages: ChatMessage[]; turnState: TurnState };
  };
}
