import { useState } from "react";
import { ABILITY_LABELS } from "./constants";
import { MODIFIER_GROUPS, ROLL_MODE_GROUPS, isRollModeTarget } from "./effects";
import type { StatModifier } from "./types";
import { Button, Input, Select } from "./ui";

// Numero col segno ("+2"): il testo resta com'è mentre si scrive ("-" da solo), poi torna formattato.
function SignedInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [text, setText] = useState<string | null>(null);
  return <Input aria-label="Valore modificatore" value={text ?? (value > 0 ? `+${value}` : String(value))} onChange={(event) => { setText(event.target.value); const parsed = Number(event.target.value); if (Number.isFinite(parsed)) onChange(parsed); }} onBlur={() => setText(null)}/>;
}

// rollModes: anche vantaggio e svantaggio sui tiri d20 (solo gli effetti li applicano).
export function ModifierEditor({ modifiers, onChange, rollModes }: { modifiers: StatModifier[]; onChange: (next: StatModifier[]) => void; rollModes?: boolean }) {
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
        {modifier.scale === "rage" && <small>+ danni d'Ira (dal livello da barbaro)</small>}
        {modifier.scale === "level" && <small>× livello del personaggio</small>}
        <label className="action-form-check"><input type="checkbox" aria-label="Solo senza armatura" checked={!!modifier.unarmored} onChange={(event) => patch(modifier.id, { unarmored: event.target.checked || undefined })}/> Solo senza armatura</label>
      </div>}
    </div>)}
    <Button type="button" variant="outline" onClick={() => onChange([...modifiers, { id: crypto.randomUUID(), target: "", amount: 1 }])}>+ Modificatore</Button>
  </div>;
}
