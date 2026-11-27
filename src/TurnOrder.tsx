import { useState } from "react";
import { asEffect, effectLabel, effectsTotal, isEffectOn } from "./effects";
import { EffectList } from "./EffectsEditor";
import { replaceTurnEntries, setTurnInitiative } from "./turns";
import type { ActionEntry, CharacterEffect, CharacterSheet, RollCard, TurnEntry, TurnState } from "./types";
import { Dialog } from "./ui";


// Effetti della voce: per un PG quelli della sua scheda, per mostri e NPC quelli del singolo token.
function ConditionEditor({ entry, state, canManage, onChange, pcEffects, onPcEffects, onShareEffect, canEditPc }: { entry: TurnEntry; state: TurnState; canManage: boolean; onChange: (state: TurnState) => void } & EffectProps) {
  const sheetEffects = entry.characterId ? pcEffects?.[entry.characterId] : undefined;
  const effects = sheetEffects ?? (entry.conditions ?? []).map(asEffect);
  const update = (change: (effects: CharacterEffect[]) => CharacterEffect[]) => {
    if (sheetEffects && entry.characterId) onPcEffects?.(entry.characterId, change);
    else onChange({ ...state, entries: state.entries.map((item) => item.id === entry.id ? { ...item, conditions: change((item.conditions ?? []).map(asEffect)) } : item) });
  };
  return <div className="turn-effects"><EffectList effects={effects} editable={sheetEffects && entry.characterId ? !!canEditPc?.(entry.characterId) : canManage} round={state.round} onChange={update} onShare={(item, card) => onShareEffect?.(entry, item, card)}/></div>;
}

interface EffectProps {
  // Effetti delle schede dei PG (per id scheda) e loro modifica; i mostri li hanno nella voce dei turni.
  pcEffects?: Record<string, CharacterEffect[]>;
  onPcEffects?: (characterId: string, update: (effects: CharacterEffect[]) => CharacterEffect[]) => void;
  onShareEffect?: (entry: TurnEntry, item: ActionEntry, card: RollCard) => void;
  // Gli effetti di un PG li gestisce chi può modificare la sua scheda, anche senza il permesso sui turni.
  canEditPc?: (characterId: string) => boolean;
}

interface TurnOrderProps extends EffectProps {
  state: TurnState;
  canManage: boolean;
  images: Record<string, string>;
  onChange: (state: TurnState) => void;
  onNext: () => void;
  onPrevious: () => void;
  onFocusToken?: (tokenId: string) => void;
  active: CharacterSheet | null;
  // Assente fuori da Owlbear: non c'è un token selezionato.
  onAttach?: () => void;
  onOpenForPlayers?: () => void;
  // PF e CA nel turn order: solo il GM. Mostri e NPC li hanno nella voce, i PG nella scheda (pcStats per id scheda).
  showStats?: boolean;
  pcStats?: Record<string, { current: number; max: number; temp: number; ac: number }>;
  onPcHp?: (characterId: string, current: number) => void;
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase()).join("");
}

