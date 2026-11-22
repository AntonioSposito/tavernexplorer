import { useState } from "react";
import { parseXp, xpProgress } from "./experience";
import { LevelUpDialog } from "./LevelUpDialog";
import { applyLevel, levelSummary } from "./levelUp";
import type { CharacterSheet } from "./types";
import { Button, Dialog, Input } from "./ui";

const format = (value: number) => value.toLocaleString("it-IT");

// PE sotto il nome: barra fino alla soglia del livello dopo; chi può modificare la scheda apre il popup per cambiarli.
// "Sali di livello" c'è sempre per chi può modificare la scheda (anche senza PE, a milestone); superata la soglia è evidenziato.
export function XpControl({ sheet, editable, onUpdate, onNotice }: { sheet: CharacterSheet; editable: boolean; onUpdate: (update: (sheet: CharacterSheet) => CharacterSheet) => void; onNotice: (title: string, body: string) => void }) {
  const [open, setOpen] = useState(false);
  const [levelingUp, setLevelingUp] = useState(false);
  const [amount, setAmount] = useState("");
  const [total, setTotal] = useState("");
  const xp = parseXp(sheet.identity.experience);
  const { next, readyFor } = xpProgress(xp, sheet.identity.level);
  const save = (value: number) => {
    onUpdate((current) => { current.identity.experience = String(Math.max(0, value)); return current; });
    setOpen(false);
  };
  const added = Number(amount) || 0;
  const bar = <>
    <span className="xp-text">PE {format(xp)}{next != null ? ` / ${format(next)}` : ""}</span>
    {next != null && <span className="xp-bar" aria-hidden="true"><span style={{ width: `${Math.min(100, (xp / next) * 100)}%` }}/></span>}
    {readyFor != null && <strong className="xp-ready">↑ Pronto per il livello {readyFor}</strong>}
  </>;
  return <>
    {editable
      ? <button type="button" className="xp-control" aria-label={`Modifica esperienza di ${sheet.name}`} title="Modifica esperienza" onClick={() => { setAmount(""); setTotal(String(xp)); setOpen(true); }}>{bar}</button>
      : <div className="xp-control">{bar}</div>}
    {editable && sheet.identity.level < 20 && <button type="button" className={`level-up-open${readyFor != null ? " ready" : ""}`} onClick={() => setLevelingUp(true)}>↑ Sali di livello</button>}
    {levelingUp && <LevelUpDialog sheet={sheet} onClose={() => setLevelingUp(false)} onConfirm={(className, level, choices) => {
      const next = applyLevel(sheet, className, level, choices);
      onUpdate((current) => applyLevel(current, className, level, choices));
      onNotice(`${sheet.name} sale al livello ${next.identity.level}`, levelSummary(sheet, next).join(" · "));
      setLevelingUp(false);
    }}/>}
    <Dialog open={open} title="Esperienza" description={`${sheet.name} · ${format(xp)} PE`} onClose={() => setOpen(false)}>
      <div className="action-form">
        <label><span>PE da aggiungere o togliere</span><Input type="number" min="0" aria-label="PE da aggiungere o togliere" value={amount} autoFocus onChange={(event) => setAmount(event.target.value)}/></label>
        <div className="action-form-buttons"><Button type="button" variant="secondary" disabled={!added} onClick={() => save(xp - added)}>− Togli</Button><Button type="button" disabled={!added} onClick={() => save(xp + added)}>+ Aggiungi</Button></div>
        <label><span>Totale PE</span><Input type="number" min="0" aria-label="Totale PE" value={total} onChange={(event) => setTotal(event.target.value)}/></label>
        <div className="action-form-buttons"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Annulla</Button><Button type="button" onClick={() => save(Number(total) || 0)}>Salva totale</Button></div>
      </div>
    </Dialog>
  </>;
}
