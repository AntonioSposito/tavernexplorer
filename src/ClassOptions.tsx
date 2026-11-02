import { CLASSES, casterLevel, classDisplay } from "./classes";
import { applyClassChanges, derivedSlots } from "./classSync";
import { ABILITY_LABELS } from "./constants";
import type { CharacterClass, CharacterSheet, ClassCaster, SheetOptions } from "./types";
import { Button, Card, Input, Select } from "./ui";

const CASTERS: Array<[ClassCaster, string]> = [["none", "Nessuno"], ["full", "Pieno"], ["half", "Mezzo"], ["third", "Terzo"], ["pact", "Patto (Warlock)"]];
const ORDINALS = ["Classe principale", "2ª classe", "3ª classe", "4ª classe"];

// Classi e opzioni di classe di Roll20: multiclasse fino a 4, classe personalizzata, slot e livello da incantatore.
// Con "Calcolo automatico dei livelli" ogni modifica riscrive livello, dadi vita, slot, TS e caratteristica da incantatore.
export function ClassOptions({ sheet, onUpdate }: { sheet: CharacterSheet; onUpdate: (update: (sheet: CharacterSheet) => CharacterSheet) => void }) {
  const classes = sheet.classes ?? [];
  const options = sheet.options ?? {};
  const change = (update: (next: CharacterSheet) => void) => onUpdate((next) => { const previous = structuredClone(next); update(next); applyClassChanges(next, previous); return next; });
  const setClass = (index: number, patch: Partial<CharacterClass>) => change((next) => { next.classes = (next.classes ?? []).map((entry, position) => position === index ? { ...entry, ...patch } : entry); });
  const setOption = <K extends keyof SheetOptions>(key: K, value: SheetOptions[K]) => change((next) => { next.options = { ...next.options, [key]: value }; });
  const slots = derivedSlots(sheet);
  const arcane = { fighter: options.arcaneFighter, rogue: options.arcaneRogue };

  return <Card className="class-options"><h2>Classi</h2>
    <label className="action-form-check"><input type="checkbox" checked={!!options.autoLevel} onChange={(event) => setOption("autoLevel", event.target.checked)}/> Calcolo automatico dei livelli (livello, dadi vita, slot, TS e caratteristica da incantatore dalle classi)</label>
    {classes.map((entry, index) => <div className="class-row" key={index}>
      <strong>{ORDINALS[index]}</strong>
      <label><span>Classe</span><Select aria-label={`${ORDINALS[index]}: classe`} value={entry.custom ? "custom" : entry.name} onChange={(event) => setClass(index, event.target.value === "custom" ? { name: entry.name || "Classe personalizzata", custom: { hitDie: 8, caster: "none", saves: [] } } : { name: event.target.value, custom: undefined })}>
        {!entry.custom && !CLASSES[entry.name] && <option value={entry.name}>{entry.name}</option>}
        {Object.keys(CLASSES).map((name) => <option key={name} value={name}>{name}</option>)}
        <option value="custom">Personalizzata…</option>
      </Select></label>
      <label><span>Livello</span><Input type="number" min="1" max="20" aria-label={`${ORDINALS[index]}: livello`} value={entry.level} onChange={(event) => setClass(index, { level: Math.min(20, Math.max(1, Math.trunc(Number(event.target.value)) || 1)) })}/></label>
      <label><span>Sottoclasse</span><Input aria-label={`${ORDINALS[index]}: sottoclasse`} value={entry.subclass ?? ""} placeholder="Eldritch Knight…" onChange={(event) => setClass(index, { subclass: event.target.value || undefined })}/></label>
      {index > 0 && <Button variant="ghost" aria-label={`Rimuovi ${ORDINALS[index]}`} onClick={() => change((next) => { next.classes = (next.classes ?? []).filter((_, position) => position !== index); })}>×</Button>}
      {entry.custom && <div className="custom-class">
        <label><span>Nome</span><Input aria-label={`${ORDINALS[index]}: nome`} value={entry.name} onChange={(event) => setClass(index, { name: event.target.value })}/></label>
        <label><span>Dado vita</span><Select aria-label={`${ORDINALS[index]}: dado vita`} value={String(entry.custom.hitDie)} onChange={(event) => setClass(index, { custom: { ...entry.custom!, hitDie: Number(event.target.value) } })}>{[4, 6, 8, 10, 12].map((die) => <option key={die} value={die}>D{die}</option>)}</Select></label>
        <label><span>Caratteristica da incantatore</span><Select aria-label={`${ORDINALS[index]}: caratteristica da incantatore`} value={entry.custom.spellAbility ?? ""} onChange={(event) => setClass(index, { custom: { ...entry.custom!, spellAbility: event.target.value || undefined } })}><option value="">Nessuna</option>{Object.entries(ABILITY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select></label>
        <label><span>Slot incantesimo</span><Select aria-label={`${ORDINALS[index]}: slot`} value={entry.custom.caster} onChange={(event) => setClass(index, { custom: { ...entry.custom!, caster: event.target.value as ClassCaster } })}>{CASTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></label>
        <div className="custom-saves"><span>TS</span>{Object.entries(ABILITY_LABELS).map(([key, label]) => <label key={key} className="action-form-check"><input type="checkbox" checked={entry.custom!.saves.includes(key)} onChange={(event) => setClass(index, { custom: { ...entry.custom!, saves: event.target.checked ? [...entry.custom!.saves, key] : entry.custom!.saves.filter((save) => save !== key) } })}/> {label}</label>)}</div>
      </div>}
    </div>)}
    {classes.length < 4 && <div className="library-actions"><Button variant="outline" onClick={() => change((next) => { next.classes = [...next.classes ?? [], { name: next.classes?.length ? "Fighter" : next.identity.className || "Fighter", level: 1 }]; })}>{classes.length ? "+ Multiclasse" : "+ Classe principale"}</Button></div>}
    <div className="class-flags">
      <label className="action-form-check"><input type="checkbox" checked={!!options.arcaneFighter} onChange={(event) => setOption("arcaneFighter", event.target.checked)}/> Arcane fighter</label>
      <label className="action-form-check"><input type="checkbox" checked={!!options.arcaneRogue} onChange={(event) => setOption("arcaneRogue", event.target.checked)}/> Arcane rogue</label>
      <label className="action-form-check"><input type="checkbox" checked={!!options.trackHitDicePerClass} onChange={(event) => setOption("trackHitDicePerClass", event.target.checked)}/> Dadi vita per classe</label>
    </div>
    <div className="editor-grid">
      <label><span>Livello da incantatore (0 = dalle classi)</span><Input type="number" min="0" max="20" aria-label="Livello da incantatore" value={options.casterLevel ?? 0} onChange={(event) => setOption("casterLevel", Math.min(20, Math.max(0, Math.trunc(Number(event.target.value)) || 0)))}/></label>
    </div>
    <div className="slot-bonus"><span>Modificatori slot</span>{Array.from({ length: 9 }, (_, index) => <label key={index}><span>{index + 1}°</span><Input type="number" aria-label={`Modificatore slot ${index + 1}°`} value={options.slotBonus?.[index] ?? 0} onChange={(event) => { const bonus = [...options.slotBonus ?? Array(9).fill(0)]; bonus[index] = Math.trunc(Number(event.target.value)) || 0; setOption("slotBonus", bonus); }}/></label>)}</div>
    {classes.length > 0 && <p className="muted">{classDisplay(classes)} · livello {classes.reduce((sum, entry) => sum + entry.level, 0)} · livello da incantatore {options.casterLevel || casterLevel(classes, arcane)} · slot {Object.entries(slots).map(([key, total]) => `${key.replace("level_", "")}°: ${total}`).join(", ") || "nessuno"}{!options.autoLevel && " (non applicati: calcolo automatico spento)"}</p>}
  </Card>;
}
