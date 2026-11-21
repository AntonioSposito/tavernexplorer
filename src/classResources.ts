import type { CharacterSheet, CounterRecovery, ResourceCounter } from "./types";

// Risorse e azioni di classe tenute allineate al livello e alle caratteristiche: si creano alla prima occasione e poi si aggiornano.
// Il contatore resta modificabile a mano; al prossimo aggiornamento torna ai valori di classe.
export type ClassResource = NonNullable<ResourceCounter["classResource"]>;

const classLevel = (sheet: CharacterSheet, name: string) => sheet.classes?.find((entry) => entry.name === name)?.level ?? (sheet.identity.className === name ? sheet.identity.level : 0);
// Dado di un privilegio che cresce a certi livelli: [livello minimo, facce], dal più alto.
const dieAt = (level: number, steps: Array<[number, number]>) => steps.find(([min]) => level >= min)?.[1] ?? steps.at(-1)![1];

// Ira (2024): usi per livello da barbaro; tutti col riposo lungo, uno col riposo breve.
export const rageUses = (level: number) => level >= 17 ? 6 : level >= 12 ? 5 : level >= 6 ? 4 : level >= 3 ? 3 : 2;
// Ispirazione bardica: dado per livello da bardo.
export const bardicDie = (level: number) => dieAt(level, [[15, 12], [10, 10], [5, 8], [1, 6]]);

// Usi per livello di classe (posizione = livello - 1), copiati dalle tabelle PHB 2024 (classProgression.test.ts li confronta con 5e.tools).
const table = (values: string) => (level: number) => Number(values.split(" ")[level - 1] ?? 0);
const clericChannel = table("0 2 2 2 2 3 3 3 3 3 3 3 3 3 3 3 3 4 4 4");
const paladinChannel = table("0 0 2 2 2 2 2 2 2 2 3 3 3 3 3 3 3 3 3 3");
const wildShapeUses = table("0 2 2 2 2 3 3 3 3 3 3 3 3 3 3 3 4 4 4 4");
const secondWindUses = table("2 2 2 3 3 3 3 3 3 4 4 4 4 4 4 4 4 4 4 4");
const favoredEnemyUses = table("2 2 2 2 3 3 3 3 4 4 4 4 5 5 5 5 6 6 6 6");
// Dadi di energia psionica (Psi Warrior, Soulknife): numero e facce per livello della classe.
const psionicDice = table("0 0 4 4 6 6 6 6 8 8 8 8 10 10 10 10 12 12 12 12");
export const psionicDie = (level: number) => dieAt(level, [[17, 12], [11, 10], [5, 8], [1, 6]]);
const PSIONIC: Record<string, string> = { "Psi Warrior": "Fighter", Soulknife: "Rogue" };

type Wanted = Omit<ResourceCounter, "id" | "current"> & { classResource: ClassResource };
function wanted(sheet: CharacterSheet): Wanted[] {
  const level = (name: string) => classLevel(sheet, name);
  const bard = level("Bard");
  // Recupero: "long" = tutti col riposo lungo; shortRestGain = usi in più col riposo breve; "short" = tutti anche col breve.
  const all: Array<Wanted | false> = [
    { name: "Ira", max: level("Barbarian") && rageUses(level("Barbarian")), recovery: "long", shortRestGain: 1, classResource: "rage" },
    // Dal 5° (Font of Inspiration) si recupera anche col riposo breve.
    !!bard && { name: `Ispirazione bardica (d${bardicDie(bard)})`, max: Math.max(1, sheet.abilities.charisma?.mod ?? 0), recovery: bard >= 5 ? "short" : "long", classResource: "bardic" },
    // shortcut: Chierico e Paladino insieme hanno un solo contatore col massimo più alto; separarli se un multiclasse lo chiede.
    { name: "Incanalare Divinità", max: Math.max(clericChannel(level("Cleric")), paladinChannel(level("Paladin"))), recovery: "long", shortRestGain: 1, classResource: "channel" },
    { name: "Forma selvatica", max: wildShapeUses(level("Druid")), recovery: "long", shortRestGain: 1, classResource: "wildShape" },
    { name: "Recuperare energie", max: secondWindUses(level("Fighter")), recovery: "long", shortRestGain: 1, classResource: "secondWind" },
    { name: "Punti focus", max: level("Monk") >= 2 ? level("Monk") : 0, recovery: "short", classResource: "focus" },
    { name: "Punti stregoneria", max: level("Sorcerer") >= 2 ? level("Sorcerer") : 0, recovery: "long", classResource: "sorcery" },
    // Favored Enemy: Marchio del cacciatore senza slot.
    { name: "Nemico prescelto (Marchio del cacciatore)", max: favoredEnemyUses(level("Ranger")), recovery: "long", classResource: "favoredEnemy" },
    ...Object.entries(PSIONIC).map(([subclass, className]): Wanted | false => {
      const entry = sheet.classes?.find((item) => item.name === className && item.subclass === subclass);
      return !!entry && { name: `Energia psionica (d${psionicDie(entry.level)})`, max: psionicDice(entry.level), recovery: "long", shortRestGain: 1, classResource: "psionic" };
    }),
  ];
  return all.filter((item): item is Wanted => !!item && item.max > 0);
}

