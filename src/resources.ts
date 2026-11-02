import type { CharacterSheet, InventoryEntry, ResourceCounter, TraitEntry } from "./types";

// Risorse collegate a un oggetto dello zaino: la quantità dell'oggetto è il valore attuale,
// counter.current ne tiene una copia (limitata al massimo) per quando il collegamento si perde.
export const linkedItem = (sheet: CharacterSheet, counter: ResourceCounter) => counter.itemId ? sheet.inventory.find((item) => item.id === counter.itemId) : undefined;

export function counterCurrent(sheet: CharacterSheet, counter: ResourceCounter): number {
  const item = linkedItem(sheet, counter);
  return item ? item.count ?? 0 : counter.current;
}

// Scrive il valore sulla risorsa e sull'oggetto collegato. L'oggetto può superare il massimo (es. frecce comprate).
export function setCounterCurrent(sheet: CharacterSheet, id: string, value: number): CharacterSheet {
  const counter = sheet.counters?.find((item) => item.id === id);
  if (!counter) return sheet;
  const amount = Math.max(0, Math.floor(value));
  const item = linkedItem(sheet, counter);
  if (item) item.count = amount;
  counter.current = Math.min(counter.max, amount);
  return sheet;
}

// Prima di un riposo: la copia segue la quantità dell'oggetto. Dopo: una risorsa ripristinata riporta l'oggetto al massimo.
export function syncCountersFromItems(sheet: CharacterSheet) {
  for (const counter of sheet.counters ?? []) { const item = linkedItem(sheet, counter); if (item) counter.current = Math.min(counter.max, item.count ?? 0); }
}
export function syncItemsFromCounters(sheet: CharacterSheet) {
  for (const counter of sheet.counters ?? []) { const item = linkedItem(sheet, counter); if (item && (item.count ?? 0) < counter.current) item.count = counter.current; }
}

// Eliminando l'oggetto o il tratto la risorsa resta, scollegata, con l'ultima quantità.
export function unlinkCounters(sheet: CharacterSheet, field: "itemId" | "traitId", id: string) {
  for (const counter of sheet.counters ?? []) if (counter[field] === id) { counter.current = Math.min(counter.max, counterCurrent(sheet, counter)); delete counter[field]; }
}

// Una risorsa per azione: spuntarla qui la sposta da un'altra risorsa.
export function linkActions(sheet: CharacterSheet, counterId: string, actionIds: string[]) {
  for (const action of sheet.actions) {
    if (actionIds.includes(action.id)) action.resourceId = counterId;
    else if (action.resourceId === counterId) delete action.resourceId;
  }
}

export function deleteCounter(sheet: CharacterSheet, id: string): CharacterSheet {
  sheet.counters = (sheet.counters ?? []).filter((counter) => counter.id !== id);
  for (const action of sheet.actions) if (action.resourceId === id) delete action.resourceId;
  return sheet;
}

// Uso di un'azione collegata: scala 1 (anche dallo zaino); a 0 non cambia nulla.
export function spendCounter(sheet: CharacterSheet, id: string): CharacterSheet {
  const counter = sheet.counters?.find((item) => item.id === id);
  const current = counter ? counterCurrent(sheet, counter) : 0;
  return current > 0 ? setCounterCurrent(sheet, id, current - 1) : sheet;
}

export const counterForItem = (sheet: CharacterSheet, item: InventoryEntry) => sheet.counters?.find((counter) => counter.itemId === item.id);
export const counterForTrait = (sheet: CharacterSheet, trait: { id: string }) => sheet.counters?.find((counter) => counter.traitId === trait.id);

// Bozze per il popup "Nuova risorsa": entrano nella scheda solo al salvataggio.
export function counterFromItem(item: InventoryEntry): ResourceCounter {
  const max = Math.max(1, item.count ?? 1);
  return { id: crypto.randomUUID(), name: item.name, current: Math.min(max, item.count ?? 0), max, recovery: "none", itemId: item.id };
}
export function counterFromTrait(trait: Pick<TraitEntry, "id" | "name">): ResourceCounter {
  return { id: crypto.randomUUID(), name: trait.name, current: 1, max: 1, recovery: "long", traitId: trait.id };
}
