import { useState, type FormEvent } from "react";
import { addTurnCondition, removeTurnCondition, replaceTurnEntries, setTurnInitiative } from "./turns";
import type { CharacterSheet, TurnEntry, TurnState } from "./types";

const CONDITION_SUGGESTIONS = ["Accecato", "Affascinato", "Afferrato", "Assordato", "Avvelenato", "Incapacitato", "Invisibile", "Paralizzato", "Pietrificato", "Prono", "Spaventato", "Stordito", "Trattenuto"];

function ConditionEditor({ entry, state, canManage, onChange, onRollInitiative }: { entry: TurnEntry; state: TurnState; canManage: boolean; onChange: (state: TurnState) => void; onRollInitiative: (entry: TurnEntry) => void }) {
  const [name, setName] = useState("");
  const [rounds, setRounds] = useState("");
  const conditions = entry.conditions ?? [];
  const add = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const remainingRounds = rounds ? Number(rounds) : undefined;
    if (remainingRounds !== undefined && (!Number.isInteger(remainingRounds) || remainingRounds < 1)) return;
    onChange(addTurnCondition(state, entry.id, { id: crypto.randomUUID(), name: trimmed, remainingRounds }));
    setName(""); setRounds("");
  };
  return <details className="turn-details"><summary>{conditions.length ? `${conditions.length} ${conditions.length === 1 ? "condizione" : "condizioni"}` : "Condizioni e iniziativa"}</summary>
    <div className="turn-condition-list">{conditions.map((condition) => <span className="turn-condition" key={condition.id}>{condition.name}{condition.remainingRounds != null && <small> · {condition.remainingRounds} round</small>}{canManage && <button aria-label={`Rimuovi ${condition.name}`} onClick={() => onChange(removeTurnCondition(state, entry.id, condition.id))}>×</button>}</span>)}{conditions.length === 0 && <small>Nessuna condizione attiva.</small>}</div>
    {canManage && <><form className="turn-condition-form" onSubmit={add}><input aria-label={`Condizione per ${entry.name}`} list="turn-condition-suggestions" value={name} onChange={(event) => setName(event.target.value)} placeholder="Condizione"/><input aria-label="Durata in round" type="number" min="1" max="99" value={rounds} onChange={(event) => setRounds(event.target.value)} placeholder="∞" title="Vuoto = fino alla rimozione manuale"/><button disabled={!name.trim()}>Aggiungi</button></form><div className="turn-initiative-roll"><label>Bonus iniziativa <input aria-label={`Bonus iniziativa di ${entry.name}`} type="number" value={entry.initiativeBonus ?? 0} onChange={(event) => onChange({ ...state, entries: state.entries.map((item) => item.id === entry.id ? { ...item, initiativeBonus: Number(event.target.value) || 0 } : item) })}/></label><button onClick={() => onRollInitiative(entry)}>Tira d20</button></div></>}
  </details>;
}

interface TurnOrderProps {
  state: TurnState;
  canManage: boolean;
  images: Record<string, string>;
  onChange: (state: TurnState) => void;
  onNext: () => void;
  onPrevious: () => void;
  onRollInitiative: (entry: TurnEntry) => void;
  onFocusToken?: (tokenId: string) => void;
  active: CharacterSheet | null;
  onAttach: () => void;
  onOpenForPlayers?: () => void;
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase()).join("");
}

export function TurnOrder({ state, canManage, images, onChange, onNext, onPrevious, onRollInitiative, onFocusToken, active, onAttach, onOpenForPlayers }: TurnOrderProps) {
  const [editing, setEditing] = useState(false);
  const remove = (entry: TurnEntry) => onChange(replaceTurnEntries(state, state.entries.filter((item) => item.id !== entry.id)));
  return <div className="turn-tracker">
    <header className="turn-tracker-head"><span>Round {state.round}</span><span>Partecipanti: {state.entries.length}</span></header>
    <datalist id="turn-condition-suggestions">{CONDITION_SUGGESTIONS.map((condition) => <option key={condition} value={condition}/>)}</datalist>
    <section className="turn-rows">
      {state.entries.length === 0 && <p className="turn-empty">Nessun partecipante. Seleziona un token sulla mappa e collegalo a una scheda.</p>}
      {state.entries.map((entry, index) => <article className={`turn-row ${index === state.activeIndex ? "current" : ""}`} key={entry.id} aria-current={index === state.activeIndex ? "true" : undefined}>
        <div className="turn-row-main">
          <span className="turn-avatar">
            {images[entry.id] ? <img src={images[entry.id]} alt=""/> : <span>{initials(entry.name)}</span>}
            {canManage && <button className="turn-remove" aria-label={`Rimuovi ${entry.name}`} title="Rimuovi dal turn order" onClick={() => remove(entry)}><span/></button>}
          </span>
          <div className="turn-name">
            {entry.tokenId && onFocusToken ? <button title="Evidenzia sulla mappa" onClick={() => { if (entry.tokenId) onFocusToken(entry.tokenId); }}>{entry.name}</button> : <strong>{entry.name}</strong>}
            {(entry.conditions?.length ?? 0) > 0 && <small>{entry.conditions?.map((condition) => condition.remainingRounds != null ? `${condition.name} (${condition.remainingRounds})` : condition.name).join(" · ")}</small>}
          </div>
          {editing && canManage ? <input className="turn-initiative-input" aria-label={`Iniziativa di ${entry.name}`} type="number" value={entry.initiative} onChange={(event) => onChange(setTurnInitiative(state, entry.id, Number(event.target.value) || 0))}/> : <strong className="turn-initiative">{entry.initiative}</strong>}
        </div>
        {editing && <ConditionEditor entry={entry} state={state} canManage={canManage} onChange={onChange} onRollInitiative={onRollInitiative}/>}
      </article>)}
    </section>
    {editing && canManage && <div className="turn-tools">
      {onOpenForPlayers && <button onClick={onOpenForPlayers}>Apri il turn order ai giocatori ↗</button>}
      <button onClick={onAttach} disabled={!active}>Collega scheda e token selezionato</button>
      <button aria-pressed={!state.hideTokenStats} onClick={() => onChange({ ...state, hideTokenStats: !state.hideTokenStats })}>{state.hideTokenStats ? "Mostra barre vita e CA" : "Nascondi barre vita e CA"}</button>
      {state.entries.length > 0 && <button className="turn-clear" onClick={() => onChange({ ...state, round: 1, activeIndex: 0, entries: [] })}>Svuota ordine</button>}
    </div>}
    <footer className="turn-footer">
      <button className="turn-step" onClick={onPrevious} disabled={!canManage || !state.entries.length || (state.round === 1 && state.activeIndex === 0)} aria-label="Turno precedente">←</button>
      <button className={`turn-settings ${editing ? "active" : ""}`} onClick={() => setEditing((value) => !value)} aria-pressed={editing} aria-label="Condizioni e modifica" title="Condizioni e modifica">⚙</button>
      <button className="turn-step primary-step" onClick={onNext} disabled={!canManage || !state.entries.length} aria-label="Turno successivo">→</button>
    </footer>
  </div>;
}
