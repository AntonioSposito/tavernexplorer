import { useEffect, useMemo, useState, type ReactNode } from "react";
import { buildCharacter, POINT_BUDGET, POINT_COST, STANDARD_ARRAY, type CharacterChoices } from "./buildCharacter";
import { ABILITY_LABELS, SKILL_LABELS } from "./constants";
import { roll } from "./dice";
import { armorClass } from "./effects";
import { loadCharacterOptions, loadItems } from "./fivetoolsApi";
import { STANDARD_LANGUAGES, type CharacterOptions, type EquipmentOption, type ToolGrant, type ToolKind } from "./fivetoolsCharacter";
import type { FiveToolsItem } from "./import5etools";
import type { CharacterSheet } from "./types";
import { Alert, Button, Input, Select, Spinner } from "./ui";

// Creazione guidata di livello 1 con le regole del PHB 2024 e i dati 5e.tools (XPHB).
const ABILITIES = Object.keys(ABILITY_LABELS);
const KIND_LABELS: Record<ToolKind, string> = { artisan: "Artisan's Tools", instrument: "Instrument", gaming: "Gaming Set" };
type Method = "standard" | "points" | "roll" | "manual";
const sorted = (values: number[]) => [...values].sort((a, b) => a - b).join(",");
// 4d6, si scarta il dado più basso.
const rollScore = () => { const dice = roll("4d6").dice; return dice.reduce((sum, die) => sum + die, 0) - Math.min(...dice); };
const blankChoices = (name: string): CharacterChoices => ({ name, className: "", background: "", species: "", scores: {}, bonuses: {}, classSkills: [], speciesSkills: [], classTools: [], backgroundTools: [], languages: [], classEquipment: "", backgroundEquipment: "", cantrips: [], spells: [] });

export function CharacterWizard({ name, onCreate, onCancel }: { name: string; onCreate: (sheet: CharacterSheet) => void; onCancel: () => void }) {
  const [data, setData] = useState<{ options: CharacterOptions; items: FiveToolsItem[] } | string | null>(null);
  useEffect(() => { Promise.all([loadCharacterOptions(), loadItems()]).then(([options, items]) => setData({ options, items }), (error: unknown) => setData(error instanceof Error ? error.message : "Dati 5e.tools non disponibili")); }, []);
  if (data === null) return <div className="action-form"><p><Spinner/> Caricamento delle regole da 5e.tools…</p></div>;
  if (typeof data === "string") return <div className="action-form"><Alert tone="danger">{data}</Alert><div className="action-form-buttons"><Button variant="secondary" onClick={onCancel}>Chiudi</Button></div></div>;
  return <Steps name={name} options={data.options} items={data.items} onCreate={onCreate} onCancel={onCancel}/>;
}

