import { useState } from "react";
import { effectiveSheet } from "./effects";
import { ChatIcon, EditIcon } from "./icons";
import { counterCurrent, deleteCounter, linkActions, linkedItem, setCounterCurrent } from "./resources";
import { isCounterRecovery, takeLongRest, takeShortRest, type RestKind } from "./rest";
import type { CharacterSheet, CounterRecovery, ResourceCounter } from "./types";
import { Button, Card, Dialog, Input, Select } from "./ui";

const RECOVERY_LABELS: Record<CounterRecovery, string> = { none: "Nessun recupero", short: "Riposo breve", long: "Riposo lungo" };

type Update = (update: (sheet: CharacterSheet) => CharacterSheet) => void;

// "Crea risorsa" accanto a "Crea azione" (zaino e tratti); se la voce ha già una risorsa diventa "Modifica risorsa".
export function CreateResource({ counter, onOpen }: { counter?: ResourceCounter; onOpen: (counter?: ResourceCounter) => void }) {
  return <Button variant="outline" onClick={() => onOpen(counter)}>{counter ? "Modifica risorsa" : "Crea risorsa"}</Button>;
}

// Popup crea/modifica risorsa. È nuova anche quando arriva precompilata (es. "Crea risorsa" dallo zaino) e non è ancora nella scheda.
export function ResourceDialog({ sheet, counter, onUpdate, onClose }: { sheet: CharacterSheet; counter: ResourceCounter | null; onUpdate: Update; onClose: () => void }) {
  const [deleting, setDeleting] = useState<ResourceCounter | null>(null);
  const isNew = counter !== null && !(sheet.counters ?? []).some((item) => item.id === counter.id);
  return <>
    <Dialog open={counter !== null} title={isNew ? "Nuova risorsa" : "Modifica risorsa"} onClose={onClose}>{counter && <ResourceForm key={counter.id} sheet={sheet} counter={counter} isNew={isNew} onUpdate={onUpdate} onClose={onClose} onDelete={isNew ? undefined : () => { setDeleting(counter); onClose(); }}/>}</Dialog>
    <Dialog open={deleting !== null} title="Eliminare la risorsa?" description={`${deleting?.name || "Risorsa senza nome"} verrà rimossa dalla scheda.`} onClose={() => setDeleting(null)}><div className="rest-actions"><Button variant="outline" onClick={() => setDeleting(null)}>Annulla</Button><Button variant="destructive" onClick={() => { const id = deleting?.id; if (id) onUpdate((next) => deleteCounter(next, id)); setDeleting(null); }}>Elimina</Button></div></Dialog>
  </>;
}

