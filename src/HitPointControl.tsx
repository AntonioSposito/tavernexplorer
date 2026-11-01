import { useState } from "react";
import { adjustHitPoints, applyDeathSave, type HitPointField } from "./hitPoints";
import type { RollResult } from "./dice";
import { labeledBonus, type AttackRoll } from "./rollCards";
import { getRuleset } from "./rulesets";
import type { CharacterSheet } from "./types";
import { Input } from "./ui";

interface HitPointControlProps {
  sheet: CharacterSheet;
  editable: boolean;
  onUpdate: (update: (sheet: CharacterSheet) => CharacterSheet) => void;
}

// In colonna come in Roll20: massimi, attuali, temporanei. I massimi si cambiano solo nella tab Modifica.
const FIELDS: Array<[HitPointField, string]> = [["max", "PF massimi"], ["current", "PF attuali"], ["temp", "PF temporanei"]];

// Numero modificabile a mano (salvato all'uscita o con Invio) con frecce ▲▼ di un punto.
function StepperBox({ field, label, value, editable, onChange }: { field: string; label: string; value: number; editable: boolean; onChange: (delta: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => { if (draft !== null && /^\d+$/.test(draft.trim())) onChange(Number(draft) - value); setDraft(null); };
  return <div className={`hit-point-box ${field}`}>
    <small>{label}</small>
    {editable ? <div className="hit-point-stepper">
      <Input aria-label={label} type="number" inputMode="numeric" min="0" value={draft ?? value} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}/>
      <div className="hit-point-arrows">
        <button type="button" aria-label={`Aumenta ${label}`} onClick={() => onChange(1)}>▲</button>
        <button type="button" aria-label={`Diminuisci ${label}`} onClick={() => onChange(-1)}>▼</button>
      </div>
    </div> : <strong>{value}</strong>}
  </div>;
}

export function HitPointControl({ sheet, editable, onUpdate }: HitPointControlProps) {
  // sheet ha gli effetti applicati: il suo massimo è il limite dei PF attuali, le modifiche vanno sulla scheda base.
  const change = (field: HitPointField, delta: number) => {
    if (!editable || !delta) return;
    onUpdate((current) => { current.combat = adjustHitPoints(current.combat, field, delta, sheet.combat.hp.max); return current; });
  };
  return <section className="paper hit-point-control">
    <h2>Punti ferita</h2>
    <div className="hit-point-boxes">{FIELDS.map(([field, label]) => <StepperBox key={field} field={field} label={label} value={sheet.combat.hp[field]} editable={editable && field !== "max"} onChange={(delta) => change(field, delta)}/>)}</div>
  </section>;
}

// Dadi vita: il pulsante tira 1 dado + COS, ne scala uno dagli attuali e cura i PF del risultato (almeno il minimo
// del ruleset, come nel riposo breve, senza superare il massimo); il totale e il dado si cambiano nella tab Modifica.
export function HitDiceControl({ sheet, editable, onUpdate, onRollValue }: HitPointControlProps & { onRollValue: (name: string, formula: string, extras?: AttackRoll) => Promise<RollResult | null> }) {
  const { current, max, die } = sheet.combat.hitDice;
  const faces = Number(/^d?(\d+)$/i.exec(die.trim())?.[1]) || 0;
  const con = sheet.abilities.constitution?.mod ?? 0;
  const setCurrent = (delta: number) => onUpdate((next) => { const dice = next.combat.hitDice; dice.current = Math.min(dice.max, Math.max(0, dice.current + delta)); return next; });
  // busy evita due tiri con un solo dado vita se si clicca due volte prima del salvataggio.
  const [busy, setBusy] = useState(false);
  const spend = async () => {
    setBusy(true);
    const result = await onRollValue("Dado vita", `1d${faces}${labeledBonus([[con, "CON"]], con)}`, { critRange: 20, label: "PF recuperati" });
    setBusy(false);
    if (!result) return;
    const healed = Math.max(getRuleset(sheet.ruleset.id).shortRestMinimumHealing, result.total);
    onUpdate((next) => {
      next.combat = adjustHitPoints(next.combat, "current", healed, sheet.combat.hp.max);
      next.combat.hitDice.current = Math.max(0, next.combat.hitDice.current - 1);
      return next;
    });
  };
  return <section className="paper hit-point-control hit-dice-control">
    <h2>Dadi vita</h2>
    <div className="hit-point-boxes">
      <button type="button" className="hit-dice-roll" disabled={busy || !editable || !faces || current < 1} title={current < 1 ? "Nessun dado vita disponibile" : "Tira e scala un dado vita"} onClick={() => void spend()}>Dado vita ({faces ? `d${faces}` : "?"})</button>
      <StepperBox field="max" label="Dadi vita tot" value={max} editable={false} onChange={() => undefined}/>
      <StepperBox field="current" label="Dadi vita attuali" value={current} editable={editable} onChange={setCurrent}/>
    </div>
  </section>;
}

// TS contro la morte: si tira solo a 0 PF finché non si è stabili (3 successi) o morti (3 fallimenti).
export function DeathSaveControl({ sheet, editable, onUpdate, onRollValue }: HitPointControlProps & { onRollValue: (name: string, formula: string, extras?: AttackRoll) => Promise<RollResult | null> }) {
  const { successes, failures } = sheet.combat.deathSaves;
  const [busy, setBusy] = useState(false);
  const canRoll = editable && !busy && sheet.combat.hp.current === 0 && successes < 3 && failures < 3;
  const rollSave = async () => {
    setBusy(true);
    const result = await onRollValue("TS contro la morte", "1d20");
    setBusy(false);
    if (result?.natural == null) return;
    const natural = result.natural;
    onUpdate((next) => { next.combat = applyDeathSave(next.combat, natural); return next; });
  };
  const dots = (count: number, kind: string, label: string) => <span className="death-dots" aria-label={`${label}: ${count} su 3`}>{[0, 1, 2].map((index) => <span key={index} className={`death-dot${index < count ? ` ${kind}` : ""}`}/>)}</span>;
  return <section className="paper hit-point-control death-save-control">
    <h2>TS contro la morte</h2>
    <div className="hit-point-boxes">
      <button type="button" className="hit-dice-roll" disabled={!canRoll} title={sheet.combat.hp.current > 0 ? "Si tira solo a 0 PF" : successes >= 3 ? "Stabile" : failures >= 3 ? "Morto" : "Tira d20: da 10 successo, 1 = due fallimenti, 20 = 1 PF"} onClick={() => void rollSave()}>TS morte</button>
      <div className="hit-point-box"><small>Successi</small>{dots(successes, "success", "Successi")}</div>
      <div className="hit-point-box"><small>Fallimenti</small>{dots(failures, "failure", "Fallimenti")}</div>
    </div>
  </section>;
}