function Steps({ name, options, items, onCreate, onCancel }: { name: string; options: CharacterOptions; items: FiveToolsItem[]; onCreate: (sheet: CharacterSheet) => void; onCancel: () => void }) {
  const [choices, setChoices] = useState(() => blankChoices(name));
  const [step, setStep] = useState(0);
  const [method, setMethod] = useState<Method>("standard");
  const [pool, setPool] = useState(STANDARD_ARRAY);
  const [split, setSplit] = useState<"21" | "111">("21");
  const patch = (change: Partial<CharacterChoices>) => setChoices((current) => ({ ...current, ...change }));
  const cls = options.classes.find((item) => item.name === choices.className);
  const background = options.backgrounds.find((item) => item.name === choices.background);
  const species = options.species.find((item) => item.name === choices.species);
  const casts = !!cls && cls.cantrips + cls.spells > 0;
  const steps = ["Classe", "Background", "Specie", "Caratteristiche", "Competenze", "Equipaggiamento", ...casts ? ["Incantesimi"] : [], "Riepilogo"];
  const current = steps[step];
  const toolsByKind = useMemo(() => Object.fromEntries((Object.keys(KIND_LABELS) as ToolKind[]).map((kind) => [kind, items.filter((item) => item.source === "XPHB" && item.detail.includes(`· ${KIND_LABELS[kind]}`)).map((item) => item.name)])) as Record<ToolKind, string[]>, [items]);
  const choiceGrants = (grants: ToolGrant[] = []) => grants.flatMap((grant) => "kinds" in grant ? Array.from({ length: grant.count }, () => grant.kinds) : []);
  const classToolSlots = choiceGrants(cls?.tools);
  const backgroundToolSlots = choiceGrants(background?.tools);
  const classSkillPool = (cls?.skills.from ?? []).filter((skill) => !background?.skills.includes(skill));
  const speciesSkillPool = (species?.skills?.from ?? []).filter((skill) => !background?.skills.includes(skill) && !choices.classSkills.includes(skill));
  const classSpells = options.spells.filter((spell) => cls && spell.classes.includes(cls.name));

  const scoresValid = method === "points"
    ? ABILITIES.every((key) => choices.scores[key] >= 8 && choices.scores[key] <= 15) && ABILITIES.reduce((sum, key) => sum + POINT_COST[choices.scores[key]], 0) <= POINT_BUDGET
    // Tiri fatti con i dadi veri: 4d6 senza il più basso va da 3 a 18.
    : method === "manual" ? ABILITIES.every((key) => Number.isInteger(choices.scores[key]) && choices.scores[key] >= 3 && choices.scores[key] <= 18)
    : ABILITIES.every((key) => choices.scores[key]) && sorted(ABILITIES.map((key) => choices.scores[key])) === sorted(pool);
  const bonusValues = Object.values(choices.bonuses).filter(Boolean);
  const valid: Record<string, boolean> = {
    Classe: !!cls, Background: !!background, Specie: !!species && (!species.originFeat || !!choices.speciesFeat),
    Caratteristiche: scoresValid && bonusValues.reduce((sum, value) => sum + value, 0) === 3 && bonusValues.length === (split === "21" ? 2 : 3),
    Competenze: choices.classSkills.length === Math.min(cls?.skills.count ?? 0, classSkillPool.length) && choices.speciesSkills.length === Math.min(species?.skills?.count ?? 0, speciesSkillPool.length)
      && choices.classTools.filter(Boolean).length === classToolSlots.length && choices.backgroundTools.filter(Boolean).length === backgroundToolSlots.length && new Set(choices.languages.filter(Boolean)).size === 2,
    Equipaggiamento: !!choices.classEquipment && !!choices.backgroundEquipment,
    Incantesimi: choices.cantrips.length === Math.min(cls?.cantrips ?? 0, classSpells.filter((spell) => spell.level === 0).length) && choices.spells.length === Math.min(cls?.spells ?? 0, classSpells.filter((spell) => spell.level === 1).length),
    Riepilogo: !!choices.name.trim(),
  };
  const preview = useMemo(() => { if (current !== "Riepilogo") return null; try { return buildCharacter(choices, options, items); } catch { return null; } }, [current, choices, options, items]);

  const setMethodAndScores = (next: Method) => { setMethod(next); setPool(next === "roll" ? Array.from({ length: 6 }, rollScore) : STANDARD_ARRAY); patch({ scores: next === "points" ? Object.fromEntries(ABILITIES.map((key) => [key, 8])) : {} }); };
  const setBonus = (rank: 2 | 1, ability: string) => patch({ bonuses: { ...Object.fromEntries(Object.entries(choices.bonuses).filter(([key, value]) => value !== rank && key !== ability)), ...ability ? { [ability]: rank } : {} } });

  return <form className="action-form" onSubmit={(event) => { event.preventDefault(); if (!valid[current]) return; if (current === "Riepilogo" && preview) onCreate(preview); else setStep(step + 1); }}>
    <p className="muted">Passo {step + 1} di {steps.length} · <strong>{current}</strong></p>
    {current === "Classe" && <>
      <Pick label="Classe" value={choices.className} values={options.classes.map((item) => item.name)} onChange={(className) => patch({ className, classSkills: [], classTools: [], classEquipment: "", cantrips: [], spells: [] })}/>
      {cls && <Summary rows={[["Dado vita", `d${cls.hitDie}`], ["Tiri salvezza", cls.saves.map((key) => ABILITY_LABELS[key]).join(", ")], ["Armature", cls.armor.join(", ") || "nessuna"], ["Armi", cls.weapons.join(", ")], ["Privilegi di livello 1", cls.features.map((feature) => feature.name).join(", ")]]}/>}
    </>}
    {current === "Background" && <>
      <Pick label="Background" value={choices.background} values={options.backgrounds.map((item) => item.name)} onChange={(value) => patch({ background: value, bonuses: {}, backgroundTools: [], backgroundEquipment: "", classSkills: [], speciesSkills: [] })}/>
      {background && <Summary rows={[["Caratteristiche", background.abilities.map((key) => ABILITY_LABELS[key]).join(", ")], ["Talento d'origine", background.feat], ["Abilità", background.skills.map((key) => SKILL_LABELS[key]).join(", ")], ["Strumenti", background.tools.map((grant) => "name" in grant ? grant.name : `${grant.kinds.map((kind) => KIND_LABELS[kind]).join(" o ")} a scelta`).join(", ")]]}/>}
    </>}
    {current === "Specie" && <>
      <Pick label="Specie" value={choices.species} values={options.species.map((item) => item.name)} onChange={(value) => patch({ species: value, speciesSkills: [], speciesFeat: undefined })}/>
      {species?.originFeat && <Pick label="Talento d'origine (Versatile)" value={choices.speciesFeat ?? ""} values={options.feats.map((feat) => feat.name)} onChange={(speciesFeat) => patch({ speciesFeat })}/>}
      {species && <Summary rows={[["Velocità", `${species.speed} ft.`], ["Tratti", species.traits.map((trait) => trait.name).join(", ")]]}/>}
    </>}
    {current === "Caratteristiche" && background && <>
      <label><span>Metodo</span><Select aria-label="Metodo dei punteggi" value={method} onChange={(event) => setMethodAndScores(event.target.value as Method)}><option value="standard">Serie standard (15, 14, 13, 12, 10, 8)</option><option value="points">Acquisto a punti (27)</option><option value="roll">4d6, si scarta il più basso</option><option value="manual">Tiri a mano (dadi veri)</option></Select></label>
      {method === "roll" && <p className="muted">Tiri: {pool.join(", ")} <Button type="button" variant="ghost" onClick={() => setMethodAndScores("roll")}>Ritira</Button></p>}
      {method === "points" && <p className="muted">Punti spesi: {ABILITIES.reduce((sum, key) => sum + (POINT_COST[choices.scores[key]] ?? 0), 0)} / {POINT_BUDGET}</p>}
      {method === "manual" && <p className="muted">Tira 4d6 sei volte, scarta il dado più basso e scrivi i risultati (3–18).</p>}
      <div className="action-form-row">{ABILITIES.map((key) => method === "manual"
        ? <label key={key}><span>{ABILITY_LABELS[key]}</span><Input type="number" min="3" max="18" aria-label={`Punteggio ${ABILITY_LABELS[key]}`} value={choices.scores[key] || ""} onChange={(event) => patch({ scores: { ...choices.scores, [key]: Math.trunc(Number(event.target.value)) } })}/></label>
        : method === "points"
        ? <label key={key}><span>{ABILITY_LABELS[key]}</span><Input type="number" min="8" max="15" aria-label={`Punteggio ${ABILITY_LABELS[key]}`} value={choices.scores[key] ?? 8} onChange={(event) => patch({ scores: { ...choices.scores, [key]: Math.trunc(Number(event.target.value)) || 8 } })}/></label>
        : <label key={key}><span>{ABILITY_LABELS[key]}</span><Select aria-label={`Punteggio ${ABILITY_LABELS[key]}`} value={choices.scores[key] ?? ""} onChange={(event) => patch({ scores: { ...choices.scores, [key]: Number(event.target.value) } })}><option value="">—</option>{[...new Set(pool)].sort((a, b) => b - a).map((value) => <option key={value} value={value}>{value}</option>)}</Select></label>)}</div>
      <label><span>Bonus del background</span><Select aria-label="Bonus del background" value={split} onChange={(event) => { const next = event.target.value as "21" | "111"; setSplit(next); patch({ bonuses: next === "111" ? Object.fromEntries(background.abilities.map((key) => [key, 1])) : {} }); }}><option value="21">+2 e +1</option><option value="111">+1 a tutte e tre</option></Select></label>
      {split === "21" && <div className="action-form-row">{([2, 1] as const).map((rank) => <label key={rank}><span>+{rank}</span><Select aria-label={`Bonus +${rank}`} value={Object.entries(choices.bonuses).find(([, value]) => value === rank)?.[0] ?? ""} onChange={(event) => setBonus(rank, event.target.value)}><option value="">—</option>{background.abilities.map((key) => <option key={key} value={key}>{ABILITY_LABELS[key]}</option>)}</Select></label>)}</div>}
    </>}
    {current === "Competenze" && cls && background && <>
      <Checks legend={`Abilità della classe (${cls.skills.count})`} options={classSkillPool} selected={choices.classSkills} max={cls.skills.count} onChange={(classSkills) => patch({ classSkills, speciesSkills: choices.speciesSkills.filter((skill) => !classSkills.includes(skill)) })}/>
      {species?.skills && <Checks legend={`Abilità della specie (${species.skills.count})`} options={speciesSkillPool} selected={choices.speciesSkills} max={species.skills.count} onChange={(speciesSkills) => patch({ speciesSkills })}/>}
      <p className="muted">Dal background: {background.skills.map((key) => SKILL_LABELS[key]).join(", ")}.</p>
      {classToolSlots.map((kinds, index) => <Pick key={`c${index}`} label={`Strumento della classe ${index + 1}`} value={choices.classTools[index] ?? ""} values={kinds.flatMap((kind) => toolsByKind[kind])} onChange={(tool) => { const next = [...choices.classTools]; next[index] = tool; patch({ classTools: next }); }}/>)}
      {backgroundToolSlots.map((kinds, index) => <Pick key={`b${index}`} label="Strumento del background" value={choices.backgroundTools[index] ?? ""} values={kinds.flatMap((kind) => toolsByKind[kind])} onChange={(tool) => { const next = [...choices.backgroundTools]; next[index] = tool; patch({ backgroundTools: next }); }}/>)}
      <div className="action-form-row">{[0, 1].map((index) => <Pick key={index} label={`Lingua ${index + 2} (oltre al Comune)`} value={choices.languages[index] ?? ""} values={STANDARD_LANGUAGES} onChange={(language) => { const next = [...choices.languages]; next[index] = language; patch({ languages: next }); }}/>)}</div>
    </>}
    {current === "Equipaggiamento" && cls && background && <>
      <Package legend={`Equipaggiamento di ${cls.name}`} options={cls.equipment} value={choices.classEquipment} onChange={(classEquipment) => patch({ classEquipment })}/>
      <Package legend={`Equipaggiamento di ${background.name}`} options={background.equipment} value={choices.backgroundEquipment} onChange={(backgroundEquipment) => patch({ backgroundEquipment })}/>
    </>}
    {current === "Incantesimi" && cls && <>
      {cls.cantrips > 0 && <Checks legend={`Trucchetti (${cls.cantrips})`} options={classSpells.filter((spell) => spell.level === 0).map((spell) => spell.name)} selected={choices.cantrips} max={cls.cantrips} onChange={(cantrips) => patch({ cantrips })} label={(value) => value}/>}
      {cls.spells > 0 && <Checks legend={cls.spells > cls.prepared ? `Incantesimi di 1° livello nel libro (${cls.spells}; i primi ${cls.prepared} scelti sono preparati)` : `Incantesimi di 1° livello preparati (${cls.spells})`} options={classSpells.filter((spell) => spell.level === 1).map((spell) => spell.name)} selected={choices.spells} max={cls.spells} onChange={(spells) => patch({ spells })} label={(value) => value}/>}
    </>}
    {current === "Riepilogo" && <>
      <label><span>Nome</span><Input aria-label="Nome del personaggio" required value={choices.name} onChange={(event) => patch({ name: event.target.value })}/></label>
      {preview && <Summary rows={[["Classe", `${preview.identity.className} 1 · ${preview.identity.race} · ${preview.identity.background}`], ["Caratteristiche", ABILITIES.map((key) => `${ABILITY_LABELS[key].slice(0, 3)} ${preview.abilities[key].score}`).join(" · ")], ["PF", String(preview.combat.hp.current)], ["CA", String(armorClass(preview).total)], ["Zaino", preview.inventory.map((item) => item.name).join(", ") || "vuoto"]]}/>}
      <p className="muted">Le scelte dei privilegi (es. Stile di combattimento, lignaggio) sono nei Tratti: completale nella scheda.</p>
    </>}
    <div className="action-form-buttons">
      <Button type="button" variant="secondary" onClick={() => step ? setStep(step - 1) : onCancel()}>{step ? "Indietro" : "Annulla"}</Button>
      <Button type="submit" disabled={!valid[current]}>{current === "Riepilogo" ? "Crea personaggio" : "Avanti"}</Button>
    </div>
  </form>;
}

