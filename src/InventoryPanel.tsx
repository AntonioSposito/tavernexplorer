import { useState } from "react";
import { CatalogDialog } from "./CatalogDialog";
import { loadItems } from "./fivetoolsApi";
import type { FiveToolsItem } from "./import5etools";
import { ChatIcon, EditIcon, ImportIcon } from "./icons";
import { ModifierEditor } from "./ModifierEditor";
import { storage } from "./storage";
import { modifierTags } from "./effects";
import { actionFromItem, itemModifierList, modifiersFromText, parseItemModifiers } from "./itemModifiers";
import type { ActionEntry, CharacterSheet, InventoryEntry, RollCard, StatModifier } from "./types";
import { Button, Card, Dialog, Input, Textarea } from "./ui";

// I pesi restano salvati in libbre (come Roll20 e 5e.tools); si mostrano e si scrivono in kg
// con la conversione dei manuali italiani, 1 lb = 0,5 kg.
const toKg = (lb: number) => lb / 2;
const toLb = (kg: number) => kg * 2;
const kgText = (lb: number) => toKg(lb).toLocaleString("it-IT", { maximumFractionDigits: 2 });
const lbText = (lb: number) => `${lb.toLocaleString("it-IT", { maximumFractionDigits: 2 })} lb`;

// Modificatori visibili nella riga, senza aprirla.
const itemTags = (item: InventoryEntry) => modifierTags(itemModifierList(item));

type Draft = { id: string | null; name: string; count: string; weight: string; equipped: boolean; properties: string; modifiers: StatModifier[]; unknown: string; description: string };

const COINS = ["cp", "sp", "ep", "gp", "pp"];
const COIN_LABELS: Record<string, string> = { cp: "Rame", sp: "Argento", ep: "Electrum", gp: "Oro", pp: "Platino" };
const optionalNumber = (value: string) => value.trim() === "" ? null : Number(value) || 0;
const draftOf = (item: InventoryEntry | null): Draft => item
  ? { id: item.id, name: item.name, count: item.count == null ? "" : String(item.count), weight: item.weight == null ? "" : String(toKg(item.weight)), equipped: item.equipped, modifiers: [...item.modifiers ?? [], ...modifiersFromText(item.modifiersText)], unknown: parseItemModifiers(item.modifiersText).unknown.join(", "), properties: item.properties ?? "", description: item.description ?? "" }
  : { id: null, name: "", count: "1", weight: "", equipped: false, properties: "", modifiers: [], unknown: "", description: "" };