function ResourceForm({ sheet, counter, isNew, onUpdate, onClose, onDelete }: { sheet: CharacterSheet; counter: ResourceCounter; isNew: boolean; onUpdate: Update; onClose: () => void; onDelete?: () => void }) {
  const [name, setName] = useState(counter.name);
  const [maximum, setMaximum] = useState(counter.max);
  const [recovery, setRecovery] = useState<CounterRecovery>(counter.recovery);
  const [actionIds, setActionIds] = useState(() => sheet.actions.filter((action) => action.resourceId === counter.id).map((action) => action.id));
  const item = linkedItem(sheet, counter);
  const save = () => {
    const label = name.trim();
    if (!label) return;
    const max = Math.max(1, Math.floor(maximum) || 1);
    // Una risorsa nuova parte piena, tranne quando segue la quantità di un oggetto.
    const current = Math.min(max, isNew && !item ? max : counterCurrent(sheet, counter));
    onUpdate((next) => { const list = next.counters ??= []; const saved = { ...counter, name: label, max, current, recovery }; const index = list.findIndex((entry) => entry.id === counter.id); if (index >= 0) list[index] = saved; else list.push(saved); linkActions(next, counter.id, actionIds); return next; });
    onClose();
  };
  return <form className="action-form" onSubmit={(event) => { event.preventDefault(); save(); }}>
    <label><span>Nome</span><Input aria-label="Nome risorsa" value={name} autoFocus onChange={(event) => setName(event.target.value)} placeholder="Ki, Ira, Ispirazione bardica…"/></label>
    <div className="action-form-row"><label><span>Massimo</span><Input aria-label="Massimo risorsa" type="number" min="1" value={maximum} onChange={(event) => setMaximum(Number(event.target.value))}/></label><label><span>Recupero</span><Select aria-label="Recupero risorsa" value={recovery} onChange={(event) => { if (isCounterRecovery(event.target.value)) setRecovery(event.target.value); }}><option value="none">Nessuno</option><option value="short">Riposo breve</option><option value="long">Riposo lungo</option></Select></label></div>
    {item && <p className="entry-meta">Collegata allo zaino: il valore attuale è la quantità di {item.name}.</p>}
    {sheet.actions.length > 0 && <fieldset><legend>Azioni che la consumano (1 per uso)</legend>{sheet.actions.map((action) => { const other = action.resourceId && action.resourceId !== counter.id ? sheet.counters?.find((entry) => entry.id === action.resourceId) : undefined; return <label key={action.id} className="action-form-check"><input type="checkbox" checked={actionIds.includes(action.id)} onChange={(event) => setActionIds(event.target.checked ? [...actionIds, action.id] : actionIds.filter((id) => id !== action.id))}/> {action.name}{other && <small> (ora consuma {other.name})</small>}</label>; })}</fieldset>}
    <div className="action-form-buttons">{onDelete && <Button type="button" variant="destructive" onClick={onDelete}>Elimina</Button>}<Button type="button" variant="secondary" onClick={onClose}>Annulla</Button><Button type="submit" disabled={!name.trim()}>{isNew ? "Aggiungi" : "Salva"}</Button></div>
  </form>;
}

