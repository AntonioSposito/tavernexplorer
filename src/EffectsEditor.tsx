import { useState } from "react";
import { CONCENTRATION, CONDITIONS, conditionRule, effectRule } from "./conditions";
import { modifierTags } from "./effects";
import { ChatIcon, EditIcon } from "./icons";
import { ModifierEditor } from "./ModifierEditor";
import type { ActionEntry, CharacterEffect, CharacterSheet, RollCard } from "./types";
import { Button, Card, Dialog, Input, Textarea } from "./ui";

type EffectsUpdate = (update: (effects: CharacterEffect[]) => CharacterEffect[]) => void;
export type ShareEffect = (entry: ActionEntry, card: RollCard) => void;

// Scegliendo una condizione (o la concentrazione) la descrizione diventa la sua regola; un testo scritto a mano non si tocca.
const describe = (effect: CharacterEffect, name: string) => effectRule(name) ?? (effect.description === effectRule(effect.name) ? undefined : effect.description);

function shareEffect(effect: CharacterEffect, onShare: ShareEffect) {
  const stats = [effect.remainingRounds != null && { label: "Round rimasti", value: String(effect.remainingRounds) }, effect.modifiers.length > 0 && { label: "Modificatori", value: modifierTags(effect.modifiers).join(", ") }].filter((stat) => !!stat);
  onShare({ id: effect.id, name: effect.name, description: effect.description }, { name: effect.name, subtitle: conditionRule(effect.name) ? "Condizione" : "Effetto", rolls: [], stats, note: effect.description });
}

// Lista di effetti (buff, debuff, condizioni) con lo stesso popup ovunque: scheda del PG e voce dei turni di un token.
// round: round attuale del turn order; un effetto aggiunto ora non scende già al turno di questo round.
export function EffectList({ effects, editable, onChange, onShare, round }: { effects: CharacterEffect[]; editable: boolean; onChange: EffectsUpdate; onShare: ShareEffect; round?: number }) {
  // Copia modificata nel popup; isNew finché non viene salvata la prima volta.
  const [draft, setDraft] = useState<{ effect: CharacterEffect; isNew: boolean } | null>(null);
  const save = () => {
    if (!draft) return;
    const effect = { ...draft.effect, name: draft.effect.name.trim() || "Effetto senza nome", ...draft.isNew && round != null ? { lastTickRound: round } : {} };
    onChange((list) => draft.isNew ? [...list, effect] : list.map((item) => item.id === effect.id ? effect : item));
    setDraft(null);
  };
  const remove = (id: string) => { onChange((list) => list.filter((item) => item.id !== id)); setDraft(null); };
  return <>
    {editable && <Button onClick={() => setDraft({ effect: { id: crypto.randomUUID(), name: "", active: true, modifiers: [] }, isNew: true })}>Aggiungi</Button>}
    {effects.length === 0 && <small className="effect-note">Nessun effetto.</small>}
    {effects.map((effect) => <div className="effect-card effect-row" key={effect.id}>
      <label><input type="checkbox" checked={effect.active} disabled={!editable} onChange={(event) => { const active = event.target.checked; onChange((list) => list.map((item) => item.id === effect.id ? { ...item, active } : item)); }}/> <strong>{effect.name}</strong></label>
      <small>{[effect.modifiers.length > 0 && `${effect.modifiers.length} modificatori`, effect.remainingRounds != null && `${effect.remainingRounds} round`].filter(Boolean).join(" · ")}</small>
      <span className="entry-icons">
        <button aria-label={`Mostra in chat ${effect.name}`} title="Mostra in chat" onClick={() => shareEffect(effect, onShare)}><ChatIcon/></button>
        {editable && <button aria-label={`Modifica ${effect.name}`} title="Modifica" onClick={() => setDraft({ effect: structuredClone(effect), isNew: false })}><EditIcon/></button>}
      </span>
    </div>)}
    <Dialog open={draft !== null} title={draft?.isNew ? "Nuovo effetto" : "Modifica effetto"} onClose={() => setDraft(null)}>{draft && <div className="action-form">
      <label><span>Nome</span><Input aria-label="Nome effetto" list="effect-conditions" value={draft.effect.name} autoFocus placeholder="Bless, Poisoned…" onChange={(event) => setDraft({ ...draft, effect: { ...draft.effect, name: event.target.value, description: describe(draft.effect, event.target.value) } })}/></label>
      <datalist id="effect-conditions">{CONDITIONS.map((condition) => <option key={condition.name} value={condition.name}/>)}<option value={CONCENTRATION}/></datalist>
      <label><span>Descrizione</span><Textarea aria-label="Descrizione effetto" value={draft.effect.description ?? ""} onChange={(event) => setDraft({ ...draft, effect: { ...draft.effect, description: event.target.value || undefined } })}/></label>
      <label><span>Round rimasti (vuoto = senza scadenza)</span><Input type="number" min="0" value={draft.effect.remainingRounds ?? ""} onChange={(event) => setDraft({ ...draft, effect: { ...draft.effect, remainingRounds: event.target.value === "" ? undefined : Math.max(0, Number(event.target.value) || 0) } })}/></label>
      <ModifierEditor modifiers={draft.effect.modifiers} onChange={(modifiers) => setDraft({ ...draft, effect: { ...draft.effect, modifiers } })}/>
      <div className="action-form-buttons">{!draft.isNew && <Button type="button" variant="destructive" onClick={() => remove(draft.effect.id)}>Elimina</Button>}<Button type="button" variant="secondary" onClick={() => setDraft(null)}>Annulla</Button><Button type="button" onClick={save}>Salva</Button></div>
    </div>}</Dialog>
  </>;
}

export function EffectsEditor({ sheet, onUpdate, onShare }: { sheet: CharacterSheet; onUpdate: (update: (sheet: CharacterSheet) => CharacterSheet) => void; onShare: ShareEffect }) {
  return <Card><div className="editor-heading"><h2>Effetti e condizioni</h2></div><p className="effect-note">Buff, debuff e condizioni. I modificatori attivi si sommano ai valori di base e ai tiri; un valore negativo è un debuff. I round rimasti scendono a ogni turno del personaggio nel turn order; a zero l'effetto si spegne.</p>
    <div className="effects-list"><EffectList effects={sheet.effects ?? []} editable onShare={onShare} onChange={(update) => onUpdate((next) => { next.effects = update(next.effects ?? []); return next; })}/></div>
  </Card>;
}
