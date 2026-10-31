import { useState } from "react";
import { canEditCloudSheet, EVERYONE } from "./cloudSheets";
import { getRuleset } from "./rulesets";
import type { CloudSheet } from "./types";
import { Button, Select } from "./ui";

type Member = { id: string; name: string; role: "GM" | "PLAYER" };
type Acl = CloudSheet["acl"];
const key = (name: string) => name.trim().toLocaleLowerCase("it");
const label = (name: string) => name === EVERYONE ? "Tutti" : name;

interface LibraryPanelProps {
  entries: CloudSheet[];
  activeId: string | null;
  members: Member[];
  player: { name: string; role: "GM" | "PLAYER" };
  onSelect: (id: string) => void;
  onOpenNpc: (id: string) => void;
  onImport: () => void;
  onExport: () => void;
  onExportPack: () => void;
  onAclChange: (id: string, acl: Acl) => void;
  onDelete: (id: string) => void;
}

export function LibraryPanel({ entries, activeId, members, player, onSelect, onOpenNpc, onImport, onExport, onExportPack, onAclChange, onDelete }: LibraryPanelProps) {
  const [section, setSection] = useState<"pc" | "npc">("pc");
  const isGm = player.role === "GM";
  const players = members.filter((member) => member.role !== "GM");
  // Proposte nei selettori: giocatori connessi più i nomi già usati in qualunque scheda.
  const candidates = [...new Map([EVERYONE, ...players.map((member) => member.name), ...entries.flatMap((entry) => [...entry.acl.view, ...entry.acl.edit])].map((name) => [key(name), name])).values()];
  const shown = entries.filter((entry) => entry.kind === section);

  return <div className="stack">
    <nav className="sheet-tabs"><button className={section === "pc" ? "active" : ""} onClick={() => setSection("pc")}>Party</button><button className={section === "npc" ? "active" : ""} onClick={() => setSection("npc")}>NPC</button></nav>
    {section === "pc" && <section className="library-actions">{isGm && <button className="primary" onClick={onImport}>Importa Roll20 / TavernPack</button>}<button onClick={onExport} disabled={!activeId}>Esporta scheda</button>{isGm && <button onClick={onExportPack}>Esporta tutto</button>}</section>}
    {isGm && <p className="library-hint">Di base ogni scheda è visibile e modificabile solo dal GM. Chi può modificare può anche vedere. I permessi valgono per il nome Owlbear e sono applicati solo dall'estensione.</p>}
    {shown.map((entry) => {
      const editable = canEditCloudSheet(entry, player);
      const subtitle = entry.kind === "pc" ? `${entry.sheet.identity.classDisplay} · ${getRuleset(entry.sheet.ruleset.id).label}` : `${entry.sheet.creatureType} · GS ${entry.sheet.challengeRating}`;
      return <article className="library-card library-entry" key={entry.sheet.id}>
        <div className="library-entry-head">
          <button className="character-open" onClick={() => entry.kind === "pc" ? onSelect(entry.sheet.id) : onOpenNpc(entry.sheet.id)}><span><strong>{entry.sheet.name}</strong><small>{subtitle}{!isGm && (editable ? " · puoi modificare" : " · sola lettura")}</small></span></button>
          {isGm && <button className="danger" aria-label={`Elimina ${entry.sheet.name}`} onClick={() => { if (window.confirm(`Eliminare ${entry.sheet.name} dalla libreria? È consigliato esportare prima un backup.`)) onDelete(entry.sheet.id); }}>×</button>}
        </div>
        {isGm && <div className="acl-row">
          <AclPicker title="Può vedere" names={entry.acl.view} candidates={candidates} onChange={(view) => onAclChange(entry.sheet.id, { ...entry.acl, view })}/>
          <AclPicker title="Può modificare" names={entry.acl.edit} candidates={candidates} onChange={(edit) => onAclChange(entry.sheet.id, { ...entry.acl, edit })}/>
        </div>}
      </article>;
    })}
    {shown.length === 0 && <p className="assign-empty">{section === "pc" ? (isGm ? "Nessuna scheda: importa un export Roll20 o un TavernPack." : "Il GM non ti ha ancora reso visibile nessuna scheda.") : (isGm ? "Nessun NPC: aggiungili dal Bestiario con «Aggiungi agli NPC»." : "Il GM non ti ha ancora reso visibile nessun NPC.")}</p>}
  </div>;
}

function AclPicker({ title, names, candidates, onChange }: { title: string; names: string[]; candidates: string[]; onChange: (names: string[]) => void }) {
  const available = candidates.filter((name) => !names.some((item) => key(item) === key(name)));
  const add = (value: string) => {
    const name = value === "__other" ? window.prompt("Nome Owlbear del giocatore")?.trim() : value;
    if (name && !names.some((item) => key(item) === key(name))) onChange([...names, name]);
  };
  return <div className="acl-picker">
    <small>{title}</small>
    <div className="acl-names">
      {names.map((name) => <span className="acl-chip" key={name}>{label(name)}<Button variant="ghost" aria-label={`${title}: rimuovi ${label(name)}`} onClick={() => onChange(names.filter((item) => item !== name))}>×</Button></span>)}
      {names.length === 0 && <small className="acl-empty">Solo GM</small>}
    </div>
    <Select aria-label={`${title}: aggiungi giocatore`} value="" onChange={(event) => add(event.target.value)}>
      <option value="">Aggiungi…</option>
      {available.map((name) => <option key={key(name)} value={name}>{label(name)}</option>)}
      <option value="__other">Altro nome…</option>
    </Select>
  </div>;
}
