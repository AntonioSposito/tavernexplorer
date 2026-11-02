import { ABILITY_LABELS, ABILITY_SHORT, SKILL_ABILITIES, SKILL_LABELS } from "./constants";
import { ClassOptions } from "./ClassOptions";
import { effectiveProficiency, proficiencyByLevel } from "./effects";
import type { CharacterSheet, RollMode, SheetOptions } from "./types";
import { Card, Input, Select } from "./ui";

const ABILITIES = Object.keys(ABILITY_LABELS);
const MODES: Array<[RollMode, string]> = [["normal", "Normale"], ["advantage", "Vantaggio"], ["disadvantage", "Svantaggio"]];

// Tab "Modifica (prova)": le opzioni della pagina impostazioni di Roll20 (fase A + B).
// I bonus partono da 0 e si sommano ai valori importati; compaiono nei tooltip come "Opzioni".
export function SheetOptionsPanel({ sheet, onUpdate }: { sheet: CharacterSheet; onUpdate: (update: (sheet: CharacterSheet) => CharacterSheet) => void }) {
  const options = sheet.options ?? {};
  const setOptions = (change: (options: SheetOptions) => void) => onUpdate((next) => { const updated = { ...next.options }; change(updated); next.options = updated; return next; });
  const bonus = (target: string, label: string) => <label key={target}><span>{label}</span><Input type="number" aria-label={label} value={options.bonuses?.[target] ?? 0} onChange={(event) => setOptions((next) => { next.bonuses = { ...next.bonuses, [target]: Math.trunc(Number(event.target.value)) || 0 }; })}/></label>;
  const check = (key: "jackOfAllTrades" | "ignoreUnequippedWeight" | "reliableTalent" | "dexTiebreaker" | "halflingLuck", label: string) => <label className="action-form-check"><input type="checkbox" checked={!!options[key]} onChange={(event) => setOptions((next) => { next[key] = event.target.checked; })}/> {label}</label>;
  const byLevel = proficiencyByLevel(sheet.identity.level);
  const proficiency = effectiveProficiency(sheet);
  const custom = (options.proficiency ?? (byLevel === sheet.combat.proficiencyBonus ? "level" : "custom")) !== "level";

  return <div className="stack options-panel">
    <ClassOptions sheet={sheet} onUpdate={onUpdate}/>
    <Card><h2>Bonus competenza</h2><div className="editor-grid">
      <label><span>Bonus di competenza</span><Select aria-label="Bonus di competenza" value={custom ? "custom" : "level"} onChange={(event) => setOptions((next) => { next.proficiency = event.target.value === "level" ? "level" : proficiency; })}><option value="level">Per livello (+{byLevel}, livello {sheet.identity.level})</option><option value="custom">Personalizzato</option></Select></label>
      {custom && <label><span>Competenza personalizzata</span><Input type="number" min="0" aria-label="Competenza personalizzata" value={proficiency} onChange={(event) => setOptions((next) => { next.proficiency = Math.max(0, Math.trunc(Number(event.target.value)) || 0); })}/></label>}
    </div></Card>
    <Card><h2>Caratteristiche</h2><div className="options-skills options-saves">{ABILITIES.filter((ability) => sheet.abilities[ability]).map((ability) => <div key={ability}>
      <span>{ABILITY_LABELS[ability]}</span>
      <Input type="number" aria-label={`Punteggio ${ABILITY_LABELS[ability]}`} value={sheet.abilities[ability].score} onChange={(event) => onUpdate((next) => { const score = Number(event.target.value) || 0; next.abilities[ability].score = score; next.abilities[ability].mod = Math.floor((score - 10) / 2); return next; })}/>
      <Input type="number" aria-label={`Bonus aggiuntivo ${ABILITY_LABELS[ability]}`} value={options.bonuses?.[`ability:${ability}`] ?? 0} onChange={(event) => setOptions((next) => { next.bonuses = { ...next.bonuses, [`ability:${ability}`]: Math.trunc(Number(event.target.value)) || 0 }; })}/>
    </div>)}</div><p className="muted">Punteggio base e bonus aggiuntivo (si somma al punteggio).</p></Card>
    <Card><h2>Tiri salvezza</h2>
      <div className="options-skills options-saves">{ABILITIES.filter((ability) => sheet.abilities[ability]).map((ability) => <div key={ability}>
        <label className="action-form-check" title="Competenza"><input type="checkbox" aria-label={`Competenza TS ${ABILITY_LABELS[ability]}`} checked={sheet.abilities[ability].saveProficient} onChange={(event) => onUpdate((next) => {
          // Il TS salvato comprende la competenza: si aggiunge o si toglie insieme alla spunta.
          const checked = event.target.checked;
          next.abilities[ability].saveProficient = checked;
          next.abilities[ability].save += checked ? next.combat.proficiencyBonus : -next.combat.proficiencyBonus;
          return next;
        })}/> Comp.</label>
        <span>TS {ABILITY_LABELS[ability]}</span>
        <Input type="number" aria-label={`Bonus aggiuntivo TS ${ABILITY_LABELS[ability]}`} value={options.bonuses?.[`save:${ability}`] ?? 0} onChange={(event) => setOptions((next) => { next.bonuses = { ...next.bonuses, [`save:${ability}`]: Math.trunc(Number(event.target.value)) || 0 }; })}/>
      </div>)}</div>
      <div className="editor-grid">
      {bonus("saveAll", "Modificatore globale TS")}
      {bonus("deathSave", "Modificatore TS contro la morte")}
    </div></Card>
    <Card><h2>Abilità</h2>
      <div className="options-skills">{Object.keys(SKILL_LABELS).filter((skill) => sheet.skills[skill]).map((skill) => <div key={skill}>
        <label className="action-form-check" title="Competenza"><input type="checkbox" aria-label={`Competenza ${SKILL_LABELS[skill]}`} checked={sheet.skills[skill].proficient} onChange={(event) => onUpdate((next) => {
          // Il bonus salvato comprende la competenza: si aggiunge o si toglie insieme alla spunta.
          const checked = event.target.checked;
          next.skills[skill].proficient = checked;
          next.skills[skill].bonus += checked ? next.combat.proficiencyBonus : -next.combat.proficiencyBonus;
          if (!checked && next.options?.expertise) next.options = { ...next.options, expertise: next.options.expertise.filter((item) => item !== skill) };
          return next;
        })}/> Comp.</label>
        <label className="action-form-check" title="Maestria: competenza doppia"><input type="checkbox" aria-label={`Maestria ${SKILL_LABELS[skill]}`} disabled={!sheet.skills[skill].proficient} checked={!!options.expertise?.includes(skill)} onChange={(event) => setOptions((next) => { const rest = (next.expertise ?? []).filter((item) => item !== skill); next.expertise = event.target.checked ? [...rest, skill] : rest; })}/> Maestria</label>
        <span>{SKILL_LABELS[skill]} <small>({ABILITY_SHORT[SKILL_ABILITIES[skill]] ?? "—"})</small> +</span>
        <Input type="number" aria-label={`Bonus aggiuntivo ${SKILL_LABELS[skill]}`} value={options.bonuses?.[`skill:${skill}`] ?? 0} onChange={(event) => setOptions((next) => { next.bonuses = { ...next.bonuses, [`skill:${skill}`]: Math.trunc(Number(event.target.value)) || 0 }; })}/>
      </div>)}</div>
      <p className="muted">Maestria raddoppia la competenza; si attiva solo con la competenza. Il numero è un bonus aggiuntivo.</p>
      {check("jackOfAllTrades", "Jack of all trades (metà competenza alle prove senza competenza, iniziativa compresa)")}
      {check("halflingLuck", "Halfling luck (un 1 naturale su un d20 si ritira una volta)")}
      {check("reliableTalent", "Reliable talent (nelle prove con competenza, abilità e strumenti, il d20 vale almeno 10)")}
      <div className="editor-grid">{bonus("passivePerception", "Modificatore Percezione passiva")}</div>
    </Card>
    <Card><h2>Combattimento</h2><div className="editor-grid">
      {bonus("initiative", "Modificatore iniziativa")}
      <label><span>Stile iniziativa</span><Select aria-label="Stile iniziativa" value={options.initiativeMode ?? "normal"} onChange={(event) => setOptions((next) => { next.initiativeMode = event.target.value as RollMode; })}>{MODES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></label>
      <div className="options-inline">{check("dexTiebreaker", "Spareggio con la Destrezza nei Turni (+DES/100)")}</div>
      <label><span>Gamma del critico</span><Input type="number" min="2" max="20" aria-label="Gamma del critico" value={options.critRange ?? 20} onChange={(event) => setOptions((next) => { next.critRange = Math.min(20, Math.max(2, Math.trunc(Number(event.target.value)) || 20)); })}/></label>
    </div></Card>
    <Card><h2>Incantesimi</h2><div className="editor-grid">
      {bonus("spellSaveDc", "Modificatore CD incantesimi")}
      {bonus("spellAttack", "Modificatore attacco magico globale")}
    </div></Card>
    <Card><h2>Inventario</h2><div className="editor-grid">
      <label><span>Moltiplicatore capacità di carico</span><Select aria-label="Moltiplicatore capacità di carico" value={String(options.carryMultiplier ?? 1)} onChange={(event) => setOptions((next) => { next.carryMultiplier = Number(event.target.value); })}>{[0.5, 1, 2, 4].map((value) => <option key={value} value={value}>×{value.toLocaleString("it-IT")}</option>)}</Select></label>
      <label><span>Ingombro</span><Select aria-label="Ingombro" value={options.encumbrance ?? "simple"} onChange={(event) => setOptions((next) => { next.encumbrance = event.target.value as SheetOptions["encumbrance"]; })}><option value="simple">Semplice</option><option value="variant">Variante (5× / 10× Forza)</option><option value="off">Disattivato</option></Select></label>
    </div>{check("ignoreUnequippedWeight", "Ignora il peso degli oggetti non equipaggiati")}</Card>
  </div>;
}
