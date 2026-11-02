import { useState } from "react";
import { EditIcon } from "./icons";
import { ModifierEditor } from "./ModifierEditor";
import type { CharacterEffect, CharacterSheet } from "./types";
import { Button, Card, Dialog, Input } from "./ui";

export function EffectsEditor({ sheet, onUpdate }: { sheet: CharacterSheet; onUpdate: (update: (sheet: CharacterSheet) => CharacterSheet) => void }) {
  const effects = sheet.effects ?? [];
  // Copia modificata nel popup; isNew finché non viene salvata la prima volta.
  const [draft, setDraft] = useState<{ effect: CharacterEffect; isNew: boolean } | null>(null);
  const save = () => {
    if (!draft) return;
    const effect = { ...draft.effect, name: draft.effect.name.trim() || "Effetto senza nome" };
    onUpdate((next) => { const list = next.effects ?? []; next.effects = draft.isNew ? [...list, effect] : list.map((item) => item.id === effect.id ? effect : item); return next; });
    setDraft(null);
  };
  const remove = (id: string) => { onUpdate((next) => { next.effects = (next.effects ?? []).filter((item) => item.id !== id); return next; }); setDraft(null); };
  return <Card><div className="editor-heading"><h2>Buff e debuff</h2><Button onClick={() => setDraft({ effect: { id: crypto.randomUUID(), name: "", active: true, modifiers: [] }, isNew: true })}>Aggiungi</Button></div><p className="effect-note">I modificatori attivi si sommano ai valori di base e ai tiri. Un valore negativo è un debuff. Le durate sono gestite manualmente.</p>
    {effects.map((effect) => <div className="effect-card effect-row" key={effect.id}>
      <label><input type="checkbox" checked={effect.active} onChange={(event) => onUpdate((next) => { next.effects!.find((item) => item.id === effect.id)!.active = event.target.checked; return next; })}/> <strong>{effect.name}</strong></label>
      <small>{effect.modifiers.length} modificatori{effect.remainingRounds != null ? ` · ${effect.remainingRounds} round` : ""}</small>
      <span className="entry-icons"><button aria-label={`Modifica ${effect.name}`} title="Modifica" onClick={() => setDraft({ effect: structuredClone(effect), isNew: false })}><EditIcon/></button></span>
    </div>)}
    <Dialog open={draft !== null} title={draft?.isNew ? "Nuovo effetto" : "Modifica effetto"} onClose={() => setDraft(null)}>{draft && <div className="action-form">
      <label><span>Nome</span><Input aria-label="Nome effetto" value={draft.effect.name} autoFocus placeholder="Benedizione, Avvelenato…" onChange={(event) => setDraft({ ...draft, effect: { ...draft.effect, name: event.target.value } })}/></label>
      <label><span>Round rimasti (vuoto = senza scadenza)</span><Input type="number" min="0" value={draft.effect.remainingRounds ?? ""} onChange={(event) => setDraft({ ...draft, effect: { ...draft.effect, remainingRounds: event.target.value === "" ? undefined : Math.max(0, Number(event.target.value) || 0) } })}/></label>
      {/* div e non form: i pulsanti di ModifierEditor non hanno type="button". */}
      <ModifierEditor modifiers={draft.effect.modifiers} onChange={(modifiers) => setDraft({ ...draft, effect: { ...draft.effect, modifiers } })}/>
      <div className="action-form-buttons">{!draft.isNew && <Button type="button" variant="destructive" onClick={() => remove(draft.effect.id)}>Elimina</Button>}<Button type="button" variant="secondary" onClick={() => setDraft(null)}>Annulla</Button><Button type="button" onClick={save}>Salva</Button></div>
    </div>}</Dialog>
  </Card>;
}
