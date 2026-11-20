import type { CharacterSheet, ResourceCounter } from "./types";

// Risorse e azioni di classe tenute allineate al livello e alle caratteristiche: si creano alla prima occasione e poi si aggiornano.
// Il contatore resta modificabile a mano; al prossimo aggiornamento torna ai valori di classe.
export type ClassResource = "rage" | "bardic";

const classLevel = (sheet: CharacterSheet, name: string) => sheet.classes?.find((entry) => entry.name === name)?.level ?? (sheet.identity.className === name ? sheet.identity.level : 0);
// Dado di un privilegio che cresce a certi livelli: [livello minimo, facce], dal più alto.
const dieAt = (level: number, steps: Array<[number, number]>) => steps.find(([min]) => level >= min)?.[1] ?? steps.at(-1)![1];

// Ira (2024): usi per livello da barbaro; tutti col riposo lungo, uno col riposo breve.
export const rageUses = (level: number) => level >= 17 ? 6 : level >= 12 ? 5 : level >= 6 ? 4 : level >= 3 ? 3 : 2;
// Ispirazione bardica: dado per livello da bardo.
export const bardicDie = (level: number) => dieAt(level, [[15, 12], [10, 10], [5, 8], [1, 6]]);

function wanted(sheet: CharacterSheet): Array<Omit<ResourceCounter, "id" | "current"> & { classResource: ClassResource }> {
  const barbarian = classLevel(sheet, "Barbarian");
  const bard = classLevel(sheet, "Bard");
  return [
    ...barbarian ? [{ name: "Ira", max: rageUses(barbarian), recovery: "long" as const, shortRestGain: 1, classResource: "rage" as const }] : [],
    // Dal 5° (Font of Inspiration) si recupera anche col riposo breve.
    ...bard ? [{ name: `Ispirazione bardica (d${bardicDie(bard)})`, max: Math.max(1, sheet.abilities.charisma?.mod ?? 0), recovery: bard >= 5 ? "short" as const : "long" as const, classResource: "bardic" as const }] : [],
  ];
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
const ADOPT: Record<ClassResource, RegExp> = { rage: /^(ira|rage)\b/i, bardic: /^(bardic inspiration|ispirazione bardica)/i };
const AUTO_NAME: Record<ClassResource, RegExp> = { rage: /^Ira$/, bardic: /^Ispirazione bardica \(d\d+\)$/ };

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