// compact: finestra del menu del token, solo le risorse da usare (niente aggiunta, ordine e riposi).
export function ResourcePanel({ sheet, onUpdate, onRest, onUse, compact }: { compact?: boolean; sheet: CharacterSheet; onUpdate: Update; onRest: (summary: string) => void; onUse: (title: string, body: string) => void }) {
  const [diceToSpend, setDiceToSpend] = useState(0);
  const [pendingRest, setPendingRest] = useState<RestKind | null>(null);
  // Risorsa aperta nel popup.
  const [editing, setEditing] = useState<ResourceCounter | null>(null);
  const [reordering, setReordering] = useState(false);
  const [error, setError] = useState("");
  const counters = sheet.counters ?? [];
  const setCurrent = (id: string, value: number) => onUpdate((next) => setCounterCurrent(next, id, value));
  const share = (counter: ResourceCounter) => onUse(counter.name || "Risorsa senza nome", `${sheet.name}: ${counterCurrent(sheet, counter)}/${counter.max} · ${RECOVERY_LABELS[counter.recovery]}`);
  const moveCounter = (index: number, offset: number) => onUpdate((next) => { const list = next.counters ?? []; const [item] = list.splice(index, 1); list.splice(index + offset, 0, item); next.counters = list; return next; });
  const completeRest = () => {
    if (!pendingRest) return;
    try {
      const result = pendingRest === "short" ? takeShortRest(sheet, diceToSpend) : takeLongRest(sheet);
      onUpdate(() => result.sheet);
      const label = pendingRest === "short" ? "Riposo breve" : "Riposo lungo";
      const summary = `${label} · ${sheet.name}: ${result.healed} PF recuperati${result.spentDice ? `, ${result.spentDice} dadi vita spesi (${result.rolls.join(", ")})` : ""}${result.restoredCounters.length ? ` · risorse: ${result.restoredCounters.join(", ")}` : ""}`;
      onRest(summary);
      setDiceToSpend(0); setError(""); setPendingRest(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Riposo non disponibile"); setPendingRest(null); }
  };
  const hp = effectiveSheet(sheet).combat.hp;
  return <div className="stack">
    <Card className="resource-panel"><div className="editor-heading"><h2>Risorse</h2></div>
      {!compact && <div className="library-actions">{!reordering && <Button onClick={() => setEditing({ id: crypto.randomUUID(), name: "", current: 1, max: 1, recovery: "long" })}>+ Nuova risorsa</Button>}{counters.length > 1 && <Button variant={reordering ? "default" : "outline"} onClick={() => setReordering(!reordering)}>{reordering ? "Fine" : "Modifica ordine"}</Button>}</div>}
      {reordering ? <ol className="order-list">{counters.map((counter, index) => <li key={counter.id}><span>{counter.name}</span><Button variant="outline" aria-label={`Sposta su ${counter.name}`} disabled={index === 0} onClick={() => moveCounter(index, -1)}>↑</Button><Button variant="outline" aria-label={`Sposta giù ${counter.name}`} disabled={index === counters.length - 1} onClick={() => moveCounter(index, 1)}>↓</Button></li>)}</ol> : counters.map((counter) => { const current = counterCurrent(sheet, counter); return <div className="resource-row" key={counter.id}>
        <button className="entry-use resource-name" title="Mostra in chat" onClick={() => share(counter)}>{counter.name || "Risorsa senza nome"}</button>
        <div className="resource-amount"><Button variant="outline" aria-label={`Riduci ${counter.name}`} disabled={current <= 0} onClick={() => { setCurrent(counter.id, current - 1); onUse(counter.name, `${sheet.name} usa ${counter.name}: ${current - 1}/${counter.max}`); }}>−</Button><strong>{current} / {counter.max}</strong><Button variant="outline" aria-label={`Aumenta ${counter.name}`} disabled={current >= counter.max} onClick={() => setCurrent(counter.id, current + 1)}>+</Button></div>
        <small>{RECOVERY_LABELS[counter.recovery]}</small>
        <span className="entry-icons"><button aria-label={`Mostra in chat ${counter.name}`} title="Mostra in chat" onClick={() => share(counter)}><ChatIcon/></button><button aria-label={`Modifica ${counter.name}`} title="Modifica" onClick={() => setEditing(counter)}><EditIcon/></button></span>
      </div>; })}
    </Card>
    <ResourceDialog sheet={sheet} counter={editing} onUpdate={onUpdate} onClose={() => setEditing(null)}/>
    {!compact && <Card className="resource-panel"><h2>Riposi</h2><p>PF {sheet.combat.hp.current}/{hp.max} · Dadi vita disponibili {sheet.combat.hitDice.current}/{sheet.combat.hitDice.max}</p><div className="rest-controls"><Button onClick={() => { setDiceToSpend(0); setPendingRest("short"); }}>Riposo breve</Button><Button onClick={() => setPendingRest("long")}>Riposo lungo</Button></div>{error && <p role="alert" className="rest-error">{error}</p>}</Card>}
    <Dialog open={pendingRest !== null} title={pendingRest === "short" ? "Conferma riposo breve" : "Conferma riposo lungo"} description={pendingRest === "short" ? "Scegli quanti dadi vita spendere; i contatori da riposo breve saranno ripristinati." : "Ripristinerai PF, slot, dadi vita e contatori configurati. I PF temporanei termineranno."} onClose={() => setPendingRest(null)}>{pendingRest === "short" && <label className="rest-dice">Dadi vita da spendere (disponibili {sheet.combat.hitDice.current}, d{/^d?(\d+)$/i.exec(sheet.combat.hitDice.die.trim())?.[1] ?? "?"}) <Input aria-label="Dadi vita da spendere" type="number" min="0" max={sheet.combat.hitDice.current} value={diceToSpend} onChange={(event) => setDiceToSpend(Math.min(sheet.combat.hitDice.current, Math.max(0, Math.floor(Number(event.target.value)) || 0)))}/></label>}<div className="rest-actions"><Button variant="outline" onClick={() => setPendingRest(null)}>Annulla</Button><Button onClick={completeRest}>Completa riposo</Button></div></Dialog>
  </div>;
}
