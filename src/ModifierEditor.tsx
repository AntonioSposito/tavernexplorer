import { MODIFIER_TARGETS } from "./effects";
import type { StatModifier } from "./types";
import { Button, Input, Select } from "./ui";

export function ModifierEditor({ modifiers, onChange }: { modifiers: StatModifier[]; onChange: (next: StatModifier[]) => void }) {
  const patch = (id: string, change: Partial<StatModifier>) => onChange(modifiers.map((item) => item.id === id ? { ...item, ...change } : item));
  return <div className="modifier-editor">
    {modifiers.map((modifier) => <div className="modifier-row" key={modifier.id}>
      <Select aria-label="Caratteristica modificata" value={modifier.target} onChange={(event) => patch(modifier.id, { target: event.target.value })}>{MODIFIER_TARGETS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
      <Input aria-label="Valore modificatore" type="number" value={modifier.amount} onChange={(event) => patch(modifier.id, { amount: Number(event.target.value) || 0 })}/>
      <Button type="button" variant="destructive" aria-label="Rimuovi modificatore" onClick={() => onChange(modifiers.filter((item) => item.id !== modifier.id))}>×</Button>
    </div>)}
    <Button type="button" variant="outline" onClick={() => onChange([...modifiers, { id: crypto.randomUUID(), target: "ac", amount: 1 }])}>+ Modificatore</Button>
  </div>;
}