export function InventoryPanel({ sheet, onUpdate, onShare, onCreateAction, editable }: { sheet: CharacterSheet; onUpdate: (update: (sheet: CharacterSheet) => CharacterSheet) => void; onShare: (entry: ActionEntry, card?: RollCard) => void; onCreateAction: (action: ActionEntry) => void; editable: boolean }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  // Ricerca 5e.tools aperta sopra il form "Nuovo oggetto" (il form resta in draft, nascosto).
  const [picking, setPicking] = useState(false);
  const [catalog, setCatalog] = useState<FiveToolsItem[] | string | null>(null);
  const openCatalog = () => { setPicking(true); if (!Array.isArray(catalog)) { setCatalog(null); loadItems().then(setCatalog, (error: unknown) => setCatalog(error instanceof Error ? error.message : "Catalogo non disponibile")); } };
  const pick = (id: string) => {
    const found = Array.isArray(catalog) ? catalog.find((entry) => entry.id === id) : undefined;
    if (found && draft) setDraft({ ...draft, name: found.item.name, weight: found.item.weight == null ? "" : String(toKg(found.item.weight)), properties: found.item.properties ?? "", modifiers: modifiersFromText(found.item.modifiersText), unknown: parseItemModifiers(found.item.modifiersText).unknown.join(", "), description: found.item.description ?? "" });
    setPicking(false);
  };
  const [reordering, setReordering] = useState(false);
  const [equippedFirst, setEquippedFirst] = useState(storage.equippedFirst.get);
  const toggleEquippedFirst = (value: boolean) => { setEquippedFirst(value); storage.equippedFirst.set(value); };
  const moveItem = (index: number, offset: number) => onUpdate((next) => { const [item] = next.inventory.splice(index, 1); next.inventory.splice(index + offset, 0, item); return next; });
  // sort è stabile: tra equipaggiati e non resta l'ordine salvato.
  const shown = equippedFirst ? [...sheet.inventory].sort((a, b) => Number(b.equipped) - Number(a.equipped)) : sheet.inventory;
  // Carico 2024: Forza × 15 lb (× 7,5 kg). Gli oggetti senza quantità contano come uno.
  const options = sheet.options ?? {};
  const load = sheet.inventory.filter((item) => item.equipped || !options.ignoreUnequippedWeight).reduce((total, item) => total + (item.weight ?? 0) * (item.count ?? 1), 0);
  const strength = sheet.abilities.strength?.score ?? 10;
  const capacity = strength * 15 * (options.carryMultiplier ?? 1);
  // Variante 2014: ingombrato oltre Forza × 5 lb, pesantemente oltre × 10 (moltiplicate come la capacità).
  const encumbered = options.encumbrance === "variant" ? load > strength * 10 * (options.carryMultiplier ?? 1) ? "Pesantemente ingombrato" : load > strength * 5 * (options.carryMultiplier ?? 1) ? "Ingombrato" : "" : "";
  const patch = (id: string, change: (item: InventoryEntry) => void) => onUpdate((next) => { const found = next.inventory.find((entry) => entry.id === id); if (found) change(found); return next; });
  const save = () => {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) return;
    const fields = { name, count: optionalNumber(draft.count), weight: draft.weight.trim() === "" ? null : toLb(Number(draft.weight) || 0), equipped: draft.equipped, modifiers: draft.modifiers.length ? draft.modifiers : undefined, properties: draft.properties.trim() || undefined, modifiersText: draft.unknown || undefined, description: draft.description.trim() || undefined };
    onUpdate((next) => {
      next.inventory = draft.id ? next.inventory.map((item) => item.id === draft.id ? { ...item, ...fields } : item) : [...next.inventory, { id: crypto.randomUUID(), ...fields }];
      return next;
    });
    setDraft(null);
  };
  const remove = (id: string) => { onUpdate((next) => { next.inventory = next.inventory.filter((item) => item.id !== id); return next; }); setDraft(null); };
  const share = (item: InventoryEntry) => {
    const stats = [item.count != null && { label: "Quantità", value: String(item.count) }, item.weight != null && { label: "Peso", value: `${kgText(item.weight)} kg (${lbText(item.weight)})` }, item.properties && { label: "Proprietà", value: item.properties }, itemTags(item).length > 0 && { label: "Modificatori", value: itemTags(item).join(", ") }].filter((stat) => !!stat);
    onShare({ id: item.id, name: item.name, description: item.description }, { name: item.name, subtitle: item.equipped ? "Equipaggiato" : undefined, rolls: [], stats, note: item.description });
  };
  const stop = (action: () => void) => (event: { preventDefault: () => void }) => { event.preventDefault(); action(); };

  return <div className="stack">
    <section className="paper coin-row">{COINS.map((key) => <label key={key} className={`coin coin-${key}`}><span>{COIN_LABELS[key]}</span>{editable
      ? <input type="number" min="0" aria-label={`Monete ${COIN_LABELS[key]}`} value={sheet.currency[key] ?? 0} onChange={(event) => onUpdate((next) => { next.currency = { ...next.currency, [key]: Math.max(0, Math.trunc(Number(event.target.value)) || 0) }; return next; })}/>
      : <strong>{sheet.currency[key] ?? 0}</strong>}</label>)}</section>
    <Card className="resource-panel inventory-panel"><div className="editor-heading"><h2>Zaino</h2>{options.encumbrance !== "off" && <small className={load > capacity || encumbered ? "inventory-over" : undefined} title={`${lbText(load)} / ${lbText(capacity)}`}>Carico {kgText(load)} / {kgText(capacity)} kg{encumbered && ` · ${encumbered}`}</small>}</div>
      {editable && <div className="library-actions">{!reordering && <Button onClick={() => setDraft(draftOf(null))}>+ Nuovo oggetto</Button>}{sheet.inventory.length > 1 && <Button variant={reordering ? "default" : "outline"} onClick={() => setReordering(!reordering)}>{reordering ? "Fine" : "Modifica ordine"}</Button>}</div>}
      {!reordering && sheet.inventory.length > 1 && <label className="action-form-check"><input type="checkbox" checked={equippedFirst} onChange={(event) => toggleEquippedFirst(event.target.checked)}/> Equipaggiati in cima</label>}
      {reordering ? <ol className="order-list">{sheet.inventory.map((item, index) => <li key={item.id}><span>{item.name}</span><Button variant="outline" aria-label={`Sposta su ${item.name}`} disabled={index === 0} onClick={() => moveItem(index, -1)}>↑</Button><Button variant="outline" aria-label={`Sposta giù ${item.name}`} disabled={index === sheet.inventory.length - 1} onClick={() => moveItem(index, 1)}>↓</Button></li>)}</ol> : <>
      {sheet.inventory.length > 0 && <div className="inventory-head" aria-hidden="true"><span>Equip.</span><span>Qtà</span><span>Nome</span><span>Peso (kg)</span></div>}
      {shown.map((item) => <details key={item.id} className="inventory-item"><summary>
        <input type="checkbox" aria-label={`Equipaggiato ${item.name}`} checked={item.equipped} disabled={!editable} onChange={(event) => patch(item.id, (found) => { found.equipped = event.target.checked; })}/>
        {editable ? <input className="inventory-qty" type="number" min="0" aria-label={`Quantità ${item.name}`} value={item.count ?? ""} onChange={(event) => patch(item.id, (found) => { found.count = optionalNumber(event.target.value); })}/> : <span className="inventory-qty">{item.count ?? "—"}</span>}
        <span className="inventory-name"><strong>{item.name}</strong>{itemTags(item).length > 0 && <small className="inventory-mods">{itemTags(item).map((tag) => <span key={tag}>{tag}</span>)}</small>}</span>
        <span className="inventory-weight" title={item.weight != null ? lbText(item.weight) : undefined}>{item.weight != null ? kgText(item.weight) : "-"}</span>
        <span className="entry-icons">
          <button aria-label={`Mostra in chat ${item.name}`} title="Mostra in chat" onClick={stop(() => share(item))}><ChatIcon/></button>
          {editable && <button aria-label={`Modifica ${item.name}`} title="Modifica" onClick={stop(() => setDraft(draftOf(item)))}><EditIcon/></button>}
        </span>
      </summary>
        <div className="inventory-body">
          {item.properties && <p className="entry-meta">Proprietà: {item.properties}</p>}
          {parseItemModifiers(item.modifiersText).unknown.length > 0 && <p className="entry-meta inventory-over">Non applicati: {parseItemModifiers(item.modifiersText).unknown.join(", ")}</p>}
          <p>{item.description || "Nessuna descrizione."}</p>
          {editable && <div className="library-actions"><Button variant="outline" onClick={() => onCreateAction(actionFromItem(item, sheet))}>Crea azione</Button></div>}
        </div>
      </details>)}
      </>}
      {!sheet.inventory.length && <p className="muted">Lo zaino è vuoto.</p>}
    </Card>
    <CatalogDialog open={picking} title="Importa da 5e.tools" description={catalog === null ? "Caricamento da 5e.tools…" : typeof catalog === "string" ? catalog : `${catalog.length} oggetti · edizione 2024, poi 2014`} items={Array.isArray(catalog) ? catalog.map((entry) => ({ id: entry.id, label: entry.name, detail: entry.detail })) : []} selectedId="" onSelect={pick} onClose={() => setPicking(false)}/>
    <Dialog open={draft !== null && !picking} title={draft?.id ? "Modifica oggetto" : "Nuovo oggetto"} onClose={() => setDraft(null)}>{draft && <form className="action-form" onSubmit={(event) => { event.preventDefault(); save(); }}>
      {!draft.id && <Button type="button" variant="outline" className="import-5etools" onClick={openCatalog}><ImportIcon/> Importa da 5e.tools</Button>}
      <label><span>Nome</span><Input aria-label="Nome oggetto" value={draft.name} autoFocus onChange={(event) => setDraft({ ...draft, name: event.target.value })}/></label>
      <div className="action-form-row">
        <label><span>Quantità</span><Input aria-label="Quantità oggetto" type="number" min="0" value={draft.count} onChange={(event) => setDraft({ ...draft, count: event.target.value })}/></label>
        <label><span>Peso (kg){draft.weight.trim() !== "" && <small className="muted"> = {lbText(toLb(Number(draft.weight) || 0))}</small>}</span><Input aria-label="Peso oggetto" type="number" min="0" step="any" value={draft.weight} onChange={(event) => setDraft({ ...draft, weight: event.target.value })}/></label>
      </div>
      <label className="action-form-check"><input type="checkbox" checked={draft.equipped} onChange={(event) => setDraft({ ...draft, equipped: event.target.checked })}/> Equipaggiato</label>
      <label><span>Proprietà</span><Input aria-label="Proprietà oggetto" value={draft.properties} placeholder="Finesse, Leggera…" onChange={(event) => setDraft({ ...draft, properties: event.target.value })}/></label>
      <div className="item-modifiers"><span>Modificatori (applicati se equipaggiato)</span><ModifierEditor modifiers={draft.modifiers} onChange={(modifiers) => setDraft({ ...draft, modifiers })}/></div>
      {draft.unknown && <p className="entry-meta inventory-over">Testo Roll20 non riconosciuto: {draft.unknown} <Button type="button" variant="ghost" aria-label="Scarta testo non riconosciuto" onClick={() => setDraft({ ...draft, unknown: "" })}>×</Button></p>}
      <label><span>Descrizione</span><Textarea aria-label="Descrizione oggetto" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })}/></label>
      <div className="action-form-buttons">{draft.id && <Button type="button" variant="destructive" onClick={() => remove(draft.id!)}>Elimina</Button>}<Button type="button" variant="secondary" onClick={() => setDraft(null)}>Annulla</Button><Button type="submit" disabled={!draft.name.trim()}>Salva</Button></div>
    </form>}</Dialog>
  </div>;
}
