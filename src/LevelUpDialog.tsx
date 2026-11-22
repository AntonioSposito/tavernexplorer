import { useState } from "react";
import { CLASSES, SUBCLASS_BOOKS } from "./classes";
import { ABILITY_LABELS } from "./constants";
import { roll } from "./dice";
import { effectiveSheet } from "./effects";
import { SUBCLASS_LEVEL, applyLevel, featLevel, hitDieOf, levelSummary, multiclassBlock, sheetClasses, type FeatChoice, type LevelChoices } from "./levelUp";
import type { CharacterSheet } from "./types";
import { Button, Dialog, Input, Select } from "./ui";

type FeatMode = "" | "two" | "split" | "feat" | "boon";
const signed = (value: number) => `${value >= 0 ? "+" : ""}${value}`;

// Popup "Sali di livello" con le regole comuni a tutte le classi: classe, PF, sottoclasse, ASI o talento.
// Il riepilogo mostra i valori prima → dopo; la scheda cambia solo con Conferma.
export function LevelUpDialog({ sheet, onClose, onConfirm }: { sheet: CharacterSheet; onClose: () => void; onConfirm: (className: string, level: number, choices: LevelChoices) => void }) {
  const classes = sheetClasses(sheet);
  const [className, setClassName] = useState(classes[0].name);
  const [rolled, setRolled] = useState<number | null>(null);
  const [subclass, setSubclass] = useState("");
  const [mode, setMode] = useState<FeatMode>("");
  const [abilities, setAbilities] = useState(["", ""]);
  const [featName, setFeatName] = useState("");

  const current = classes.find((entry) => entry.name === className);
  const level = (current?.level ?? 0) + 1;
  const die = hitDieOf(className);
  const conMod = effectiveSheet(sheet).abilities.constitution?.mod ?? 0;
  const needsSubclass = level === SUBCLASS_LEVEL && !current?.subclass;
  const featKind = featLevel(className, level);
  const name = featName.trim();
  const feat: FeatChoice | undefined = !featKind ? undefined
    : mode === "two" && abilities[0] ? { kind: "asi", abilities: [abilities[0], abilities[0]] }
    : mode === "split" && abilities[0] && abilities[1] && abilities[0] !== abilities[1] ? { kind: "asi", abilities }
    : mode === "feat" && name ? { kind: "feat", name }
    : mode === "boon" && name && abilities[0] ? { kind: "boon", name, ability: abilities[0] } : undefined;
  const choices: LevelChoices = { ...rolled !== null && { hpRoll: rolled }, ...needsSubclass && subclass && { subclass }, ...feat && { feat } };
  const missing = [needsSubclass && !subclass && "la sottoclasse", featKind && !feat && (featKind === "boon" ? "il Dono epico, l'aumento o il talento" : "l'aumento dei punteggi o il talento")].filter(Boolean);
  const summary = levelSummary(sheet, applyLevel(sheet, className, level, choices));

  const change = (value: string) => { setClassName(value); setRolled(null); setSubclass(""); setMode(""); setAbilities(["", ""]); setFeatName(""); };
  const abilitySelect = (index: number, label: string) => <Select aria-label={label} value={abilities[index]} onChange={(event) => setAbilities(abilities.map((value, position) => position === index ? event.target.value : value))}>
    <option value="">Scegli…</option>{Object.entries(ABILITY_LABELS).map(([key, text]) => <option key={key} value={key}>{text} ({effectiveSheet(sheet).abilities[key]?.score ?? 10})</option>)}
  </Select>;
  const books = SUBCLASS_BOOKS.flatMap(([book, lists]) => lists[className]?.length ? [[book, lists[className]] as const] : []);
  const radio = (value: FeatMode, text: string) => <label className="action-form-check"><input type="radio" name="level-up-feat" checked={mode === value} onChange={() => setMode(value)}/> {text}</label>;

  return <Dialog open title={`Sali al livello ${sheet.identity.level + 1}`} description={sheet.name} onClose={onClose}>
    <div className="action-form level-up">
      <div className="level-up-box"><label><span>Classe</span><Select aria-label="Classe che sale di livello" value={className} onChange={(event) => change(event.target.value)}>
        <optgroup label="Le tue classi">{classes.map((entry) => <option key={entry.name} value={entry.name}>{entry.name} {entry.level} → {entry.level + 1}</option>)}</optgroup>
        <optgroup label="Nuova classe (multiclasse)">{Object.keys(CLASSES).filter((key) => key !== "Artificer" && !classes.some((entry) => entry.name === key)).map((key) => {
          const block = multiclassBlock(sheet, key);
          return <option key={key} value={key} disabled={!!block}>{key} 1{block ? ` — ${block}` : ""}</option>;
        })}</optgroup>
      </Select></label></div>

      <div className="level-up-box form-field"><span>Punti ferita (d{die} {signed(conMod)} COS)</span>
        <label className="action-form-check"><input type="radio" name="level-up-hp" checked={rolled === null} onChange={() => setRolled(null)}/> Valore fisso: {die / 2 + 1} {signed(conMod)}</label>
        <label className="action-form-check"><input type="radio" name="level-up-hp" checked={rolled !== null} onChange={() => setRolled(roll(`1d${die}`).total)}/> Tira d{die}{rolled !== null && `: ${rolled} ${signed(conMod)}`}</label>
      </div>

      {needsSubclass && <div className="level-up-box"><label><span>Sottoclasse</span><Select aria-label="Sottoclasse" value={subclass} onChange={(event) => setSubclass(event.target.value)}>
        <option value="">Scegli…</option>{books.map(([book, names]) => <optgroup key={book} label={book}>{names.map((item) => <option key={item} value={item}>{item}</option>)}</optgroup>)}
      </Select></label></div>}

      {featKind && <div className="level-up-box form-field"><span>{featKind === "boon" ? "Dono epico o aumento dei punteggi" : "Aumento dei punteggi (massimo 20) o talento"}</span>
        {featKind === "boon" && radio("boon", "Dono epico (+1 a una caratteristica, massimo 30)")}
        {mode === "boon" && <><Input aria-label="Nome del Dono epico" placeholder="Boon of…" value={featName} onChange={(event) => setFeatName(event.target.value)}/>{abilitySelect(0, "Caratteristica +1")}</>}
        {radio("two", "+2 a una caratteristica")}
        {mode === "two" && abilitySelect(0, "Caratteristica +2")}
        {radio("split", "+1 a due caratteristiche")}
        {mode === "split" && <div className="action-form-row">{abilitySelect(0, "Prima caratteristica +1")}{abilitySelect(1, "Seconda caratteristica +1")}</div>}
        {radio("feat", "Talento")}
        {mode === "feat" && <Input aria-label="Nome del talento" placeholder="Nome del talento" value={featName} onChange={(event) => setFeatName(event.target.value)}/>}
      </div>}

      <section className="level-up-summary" aria-label="Riepilogo"><h3>Riepilogo</h3><ul>{summary.map((line) => <li key={line}>{line}</li>)}</ul></section>
      <small>Privilegi della classe, trucchetti e incantesimi nuovi non si aggiungono ancora da qui: vanno messi a mano nei tratti e nella tab Magia.</small>
      {missing.length > 0 && <small>Per confermare scegli {missing.join(" e ")}.</small>}
      <div className="action-form-buttons"><Button type="button" variant="secondary" onClick={onClose}>Annulla</Button><Button type="button" disabled={missing.length > 0} onClick={() => onConfirm(className, level, choices)}>Conferma</Button></div>
    </div>
  </Dialog>;
}
