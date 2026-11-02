import { useState } from "react";
import { effectiveSheet } from "./effects";
import { EditIcon } from "./icons";
import { isCounterRecovery, takeLongRest, takeShortRest, type RestKind } from "./rest";
import type { CharacterSheet, CounterRecovery, ResourceCounter } from "./types";
import { Button, Card, Dialog, Input, Select } from "./ui";

const RECOVERY_LABELS: Record<CounterRecovery, string> = { none: "Nessun recupero", short: "Riposo breve", long: "Riposo lungo" };

export function ResourcePanel({ sheet, onUpdate, onRest }: { sheet: CharacterSheet; onUpdate: (update: (sheet: CharacterSheet) => CharacterSheet) => void; onRest: (summary: string) => void }) {
  const [name, setName] = useState("");
  const [maximum, setMaximum] = useState(1);
  const [recovery, setRecovery] = useState<CounterRecovery>("long");
  const [diceToSpend, setDiceToSpend] = useState(0);
  const [pendingRest, setPendingRest] = useState<RestKind | null>(null);
  // Risorsa aperta nel popup: "new" per crearne una.
  const [editing, setEditing] = useState<ResourceCounter | "new" | null>(null);
  const [reordering, setReordering] = useState(false);
  const [deleting, setDeleting] = useState<ResourceCounter | null>(null);
  const [error, setError] = useState("");
  const counters = sheet.counters ?? [];
  const patch = (id: string, change: Partial<ResourceCounter>) => onUpdate((next) => { next.counters = (next.counters ?? []).map((counter) => counter.id === id ? { ...counter, ...change } : counter); return next; });
  const openEditor = (counter: ResourceCounter | "new") => {
    setName(counter === "new" ? "" : counter.name); setMaximum(counter === "new" ? 1 : counter.max); setRecovery(counter === "new" ? "long" : counter.recovery); setEditing(counter);
  };
  const saveCounter = () => {
    const label = name.trim();
    if (!label || !editing) return;
    const max = Math.max(1, Math.floor(maximum) || 1);
    if (editing === "new") onUpdate((next) => { (next.counters ??= []).push({ id: crypto.randomUUID(), name: label, current: max, max, recovery }); return next; });
    else patch(editing.id, { name: label, max, current: Math.min(editing.current, max), recovery });
    setEditing(null);
  };
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
      <div className="library-actions">{!reordering && <Button onClick={() => openEditor("new")}>+ Nuova risorsa</Button>}{counters.length > 1 && <Button variant={reordering ? "default" : "outline"} onClick={() => setReordering(!reordering)}>{reordering ? "Fine" : "Modifica ordine"}</Button>}</div>
      {reordering ? <ol className="order-list">{counters.map((counter, index) => <li key={counter.id}><span>{counter.name}</span><Button variant="outline" aria-label={`Sposta su ${counter.name}`} disabled={index === 0} onClick={() => moveCounter(index, -1)}>↑</Button><Button variant="outline" aria-label={`Sposta giù ${counter.name}`} disabled={index === counters.length - 1} onClick={() => moveCounter(index, 1)}>↓</Button></li>)}</ol> : counters.map((counter) => <div className="resource-row" key={counter.id}>
        <strong className="resource-name">{counter.name || "Risorsa senza nome"}</strong>
        <div className="resource-amount"><Button variant="outline" aria-label={`Riduci ${counter.name}`} onClick={() => patch(counter.id, { current: Math.max(0, counter.current - 1) })}>−</Button><strong>{counter.current} / {counter.max}</strong><Button variant="outline" aria-label={`Aumenta ${counter.name}`} onClick={() => patch(counter.id, { current: Math.min(counter.max, counter.current + 1) })}>+</Button></div>
        <small>{RECOVERY_LABELS[counter.recovery]}</small>
        <span className="entry-icons"><button aria-label={`Modifica ${counter.name}`} title="Modifica" onClick={() => openEditor(counter)}><EditIcon/></button></span>
      </div>)}
    </Card>
    <Dialog open={deleting !== null} title="Eliminare la risorsa?" description={`${deleting?.name || "Risorsa senza nome"} verrà rimossa dalla scheda.`} onClose={() => setDeleting(null)}><div className="rest-actions"><Button variant="outline" onClick={() => setDeleting(null)}>Annulla</Button><Button variant="destructive" onClick={() => { const id = deleting?.id; onUpdate((next) => { next.counters = (next.counters ?? []).filter((item) => item.id !== id); return next; }); setDeleting(null); }}>Elimina</Button></div></Dialog>
    <Dialog open={editing !== null} title={editing === "new" ? "Nuova risorsa" : "Modifica risorsa"} onClose={() => setEditing(null)}><form className="action-form" onSubmit={(event) => { event.preventDefault(); saveCounter(); }}>
      <label><span>Nome</span><Input aria-label="Nome risorsa" value={name} autoFocus onChange={(event) => setName(event.target.value)} placeholder="Ki, Ira, Ispirazione bardica…"/></label>
      <div className="action-form-row"><label><span>Massimo</span><Input aria-label="Massimo risorsa" type="number" min="1" value={maximum} onChange={(event) => setMaximum(Number(event.target.value))}/></label><label><span>Recupero</span><Select aria-label="Recupero risorsa" value={recovery} onChange={(event) => { if (isCounterRecovery(event.target.value)) setRecovery(event.target.value); }}><option value="none">Nessuno</option><option value="short">Riposo breve</option><option value="long">Riposo lungo</option></Select></label></div>
      <div className="action-form-buttons">{editing && editing !== "new" && <Button type="button" variant="destructive" onClick={() => { setDeleting(editing); setEditing(null); }}>Elimina</Button>}<Button type="button" variant="secondary" onClick={() => setEditing(null)}>Annulla</Button><Button type="submit" disabled={!name.trim()}>{editing === "new" ? "Aggiungi" : "Salva"}</Button></div>
    </form></Dialog>
    <Card className="resource-panel"><h2>Riposi</h2><p>PF {sheet.combat.hp.current}/{hp.max} · Dadi vita disponibili {sheet.combat.hitDice.current}/{sheet.combat.hitDice.max}</p><div className="rest-controls"><Button onClick={() => { setDiceToSpend(0); setPendingRest("short"); }}>Riposo breve</Button><Button onClick={() => setPendingRest("long")}>Riposo lungo</Button></div>{error && <p role="alert" className="rest-error">{error}</p>}</Card>
    <Dialog open={pendingRest !== null} title={pendingRest === "short" ? "Conferma riposo breve" : "Conferma riposo lungo"} description={pendingRest === "short" ? "Scegli quanti dadi vita spendere; i contatori da riposo breve saranno ripristinati." : "Ripristinerai PF, slot, dadi vita e contatori configurati. I PF temporanei termineranno."} onClose={() => setPendingRest(null)}>{pendingRest === "short" && <label className="rest-dice">Dadi vita da spendere (disponibili {sheet.combat.hitDice.current}, d{/^d?(\d+)$/i.exec(sheet.combat.hitDice.die.trim())?.[1] ?? "?"}) <Input aria-label="Dadi vita da spendere" type="number" min="0" max={sheet.combat.hitDice.current} value={diceToSpend} onChange={(event) => setDiceToSpend(Math.min(sheet.combat.hitDice.current, Math.max(0, Math.floor(Number(event.target.value)) || 0)))}/></label>}<div className="rest-actions"><Button variant="outline" onClick={() => setPendingRest(null)}>Annulla</Button><Button onClick={completeRest}>Completa riposo</Button></div></Dialog>
  </div>;
}
