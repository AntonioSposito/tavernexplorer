import { useState, type DragEvent, type MouseEvent } from "react";
import { aclCandidates, canEditCloudSheet } from "./cloudSheets";
import { ChatIcon, EditIcon, FolderIcon, FolderOpenIcon, NoteIcon } from "./icons";
import { canMoveFolder, folderChildren, folderTargets, visibleFolders } from "./journalTree";
import { AclPicker } from "./LibraryPanel";
import type { CloudSheet } from "./types";
import { Button, Dialog, Input, Select, Textarea } from "./ui";

// Journal come su Roll20: il GM crea e organizza note e cartelle e sceglie chi vede e chi modifica ogni nota.
type NoteEntry = Extract<CloudSheet, { kind: "note" }>;
type Member = { id: string; name: string; role: "GM" | "PLAYER" };
type Viewer = { name: string; role: "GM" | "PLAYER" };
type NoteDraft = { id: string | null; name: string; body: string; folderId: string; acl: CloudSheet["acl"] };
type FolderDraft = { id: string | null; name: string; parentId: string };

interface JournalProps {
  entries: CloudSheet[];
  members: Member[];
  player: Viewer;
  onAdd: (entry: CloudSheet) => Promise<void>;
  onUpdate: (id: string, update: (entry: CloudSheet) => CloudSheet) => void;
  onRemove: (id: string) => Promise<void>;
  onShare: (title: string, body: string) => void;
}

const stop = (action: () => void) => (event: MouseEvent) => { event.preventDefault(); event.stopPropagation(); action(); };

