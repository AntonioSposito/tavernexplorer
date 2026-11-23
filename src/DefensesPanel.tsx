import { useState } from "react";
import { ChatIcon, EditIcon } from "./icons";
import type { ActionEntry, CharacterSheet, DefenseEntry, DefenseType, RollCard } from "./types";
import { Button, Card, Dialog, Input, Select } from "./ui";

type Draft = { id: string | null; name: string; type: DefenseType; meters: string };

// Ordine di visualizzazione. Sensi e velocità hanno la distanza in metri.
const TYPE_LABELS: Record<DefenseType, string> = {
  RESISTANCE: "Resistenze", IMMUNITY: "Immunità ai danni", VULNERABILITY: "Vulnerabilità", CONDITION: "Immunità alle condizioni", SENSE: "Sensi", SPEED: "Velocità speciali",
};
const hasMeters = (type: DefenseType) => type === "SENSE" || type === "SPEED";
const label = (entry: DefenseEntry) => entry.meters != null ? `${entry.name} ${entry.meters} m` : entry.name;

// Resistenze, immunità, sensi e velocità speciali del PG (Ira, specie, talenti…), come i campi dei mostri.
export function DefensesPanel({ sheet, onUpdate, onShare, editable }: { sheet: CharacterSheet; onUpdate: (update: (sheet: CharacterSheet) => CharacterSheet) => void; onShare: (entry: ActionEntry, card?: RollCard) => void; editable: boolean }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const defenses = sheet.defenses ?? [];
  const share = (entry: DefenseEntry) => onShare({ id: entry.id, name: label(entry), description: TYPE_LABELS[entry.type] }, { name: label(entry), subtitle: TYPE_LABELS[entry.type], rolls: [] });
  const remove = (id: string) => { onUpdate((next) => { next.defenses = (next.defenses ?? []).filter((entry) => entry.id !== id); return next; }); setDraft(null); };
  const save = () => {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) return;
    const meters = Number(draft.meters.replace(",", "."));
    const entry: DefenseEntry = { id: draft.id ?? crypto.randomUUID(), name, type: draft.type, ...hasMeters(draft.type) && draft.meters.trim() && Number.isFinite(meters) ? { meters } : {} };
    onUpdate((next) => {
      const current = next.defenses ?? [];
      next.defenses = current.some((item) => item.id === entry.id) ? current.map((item) => item.id === entry.id ? entry : item) : [...current, entry];
      return next;
    });
    setDraft(null);
  };

  return <Card className="resource-panel proficiencies defenses"><div className="editor-heading"><h2>Difese e sensi</h2></div>
    {editable && <div className="library-actions"><Button onClick={() => setDraft({ id: null, name: "", type: "RESISTANCE", meters: "" })}>+ Nuova difesa o senso</Button></div>}
    {defenses.length ? <dl>
      {(Object.keys(TYPE_LABELS) as DefenseType[]).map((type) => { const entries = defenses.filter((entry) => entry.type === type); return entries.length > 0 && <div key={type}><dt>{TYPE_LABELS[type]}</dt><dd><ul>{entries.map((entry) => <li key={entry.id}>
        <span>{label(entry)}</span>
        <span className="entry-icons">
          <button aria-label={`Mostra in chat ${entry.name}`} title="Mostra in chat" onClick={() => share(entry)}><ChatIcon/></button>
          {editable && <button aria-label={`Modifica ${entry.name}`} title="Modifica" onClick={() => setDraft({ id: entry.id, name: entry.name, type: entry.type, meters: entry.meters != null ? String(entry.meters) : "" })}><EditIcon/></button>}
        </span>
      </li>)}</ul></dd></div>; })}
    </dl> : <p className="muted">Nessuna resistenza, immunità o senso speciale.</p>}
    <Dialog open={draft !== null} title={draft?.id ? "Modifica difesa o senso" : "Nuova difesa o senso"} onClose={() => setDraft(null)}>{draft && <form className="action-form" onSubmit={(event) => { event.preventDefault(); save(); }}>
      <label><span>Nome</span><Input aria-label="Nome difesa" value={draft.name} autoFocus placeholder="Fuoco, Avvelenato, Scurovisione, Volo…" onChange={(event) => setDraft({ ...draft, name: event.target.value })}/></label>
      <label><span>Tipo</span><Select aria-label="Tipo difesa" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as DefenseType })}>{Object.entries(TYPE_LABELS).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</Select></label>
      {hasMeters(draft.type) && <label><span>Distanza (m)</span><Input aria-label="Distanza difesa" inputMode="decimal" value={draft.meters} placeholder="18" onChange={(event) => setDraft({ ...draft, meters: event.target.value })}/></label>}
      <div className="action-form-buttons">{draft.id && <Button type="button" variant="destructive" onClick={() => remove(draft.id!)}>Elimina</Button>}<Button type="button" variant="secondary" onClick={() => setDraft(null)}>Annulla</Button><Button type="submit" disabled={!draft.name.trim()}>Salva</Button></div>
    </form>}</Dialog>
  </Card>;
}
