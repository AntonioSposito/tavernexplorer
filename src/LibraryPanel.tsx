import { useState } from "react";
import { createBlankSheet } from "./blankSheet";
import { CatalogDialog } from "./CatalogDialog";
import { CharacterWizard } from "./CharacterWizard";
import { aclCandidates, canEditCloudSheet, EVERYONE } from "./cloudSheets";
import { getRuleset } from "./rulesets";
import { storage } from "./storage";
import type { CharacterSheet, CloudSheet } from "./types";
import { Button, Dialog, Input, Select } from "./ui";

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
  onCreate: (sheet: CharacterSheet) => void;
  onExport: () => void;
  onExportPack: () => void;
  onAclChange: (id: string, acl: Acl) => void;
  onDelete: (id: string) => void;
}

export function LibraryPanel({ entries, activeId, members, player, onSelect, onOpenNpc, onImport, onCreate, onExport, onExportPack, onAclChange, onDelete }: LibraryPanelProps) {
  const [section, setSection] = useState<"pc" | "npc">("pc");
  const [newName, setNewName] = useState<string | null>(null);
  const [guided, setGuided] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [alphabetical, setAlphabetical] = useState(storage.libraryAlphabetical.get);
  const isGm = player.role === "GM";
  const candidates = aclCandidates(entries, members);
  const inSection = entries.filter((entry) => entry.kind === section);
  const shown = alphabetical ? [...inSection].sort((a, b) => a.sheet.name.localeCompare(b.sheet.name, "it", { sensitivity: "base" })) : inSection;
  const subtitleOf = (entry: CloudSheet) => entry.kind === "pc" ? `${entry.sheet.identity.classDisplay} · ${getRuleset(entry.sheet.ruleset.id).label}` : entry.kind === "npc" ? `${entry.sheet.creatureType} · GS ${entry.sheet.challengeRating}` : "";
  const open = (entry: CloudSheet) => entry.kind === "pc" ? onSelect(entry.sheet.id) : onOpenNpc(entry.sheet.id);

  return <div className="stack">
    <nav className="sheet-tabs"><button className={section === "pc" ? "active" : ""} onClick={() => setSection("pc")}>Party</button><button className={section === "npc" ? "active" : ""} onClick={() => setSection("npc")}>NPC</button></nav>
    {section === "pc" && <section className="library-actions"><button className="primary" onClick={() => setNewName("")}>Nuovo personaggio</button>{isGm && <button className="primary" onClick={onImport}>Importa Roll20 / TavernPack</button>}<button onClick={onExport} disabled={!activeId}>Esporta scheda</button>{isGm && <button onClick={onExportPack}>Esporta tutto</button>}</section>}
    {shown.length > 0 && <div className="library-actions">
      <Button variant="outline" className="picker-button" onClick={() => setSearching(true)}><span>{section === "pc" ? "Cerca nel party" : "Cerca negli NPC"}</span><span>⌕</span></Button>
      <Button variant={alphabetical ? "default" : "outline"} aria-pressed={alphabetical} onClick={() => { setAlphabetical(!alphabetical); storage.libraryAlphabetical.set(!alphabetical); }}>Ordine alfabetico</Button>
    </div>}
    <CatalogDialog open={searching} title={section === "pc" ? "Cerca nel party" : "Cerca negli NPC"} description="Cerca per nome, classe o tipo" items={shown.map((entry) => ({ id: entry.sheet.id, label: entry.sheet.name, detail: subtitleOf(entry) }))} selectedId={activeId ?? ""} onSelect={(id) => { setSearching(false); const entry = shown.find((item) => item.sheet.id === id); if (entry) open(entry); }} onClose={() => setSearching(false)}/>
    {isGm && <p className="library-hint">Di base ogni scheda è visibile e modificabile solo dal GM. Chi può modificare può anche vedere. I permessi valgono per il nome Owlbear e sono applicati solo dall'estensione.</p>}
    {shown.map((entry) => {
      const editable = canEditCloudSheet(entry, player);
      const subtitle = subtitleOf(entry);
      return <article className="library-card library-entry" key={entry.sheet.id}>
        <div className="library-entry-head">
          <button className="character-open" onClick={() => open(entry)}><span><strong>{entry.sheet.name}</strong><small>{subtitle}{!isGm && (editable ? " · puoi modificare" : " · sola lettura")}</small></span></button>
          {isGm && <button className="danger" aria-label={`Elimina ${entry.sheet.name}`} onClick={() => { if (window.confirm(`Eliminare ${entry.sheet.name} dalla libreria? È consigliato esportare prima un backup.`)) onDelete(entry.sheet.id); }}>×</button>}
        </div>
        {isGm && <div className="acl-row">
          <AclPicker title="Può vedere" names={entry.acl.view} candidates={candidates} onChange={(view) => onAclChange(entry.sheet.id, { ...entry.acl, view })}/>
          <AclPicker title="Può modificare" names={entry.acl.edit} candidates={candidates} onChange={(edit) => onAclChange(entry.sheet.id, { ...entry.acl, edit })}/>
        </div>}
      </article>;
    })}
    <Dialog open={newName !== null} title="Nuovo personaggio" description="Creazione guidata con le regole del PHB 2024, oppure scheda vuota di livello 1 da completare nella tab Modifica." onClose={() => setNewName(null)}>{newName !== null && <form className="action-form" onSubmit={(event) => { event.preventDefault(); if (!newName.trim()) return; setGuided(newName.trim()); setNewName(null); }}>
      <label><span>Nome</span><Input aria-label="Nome del personaggio" autoFocus required value={newName} onChange={(event) => setNewName(event.target.value)}/></label>
      <div className="action-form-buttons"><Button type="button" variant="secondary" onClick={() => setNewName(null)}>Annulla</Button><Button type="button" variant="outline" disabled={!newName.trim()} onClick={() => { onCreate(createBlankSheet(newName.trim())); setNewName(null); }}>Scheda vuota</Button><Button type="submit">Creazione guidata</Button></div>
    </form>}</Dialog>
    <Dialog open={guided !== null} title="Creazione guidata" description="Livello 1 · PHB 2024 (dati 5e.tools)" onClose={() => setGuided(null)}>{guided !== null && <CharacterWizard name={guided} onCreate={(sheet) => { onCreate(sheet); setGuided(null); }} onCancel={() => setGuided(null)}/>}</Dialog>
    {shown.length === 0 && <p className="assign-empty">{section === "pc" ? (isGm ? "Nessuna scheda: crea un personaggio o importa un export Roll20 o un TavernPack." : "Crea il tuo personaggio, oppure chiedi al GM di renderti visibile una scheda.") : (isGm ? "Nessun NPC: aggiungili dal Bestiario con «Aggiungi agli NPC»." : "Il GM non ti ha ancora reso visibile nessun NPC.")}</p>}
  </div>;
}

export function AclPicker({ title, names, candidates, onChange }: { title: string; names: string[]; candidates: string[]; onChange: (names: string[]) => void }) {
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
