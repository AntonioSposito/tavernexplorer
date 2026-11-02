import { useState } from "react";
import { ABILITY_LABELS, ABILITY_SHORT, ABILITY_TAGS } from "./constants";
import { ChatIcon, EditIcon } from "./icons";
import { labeledBonus } from "./rollCards";
import type { ActionEntry, CharacterSheet, ProficiencyEntry, RollCard, ToolEntry, ToolProficiency } from "./types";
import { Button, Card, Dialog, Input, Select } from "./ui";

type Kind = ProficiencyEntry["type"] | "TOOL";
type Draft = { id: string | null; name: string; kind: Kind; ability: string; proficiency: ToolProficiency; mods: number };

// Ordine di visualizzazione; gli strumenti vengono prima di questi gruppi.
const GROUPS: Array<[Array<ProficiencyEntry["type"]>, string]> = [[["WEAPON", "ARMOR"], "Armi e armature"], [["LANGUAGE"], "Linguaggi"], [["OTHER"], "Altro"]];
const KIND_LABELS: Record<Kind, string> = { LANGUAGE: "Linguaggio", WEAPON: "Arma", ARMOR: "Armatura", OTHER: "Altro", TOOL: "Strumento" };
const PROFICIENCY_LABELS: Record<ToolProficiency, string> = { proficient: "Competente", expertise: "Maestria (×2)", jack: "Factotum (½)" };
const signed = (value: number) => `${value >= 0 ? "+" : ""}${value}`;

// Strumenti salvati nel primo formato: solo `bonus` (totale; con caratteristica a scelta, competenza + mod).
function normalizeTool(sheet: CharacterSheet, tool: ToolEntry & { bonus?: number }): ToolEntry {
  if (tool.mods != null && tool.proficiency) return tool;
  const pb = sheet.combat.proficiencyBonus;
  const mods = tool.mods ?? (tool.bonus ?? pb) - pb - (tool.ability ? sheet.abilities[tool.ability]?.mod ?? 0 : 0);
  return { id: tool.id, name: tool.name, ability: tool.ability ?? "", proficiency: tool.proficiency ?? "proficient", mods };
}

const proficiencyValue = (tool: ToolEntry, pb: number) => tool.proficiency === "expertise" ? pb * 2 : tool.proficiency === "jack" ? Math.floor(pb / 2) : pb;
// Parti del bonus con etichetta, come i tiri di abilità: caratteristica, competenza, mod.
function toolParts(sheet: CharacterSheet, tool: ToolEntry, ability: string): Array<[number, string]> {
  return [[sheet.abilities[ability]?.mod ?? 0, ABILITY_TAGS[ability] ?? ""], [proficiencyValue(tool, sheet.combat.proficiencyBonus), "PROF"], [tool.mods, "MOD"]];
}
const sum = (parts: Array<[number, string]>) => parts.reduce((total, [value]) => total + value, 0);