export function Journal({ entries, members, player, onAdd, onUpdate, onRemove, onShare }: JournalProps) {
  const isGm = player.role === "GM";
  const notes = entries.filter((entry): entry is NoteEntry => entry.kind === "note");
  const allFolders = entries.flatMap((entry) => entry.kind === "folder" ? [entry.sheet] : []);
  const folders = visibleFolders(allFolders, notes.map((entry) => entry.sheet), isGm);
  const [readingId, setReadingId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<NoteDraft | null>(null);
  const [folderDraft, setFolderDraft] = useState<FolderDraft | null>(null);
  const reading = notes.find((entry) => entry.sheet.id === readingId);
  const candidates = aclCandidates(entries, members);

  // Sposta una nota o una cartella (undefined = radice): solo il GM organizza.
  const move = (id: string, folderId: string | undefined) => {
    if (!isGm || (allFolders.some((folder) => folder.id === id) && !canMoveFolder(allFolders, id, folderId))) return;
    onUpdate(id, (entry) => entry.kind === "note" ? { ...entry, sheet: { ...entry.sheet, folderId } } : entry.kind === "folder" ? { ...entry, sheet: { ...entry.sheet, parentId: folderId } } : entry);
  };
  const dropOn = (folderId: string | undefined) => isGm ? {
    onDragOver: (event: DragEvent) => event.preventDefault(),
    onDrop: (event: DragEvent) => { event.preventDefault(); event.stopPropagation(); const id = event.dataTransfer.getData("text/plain"); if (id && id !== folderId) move(id, folderId); },
  } : {};
  const dragFrom = (id: string) => isGm ? { draggable: true, onDragStart: (event: DragEvent) => { event.stopPropagation(); event.dataTransfer.setData("text/plain", id); } } : {};

  const editNote = (entry: NoteEntry | null, folderId = "") => setNoteDraft(entry
    ? { id: entry.sheet.id, name: entry.sheet.name, body: entry.sheet.body, folderId: entry.sheet.folderId ?? "", acl: entry.acl }
    : { id: null, name: "", body: "", folderId, acl: { view: [], edit: [] } });
  const saveNote = async (draft: NoteDraft) => {
    const folderId = draft.folderId || undefined;
    if (!draft.id) await onAdd({ kind: "note", sheet: { schemaVersion: 1, id: crypto.randomUUID(), name: draft.name.trim(), body: draft.body, folderId }, acl: draft.acl, rev: 0, updatedAt: 0, updatedBy: player.name });
    else onUpdate(draft.id, (entry) => entry.kind !== "note" ? entry : { ...entry, sheet: { ...entry.sheet, name: draft.name.trim(), body: draft.body, ...isGm ? { folderId } : {} }, acl: isGm ? draft.acl : entry.acl });
    setNoteDraft(null);
  };
  const saveFolder = async (draft: FolderDraft) => {
    const parentId = draft.parentId || undefined;
    if (!draft.id) await onAdd({ kind: "folder", sheet: { schemaVersion: 1, id: crypto.randomUUID(), name: draft.name.trim(), parentId }, acl: { view: [], edit: [] }, rev: 0, updatedAt: 0, updatedBy: player.name });
    else onUpdate(draft.id, (entry) => entry.kind !== "folder" ? entry : { ...entry, sheet: { ...entry.sheet, name: draft.name.trim(), parentId } });
    setFolderDraft(null);
  };
  // Eliminando una cartella il suo contenuto sale di un livello: nessuna nota va persa.
  const deleteFolder = async (id: string) => {
    const parentId = allFolders.find((folder) => folder.id === id)?.parentId;
    for (const folder of allFolders.filter((item) => item.parentId === id)) move(folder.id, parentId);
    for (const note of notes.filter((item) => item.sheet.folderId === id)) move(note.sheet.id, parentId);
    await onRemove(id);
    setFolderDraft(null);
  };

  const renderLevel = (parentId: string | undefined) => {
    const level = folderChildren(folders, notes.map((entry) => entry.sheet), parentId);
    return <>
      {level.folders.map((folder) => { const inside = folderChildren(folders, notes.map((entry) => entry.sheet), folder.id); const count = inside.folders.length + inside.notes.length; return <details key={folder.id} className="journal-folder" open>
        <summary {...dragFrom(folder.id)} {...dropOn(folder.id)}><span className="journal-icon"><FolderIcon/><FolderOpenIcon/></span><strong>{folder.name}</strong><small className="journal-count" title="Elementi nella cartella">{count}</small>{isGm && <span className="entry-icons">
          <button aria-label={`Nuova nota in ${folder.name}`} title="Nuova nota qui" onClick={stop(() => editNote(null, folder.id))}>+</button>
          <button aria-label={`Modifica ${folder.name}`} title="Modifica" onClick={stop(() => setFolderDraft({ id: folder.id, name: folder.name, parentId: folder.parentId ?? "" }))}><EditIcon/></button>
        </span>}</summary>
        <div className="journal-children">{renderLevel(folder.id)}{count === 0 && <small className="journal-empty">Cartella vuota</small>}</div>
      </details>; })}
      {level.notes.map((note) => { const entry = notes.find((item) => item.sheet.id === note.id)!; return <div key={note.id} className="journal-note" {...dragFrom(note.id)}>
        <span className="journal-icon"><NoteIcon/></span><button className="journal-open" onClick={() => setReadingId(note.id)}>{note.name}</button>
        <span className="entry-icons">
          <button aria-label={`Mostra in chat ${note.name}`} title="Mostra in chat" onClick={() => onShare(note.name, note.body)}><ChatIcon/></button>
          {canEditCloudSheet(entry, player) && <button aria-label={`Modifica ${note.name}`} title="Modifica" onClick={() => editNote(entry)}><EditIcon/></button>}
        </span>
      </div>; })}
    </>;
  };

  return <div className="stack">
    {isGm && <section className="library-actions"><Button onClick={() => editNote(null)}>Nuova nota</Button><Button variant="outline" onClick={() => setFolderDraft({ id: null, name: "", parentId: "" })}>Nuova cartella</Button></section>}
    {isGm && <p className="library-hint">Trascina note e cartelle per spostarle; rilasciale qui sotto per portarle fuori da ogni cartella. Una nota nuova la vede solo il GM finché non scegli chi può vederla.</p>}
    <div className="journal-tree" {...dropOn(undefined)}>
      {renderLevel(undefined)}
      {notes.length === 0 && folders.length === 0 && <p className="assign-empty">{isGm ? "Nessuna nota: crea una nota o una cartella." : "Il GM non ha ancora condiviso nessuna nota con te."}</p>}
    </div>

    <Dialog open={!!reading} title={reading?.sheet.name ?? ""} onClose={() => setReadingId(null)}>{reading && <div className="action-form">
      <p className="prose">{reading.sheet.body || "Nessun testo."}</p>
      <div className="action-form-buttons">
        <Button variant="outline" onClick={() => onShare(reading.sheet.name, reading.sheet.body)}>Mostra in chat</Button>
        {canEditCloudSheet(reading, player) && <Button variant="outline" onClick={() => { setReadingId(null); editNote(reading); }}>Modifica</Button>}
        <Button variant="secondary" onClick={() => setReadingId(null)}>Chiudi</Button>
      </div>
    </div>}</Dialog>

    <Dialog open={!!noteDraft} title={noteDraft?.id ? "Modifica nota" : "Nuova nota"} onClose={() => setNoteDraft(null)}>{noteDraft && <form className="action-form" onSubmit={(event) => { event.preventDefault(); if (noteDraft.name.trim()) void saveNote(noteDraft); }}>
      <label><span>Titolo</span><Input aria-label="Titolo della nota" autoFocus required value={noteDraft.name} onChange={(event) => setNoteDraft({ ...noteDraft, name: event.target.value })}/></label>
      <label><span>Testo</span><Textarea aria-label="Testo della nota" rows={10} value={noteDraft.body} onChange={(event) => setNoteDraft({ ...noteDraft, body: event.target.value })}/></label>
      {isGm && <>
        <FolderPick label="Cartella" value={noteDraft.folderId} targets={folderTargets(allFolders)} onChange={(folderId) => setNoteDraft({ ...noteDraft, folderId })}/>
        <div className="acl-row">
          <AclPicker title="Può vedere" names={noteDraft.acl.view} candidates={candidates} onChange={(view) => setNoteDraft({ ...noteDraft, acl: { ...noteDraft.acl, view } })}/>
          <AclPicker title="Può modificare" names={noteDraft.acl.edit} candidates={candidates} onChange={(edit) => setNoteDraft({ ...noteDraft, acl: { ...noteDraft.acl, edit } })}/>
        </div>
      </>}
      <div className="action-form-buttons">
        {isGm && noteDraft.id && <Button type="button" variant="destructive" onClick={() => { if (window.confirm(`Eliminare la nota “${noteDraft.name}”?`)) void onRemove(noteDraft.id!).then(() => setNoteDraft(null)); }}>Elimina</Button>}
        <Button type="button" variant="secondary" onClick={() => setNoteDraft(null)}>Annulla</Button>
        <Button type="submit">Salva</Button>
      </div>
    </form>}</Dialog>

    <Dialog open={!!folderDraft} title={folderDraft?.id ? "Modifica cartella" : "Nuova cartella"} onClose={() => setFolderDraft(null)}>{folderDraft && <form className="action-form" onSubmit={(event) => { event.preventDefault(); if (folderDraft.name.trim()) void saveFolder(folderDraft); }}>
      <label><span>Nome</span><Input aria-label="Nome della cartella" autoFocus required value={folderDraft.name} onChange={(event) => setFolderDraft({ ...folderDraft, name: event.target.value })}/></label>
      <FolderPick label="Dentro la cartella" value={folderDraft.parentId} targets={folderTargets(allFolders, folderDraft.id ?? undefined).filter((target) => target.id !== folderDraft.id)} onChange={(parentId) => setFolderDraft({ ...folderDraft, parentId })}/>
      <div className="action-form-buttons">
        {folderDraft.id && <Button type="button" variant="destructive" onClick={() => { if (window.confirm(`Eliminare la cartella “${folderDraft.name}”? Il suo contenuto sale di un livello.`)) void deleteFolder(folderDraft.id!); }}>Elimina</Button>}
        <Button type="button" variant="secondary" onClick={() => setFolderDraft(null)}>Annulla</Button>
        <Button type="submit">Salva</Button>
      </div>
    </form>}</Dialog>
  </div>;
}

function FolderPick({ label, value, targets, onChange }: { label: string; value: string; targets: Array<{ id: string; path: string }>; onChange: (id: string) => void }) {
  return <label><span>{label}</span><Select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}><option value="">Nessuna (radice)</option>{targets.map((target) => <option key={target.id} value={target.id}>{target.path}</option>)}</Select></label>;
}