function Pick({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return <label><span>{label}</span><Select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}><option value="">—</option>{values.map((item) => <option key={item} value={item}>{item}</option>)}</Select></label>;
}

function Checks({ legend, options, selected, max, onChange, label = (value) => SKILL_LABELS[value] ?? value }: { legend: string; options: string[]; selected: string[]; max: number; onChange: (values: string[]) => void; label?: (value: string) => string }) {
  return <fieldset><legend>{legend}</legend>{options.map((option) => <label key={option} className="action-form-check"><input type="checkbox" checked={selected.includes(option)} disabled={!selected.includes(option) && selected.length >= max} onChange={(event) => onChange(event.target.checked ? [...selected, option] : selected.filter((item) => item !== option))}/> {label(option)}</label>)}</fieldset>;
}

function Package({ legend, options, value, onChange }: { legend: string; options: EquipmentOption[]; value: string; onChange: (value: string) => void }) {
  const describe = (option: EquipmentOption) => [...option.items.map((item) => `${item.quantity > 1 ? `${item.quantity} ` : ""}${item.name}`), ...option.tools.map((kind) => `${KIND_LABELS[kind]} (lo strumento scelto)`), option.copper && `${option.copper / 100} mo`].filter(Boolean).join(", ");
  return <fieldset><legend>{legend}</legend>{options.map((option) => <label key={option.key} className="action-form-check"><input type="radio" name={legend} checked={value === option.key} onChange={() => onChange(option.key)}/> ({option.key}) {describe(option)}</label>)}</fieldset>;
}

function Summary({ rows }: { rows: Array<[string, ReactNode]> }) {
  return <dl className="wizard-summary">{rows.map(([term, detail]) => <div key={term}><dt>{term}</dt><dd>{detail}</dd></div>)}</dl>;
}
