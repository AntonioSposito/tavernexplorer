import { useState } from "react";
import { ABILITY_LABELS } from "./constants";
import { MODIFIER_CONDITIONS, MODIFIER_GROUPS, ROLL_MODE_GROUPS, isRollModeTarget } from "./effects";
import type { StatModifier } from "./types";
import { Button, Input, Select } from "./ui";

// Numero col segno ("+2"): il testo resta com'è mentre si scrive ("-" da solo), poi torna formattato.
function SignedInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [text, setText] = useState<string | null>(null);
  return <Input aria-label="Valore modificatore" value={text ?? (value > 0 ? `+${value}` : String(value))} onChange={(event) => { setText(event.target.value); const parsed = Number(event.target.value); if (Number.isFinite(parsed)) onChange(parsed); }} onBlur={() => setText(null)}/>;
}

// rollModes: anche vantaggio e svantaggio sui tiri d20 (solo gli effetti li applicano).
// rageBonus: danni d'Ira della scheda, mostrati accanto al valore fisso (che di solito è 0).
export function ModifierEditor({ modifiers, onChange, rollModes, rageBonus }: { modifiers: StatModifier[]; onChange: (next: StatModifier[]) => void; rollModes?: boolean; rageBonus?: number }) {
  const patch = (id: string, change: Partial<StatModifier>) => onChange(modifiers.map((item) => item.id === id ? { ...item, ...change } : item));
  return <div className="modifier-editor">
    {modifiers.map((modifier) => <div className="modifier-row" key={modifier.id}>
      <Select aria-label="Caratteristica modificata" value={modifier.target} onChange={(event) => patch(modifier.id, { target: event.target.value })}>
        <option value="" disabled>Scegli cosa modificare…</option>
        {[...MODIFIER_GROUPS, ...rollModes ? ROLL_MODE_GROUPS : []].map(([group, targets]) => <optgroup key={group} label={group}>{targets.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</optgroup>)}
      </Select>
      {!isRollModeTarget(modifier.target) && <SignedInput value={modifier.amount} onChange={(amount) => patch(modifier.id, { amount })}/>}
      <Button type="button" variant="destructive" aria-label="Rimuovi modificatore" onClick={() => onChange(modifiers.filter((item) => item.id !== modifier.id))}>×</Button>
      {!isRollModeTarget(modifier.target) && <div className="modifier-bonus">
        <Select aria-label="Aggiungi modificatore di caratteristica" value={modifier.ability ?? ""} onChange={(event) => patch(modifier.id, { ability: event.target.value || undefined })}><option value="">Nessuna caratteristica</option>{Object.entries(ABILITY_LABELS).map(([value, label]) => <option key={value} value={value}>+ mod. {label}</option>)}</Select>
        <label className="action-form-check"><input type="checkbox" aria-label="Aggiungi bonus di competenza" checked={!!modifier.proficient} onChange={(event) => patch(modifier.id, { proficient: event.target.checked || undefined })}/> + Competenza</label>
        {modifier.ability && <label className="action-form-check"><input type="checkbox" aria-label="Valore minimo 1" checked={modifier.min === 1} onChange={(event) => patch(modifier.id, { min: event.target.checked ? 1 : undefined })}/> Minimo +1</label>}
        {modifier.target.startsWith("ability:") && <label className="modifier-max"><span>Punteggio fino a</span><Input aria-label="Punteggio massimo" type="number" min="1" placeholder="—" value={modifier.max ?? ""} onChange={(event) => patch(modifier.id, { max: event.target.value ? Math.trunc(Number(event.target.value)) || undefined : undefined })}/></label>}
        {modifier.scale === "rage" && <small>{rageBonus != null ? `+ danni d'Ira: +${rageBonus} (totale ${modifier.amount + rageBonus >= 0 ? "+" : ""}${modifier.amount + rageBonus})` : "+ danni d'Ira (dal livello da barbaro)"}</small>}
        <Select aria-label="Condizione del modificatore" value={modifier.when ?? ""} onChange={(event) => patch(modifier.id, { when: (event.target.value || undefined) as StatModifier["when"] })}><option value="">Sempre</option>{MODIFIER_CONDITIONS.map(([value, label]) => <option key={value} value={value}>Solo {label}</option>)}</Select>
        {modifier.scale !== "rage" && <label className="action-form-check"><input type="checkbox" aria-label="Moltiplica per il livello del personaggio" checked={modifier.scale === "level"} onChange={(event) => patch(modifier.id, { scale: event.target.checked ? "level" : undefined })}/> × livello del personaggio</label>}
      </div>}
    </div>)}
    <Button type="button" variant="outline" onClick={() => onChange([...modifiers, { id: crypto.randomUUID(), target: "", amount: 1 }])}>+ Modificatore</Button>
  </div>;
}
