import { useState } from "react";
import { resolveAction } from "./actions";
import { ABILITY_LABELS } from "./constants";
import { sanitizeFormula } from "./dice";
import type { ActionAbility, ActionDamage, ActionEntry, CharacterSheet } from "./types";
import { Alert, Button, Input, Select, Textarea } from "./ui";

type SaveAbility = NonNullable<ActionEntry["save"]>["ability"];
const ABILITIES = Object.keys(ABILITY_LABELS) as SaveAbility[];
const emptyDamage = (): ActionDamage => ({ dice: "", ability: "none", bonus: 0, type: "", critDice: "" });
const diceOnly = (formula: string) => formula.match(/\d*d\d+/gi)?.join("+") ?? "";
const signed = (value: number) => `${value >= 0 ? "+" : ""}${value}`;

// Le azioni importate hanno solo valori fissi: il form li presenta come "nessuna caratteristica + bonus".
function toDraft(entry: ActionEntry | null): ActionEntry {
  if (!entry) return { id: crypto.randomUUID(), name: "", attack: { ability: "strength", bonus: 0, proficient: true }, critRange: 20, damages: [{ ...emptyDamage(), ability: "strength" }, emptyDamage()] };
  const damages = entry.damages ?? (entry.damage ? [{ dice: entry.damage, ability: "none" as const, bonus: 0, type: entry.damageType ?? "", critDice: diceOnly(entry.damage) }] : []);
  return {
    ...entry,
    attack: entry.attack ?? (entry.attackBonus != null ? { ability: "none", bonus: entry.attackBonus, proficient: false } : undefined),
    save: entry.save ?? (entry.saveDc != null ? { ability: "dexterity", dc: entry.saveDc, effect: "" } : undefined),
    critRange: entry.critRange ?? 20,
    damages: [...damages, emptyDamage(), emptyDamage()].slice(0, 2),
  };
}

// Salva solo i campi del form: i valori fissi importati non servono più e non devono restare in conflitto.
function toEntry(draft: ActionEntry): ActionEntry {
  const entry: ActionEntry = { ...draft, name: draft.name.trim(), damages: draft.damages?.filter((part) => part.dice.trim()) };
  delete entry.attackBonus; delete entry.damage; delete entry.damageType; delete entry.saveDc;
  return entry;
}

function validate(draft: ActionEntry): string {
  if (!draft.name.trim()) return "Inserisci un nome";
  const critRange = draft.critRange ?? 20;
  if (!Number.isInteger(critRange) || critRange < 2 || critRange > 20) return "La gamma del critico va da 2 a 20";
  for (const part of draft.damages ?? []) {
    for (const formula of [part.dice, part.critDice]) {
      if (!formula.trim()) continue;
      try { sanitizeFormula(formula); } catch { return `Formula non valida: ${formula}`; }
    }
  }
  return "";
}

const AbilitySelect = ({ label, value, onChange, extra = true }: { label: string; value: ActionAbility; onChange: (value: ActionAbility) => void; extra?: boolean }) =>
  <Select aria-label={label} value={value} onChange={(event) => onChange(event.target.value as ActionAbility)}>
    {ABILITIES.map((key) => <option key={key} value={key}>{ABILITY_LABELS[key]}</option>)}
    {extra && <option value="spell">Incantatore</option>}
    {extra && <option value="none">—</option>}
  </Select>;

const numberValue = (value: string) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : 0;

