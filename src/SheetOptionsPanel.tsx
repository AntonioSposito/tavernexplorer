import { ABILITY_LABELS, ABILITY_SHORT, SKILL_ABILITIES, SKILL_LABELS } from "./constants";
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
  const check = (key: "jackOfAllTrades" | "ignoreUnequippedWeight", label: string) => <label className="action-form-check"><input type="checkbox" checked={!!options[key]} onChange={(event) => setOptions((next) => { next[key] = event.target.checked; })}/> {label}</label>;
  const die = /^d?(\d+)$/i.exec(sheet.combat.hitDice.die.trim())?.[1];

  return <div className="stack options-panel">
    <Card><h2>Classe</h2><div className="editor-grid">
      <label><span>Dado vita</span><Select aria-label="Dado vita" value={die ? `d${die}` : ""} onChange={(event) => onUpdate((next) => { next.combat.hitDice.die = event.target.value; return next; })}>{!die && <option value="">—</option>}{["d4", "d6", "d8", "d10", "d12"].map((value) => <option key={value} value={value}>{value.toUpperCase()}</option>)}</Select></label>
    </div></Card>
    <Card><h2>Caratteristiche</h2><div className="editor-grid">{ABILITIES.map((ability) => bonus(`ability:${ability}`, `${ABILITY_LABELS[ability]} +`))}</div></Card>
    <Card><h2>Tiri salvezza</h2><div className="editor-grid">
      {ABILITIES.map((ability) => bonus(`save:${ability}`, `TS ${ABILITY_LABELS[ability]} +`))}
      {bonus("saveAll", "Modificatore globale TS")}
      {bonus("deathSave", "Modificatore TS contro la morte")}
    </div></Card>
    <Card><h2>Abilità</h2>
      <div className="options-skills">{Object.keys(SKILL_LABELS).filter((skill) => sheet.skills[skill]).map((skill) => <div key={skill}>
        <Select aria-label={`Competenza ${SKILL_LABELS[skill]}`} value={options.expertise?.includes(skill) ? "expertise" : "normal"} onChange={(event) => setOptions((next) => { const rest = (next.expertise ?? []).filter((item) => item !== skill); next.expertise = event.target.value === "expertise" ? [...rest, skill] : rest; })}><option value="normal">Normale</option><option value="expertise">Maestria</option></Select>
        <span>{SKILL_LABELS[skill]} <small>({ABILITY_SHORT[SKILL_ABILITIES[skill]] ?? "—"})</small> +</span>
        <Input type="number" aria-label={`${SKILL_LABELS[skill]} +`} value={options.bonuses?.[`skill:${skill}`] ?? 0} onChange={(event) => setOptions((next) => { next.bonuses = { ...next.bonuses, [`skill:${skill}`]: Math.trunc(Number(event.target.value)) || 0 }; })}/>
      </div>)}</div>
      <p className="muted">Maestria raddoppia la competenza solo se sei competente nell'abilità.</p>
      {check("jackOfAllTrades", "Jack of all trades (metà competenza alle prove senza competenza, iniziativa compresa)")}
      <div className="editor-grid">{bonus("passivePerception", "Modificatore Percezione passiva")}</div>
    </Card>
    <Card><h2>Combattimento</h2><div className="editor-grid">
      {bonus("initiative", "Modificatore iniziativa")}
      <label><span>Stile iniziativa</span><Select aria-label="Stile iniziativa" value={options.initiativeMode ?? "normal"} onChange={(event) => setOptions((next) => { next.initiativeMode = event.target.value as RollMode; })}>{MODES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></label>
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
