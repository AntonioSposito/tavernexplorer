import { useState } from "react";
import { ABILITY_LABELS } from "./constants";
import { HIGHER_DICE, SPELL_SCHOOLS, toSpell, toSpellDraft, validateSpell, type SaveAbility, type SpellDraft } from "./spells";
import type { ActionAbility, SpellEntry } from "./types";
import { Alert, Button, Input, Select, Textarea } from "./ui";

const ABILITIES = Object.keys(ABILITY_LABELS) as SaveAbility[];
const numberValue = (value: string) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : 0;

export function SpellForm({ spell, level, onSave, onCancel, onDelete }: { spell: SpellEntry | null; level: number; onSave: (spell: SpellEntry) => void; onCancel: () => void; onDelete?: () => void }) {
  const [draft, setDraft] = useState(() => toSpellDraft(spell));
  const [error, setError] = useState("");
  const patch = (next: Partial<SpellDraft>) => setDraft((current) => ({ ...current, ...next }));
  const save = () => { const problem = validateSpell(draft); setError(problem); if (!problem) onSave(toSpell(draft, { id: spell?.id ?? crypto.randomUUID(), level: spell?.level ?? level, prepared: spell?.prepared ?? true, source: spell?.source ?? "spell" })); };
  const field = (label: string, key: "castingTime" | "range" | "target" | "duration" | "innate" | "spellClass" | "spellType", placeholder = "") =>
    <label><span>{label}</span><Input value={draft[key]} placeholder={placeholder} onChange={(event) => patch({ [key]: event.target.value })}/></label>;
  const check = (label: string, key: "ritual" | "verbal" | "somatic" | "material" | "concentration" | "addAbilityMod" | "includeDescription") =>
    <label className="action-form-check"><input type="checkbox" checked={draft[key]} onChange={(event) => patch({ [key]: event.target.checked })}/> {label}</label>;
  const schools = draft.school && !SPELL_SCHOOLS.includes(draft.school) ? [draft.school, ...SPELL_SCHOOLS] : SPELL_SCHOOLS;

  return <form className="action-form spell-form" onSubmit={(event) => { event.preventDefault(); save(); }}>
    <label><span>Nome</span><Input value={draft.name} onChange={(event) => patch({ name: event.target.value })} autoFocus/></label>
    <div className="action-form-row">
      <label><span>Scuola</span><Select value={draft.school} onChange={(event) => patch({ school: event.target.value })}><option value="">—</option>{schools.map((school) => <option key={school} value={school}>{school}</option>)}</Select></label>
      {check("Rituale", "ritual")}
    </div>
    <div className="action-form-row">{field("Tempo di lancio", "castingTime", "1 azione")}{field("Gittata", "range", "36 metri")}{field("Bersaglio", "target", "un bersaglio")}</div>
    <fieldset>
      <legend>Componenti</legend>
      <div className="check-row">{check("V", "verbal")}{check("S", "somatic")}{check("M", "material")}</div>
      {draft.material && <Input aria-label="Materiali" value={draft.materials} placeholder="polvere di rubino del valore di 50 mo" onChange={(event) => patch({ materials: event.target.value })}/>}
    </fieldset>
    <div className="action-form-row">{check("Concentrazione", "concentration")}{field("Durata", "duration", "istantanea")}</div>
    <div className="action-form-row">
      <label><span>Caratteristica da incantatore</span><Select value={draft.castingAbility} onChange={(event) => patch({ castingAbility: event.target.value as ActionAbility })}><option value="spell">Quella della scheda</option>{ABILITIES.map((key) => <option key={key} value={key}>{ABILITY_LABELS[key]}</option>)}</Select></label>
      {field("Innato", "innate", "1/giorno")}
    </div>
    <fieldset>
      <legend>Risultato</legend>
      <div className="action-form-row">
        <label><span>Uscita</span><Select value={draft.output} onChange={(event) => patch({ output: event.target.value as SpellDraft["output"] })}><option value="attack">Attacco</option><option value="spellcard">Scheda incantesimo</option></Select></label>
        {draft.output === "attack" && <label><span>Attacco con incantesimo</span><Select value={draft.spellAttack} onChange={(event) => patch({ spellAttack: event.target.value as SpellDraft["spellAttack"] })}><option value="none">Nessuno</option><option value="melee">In mischia</option><option value="ranged">A distanza</option></Select></label>}
      </div>
      {draft.output === "attack" && <>
        <div className="action-form-row">
          <label><span>Danno</span><Input value={draft.damage} placeholder="1d4+1" onChange={(event) => patch({ damage: event.target.value })}/></label>
          <label><span>Tipo</span><Input value={draft.damageType} placeholder="Forza" onChange={(event) => patch({ damageType: event.target.value })}/></label>
        </div>
        <div className="action-form-row">
          <label><span>Danno 2</span><Input value={draft.damage2} onChange={(event) => patch({ damage2: event.target.value })}/></label>
          <label><span>Tipo</span><Input aria-label="Tipo danno 2" value={draft.damage2Type} onChange={(event) => patch({ damage2Type: event.target.value })}/></label>
        </div>
        <div className="action-form-row">
          <label><span>Cura</span><Input value={draft.healing} placeholder="1d8" onChange={(event) => patch({ healing: event.target.value })}/></label>
          {check("Aggiungi il modificatore a danno o cura", "addAbilityMod")}
        </div>
        <div className="action-form-row">
          <label><span>Tiro salvezza</span><Select value={draft.saveAbility} onChange={(event) => patch({ saveAbility: event.target.value as SpellDraft["saveAbility"] })}><option value="">Nessuno</option>{ABILITIES.map((key) => <option key={key} value={key}>{ABILITY_LABELS[key]}</option>)}</Select></label>
          {draft.saveAbility && <label><span>Effetto</span><Input value={draft.saveEffect} placeholder="metà danni" onChange={(event) => patch({ saveEffect: event.target.value })}/></label>}
        </div>
        <div className="action-form-row">
          <label><span>Danno ai livelli superiori</span><Input type="number" min={1} value={draft.higherCount} onChange={(event) => patch({ higherCount: numberValue(event.target.value) })}/></label>
          <label><span>Dado</span><Select value={draft.higherDie} onChange={(event) => patch({ higherDie: event.target.value })}><option value="">Nessuno</option>{HIGHER_DICE.map((die) => <option key={die} value={die}>{die}</option>)}</Select></label>
          <label><span>+ Bonus</span><Input type="number" value={draft.higherBonus} onChange={(event) => patch({ higherBonus: numberValue(event.target.value) })}/></label>
        </div>
        {check("Includi la descrizione nell'attacco", "includeDescription")}
      </>}
    </fieldset>
    <label><span>Descrizione</span><Textarea value={draft.description} onChange={(event) => patch({ description: event.target.value })}/></label>
    <label><span>Ai livelli superiori</span><Textarea value={draft.higherLevelText} onChange={(event) => patch({ higherLevelText: event.target.value })}/></label>
    <div className="action-form-row">{field("Classe", "spellClass")}{field("Tipo", "spellType")}</div>
    {error && <Alert tone="danger">{error}</Alert>}
    <div className="action-form-buttons">
      {onDelete && <Button type="button" variant="destructive" onClick={() => { if (window.confirm(`Eliminare ${draft.name || "questo incantesimo"}?`)) onDelete(); }}>Elimina</Button>}
      <Button type="button" variant="secondary" onClick={onCancel}>Annulla</Button>
      <Button type="submit">Salva</Button>
    </div>
  </form>;
}