export function ActionForm({ action, sheet, onSave, onCancel, onDelete }: { action: ActionEntry | null; sheet: CharacterSheet; onSave: (entry: ActionEntry) => void; onCancel: () => void; onDelete?: () => void }) {
  const [draft, setDraft] = useState(() => toDraft(action));
  const [error, setError] = useState("");
  const patch = (next: Partial<ActionEntry>) => setDraft((current) => ({ ...current, ...next }));
  const patchDamage = (index: number, next: Partial<ActionDamage>) => setDraft((current) => ({ ...current, damages: current.damages!.map((part, i) => i === index ? { ...part, ...next } : part) }));
  const preview = validate(draft) ? null : resolveAction(sheet, toEntry(draft));
  const save = () => { const problem = validate(draft); setError(problem); if (!problem) onSave(toEntry(draft)); };

  return <form className="action-form" onSubmit={(event) => { event.preventDefault(); save(); }}>
    <label><span>Nome</span><Input value={draft.name} onChange={(event) => patch({ name: event.target.value })} autoFocus/></label>

    <fieldset>
      <legend><label><input type="checkbox" checked={!!draft.attack} onChange={(event) => patch({ attack: event.target.checked ? { ability: "strength", bonus: 0, proficient: true } : undefined })}/> Tiro per colpire</label></legend>
      {draft.attack && <div className="action-form-row">
        <AbilitySelect label="Caratteristica attacco" value={draft.attack.ability} onChange={(ability) => patch({ attack: { ...draft.attack!, ability } })}/>
        <label><span>Bonus</span><Input type="number" value={draft.attack.bonus} onChange={(event) => patch({ attack: { ...draft.attack!, bonus: numberValue(event.target.value) } })}/></label>
        <label className="action-form-check"><input type="checkbox" checked={draft.attack.proficient} onChange={(event) => patch({ attack: { ...draft.attack!, proficient: event.target.checked } })}/> Competente</label>
      </div>}
    </fieldset>

    <div className="action-form-row">
      <label><span>Gittata</span><Input value={draft.range ?? ""} placeholder="1,5 m / 24/96 m / Se stesso (cono 18 m)" onChange={(event) => patch({ range: event.target.value || undefined })}/></label>
      <label><span>Bonus magico</span><Input type="number" value={draft.magicBonus ?? 0} onChange={(event) => patch({ magicBonus: numberValue(event.target.value) || undefined })}/></label>
      <label><span>Critico da</span><Input type="number" min={2} max={20} value={draft.critRange ?? 20} onChange={(event) => patch({ critRange: numberValue(event.target.value) })}/></label>
    </div>

    {draft.damages!.map((part, index) => <fieldset key={index}>
      <legend>{index === 0 ? "Danno" : "Secondo danno (facoltativo)"}</legend>
      <div className="action-form-row">
        <label><span>Dadi</span><Input value={part.dice} placeholder="1d8" onChange={(event) => patchDamage(index, { dice: event.target.value })}/></label>
        <AbilitySelect label={`Caratteristica danno ${index + 1}`} value={part.ability} onChange={(ability) => patchDamage(index, { ability })}/>
        <label><span>Bonus</span><Input type="number" value={part.bonus} onChange={(event) => patchDamage(index, { bonus: numberValue(event.target.value) })}/></label>
        <label><span>Tipo</span><Input value={part.type} placeholder="Tagliente" onChange={(event) => patchDamage(index, { type: event.target.value })}/></label>
        <label><span>Dadi critico</span><Input value={part.critDice} placeholder={diceOnly(part.dice) || "1d8"} onChange={(event) => patchDamage(index, { critDice: event.target.value })}/></label>
      </div>
    </fieldset>)}

    <fieldset>
      <legend><label><input type="checkbox" checked={!!draft.save} onChange={(event) => patch({ save: event.target.checked ? { ability: "dexterity", dc: "spell", effect: "" } : undefined })}/> Tiro salvezza</label></legend>
      {draft.save && <div className="action-form-row">
        <AbilitySelect label="Caratteristica tiro salvezza" extra={false} value={draft.save.ability} onChange={(ability) => patch({ save: { ...draft.save!, ability: ability as SaveAbility } })}/>
        <Select aria-label="CD" value={draft.save.dc === "spell" ? "spell" : "fixed"} onChange={(event) => patch({ save: { ...draft.save!, dc: event.target.value === "spell" ? "spell" : sheet.spellcasting.saveDc } })}>
          <option value="spell">CD incantesimi ({sheet.spellcasting.saveDc})</option>
          <option value="fixed">CD fissa</option>
        </Select>
        {draft.save.dc !== "spell" && <label><span>CD</span><Input type="number" value={draft.save.dc} onChange={(event) => patch({ save: { ...draft.save!, dc: numberValue(event.target.value) } })}/></label>}
        <label><span>Effetto</span><Input value={draft.save.effect} placeholder="metà danni" onChange={(event) => patch({ save: { ...draft.save!, effect: event.target.value } })}/></label>
      </div>}
    </fieldset>

    {(sheet.counters ?? []).length > 0 && <label><span>Consuma risorsa (1 per uso)</span><Select aria-label="Risorsa consumata" value={draft.resourceId ?? ""} onChange={(event) => patch({ resourceId: event.target.value || undefined })}><option value="">Nessuna</option>{sheet.counters!.map((counter) => <option key={counter.id} value={counter.id}>{counter.name}</option>)}</Select></label>}

    <label><span>Descrizione</span><Textarea value={draft.description ?? ""} onChange={(event) => patch({ description: event.target.value || undefined })}/></label>

    {preview && <p className="action-form-preview">{[preview.attackBonus != null && `Attacco ${signed(preview.attackBonus)}`, preview.damage && `Danno ${preview.damage}`, preview.attackBonus != null && preview.critDamage && `Critico ${preview.critDamage}`, preview.saveDc != null && `CD ${preview.saveDc}`].filter(Boolean).join(" · ") || "Nessun tiro"}</p>}
    {error && <Alert tone="danger">{error}</Alert>}
    <div className="action-form-buttons">
      {onDelete && <Button type="button" variant="destructive" onClick={() => { if (window.confirm(`Eliminare ${draft.name || "questa azione"}?`)) onDelete(); }}>Elimina</Button>}
      <Button type="button" variant="secondary" onClick={onCancel}>Annulla</Button>
      <Button type="submit">Salva</Button>
    </div>
  </form>;
}
