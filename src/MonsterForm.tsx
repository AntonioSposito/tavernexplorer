import { useState } from "react";
import { ABILITY_LABELS, ABILITY_SHORT, SKILL_ABILITIES } from "./constants";
import { MONSTER_ABILITIES, monsterDamages, MONSTER_DETAILS, MONSTER_SKILLS, monsterProficiency, monsterSkillLabel, monsterSlots, monsterSpellStats, monsterTokenSize, monsterXp, type MonsterSection } from "./monsterSheet";
import type { ActionEntry, MonsterSheet, MonsterSpellcasting } from "./types";
import { Button, Input, Select, Textarea } from "./ui";

const whole = (value: string) => Math.trunc(Number(value)) || 0;
const signed = (value: number) => `${value >= 0 ? "+" : ""}${value}`;
// TS e abilità sono facoltativi: il campo vuoto toglie il bonus.
const optional = (values: Record<string, number>, key: string, value: string) => {
  const next = { ...values };
  if (value.trim() === "") delete next[key]; else next[key] = whole(value);
  return next;
};
const optionalNumber = (value: string) => value.trim() === "" ? undefined : whole(value);

// Dati base dello statblock in un popup (tratti e azioni hanno i loro popup).
export function MonsterForm({ monster, onSave, onCancel }: { monster: MonsterSheet; onSave: (monster: MonsterSheet) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState(monster);
  const set = (patch: Partial<MonsterSheet>) => setDraft({ ...draft, ...patch });
  const cast = draft.spellcasting;
  const setCast = (patch: Partial<MonsterSpellcasting>) => cast && set({ spellcasting: { ...cast, ...patch } });
  const mod = (key: string) => Math.floor(((draft.abilities[key] ?? 10) - 10) / 2);
  const skillAbility = (skill: string) => MONSTER_ABILITIES.find(([, long]) => long === SKILL_ABILITIES[skill.replace(/ /g, "_")])?.[0] ?? "str";
  // Come "Competente" di Roll20: spuntato = modificatore + bonus competenza, il totale resta modificabile.
  const proficient = (field: "saves" | "skills", key: string, ability: string, label: string) => <input type="checkbox" aria-label={`Competente ${label}`} checked={draft[field][key] != null} onChange={(event) => set({ [field]: optional(draft[field], key, event.target.checked ? String(mod(ability) + monsterProficiency(draft)) : "") })}/>;
  return <form className="action-form" onSubmit={(event) => { event.preventDefault(); if (draft.name.trim()) onSave({ ...draft, name: draft.name.trim(), ...Object.fromEntries(MONSTER_DETAILS.map(([key]) => [key, draft[key]?.trim() || undefined])) }); }}>
    <label><span>Nome</span><Input aria-label="Nome del mostro" autoFocus required value={draft.name} onChange={(event) => set({ name: event.target.value })}/></label>
    <div className="action-form-row">
      <label><span>Taglia</span><Input aria-label="Taglia" value={draft.size} onChange={(event) => set({ size: event.target.value })}/></label>
      <label><span>Tipo</span><Input aria-label="Tipo" value={draft.creatureType} onChange={(event) => set({ creatureType: event.target.value })}/></label>
      <label><span>Allineamento</span><Input aria-label="Allineamento" value={draft.alignment} onChange={(event) => set({ alignment: event.target.value })}/></label>
    </div>
    <div className="action-form-row">
      <label><span>GS</span><Input aria-label="GS" value={draft.challengeRating} onChange={(event) => set({ challengeRating: event.target.value })}/></label>
      <label><span>PE</span><Input aria-label="PE" type="number" min="0" placeholder={String(monsterXp({ ...draft, xp: undefined }))} value={draft.xp ?? ""} onChange={(event) => set({ xp: optionalNumber(event.target.value) })}/></label>
      <label><span>Bonus competenza</span><Input aria-label="Bonus competenza" type="number" min="0" placeholder={String(monsterProficiency({ ...draft, proficiencyBonus: undefined }))} value={draft.proficiencyBonus ?? ""} onChange={(event) => set({ proficiencyBonus: optionalNumber(event.target.value) })}/></label>
      <label><span>Taglia token (quadretti)</span><Input aria-label="Taglia token" type="number" min="0.5" step="0.5" placeholder={String(monsterTokenSize({ size: draft.size }))} value={draft.tokenSize ?? ""} onChange={(event) => set({ tokenSize: event.target.value.trim() === "" ? undefined : Math.max(0.5, Number(event.target.value) || 1) })}/></label>
    </div>
    <div className="action-form-row">
      <label><span>CA</span><Input aria-label="CA" type="number" value={draft.ac} onChange={(event) => set({ ac: whole(event.target.value) })}/></label>
      <label><span>PF medi</span><Input aria-label="PF medi" type="number" min="1" value={draft.hp.average} onChange={(event) => set({ hp: { ...draft.hp, average: whole(event.target.value) } })}/></label>
      <label><span>Dadi vita</span><Input aria-label="Dadi vita" placeholder="2d8+2" value={draft.hp.formula} onChange={(event) => set({ hp: { ...draft.hp, formula: event.target.value } })}/></label>
      <label><span>Velocità</span><Input aria-label="Velocità" value={draft.speed} onChange={(event) => set({ speed: event.target.value })}/></label>
      <label><span>Percezione passiva</span><Input aria-label="Percezione passiva" type="number" value={draft.passivePerception} onChange={(event) => set({ passivePerception: whole(event.target.value) })}/></label>
    </div>
    <fieldset className="action-form-row"><legend>Caratteristiche</legend>
      {MONSTER_ABILITIES.map(([key, long]) => <label key={key}><span>{ABILITY_SHORT[long]}</span><Input aria-label={`Punteggio ${ABILITY_SHORT[long]}`} type="number" value={draft.abilities[key] ?? 10} onChange={(event) => set({ abilities: { ...draft.abilities, [key]: whole(event.target.value) } })}/></label>)}
    </fieldset>
    <fieldset className="action-form-row"><legend>Tiri salvezza (spunta = competente, vuoto = modificatore)</legend>
      {MONSTER_ABILITIES.map(([key, long]) => <div className="form-field" key={key}><span>{proficient("saves", key, key, `TS ${ABILITY_SHORT[long]}`)}{ABILITY_SHORT[long]}</span><Input aria-label={`TS ${ABILITY_SHORT[long]}`} placeholder={String(mod(key))} type="number" value={draft.saves[key] ?? ""} onChange={(event) => set({ saves: optional(draft.saves, key, event.target.value) })}/></div>)}
    </fieldset>
    <fieldset className="action-form-row"><legend>Abilità (spunta = competente, vuoto = modificatore)</legend>
      {MONSTER_SKILLS.map((key) => <div className="form-field" key={key}><span>{proficient("skills", key, skillAbility(key), monsterSkillLabel(key))}{monsterSkillLabel(key)}</span><Input aria-label={`Abilità ${monsterSkillLabel(key)}`} placeholder={String(mod(skillAbility(key)))} type="number" value={draft.skills[key] ?? ""} onChange={(event) => set({ skills: optional(draft.skills, key, event.target.value) })}/></div>)}
    </fieldset>
    <fieldset className="action-form-row"><legend>Difese, sensi e linguaggi</legend>
      {MONSTER_DETAILS.map(([key, label]) => <label key={key}><span>{label}</span><Input aria-label={label} value={draft[key] ?? ""} onChange={(event) => set({ [key]: event.target.value })}/></label>)}
    </fieldset>
    <fieldset className="action-form-row"><legend><label><input type="checkbox" checked={!!cast} onChange={(event) => set({ spellcasting: event.target.checked ? { ability: "intelligence", attackModifier: 0, dcModifier: 0, casterLevel: 0, slots: {} } : undefined })}/> Incantatore (Spellcasting NPC)</label></legend>
      {cast && <>
        <label><span>Caratteristica da incantatore</span><Select aria-label="Caratteristica da incantatore" value={cast.ability} onChange={(event) => setCast({ ability: event.target.value })}>{MONSTER_ABILITIES.map(([, long]) => <option key={long} value={long}>{ABILITY_LABELS[long]}</option>)}</Select></label>
        <label><span>Mod. attacco magico</span><Input aria-label="Mod. attacco magico" type="number" value={cast.attackModifier} onChange={(event) => setCast({ attackModifier: whole(event.target.value) })}/></label>
        <label><span>Mod. CD incantesimi</span><Input aria-label="Mod. CD incantesimi" type="number" value={cast.dcModifier} onChange={(event) => setCast({ dcModifier: whole(event.target.value) })}/></label>
        <label><span>Livello incantatore (slot)</span><Input aria-label="Livello incantatore" type="number" min="0" max="20" value={cast.casterLevel} onChange={(event) => { const casterLevel = Math.min(20, Math.max(0, whole(event.target.value))); setCast({ casterLevel, slots: monsterSlots(casterLevel, cast.slots) }); }}/></label>
        <p className="form-note">CD {monsterSpellStats(draft, cast).saveDc} · attacco {signed(monsterSpellStats(draft, cast).attackBonus)} · {Object.keys(cast.slots).length ? `slot fino al ${Object.keys(cast.slots).length}° livello` : "nessuno slot"}</p>
      </>}
    </fieldset>
    <div className="action-form-buttons"><Button type="button" variant="secondary" onClick={onCancel}>Annulla</Button><Button type="submit">Salva</Button></div>
  </form>;
}

// Popup di un tratto o di un'azione del mostro: valori fissi come nello statblock (i tratti hanno solo nome e testo).
export function MonsterEntryForm({ entry, section, onSave, onCancel, onDelete }: { entry: ActionEntry; section: MonsterSection; onSave: (entry: ActionEntry) => void; onCancel: () => void; onDelete?: () => void }) {
  const [draft, setDraft] = useState(entry);
  const set = (patch: Partial<ActionEntry>) => setDraft({ ...draft, ...patch });
  // Una riga per danno ("Danno", "Danno 2"… come Roll20) più una vuota per aggiungerne un altro.
  const [damages, setDamages] = useState(() => entry.damages?.length
    ? entry.damages.map((part) => ({ damage: `${part.dice}${part.bonus ? signed(part.bonus) : ""}`, type: part.type }))
    : entry.damage ? [{ damage: entry.damage, type: entry.damageType ?? "" }] : []);
  const rows = [...damages.filter((row) => row.damage || row.type), { damage: "", type: "" }];
  const setRow = (index: number, patch: Partial<{ damage: string; type: string }>) => setDamages(rows.map((row, at) => at === index ? { ...row, ...patch } : row));
  return <form className="action-form" onSubmit={(event) => { event.preventDefault(); if (draft.name.trim()) onSave({ ...draft, name: draft.name.trim(), ...monsterDamages(damages) }); }}>
    <label><span>Nome</span><Input aria-label="Nome voce" autoFocus required value={draft.name} onChange={(event) => set({ name: event.target.value })}/></label>
    {section !== "traits" && <div className="action-form-row">
      <label><span>Bonus attacco</span><Input aria-label="Bonus attacco" type="number" value={draft.attackBonus ?? ""} onChange={(event) => set({ attackBonus: optionalNumber(event.target.value) })}/></label>
      <label><span>CD TS</span><Input aria-label="CD TS" type="number" value={draft.saveDc ?? ""} onChange={(event) => set({ saveDc: optionalNumber(event.target.value) })}/></label>
    </div>}
    {section !== "traits" && rows.map((row, index) => { const suffix = index ? ` ${index + 1}` : ""; return <div className="action-form-row" key={index}>
      <label><span>Danno{suffix}</span><Input aria-label={`Danno${suffix}`} placeholder="1d6+2" value={row.damage} onChange={(event) => setRow(index, { damage: event.target.value })}/></label>
      <label><span>Tipo di danno{suffix}</span><Input aria-label={`Tipo di danno${suffix}`} value={row.type} onChange={(event) => setRow(index, { type: event.target.value })}/></label>
    </div>; })}
    <label><span>Descrizione</span><Textarea aria-label="Descrizione voce" rows={6} value={draft.description ?? ""} onChange={(event) => set({ description: event.target.value })}/></label>
    <div className="action-form-buttons">{onDelete && <Button type="button" variant="destructive" onClick={onDelete}>Elimina</Button>}<Button type="button" variant="secondary" onClick={onCancel}>Annulla</Button><Button type="submit">Salva</Button></div>
  </form>;
}