// Arti marziali: dado per livello da monaco; colpo senz'armi con la migliore tra Forza e Destrezza.
export const martialArtsDie = (level: number) => dieAt(level, [[17, 12], [11, 10], [5, 8], [1, 6]]);
function syncMartialArts(sheet: CharacterSheet) {
  const monk = classLevel(sheet, "Monk");
  if (!monk) return;
  const ability = (sheet.abilities.dexterity?.mod ?? 0) > (sheet.abilities.strength?.mod ?? 0) ? "dexterity" as const : "strength" as const;
  const dice = `1d${martialArtsDie(monk)}`;
  // Un colpo senz'armi già nella scheda (anche scritto a mano) si adotta: cambia solo il dado, il tiro per colpire resta com'è.
  const existing = sheet.actions.find((action) => action.classAction === "martialArts") ?? sheet.actions.find((action) => /^(unarmed strike|colpo senz'armi)/i.test(action.name.trim()));
  if (existing) {
    existing.classAction = "martialArts";
    existing.damages = [{ ...existing.damages?.[0] ?? { ability, bonus: 0, type: "Contundente", critDice: "" }, dice }, ...existing.damages?.slice(1) ?? []];
    return;
  }
  sheet.actions.push({ id: crypto.randomUUID(), name: "Colpo senz'armi (Arti marziali)", classAction: "martialArts", range: "Mischia", attack: { ability, bonus: 0, proficient: true },
    damages: [{ dice, ability, bonus: 0, type: "Contundente", critDice: "" }], description: "Arti marziali: dado del monaco al posto del danno normale, con Forza o Destrezza." });
}

// Movimento senza armatura: metri per livello da monaco, scritti nel modificatore "solo senza armatura" del tratto.
const UNARMORED_MOVEMENT: Array<[number, number]> = [[18, 9], [14, 7.5], [10, 6], [6, 4.5], [2, 3]];
function syncUnarmoredMovement(sheet: CharacterSheet) {
  const meters = UNARMORED_MOVEMENT.find(([level]) => classLevel(sheet, "Monk") >= level)?.[1];
  if (!meters) return;
  for (const item of sheet.traits) if (item.name === "Unarmored Movement") for (const mod of item.modifiers ?? []) if (mod.target === "speed" && mod.unarmored) mod.amount = meters;
}

// Nomi con cui una risorsa di classe può essere già stata creata a mano, e nomi messi dall'app (che si aggiornano).
const ADOPT: Record<ClassResource, RegExp> = {
  rage: /^(ira|rage)\b/i, bardic: /^(bardic inspiration|ispirazione bardica)/i, channel: /^(channel divinity|incanalare divinit)/i,
  wildShape: /^(wild shape|forma selvatica)/i, secondWind: /^(second wind|recuperare energie)/i, focus: /^(focus points?|punti focus|ki)\b/i,
  sorcery: /^(sorcery points?|punti stregoneria)/i, favoredEnemy: /^(favou?red enemy|nemico prescelto)/i, psionic: /^(psionic energy|energia psionica)/i,
};
const AUTO_NAME: Record<ClassResource, RegExp> = {
  rage: /^Ira$/, bardic: /^Ispirazione bardica \(d\d+\)$/, channel: /^Incanalare Divinità$/, wildShape: /^Forma selvatica$/, secondWind: /^Recuperare energie$/,
  focus: /^Punti focus$/, sorcery: /^Punti stregoneria$/, favoredEnemy: /^Nemico prescelto \(Marchio del cacciatore\)$/, psionic: /^Energia psionica \(d\d+\)$/,
};

// Privilegi con usi da contare (PHB 2024): il contatore nasce quando la scheda ha il tratto con quel nome (dal level up o a mano).
// max riceve il livello della classe del privilegio; dice = facce del dado, scritte nel nome come "(d8)".
interface FeatureUse { className: string; max: (level: number, sheet: CharacterSheet) => number; recovery: CounterRecovery | ((sheet: CharacterSheet) => CounterRecovery); shortRestGain?: number; dice?: (level: number) => number }
const once = () => 1;
const modOf = (ability: string) => (_level: number, sheet: CharacterSheet) => Math.max(1, sheet.abilities[ability]?.mod ?? 0);
const hasTrait = (sheet: CharacterSheet, name: string) => sheet.traits.some((item) => item.name === name);
const longOnce = (className: string): FeatureUse => ({ className, max: once, recovery: "long" });
const shortOnce = (className: string): FeatureUse => ({ className, max: once, recovery: "short" });
const FEATURE_USES: Record<string, FeatureUse> = {
  // Usi fissi.
  "Action Surge": { className: "Fighter", max: (level) => level >= 17 ? 2 : 1, recovery: "short" },
  Indomitable: { className: "Fighter", max: (level) => level >= 17 ? 3 : level >= 13 ? 2 : 1, recovery: "long" },
  "Innate Sorcery": { className: "Sorcerer", max: () => 2, recovery: "long" },
  ...Object.fromEntries([
    ["Barbarian", ["Zealous Presence", "Intimidating Presence", "Rage of the Gods"]],
    ["Cleric", ["Divine Intervention"]],
    ["Druid", ["Wild Resurgence", "Natural Recovery"]],
    ["Fighter", ["Know Your Enemy", "Bulwark of Force"]],
    ["Monk", ["Uncanny Metabolism", "Hand of Ultimate Mercy"]],
    ["Paladin", ["Undying Sentinel", "Holy Nimbus", "Living Legend", "Elder Champion", "Avenging Angel"]],
    ["Ranger", ["Fey Reinforcements"]],
    ["Rogue", ["Spell Thief", "Psychic Veil", "Rend Mind"]],
    ["Sorcerer", ["Sorcerous Restoration", "Tides of Chaos", "Trance of Order", "Dragon Wings", "Warping Implosion", "Clockwork Cavalcade", "Dragon Companion", "Tamed Surge"]],
    ["Warlock", ["Magical Cunning", "Searing Vengeance", "Hurl Through Hell", "Beguiling Defenses"]],
    ["Wizard", ["Arcane Recovery"]],
  ].flatMap(([className, names]) => (names as string[]).map((name) => [name, longOnce(className as string)]))),
  ...Object.fromEntries([
    ["Bard", ["Unbreakable Majesty"]], ["Fighter", ["Telekinetic Movement", "Psi-Powered Leap"]], ["Rogue", ["Stroke of Luck"]],
    ["Warlock", ["Clairvoyant Combatant"]], ["Wizard", ["Illusory Self"]],
  ].flatMap(([className, names]) => (names as string[]).map((name) => [name, shortOnce(className as string)]))),
  // Usi pari al modificatore (minimo 1).
  "Warding Flare": { className: "Cleric", max: modOf("wisdom"), recovery: (sheet) => hasTrait(sheet, "Improved Warding Flare") ? "short" : "long" },
  "War Priest": { className: "Cleric", max: modOf("wisdom"), recovery: "short" },
  "Corona of Light": { className: "Cleric", max: modOf("wisdom"), recovery: "long" },
  "Star Map": { className: "Druid", max: modOf("wisdom"), recovery: "long" },
  "Moonlight Step": { className: "Druid", max: modOf("wisdom"), recovery: "long" },
  "Wholeness of Body": { className: "Monk", max: modOf("wisdom"), recovery: "long" },
  "Flurry of Healing and Harm": { className: "Monk", max: modOf("wisdom"), recovery: "long" },
  "Dread Ambusher": { className: "Ranger", max: modOf("wisdom"), recovery: "long" },
  Tireless: { className: "Ranger", max: modOf("wisdom"), recovery: "long" },
  "Nature's Veil": { className: "Ranger", max: modOf("wisdom"), recovery: "long" },
  "Misty Wanderer": { className: "Ranger", max: modOf("wisdom"), recovery: "long" },
  "Glorious Defense": { className: "Paladin", max: modOf("charisma"), recovery: "long" },
  "Restore Balance": { className: "Sorcerer", max: modOf("charisma"), recovery: "long" },
  "Steps of the Fey": { className: "Warlock", max: modOf("charisma"), recovery: "long" },
  "Dark One's Own Luck": { className: "Warlock", max: modOf("charisma"), recovery: "long" },
  // Riserve: punti ferita o dadi.
  "Lay on Hands": { className: "Paladin", max: (level) => 5 * level, recovery: "long" },
  "Warrior of the Gods": { className: "Barbarian", max: (level) => level >= 17 ? 7 : level >= 12 ? 6 : level >= 6 ? 5 : 4, recovery: "long", dice: () => 12 },
  "Healing Light": { className: "Warlock", max: (level) => 1 + level, recovery: "long", dice: () => 6 },
  "Combat Superiority": { className: "Fighter", max: (level) => level >= 15 ? 6 : level >= 7 ? 5 : 4, recovery: "short", dice: (level) => level >= 18 ? 12 : level >= 10 ? 10 : 8 },
};

export const FEATURE_USE_NAMES = Object.keys(FEATURE_USES);

function syncFeatureUses(sheet: CharacterSheet, counters: ResourceCounter[]) {
  for (const [feature, rule] of Object.entries(FEATURE_USES)) {
    const owner = sheet.traits.find((item) => item.name === feature);
    if (!owner) continue;
    const level = classLevel(sheet, rule.className);
    const max = rule.max(level, sheet);
    const recovery = typeof rule.recovery === "function" ? rule.recovery(sheet) : rule.recovery;
    const name = rule.dice ? `${feature} (d${rule.dice(level)})` : feature;
    // Si adotta il contatore creato a mano dal tratto ("Crea risorsa") o con lo stesso nome.
    const existing = counters.find((counter) => counter.featureUse === feature)
      ?? counters.find((counter) => !counter.classResource && !counter.featureUse && (counter.traitId === owner.id || counter.name.trim().toLowerCase().startsWith(feature.toLowerCase())));
    if (!existing) { counters.push({ id: crypto.randomUUID(), name, current: max, max, recovery, ...rule.shortRestGain ? { shortRestGain: rule.shortRestGain } : {}, featureUse: feature }); continue; }
    const gained = Math.max(0, max - existing.max);
    // Il nome messo dall'app segue il dado (es. "Combat Superiority (d10)"); uno scritto a mano resta.
    const autoName = existing.featureUse === feature && (existing.name === feature || existing.name.startsWith(`${feature} (d`));
    Object.assign(existing, { max, recovery, featureUse: feature, name: autoName ? name : existing.name, current: Math.min(max, existing.current + gained) });
  }
}

// Crea o aggiorna risorse e azioni di classe; un massimo più alto dà subito gli usi in più.
export function syncClassResources(sheet: CharacterSheet) {
  syncMartialArts(sheet);
  syncUnarmoredMovement(sheet);
  const counters = sheet.counters ?? [];
  for (const resource of wanted(sheet)) {
    // Una risorsa già creata a mano con un nome riconoscibile si adotta, col suo nome.
    const existing = counters.find((counter) => counter.classResource === resource.classResource) ?? counters.find((counter) => !counter.classResource && ADOPT[resource.classResource].test(counter.name.trim()));
    if (!existing) { counters.push({ id: crypto.randomUUID(), current: resource.max, ...resource }); continue; }
    const gained = Math.max(0, resource.max - existing.max);
    const name = AUTO_NAME[resource.classResource].test(existing.name) ? resource.name : existing.name;
    Object.assign(existing, resource, { name, current: Math.min(resource.max, existing.current + gained) });
  }
  syncFeatureUses(sheet, counters);
  sheet.counters = counters;
}

// Attivare l'Ira consuma un uso: false se non ne restavano (l'effetto si accende lo stesso).
export function spendRage(sheet: CharacterSheet): boolean {
  const counter = sheet.counters?.find((item) => item.classResource === "rage");
  if (!counter) return true;
  if (counter.current <= 0) return false;
  counter.current -= 1;
  return true;
}