export function TurnOrder({ state, canManage, images, onChange, onNext, onPrevious, onFocusToken, active, onAttach, onOpenForPlayers, showStats = false, pcStats = {}, onPcHp, pcEffects, onPcEffects, onShareEffect, canEditPc }: TurnOrderProps) {
  const [editing, setEditing] = useState(false);
  const [effectsId, setEffectsId] = useState<string | null>(null);
  const effectsEntry = state.entries.find((entry) => entry.id === effectsId);
  const setHp = (entry: TurnEntry, current: number) => onChange({ ...state, entries: state.entries.map((item) => item.id === entry.id && item.hp ? { ...item, hp: { ...item.hp, current: Math.max(0, current) } } : item) });
  const remove = (entry: TurnEntry) => onChange(replaceTurnEntries(state, state.entries.filter((item) => item.id !== entry.id)));
  return <div className="turn-tracker">
    <header className="turn-tracker-head"><span>Round {state.round}</span><span>Partecipanti: {state.entries.length}</span></header>
    <section className="turn-rows">
      {state.entries.length === 0 && <p className="turn-empty">Nessun partecipante. Seleziona un token sulla mappa e collegalo a una scheda.</p>}
      {state.entries.map((entry, index) => { const stats = entry.hp ? { ...entry.hp, temp: 0, ac: entry.ac == null ? undefined : entry.ac + effectsTotal(entry.conditions, "ac") } : entry.characterId ? pcStats[entry.characterId] : undefined; return <article className={`turn-row ${index === state.activeIndex ? "current" : ""}`} key={entry.id} aria-current={index === state.activeIndex ? "true" : undefined}>
        <div className="turn-row-main">
          <span className="turn-avatar">
            {images[entry.id] ? <img src={images[entry.id]} alt=""/> : <span>{initials(entry.name)}</span>}
            {canManage && <button className="turn-remove" aria-label={`Rimuovi ${entry.name}`} title="Rimuovi dal turn order" onClick={() => remove(entry)}><span/></button>}
          </span>
          <div className="turn-name">
            {entry.tokenId && onFocusToken ? <button title="Evidenzia sulla mappa" onClick={() => { if (entry.tokenId) onFocusToken(entry.tokenId); }}>{entry.name}</button> : <strong>{entry.name}</strong>}
            {/* Il GM cambia i PF dalla riga, senza aprire ⚙: per i PG si aggiorna la scheda. Il numero comprende i
                PF temporanei; scrivendo un totale più basso si consumano prima quelli. */}
            {showStats && stats && <small className="turn-stats">PF {canManage ? <input aria-label={`PF di ${entry.name}`} title="PF attuali + temporanei" type="number" min="0" value={stats.current + stats.temp} onChange={(event) => { const value = Math.max(0, Math.trunc(Number(event.target.value)) || 0); if (entry.hp) setHp(entry, value); else if (entry.characterId) onPcHp?.(entry.characterId, value); }}/> : stats.current + stats.temp}/{stats.max}{stats.temp > 0 && ` (${stats.temp} temp.)`}{stats.ac != null && ` · CA ${stats.ac}`}</small>}
            {(() => { const shown = ((entry.characterId && pcEffects?.[entry.characterId]) || entry.conditions || []).filter(isEffectOn); return shown.length > 0 && <small>{shown.map(effectLabel).join(" · ")}</small>; })()}
          </div>
          {canManage ? <input className="turn-initiative-input" aria-label={`Iniziativa di ${entry.name}`} type="number" value={entry.initiative} onChange={(event) => onChange(setTurnInitiative(state, entry.id, Number(event.target.value) || 0))}/> : <strong className="turn-initiative">{entry.initiative}</strong>}
          <button className="turn-effects-open" aria-label={`Effetti di ${entry.name}`} title="Effetti e condizioni" onClick={() => setEffectsId(entry.id)}>Effetti</button>
        </div>
      </article>; })}
    </section>
    <Dialog open={!!effectsEntry} title={effectsEntry?.name ?? ""} description="Effetti e condizioni" onClose={() => setEffectsId(null)}>{effectsEntry && <div className="action-form"><ConditionEditor entry={effectsEntry} state={state} canManage={canManage} onChange={onChange} pcEffects={pcEffects} onPcEffects={onPcEffects} onShareEffect={onShareEffect} canEditPc={canEditPc}/></div>}</Dialog>
    {editing && canManage && <div className="turn-tools">
      {onOpenForPlayers && <button onClick={onOpenForPlayers}>Apri il turn order ai giocatori ↗</button>}
      {onAttach && <button onClick={onAttach} disabled={!active}>Collega scheda e token selezionato</button>}
      <button aria-pressed={!state.hideTokenStats} onClick={() => onChange({ ...state, hideTokenStats: !state.hideTokenStats })}>{state.hideTokenStats ? "Mostra barre vita e CA" : "Nascondi barre vita e CA"}</button>
      {state.entries.length > 0 && <button className="turn-clear" onClick={() => onChange({ ...state, round: 1, activeIndex: 0, entries: [] })}>Svuota ordine</button>}
    </div>}
    <footer className="turn-footer">
      <button className="turn-step" onClick={onPrevious} disabled={!canManage || !state.entries.length || (state.round === 1 && state.activeIndex === 0)} aria-label="Turno precedente">←</button>
      <button className={`turn-settings ${editing ? "active" : ""}`} onClick={() => setEditing((value) => !value)} aria-pressed={editing} aria-label="Opzioni turn order" title="Opzioni turn order">⚙</button>
      <button className="turn-step primary-step" onClick={onNext} disabled={!canManage || !state.entries.length} aria-label="Turno successivo">→</button>
    </footer>
  </div>;
}
