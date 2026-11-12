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
  // Risorsa (sheet.counters) che l'azione consuma, una per uso: es. Frecce per l'arco lungo.
  resourceId?: string;
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
  // Si sommano ad amount: modificatore della caratteristica e bonus di competenza della scheda.
  ability?: string;
  proficient?: boolean;
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
  // Creata da "Crea risorsa": con itemId la quantità dell'oggetto dello zaino è il valore attuale.
  itemId?: string;
  traitId?: string;
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
    // Manuale: ac è la CA scritta. Automatica: armatura equipaggiata + DES, oppure acBase + DES senza armatura.
    // Non scelto (schede importate): come manuale, ma con un'armatura equipaggiata vale come automatica.
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
    // "Track hit dice per class": un gruppo per tipo di dado; hitDice resta il totale.
    hitDicePools?: Array<{ die: string; current: number; max: number }>;
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
  classes?: CharacterClass[];
  // Opzioni della tab Modifica, come la pagina impostazioni di Roll20. Partono da zero: i valori importati non le includono.
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

export type ClassCaster = "full" | "half" | "third" | "pact" | "none";
// Una classe del personaggio (fino a 4 come Roll20). custom = "Use custom class" di Roll20.
export interface CharacterClass {
  name: string;
  level: number;
  subclass?: string;
  custom?: { hitDie: number; spellAbility?: string; caster: ClassCaster; saves: string[] };
}

export interface SheetOptions {
  // Bonus fissi per bersaglio di modificatore ("save:wisdom", "skill:stealth", "initiative"…), più
  // "saveAll" (Global saving throw modifier) e "deathSave" (Death save modifier).
  bonuses?: Record<string, number>;
  // Abilità con Maestria (Roll20: Expertise): competenza doppia se si è competenti.
  expertise?: string[];
  jackOfAllTrades?: boolean;
  // Prove con competenza (abilità e strumenti): il d20 vale almeno 10.
  reliableTalent?: boolean;
  initiativeMode?: RollMode;
  // Iniziativa nei turni + Destrezza/100, per gli spareggi.
  dexTiebreaker?: boolean;
  // "level" = 2 + (livello − 1) / 4 come Roll20 "By Level"; un numero = valore personalizzato.
  // Assente: per livello se coincide con il bonus importato, altrimenti il bonus importato.
  proficiency?: "level" | number;
  critRange?: number;
  carryMultiplier?: number;
  encumbrance?: "simple" | "variant" | "off";
  ignoreUnequippedWeight?: boolean;
  // Roll20 "Auto level calculations": cambiare le classi aggiorna livello, dadi vita, slot, TS e caratteristica da incantatore.
  autoLevel?: boolean;
  arcaneFighter?: boolean;
  arcaneRogue?: boolean;
  // Magic caster level forzato (0/assente = calcolato dalle classi).
  casterLevel?: number;
  // Spell slot modifiers, livelli 1–9.
  slotBonus?: number[];
  trackHitDicePerClass?: boolean;
  // Un 1 naturale su un d20 si ritira una volta.
  halflingLuck?: boolean;
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
  // Solo mostri e NPC: PF attuali e CA del token (i PG li prendono dalla scheda).
  hp?: { current: number; max: number };
  ac?: number;
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
  // Barre della vita e CA sui token nascoste (es. fuori dal combattimento).
  hideTokenStats?: boolean;
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
  // Tiro o voce di un mostro: intestazione blu invece che rossa.
  monster?: boolean;
}

export interface Roll20Export {
  _meta?: { sheet?: string; version?: string };
  character?: Record<string, unknown>;
  normalized?: Record<string, unknown>;
  raw?: Record<string, unknown>;
}

// CD = 8 + competenza + modificatore + dcModifier; attacco = competenza + modificatore + attackModifier (come Roll20).
export interface MonsterSpellcasting {
  ability: string;
  attackModifier: number;
  dcModifier: number;
  // Livello da incantatore completo: dà gli slot. 0 = nessuno slot (es. solo incantesimi innati).
  casterLevel: number;
  slots: Record<string, { total: number; used: number }>;
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
  // Campi del form NPC di Roll20, assenti nei mostri salvati prima. PE, bonus competenza e taglia token vuoti = calcolati da GS e taglia.
  vulnerabilities?: string;
  resistances?: string;
  immunities?: string;
  conditionImmunities?: string;
  senses?: string;
  languages?: string;
  xp?: number;
  proficiencyBonus?: number;
  tokenSize?: number;
  // "Spellcasting NPC" di Roll20: presente solo sui mostri incantatori.
  spellcasting?: MonsterSpellcasting;
  spells?: SpellEntry[];
  traits: TraitEntry[];
  actions: ActionEntry[];
  // Assenti nei mostri salvati prima delle azioni bonus.
  bonusActions?: ActionEntry[];
  reactions: ActionEntry[];
  legendaryActions: ActionEntry[];
  image?: string;
  importWarnings: string[];
  // Cartella del Bestiario (voce "folder" con area "bestiary" della libreria).
  folderId?: string;
  // Ultima modifica del GM: tra due browser vince la versione più recente.
  updatedAt?: number;
}

export interface CampaignChapter {
  id: string;
  title: string;
  body: string;
  children: CampaignChapter[];
  images: Array<{ title: string; url: string; kind: "map" | "mapPlayer" | "image" }>;
}

// Journal come su Roll20: note in cartelle, salvate nel cloud della stanza. Il GM organizza; anche i giocatori creano le proprie note.
// owner: giocatore che ha creato la nota, l'unico (oltre al GM) che può eliminarla.
// Con diagram la nota è un diagramma (React Flow): riquadri con un testo, collegati da frecce.
export interface DiagramNode { id: string; x: number; y: number; label: string }
export interface DiagramEdge { id: string; source: string; target: string; label?: string }
export interface JournalNote { schemaVersion: 1; id: string; name: string; body: string; folderId?: string; owner?: string; diagram?: { nodes: DiagramNode[]; edges: DiagramEdge[] } }
// area: "bestiary" per le cartelle del Bestiario; senza, cartella del Journal.
export interface JournalFolder { schemaVersion: 1; id: string; name: string; parentId?: string; area?: "bestiary" }

// Scheda condivisa nella room: visibile a tutti, scrivibile da owner, GM e delegati.
// Copia di una scheda salvata nel cloud per una stanza.
// Libreria cloud: "pc" = personaggi del party, "npc" = statblock dal bestiario, "note"/"folder" = Journal.
export type CloudSheet = {
  rev: number;
  updatedAt: number;
  updatedBy: string;
  deletedAt?: number;
  acl: { view: string[]; edit: string[] };
} & ({ kind: "pc"; sheet: CharacterSheet } | { kind: "npc"; sheet: MonsterSheet } | { kind: "note"; sheet: JournalNote } | { kind: "folder"; sheet: JournalFolder });

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
    session?: { messages: ChatMessage[]; turnState: TurnState };
  };
}
