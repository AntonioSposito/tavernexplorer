export type RollMode = "normal" | "advantage" | "disadvantage";
export type Visibility = "everyone" | "self" | "gm";
export type AppTab = "sheet" | "turns" | "messages" | "notes" | "library" | "compendium" | "campaigns" | "shared" | "settings";
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

// Caratteristica usata da attacco o danno: "spell" = caratteristica da incantatore, "none" = nessuna.
export type ActionAbility = "strength" | "dexterity" | "constitution" | "intelligence" | "wisdom" | "charisma" | "spell" | "none";

export interface ActionDamage {
  dice: string;
  ability: ActionAbility;
  bonus: number;
  type: string;
  critDice: string;
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
  // Campi del form attacchi (come Roll20): se presenti, attacco, danno e CD si calcolano dalla scheda
  // e prevalgono sui valori fissi sopra, che restano per le azioni importate.
  attack?: { ability: ActionAbility; bonus: number; proficient: boolean };
  range?: string;
  magicBonus?: number;
  critRange?: number;
  damages?: ActionDamage[];
  save?: { ability: Exclude<ActionAbility, "spell" | "none">; dc: "spell" | number; effect: string };
}

export interface SpellEntry extends ActionEntry {
  level: number;
  prepared: boolean;
  ritual: boolean;
  concentration: boolean;
  school?: string;
  // Campi del form incantesimi (come Roll20). Attacco, danni e TS stanno nei campi di ActionEntry.
  castingTime?: string;
  target?: string;
  components?: { verbal: boolean; somatic: boolean; material: boolean; materials?: string };
  duration?: string;
  // Caratteristica da incantatore: "spell" = quella della scheda (NONE in Roll20).
  castingAbility?: ActionAbility;
  innate?: string;
  output?: "attack" | "spellcard";
  spellAttack?: "melee" | "ranged";
  healing?: string;
  addAbilityMod?: boolean;
  // Danno extra per ogni livello di slot sopra quello dell'incantesimo: count + die + bonus.
  higherLevel?: { count: number; die: string; bonus: number };
  includeDescription?: boolean;
  higherLevelText?: string;
  spellClass?: string;
  spellType?: string;
}

export interface InventoryEntry {
  id: string;
  name: string;
  count: number | null;
  equipped: boolean;
  description?: string;
  // Campi del form oggetto di Roll20, come testo: non sono applicati alla scheda.
  weight?: number | null;
  properties?: string;
  modifiersText?: string;
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
  // Testo mostrato sotto il nome, es. "Aasimar • Racial" (unico campo nei tratti salvati prima del form).
  source?: string;
  // Campi del form tratti di Roll20: SOURCE (uno dei sei valori) e SOURCE TYPE (testo libero).
  sourceKind?: TraitSource;
  sourceType?: string;
  description: string;
  // Sempre attivi (un tratto non si equipaggia), come gli effetti.
  modifiers?: StatModifier[];
}

export type TraitSource = "Racial" | "Class" | "Feat" | "Background" | "Item" | "Other";

export interface CharacterSheet {
  schemaVersion: 1;
  id: string;
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
    // Manuale (default): ac è la CA scritta. Automatica: armatura equipaggiata + DES, oppure acBase + DES senza armatura.
    ac: number;
    acMode?: "manual" | "auto";
    acBase?: number;
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
  // Assenti nelle schede importate prima di questo campo.
  proficiencies?: ProficiencyEntry[];
  tools?: ToolEntry[];
  // Opzioni della tab "Modifica (prova)", come la pagina impostazioni di Roll20. Partono da zero: i valori importati non le includono.
  options?: SheetOptions;
  // Modificatori degli oggetti equipaggiati al momento dell'import: Roll20 li ha già sommati ai valori esportati.
  importedItemModifiers?: StatModifier[];
  currency: Record<string, number>;
  biography: string;
  importWarnings: string[];
}

export interface ProficiencyEntry {
  id: string;
  name: string;
  type: "LANGUAGE" | "WEAPON" | "ARMOR" | "OTHER";
}

// Come il form strumenti di Roll20: bonus = caratteristica + competenza + mod.
export interface ToolEntry {
  id: string;
  name: string;
  // Chiave di caratteristica ("dexterity") o "" se si sceglie al tiro (QUERY ATTRIBUTE).
  ability: string;
  proficiency: ToolProficiency;
  mods: number;
}

export type ToolProficiency = "proficient" | "expertise" | "jack";

export interface SheetOptions {
  // Bonus fissi per bersaglio di modificatore ("save:wisdom", "skill:stealth", "initiative"…), più
  // "saveAll" (Global saving throw modifier) e "deathSave" (Death save modifier).
  bonuses?: Record<string, number>;
  // Abilità con Maestria (Roll20: Expertise): competenza doppia se si è competenti.
  expertise?: string[];
  jackOfAllTrades?: boolean;
  initiativeMode?: RollMode;
  critRange?: number;
  carryMultiplier?: number;
  encumbrance?: "simple" | "variant" | "off";
  ignoreUnequippedWeight?: boolean;
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
  // Nome Owlbear di chi ha inviato: author può essere il personaggio controllato.
  playerName?: string;
  characterId?: string;
  title?: string;
  body: string;
  formula?: string;
  total?: number;
  dice?: number[];
  // Card in stile template Roll20; i messaggi senza card (vecchi o di testo) usano title/body.
  card?: RollCard;
  visibility: Visibility;
  createdAt: number;
}

export interface RollCard {
  name: string;
  subtitle?: string;
  // d20 naturali (due con vantaggio/svantaggio); il totale mostrato è dado + modifier.
  // formula: quella tirata, con etichette (assente nelle card salvate prima delle etichette).
  d20?: { label: string; formula?: string; dice: number[]; modifier: number; kept: number; mode: RollMode; critRange: number };
  rolls: Array<{ label: string; formula: string; total: number; dice: number[]; type?: string; critical?: boolean }>;
  // Valori senza tiro (card di "Mostra in chat"), es. Colpire +5, Danno 1d8+3.
  stats?: Array<{ label: string; value: string; type?: string }>;
  save?: { ability?: string; dc: number; effect?: string };
  note?: string;
  // Avviso evidenziato per il tavolo, es. incantesimo lanciato senza slot o slot recuperato a mano.
  alert?: string;
  description?: string;
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
