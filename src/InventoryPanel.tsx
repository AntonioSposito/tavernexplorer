import { useState } from "react";
import { ChatIcon, EditIcon } from "./icons";
import type { ActionEntry, CharacterSheet, InventoryEntry, RollCard } from "./types";
import { Button, Card, Dialog, Input, Textarea } from "./ui";

type Draft = { id: string | null; name: string; count: string; weight: string; equipped: boolean; properties: string; modifiersText: string; description: string };

const signed = (value: number) => `${value >= 0 ? "+" : ""}${value}`;
const optionalNumber = (value: string) => value.trim() === "" ? null : Number(value) || 0;
const draftOf = (item: InventoryEntry | null): Draft => item
  ? { id: item.id, name: item.name, count: item.count == null ? "" : String(item.count), weight: item.weight == null ? "" : String(item.weight), equipped: item.equipped, properties: item.properties ?? "", modifiersText: item.modifiersText ?? "", description: item.description ?? "" }
  : { id: null, name: "", count: "1", weight: "", equipped: false, properties: "", modifiersText: "", description: "" };

export function InventoryPanel({ sheet, onUpdate, onShare, editable }: { sheet: CharacterSheet; onUpdate: (update: (sheet: CharacterSheet) => CharacterSheet) => void; onShare: (entry: ActionEntry, card?: RollCard) => void; editable: boolean }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const patch = (id: string, change: (item: InventoryEntry) => void) => onUpdate((next) => { const found = next.inventory.find((entry) => entry.id === id); if (found) change(found); return next; });
  const save = () => {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) return;
    const fields = { name, count: optionalNumber(draft.count), weight: optionalNumber(draft.weight), equipped: draft.equipped, properties: draft.properties.trim() || undefined, modifiersText: draft.modifiersText.trim() || undefined, description: draft.description.trim() || undefined };
    onUpdate((next) => {
      // I modificatori strutturati (StatModifier) restano quelli dell'oggetto: il form non li tocca.
      next.inventory = draft.id ? next.inventory.map((item) => item.id === draft.id ? { ...item, ...fields } : item) : [...next.inventory, { id: crypto.randomUUID(), ...fields }];
      return next;
    });
    setDraft(null);
  };
  const remove = (id: string) => { onUpdate((next) => { next.inventory = next.inventory.filter((item) => item.id !== id); return next; }); setDraft(null); };
  const share = (item: InventoryEntry) => {
    const stats = [item.count != null && { label: "Quantità", value: String(item.count) }, item.weight != null && { label: "Peso", value: String(item.weight) }, item.properties && { label: "Proprietà", value: item.properties }, item.modifiersText && { label: "Modificatori", value: item.modifiersText }].filter((stat) => !!stat);
    onShare({ id: item.id, name: item.name, description: item.description }, { name: item.name, subtitle: item.equipped ? "Equipaggiato" : undefined, rolls: [], stats, note: item.description });
  };
  const stop = (action: () => void) => (event: { preventDefault: () => void }) => { event.preventDefault(); action(); };

  return <div className="stack">
    <section className="paper currency">{Object.entries(sheet.currency).map(([key, value]) => <span key={key}><strong>{value ?? 0}</strong>{key.toUpperCase()}</span>)}</section>
    <Card className="resource-panel inventory-panel"><div className="editor-heading"><h2>Zaino</h2></div>
      {editable && <div className="library-actions"><Button onClick={() => setDraft(draftOf(null))}>+ Nuovo oggetto</Button></div>}
      {sheet.inventory.length > 0 && <div className="inventory-head" aria-hidden="true"><span>Equip.</span><span>Qtà</span><span>Nome</span><span>Peso</span></div>}
      {sheet.inventory.map((item) => <details key={item.id} className="inventory-item"><summary>
        <input type="checkbox" aria-label={`Equipaggiato ${item.name}`} checked={item.equipped} disabled={!editable} onChange={(event) => patch(item.id, (found) => { found.equipped = event.target.checked; })}/>
        {editable ? <input className="inventory-qty" type="number" min="0" aria-label={`Quantità ${item.name}`} value={item.count ?? ""} onChange={(event) => patch(item.id, (found) => { found.count = optionalNumber(event.target.value); })}/> : <span className="inventory-qty">{item.count ?? "—"}</span>}
        <strong>{item.name}</strong>
        <span className="inventory-weight">{item.weight ?? ""}</span>
        <span className="entry-icons">
          <button aria-label={`Mostra in chat ${item.name}`} title="Mostra in chat" onClick={stop(() => share(item))}><ChatIcon/></button>
          {editable && <button aria-label={`Modifica ${item.name}`} title="Modifica" onClick={stop(() => setDraft(draftOf(item)))}><EditIcon/></button>}
        </span>
      </summary>
        <div className="inventory-body">
          {(item.properties || item.modifiersText) && <p className="entry-meta">{[item.properties && `Proprietà: ${item.properties}`, item.modifiersText && `Modificatori: ${item.modifiersText}`].filter(Boolean).join(" · ")}</p>}
          {item.modifiers?.length ? <p className="entry-meta">{item.modifiers.map((modifier) => `${modifier.target} ${signed(modifier.amount)}`).join(" · ")}</p> : null}
          <p>{item.description || "Nessuna descrizione."}</p>
        </div>
      </details>)}
      {!sheet.inventory.length && <p className="muted">Lo zaino è vuoto.</p>}
    </Card>
    <Dialog open={draft !== null} title={draft?.id ? "Modifica oggetto" : "Nuovo oggetto"} onClose={() => setDraft(null)}>{draft && <form className="action-form" onSubmit={(event) => { event.preventDefault(); save(); }}>
      <label><span>Nome</span><Input aria-label="Nome oggetto" value={draft.name} autoFocus onChange={(event) => setDraft({ ...draft, name: event.target.value })}/></label>
      <div className="action-form-row">
        <label><span>Quantità</span><Input aria-label="Quantità oggetto" type="number" min="0" value={draft.count} onChange={(event) => setDraft({ ...draft, count: event.target.value })}/></label>
        <label><span>Peso</span><Input aria-label="Peso oggetto" type="number" min="0" step="any" value={draft.weight} onChange={(event) => setDraft({ ...draft, weight: event.target.value })}/></label>
      </div>
      <label className="action-form-check"><input type="checkbox" checked={draft.equipped} onChange={(event) => setDraft({ ...draft, equipped: event.target.checked })}/> Equipaggiato</label>
      <label><span>Proprietà</span><Input aria-label="Proprietà oggetto" value={draft.properties} placeholder="Finesse, Leggera…" onChange={(event) => setDraft({ ...draft, properties: event.target.value })}/></label>
      <label><span>Modificatori</span><Input aria-label="Modificatori oggetto" value={draft.modifiersText} placeholder="AC +1, Strength +2…" onChange={(event) => setDraft({ ...draft, modifiersText: event.target.value })}/></label>
      <label><span>Descrizione</span><Textarea aria-label="Descrizione oggetto" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })}/></label>
      <div className="action-form-buttons">{draft.id && <Button type="button" variant="destructive" onClick={() => remove(draft.id!)}>Elimina</Button>}<Button type="button" variant="secondary" onClick={() => setDraft(null)}>Annulla</Button><Button type="submit" disabled={!draft.name.trim()}>Salva</Button></div>
    </form>}</Dialog>
  </div>;
}
