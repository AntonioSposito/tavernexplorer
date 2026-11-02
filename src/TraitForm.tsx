import { useState } from "react";
import { traitSource, traitSourceText } from "./importer";
import { ModifierEditor } from "./ModifierEditor";
import type { TraitEntry, TraitSource } from "./types";
import { Button, Input, Select, Textarea } from "./ui";

const SOURCES: TraitSource[] = ["Racial", "Class", "Feat", "Background", "Item", "Other"];

// I tratti salvati prima del form hanno solo il testo "tipo • source": lo si divide nei due campi.
function toDraft(trait: TraitEntry | null): TraitEntry {
  if (!trait) return { id: crypto.randomUUID(), name: "", description: "" };
  if (trait.sourceKind || trait.sourceType || !trait.source) return trait;
  const parts = trait.source.split("•").map((part) => part.trim());
  const kind = traitSource(parts.at(-1) ?? "");
  return { ...trait, sourceKind: kind, sourceType: (kind ? parts.slice(0, -1) : parts).join(" • ") || undefined };
}

// Form dei tratti come Roll20: NAME, SOURCE (Choose… + sei valori), SOURCE TYPE, più la descrizione.
export function TraitForm({ trait, onSave, onCancel, onDelete }: { trait: TraitEntry | null; onSave: (trait: TraitEntry) => void; onCancel: () => void; onDelete?: () => void }) {
  const [draft, setDraft] = useState(() => toDraft(trait));
  const save = () => {
    const name = draft.name.trim();
    if (!name) return;
    const sourceType = draft.sourceType?.trim() || undefined;
    onSave({ ...draft, name, sourceType, source: traitSourceText(draft.sourceKind, sourceType), modifiers: draft.modifiers?.length ? draft.modifiers : undefined });
  };
  return <form className="action-form" onSubmit={(event) => { event.preventDefault(); save(); }}>
    <label><span>Nome</span><Input aria-label="Nome tratto" value={draft.name} autoFocus onChange={(event) => setDraft({ ...draft, name: event.target.value })}/></label>
    <div className="action-form-row">
      <label><span>Source</span><Select aria-label="Source tratto" value={draft.sourceKind ?? ""} onChange={(event) => setDraft({ ...draft, sourceKind: (event.target.value || undefined) as TraitSource | undefined })}><option value="">Choose...</option>{SOURCES.map((source) => <option key={source} value={source}>{source}</option>)}</Select></label>
      <label><span>Source type</span><Input aria-label="Source type tratto" value={draft.sourceType ?? ""} placeholder="background, Wizard 2…" onChange={(event) => setDraft({ ...draft, sourceType: event.target.value })}/></label>
    </div>
    <div className="item-modifiers"><span>Modificatori (sempre attivi)</span><ModifierEditor modifiers={draft.modifiers ?? []} onChange={(modifiers) => setDraft({ ...draft, modifiers })}/></div>
    <label><span>Descrizione</span><Textarea aria-label="Descrizione tratto" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })}/></label>
    <div className="action-form-buttons">{onDelete && <Button type="button" variant="destructive" onClick={onDelete}>Elimina</Button>}<Button type="button" variant="secondary" onClick={onCancel}>Annulla</Button><Button type="submit" disabled={!draft.name.trim()}>Salva</Button></div>
  </form>;
}
