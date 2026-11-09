import type { DragEvent, MouseEvent, ReactNode } from "react";
import { EditIcon, FolderIcon, FolderOpenIcon } from "./icons";
import { folderChildren, folderTargets } from "./journalTree";
import type { JournalFolder } from "./types";
import { Button, Dialog, Input, Select } from "./ui";

// Albero a cartelle come su Roll20 (Journal, Bestiario): chi organizza trascina voci e cartelle.
type Item = { id: string; name: string; folderId?: string };
export type FolderDraft = { id: string | null; name: string; parentId: string };

const stop = (action: () => void) => (event: MouseEvent) => { event.preventDefault(); event.stopPropagation(); action(); };

interface FolderTreeProps<T extends Item> {
  folders: JournalFolder[];
  items: T[];
  canOrganize: boolean;
  // Sposta una voce o una cartella (undefined = radice).
  onMove: (id: string, folderId: string | undefined) => void;
  onEditFolder: (folder: JournalFolder) => void;
  // Pulsante "+" sulla cartella (es. nuova nota qui).
  addIn?: { label: string; title: string; onAdd: (folderId: string) => void };
  // Riga della voce: icona, nome e pulsanti.
  renderItem: (item: T) => ReactNode;
  empty: ReactNode;
}

export function FolderTree<T extends Item>({ folders, items, canOrganize, onMove, onEditFolder, addIn, renderItem, empty }: FolderTreeProps<T>) {
  const dropOn = (folderId: string | undefined) => canOrganize ? {
    onDragOver: (event: DragEvent) => event.preventDefault(),
    onDrop: (event: DragEvent) => { event.preventDefault(); event.stopPropagation(); const id = event.dataTransfer.getData("text/plain"); if (id && id !== folderId) onMove(id, folderId); },
  } : {};
  const dragFrom = (id: string) => canOrganize ? { draggable: true, onDragStart: (event: DragEvent) => { event.stopPropagation(); event.dataTransfer.setData("text/plain", id); } } : {};

  const renderLevel = (parentId: string | undefined) => {
    const level = folderChildren(folders, items, parentId);
    return <>
      {level.folders.map((folder) => { const inside = folderChildren(folders, items, folder.id); const count = inside.folders.length + inside.notes.length; return <details key={folder.id} className="journal-folder" open>
        <summary {...dragFrom(folder.id)} {...dropOn(folder.id)}><span className="journal-icon"><FolderIcon/><FolderOpenIcon/></span><strong>{folder.name}</strong><small className="journal-count" title="Elementi nella cartella">{count}</small>{canOrganize && <span className="entry-icons">
          {addIn && <button aria-label={`${addIn.label} in ${folder.name}`} title={addIn.title} onClick={stop(() => addIn.onAdd(folder.id))}>+</button>}
          <button aria-label={`Modifica ${folder.name}`} title="Modifica" onClick={stop(() => onEditFolder(folder))}><EditIcon/></button>
        </span>}</summary>
        <div className="journal-children">{renderLevel(folder.id)}{count === 0 && <small className="journal-empty">Cartella vuota</small>}</div>
      </details>; })}
      {level.notes.map((item) => <div key={item.id} className="journal-note" {...dragFrom(item.id)}>{renderItem(item)}</div>)}
    </>;
  };

  return <div className="journal-tree" {...dropOn(undefined)}>
    {renderLevel(undefined)}
    {items.length === 0 && folders.length === 0 && empty}
  </div>;
}

// Popup per creare, modificare o eliminare una cartella.
export function FolderDialog({ draft, folders, onChange, onSave, onDelete, onClose }: { draft: FolderDraft | null; folders: JournalFolder[]; onChange: (draft: FolderDraft) => void; onSave: (draft: FolderDraft) => void; onDelete: (id: string) => void; onClose: () => void }) {
  return <Dialog open={!!draft} title={draft?.id ? "Modifica cartella" : "Nuova cartella"} onClose={onClose}>{draft && <form className="action-form" onSubmit={(event) => { event.preventDefault(); if (draft.name.trim()) onSave(draft); }}>
    <label><span>Nome</span><Input aria-label="Nome della cartella" autoFocus required value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })}/></label>
    <FolderPick label="Dentro la cartella" value={draft.parentId} targets={folderTargets(folders, draft.id ?? undefined).filter((target) => target.id !== draft.id)} onChange={(parentId) => onChange({ ...draft, parentId })}/>
    <div className="action-form-buttons">
      {draft.id && <Button type="button" variant="destructive" onClick={() => { if (window.confirm(`Eliminare la cartella “${draft.name}”? Il suo contenuto sale di un livello.`)) onDelete(draft.id!); }}>Elimina</Button>}
      <Button type="button" variant="secondary" onClick={onClose}>Annulla</Button>
      <Button type="submit">Salva</Button>
    </div>
  </form>}</Dialog>;
}

export function FolderPick({ label, value, targets, onChange }: { label: string; value: string; targets: Array<{ id: string; path: string }>; onChange: (id: string) => void }) {
  return <label><span>{label}</span><Select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}><option value="">Nessuna (radice)</option>{targets.map((target) => <option key={target.id} value={target.id}>{target.path}</option>)}</Select></label>;
}
