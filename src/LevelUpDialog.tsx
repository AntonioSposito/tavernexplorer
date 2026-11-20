import { useEffect, useState } from "react";
import { CLASSES } from "./classes";
import { derivedSlots } from "./classSync";
import { ABILITY_LABELS, SKILL_LABELS } from "./constants";
import { roll } from "./dice";
import { loadClassFile, loadLevelFeats, loadSpells } from "./fivetoolsApi";
import { parseLevelOptions, type Feature, type LevelOptions, type SpellOption } from "./fivetoolsCharacter";
import { EXPERTISE_FEATURES, applyLevelUp, hitDieOf, hitPointGain, sheetClasses, type LevelUpPlan } from "./levelUp";
import type { CharacterSheet } from "./types";
import { Alert, Button, Dialog, Input, Select } from "./ui";

type Increase = "two" | "split" | "feat";
const signed = (value: number) => `${value >= 0 ? "+" : ""}${value}`;

// Popup "Sali di livello" come su Roll20: privilegi, sottoclasse, aumento caratteristiche e incantesimi del livello
// arrivano da 5e.tools; ogni scelta si vede nel riepilogo e si cambia qui, e si applica tutto solo con Conferma.
export function LevelUpDialog({ sheet, onClose, onConfirm }: { sheet: CharacterSheet; onClose: () => void; onConfirm: (plan: LevelUpPlan) => void }) {
  const classes = sheetClasses(sheet);
  const [className, setClassName] = useState(classes[0].name);
  const [rolled, setRolled] = useState<number | null>(null);
  const [subclass, setSubclass] = useState("");
  const [options, setOptions] = useState<LevelOptions | null>(null);
  const [error, setError] = useState("");
  const [skipped, setSkipped] = useState<string[]>([]);
  // Privilegio di cui si legge il testo.
  const [reading, setReading] = useState<string | null>(null);
  const [increase, setIncrease] = useState<Increase>("two");
  const [abilities, setAbilities] = useState(["strength", "dexterity"]);
  const [feats, setFeats] = useState<Feature[]>([]);
  const [featName, setFeatName] = useState("");
  const [catalog, setCatalog] = useState<SpellOption[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [expertise, setExpertise] = useState<string[]>([]);

  const current = classes.find((entry) => entry.name === className);
  const classLevel = (current?.level ?? 0) + 1;
  const chosenSubclass = current?.subclass || subclass || undefined;
  const die = hitDieOf(className);
  const conMod = sheet.abilities.constitution?.mod ?? 0;
  const hitPoints = hitPointGain(die, conMod, rolled ?? undefined);
  const newLevel = sheet.identity.level + 1;

  useEffect(() => {
    let alive = true;
    setOptions(null); setError("");
    loadClassFile(className).then((file) => { if (alive) setOptions(parseLevelOptions(file, classLevel, chosenSubclass)); })
      .catch(() => { if (alive) setError("Privilegi del livello non disponibili da 5e.tools: aggiungili poi a mano nei tratti."); });
    return () => { alive = false; };
  }, [className, classLevel, chosenSubclass]);
  useEffect(() => { if (options?.abilityIncrease && !feats.length) void loadLevelFeats().then(setFeats).catch(() => undefined); }, [options?.abilityIncrease, feats.length]);
  useEffect(() => { if ((options?.cantrips || options?.spells) && !catalog.length) void loadSpells().then(setCatalog).catch(() => undefined); }, [options?.cantrips, options?.spells, catalog.length]);

  const features = (options?.features ?? []).filter((feature) => !skipped.includes(feature.name));
  const feat = increase === "feat" ? feats.find((item) => item.name === featName) : undefined;
  const abilityIncrease = options?.abilityIncrease && increase !== "feat" ? (increase === "two" ? [abilities[0], abilities[0]] : abilities) : undefined;
  // Incantesimi della classe fino al livello di slot più alto dopo la salita.
  // shortcut: con più classi il limite è quello di tutti gli slot, non solo della classe che sale.
  const base: LevelUpPlan = { className, subclass: chosenSubclass, hitPoints, features: [], spells: [] };
  const maxSpellLevel = Math.max(0, ...Object.keys(derivedSlots(applyLevelUp(sheet, base))).map((key) => Number(key.replace("level_", "")) || 0));
  const known = new Set(sheet.spells.map((spell) => spell.name.toLowerCase()));
  const available = catalog.filter((spell) => spell.classes.includes(className) && spell.level <= maxSpellLevel && !known.has(spell.name.toLowerCase()));
  const chosenSpells = available.filter((spell) => picked.includes(spell.name));
  const cantripsLeft = (options?.cantrips ?? 0) - chosenSpells.filter((spell) => spell.level === 0).length;
  const spellsLeft = (options?.spells ?? 0) - chosenSpells.filter((spell) => spell.level > 0).length;
  const listed = available.filter((spell) => (spell.level === 0 ? options?.cantrips : options?.spells) && spell.name.toLowerCase().includes(search.trim().toLowerCase()));
  // Maestria: abilità con competenza e senza Maestria, quante ne dà il privilegio scelto.
  const expertiseCount = features.reduce((sum, feature) => sum + (EXPERTISE_FEATURES[feature.name] ?? 0), 0);
  const eligible = Object.entries(sheet.skills).filter(([key, skill]) => skill.proficient && !sheet.options?.expertise?.includes(key)).map(([key]) => key);
  const expertiseNeeded = Math.min(expertiseCount, eligible.length);
  const chosenExpertise = expertise.filter((key) => eligible.includes(key)).slice(0, expertiseNeeded);
  const plan: LevelUpPlan = { ...base, features, abilityIncrease, feat, spells: chosenSpells.map((spell) => spell.spell), expertise: chosenExpertise };
  const needsSubclass = !!options?.subclasses.length && !chosenSubclass;

  const abilitySelect = (index: number, label: string) => <Select aria-label={label} value={abilities[index]} onChange={(event) => setAbilities(abilities.map((value, position) => position === index ? event.target.value : value))}>
    {Object.entries(ABILITY_LABELS).map(([key, name]) => <option key={key} value={key}>{name} ({sheet.abilities[key]?.score ?? 10})</option>)}
  </Select>;

  return <Dialog open title={`Sali al livello ${newLevel}`} description={sheet.name} onClose={onClose}>
    <div className="action-form level-up">
      <label><span>Classe</span><Select aria-label="Classe che sale di livello" value={className} onChange={(event) => { setClassName(event.target.value); setRolled(null); setSubclass(""); setSkipped([]); setPicked([]); }}>
        <optgroup label="Le tue classi">{classes.map((entry) => <option key={entry.name} value={entry.name}>{entry.name} {entry.level} → {entry.level + 1}</option>)}</optgroup>
        <optgroup label="Nuova multiclasse">{Object.keys(CLASSES).filter((name) => !classes.some((entry) => entry.name === name)).map((name) => <option key={name} value={name}>{name} 1</option>)}</optgroup>
      </Select></label>

      <div className="form-field"><span>Punti ferita (d{die} {signed(conMod)} COS)</span>
        <label className="action-form-check"><input type="radio" name="level-up-hp" checked={rolled === null} onChange={() => setRolled(null)}/> Media: {die / 2 + 1} {signed(conMod)}</label>
        <label className="action-form-check"><input type="radio" name="level-up-hp" checked={rolled !== null} onChange={() => setRolled(roll(`1d${die}`).total)}/> Tira d{die}{rolled !== null && `: ${rolled} ${signed(conMod)}`}</label>
      </div>

      {error && <Alert>{error}</Alert>}
      {!options && !error && <small>Carico i privilegi del livello da 5e.tools…</small>}
      {options?.subclasses.length ? <label><span>Sottoclasse</span><Select aria-label="Sottoclasse" value={subclass} onChange={(event) => { setSubclass(event.target.value); setSkipped([]); }}>
        <option value="">Scegli…</option>{options.subclasses.map((name) => <option key={name} value={name}>{name}</option>)}
      </Select></label> : null}
      {options && options.features.length > 0 && <div className="form-field"><span>Privilegi (diventano tratti)</span>
        {options.features.map((feature) => <div key={feature.name} className="level-up-feature">
          <div className="level-up-feature-row">
            <label className="action-form-check"><input type="checkbox" aria-label={`Aggiungi ${feature.name}`} checked={!skipped.includes(feature.name)} onChange={(event) => setSkipped(event.target.checked ? skipped.filter((name) => name !== feature.name) : [...skipped, feature.name])}/> {feature.name}</label>
            <Button type="button" variant="ghost" aria-expanded={reading === feature.name} onClick={() => setReading(reading === feature.name ? null : feature.name)}>{reading === feature.name ? "Nascondi ▴" : "Leggi ▾"}</Button>
          </div>
          {reading === feature.name && <p>{feature.description}</p>}
        </div>)}
      </div>}

      {expertiseCount > 0 && <div className="form-field"><span>Maestria: scegli {expertiseNeeded} abilità con competenza ({expertiseNeeded - chosenExpertise.length} rimaste)</span>
        {eligible.length === 0 && <small>Nessuna abilità con competenza senza Maestria.</small>}
        <div className="level-up-skills">{eligible.map((key) => {
          const checked = chosenExpertise.includes(key);
          return <label className="action-form-check" key={key}><input type="checkbox" aria-label={`Maestria in ${SKILL_LABELS[key] ?? key}`} checked={checked} disabled={!checked && chosenExpertise.length >= expertiseNeeded} onChange={(event) => setExpertise(event.target.checked ? [...chosenExpertise, key] : chosenExpertise.filter((item) => item !== key))}/> {SKILL_LABELS[key] ?? key}</label>;
        })}</div>
      </div>}

      {options?.abilityIncrease && <div className="form-field"><span>Aumento caratteristiche (massimo 20)</span>
        <label className="action-form-check"><input type="radio" name="level-up-asi" checked={increase === "two"} onChange={() => setIncrease("two")}/> +2 a una caratteristica</label>
        {increase === "two" && abilitySelect(0, "Caratteristica +2")}
        <label className="action-form-check"><input type="radio" name="level-up-asi" checked={increase === "split"} onChange={() => setIncrease("split")}/> +1 a due caratteristiche</label>
        {increase === "split" && <div className="level-up-pair">{abilitySelect(0, "Prima caratteristica +1")}{abilitySelect(1, "Seconda caratteristica +1")}</div>}
        <label className="action-form-check"><input type="radio" name="level-up-asi" checked={increase === "feat"} onChange={() => setIncrease("feat")}/> Talento</label>
        {increase === "feat" && <><Select aria-label="Talento" value={featName} onChange={(event) => setFeatName(event.target.value)}><option value="">Scegli…</option>{feats.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</Select>{feat && <small>{feat.description}</small>}</>}
      </div>}

      {options && (options.cantrips > 0 || options.spells > 0) && <div className="form-field"><span>Nuovi incantesimi: {options.cantrips ? `${cantripsLeft} trucchetti` : ""}{options.cantrips && options.spells ? " · " : ""}{options.spells ? `${spellsLeft} incantesimi fino al ${maxSpellLevel}°` : ""} da scegliere</span>
        <Input aria-label="Cerca incantesimo" placeholder="Cerca…" value={search} onChange={(event) => setSearch(event.target.value)}/>
        <div className="catalog-list level-up-spells">{listed.map((spell) => {
          const checked = picked.includes(spell.name);
          const full = spell.level === 0 ? cantripsLeft <= 0 : spellsLeft <= 0;
          return <label className="action-form-check" key={spell.name}><input type="checkbox" aria-label={`Scegli ${spell.name}`} checked={checked} disabled={!checked && full} onChange={(event) => setPicked(event.target.checked ? [...picked, spell.name] : picked.filter((name) => name !== spell.name))}/> {spell.name} <small>{spell.level ? `${spell.level}°` : "trucchetto"}</small></label>;
        })}</div>
      </div>}

      <section className="level-up-summary" aria-label="Riepilogo">
        <h3>Riepilogo</h3>
        <ul>
          <li>{className} {current ? `${current.level} → ${current.level + 1}` : "1 (nuova classe)"} · livello {newLevel}</li>
          <li>PF massimi {sheet.combat.hp.max} → {sheet.combat.hp.max + hitPoints} ({signed(hitPoints)})</li>
          {chosenSubclass && !current?.subclass && <li>Sottoclasse: {chosenSubclass}</li>}
          {features.length > 0 && <li>Privilegi: {features.map((feature) => feature.name).join(", ")}</li>}
          {abilityIncrease && <li>Caratteristiche: {[...new Set(abilityIncrease)].map((key) => `${ABILITY_LABELS[key]} ${signed(abilityIncrease.filter((item) => item === key).length)}`).join(", ")}</li>}
          {chosenExpertise.length > 0 && <li>Maestria: {chosenExpertise.map((key) => SKILL_LABELS[key] ?? key).join(", ")}</li>}
          {features.some((feature) => feature.name === "Jack of All Trades") && <li>Opzione attivata: Jack of all trades</li>}
          {feat && <li>Talento: {feat.name}</li>}
          {chosenSpells.length > 0 && <li>Incantesimi: {chosenSpells.map((spell) => spell.name).join(", ")}</li>}
        </ul>
      </section>
      <div className="action-form-buttons"><Button type="button" variant="secondary" onClick={onClose}>Annulla</Button><Button type="button" disabled={needsSubclass || chosenExpertise.length < expertiseNeeded || (increase === "feat" && !!options?.abilityIncrease && !feat)} onClick={() => onConfirm(plan)}>Conferma</Button></div>
      {needsSubclass && <small>Scegli la sottoclasse per confermare.</small>}
      {chosenExpertise.length < expertiseNeeded && <small>Scegli le abilità della Maestria per confermare.</small>}
    </div>
  </Dialog>;
}