export function ProficiencyPanel({ sheet, onUpdate, onRoll, onShare, editable }: { sheet: CharacterSheet; onUpdate: (update: (sheet: CharacterSheet) => CharacterSheet) => void; onRoll: (title: string, formula: string) => void; onShare: (entry: ActionEntry, card?: RollCard) => void; editable: boolean }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  // Strumento con caratteristica a scelta in attesa della scelta.
  const [asking, setAsking] = useState<ToolEntry | null>(null);
  const proficiencies = sheet.proficiencies ?? [];
  const tools = (sheet.tools ?? []).map((tool) => normalizeTool(sheet, tool));

  const roll = (tool: ToolEntry, ability: string) => { const parts = toolParts(sheet, tool, ability); onRoll(tool.name, `${sheet.options?.reliableTalent ? "1d20min10" : "1d20"}${labeledBonus(parts, sum(parts))}`); };
  const share = (name: string, kind: Kind, tool?: ToolEntry) => {
    const stats = tool && [{ label: "Caratteristica", value: tool.ability ? ABILITY_LABELS[tool.ability] : "A scelta" }, { label: "Bonus", value: signed(sum(toolParts(sheet, tool, tool.ability))) }];
    onShare({ id: tool?.id ?? name, name, description: KIND_LABELS[kind] }, { name, subtitle: KIND_LABELS[kind], rolls: [], stats });
  };
  const remove = (id: string) => { onUpdate((next) => { next.proficiencies = (next.proficiencies ?? []).filter((entry) => entry.id !== id); next.tools = (next.tools ?? []).filter((entry) => entry.id !== id); return next; }); setDraft(null); };
  const save = () => {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) return;
    const id = draft.id ?? crypto.randomUUID();
    onUpdate((next) => {
      const list = <T extends { id: string }>(items: T[] | undefined, entry: T | null) => {
        const current = items ?? [];
        // Stesso elenco: resta al suo posto; nuovo o cambiato di tipo: va in fondo.
        if (!entry) return current.filter((item) => item.id !== id);
        return current.some((item) => item.id === id) ? current.map((item) => item.id === id ? entry : item) : [...current, entry];
      };
      next.tools = list(next.tools, draft.kind === "TOOL" ? { id, name, ability: draft.ability, proficiency: draft.proficiency, mods: draft.mods } : null);
      next.proficiencies = list(next.proficiencies, draft.kind === "TOOL" ? null : { id, name, type: draft.kind });
      return next;
    });
    setDraft(null);
  };
  const empty: Draft = { id: null, name: "", kind: "LANGUAGE", ability: "", proficiency: "proficient", mods: 0 };
  const icons = (name: string, onShareClick: () => void, edit: Draft) => <span className="entry-icons">
    <button aria-label={`Mostra in chat ${name}`} title="Mostra in chat" onClick={onShareClick}><ChatIcon/></button>
    {editable && <button aria-label={`Modifica ${name}`} title="Modifica" onClick={() => setDraft(edit)}><EditIcon/></button>}
  </span>;

  return <Card className="resource-panel proficiencies"><div className="editor-heading"><h2>Competenze e linguaggi</h2></div>
    {editable && <div className="library-actions"><Button onClick={() => setDraft(empty)}>+ Nuova competenza</Button></div>}
    {!sheet.proficiencies && !sheet.tools ? <p className="muted">Scheda importata prima di questa sezione: reimportala da Roll20 per vedere competenze e linguaggi.</p> : <dl>
      {tools.length > 0 && <div><dt>Strumenti</dt><dd><ul>{tools.map((tool) => <li key={tool.id}>
        <span><button className="entry-use" title={`Tira ${tool.name}`} onClick={() => tool.ability ? roll(tool, tool.ability) : setAsking(tool)}>{tool.name}</button> <small>({tool.ability ? ABILITY_SHORT[tool.ability] : "a scelta"}) {signed(sum(toolParts(sheet, tool, tool.ability)))}</small></span>
        {icons(tool.name, () => share(tool.name, "TOOL", tool), { id: tool.id, name: tool.name, kind: "TOOL", ability: tool.ability, proficiency: tool.proficiency, mods: tool.mods })}
      </li>)}</ul></dd></div>}
      {GROUPS.map(([types, label]) => { const entries = proficiencies.filter((entry) => types.includes(entry.type)); return entries.length > 0 && <div key={label}><dt>{label}</dt><dd><ul>{entries.map((entry) => <li key={entry.id}><span>{entry.name}</span>{icons(entry.name, () => share(entry.name, entry.type), { ...empty, id: entry.id, name: entry.name, kind: entry.type })}</li>)}</ul></dd></div>; })}
      {!proficiencies.length && !tools.length && <p className="muted">Nessuna competenza o linguaggio.</p>}
    </dl>}
    <Dialog open={asking !== null} title={`Tira ${asking?.name ?? ""}`} description="Scegli la caratteristica" onClose={() => setAsking(null)}><div className="ability-query">{Object.entries(ABILITY_LABELS).map(([key, label]) => <Button key={key} variant="outline" onClick={() => { if (asking) roll(asking, key); setAsking(null); }}>{label} {asking && signed(sum(toolParts(sheet, asking, key)))}</Button>)}</div></Dialog>
    <Dialog open={draft !== null} title={draft?.id ? "Modifica competenza" : "Nuova competenza"} onClose={() => setDraft(null)}>{draft && <form className="action-form" onSubmit={(event) => { event.preventDefault(); save(); }}>
      <label><span>Nome</span><Input aria-label="Nome competenza" value={draft.name} autoFocus onChange={(event) => setDraft({ ...draft, name: event.target.value })}/></label>
      <label><span>Tipo</span><Select aria-label="Tipo competenza" value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as Kind })}>{Object.entries(KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></label>
      {draft.kind === "TOOL" && <>
        <div className="action-form-row">
          <label><span>Bonus competenza</span><Select aria-label="Bonus competenza strumento" value={draft.proficiency} onChange={(event) => setDraft({ ...draft, proficiency: event.target.value as ToolProficiency })}>{Object.entries(PROFICIENCY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></label>
          <label><span>Caratteristica</span><Select aria-label="Caratteristica strumento" value={draft.ability} onChange={(event) => setDraft({ ...draft, ability: event.target.value })}>{Object.entries(ABILITY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}<option value="">Chiedi al tiro</option></Select></label>
          <label><span>Mod</span><Input type="number" aria-label="Mod strumento" value={draft.mods} onChange={(event) => setDraft({ ...draft, mods: Math.trunc(Number(event.target.value)) || 0 })}/></label>
        </div>
      </>}
      <div className="action-form-buttons">{draft.id && <Button type="button" variant="destructive" onClick={() => remove(draft.id!)}>Elimina</Button>}<Button type="button" variant="secondary" onClick={() => setDraft(null)}>Annulla</Button><Button type="submit" disabled={!draft.name.trim()}>Salva</Button></div>
    </form>}</Dialog>
  </Card>;
}
