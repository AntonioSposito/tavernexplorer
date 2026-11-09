import type { JournalFolder } from "./types";

// Voce dentro una cartella: nota del Journal o mostro del Bestiario.
type Item = { id: string; name: string; folderId?: string };

// Albero del Journal (come Roll20). Una nota o cartella con un genitore che non esiste più sta nella radice.

const parentOf = (folders: Map<string, JournalFolder>, id: string | undefined) => id && folders.has(id) ? id : undefined;

// Cartelle da mostrare: al GM tutte; al giocatore solo quelle che contengono, anche in sottocartelle, una nota che vede.
export function visibleFolders(folders: JournalFolder[], notes: Item[], isGm: boolean): JournalFolder[] {
  if (isGm) return folders;
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const shown = new Set<string>();
  for (const note of notes) {
    for (let id = parentOf(byId, note.folderId); id && !shown.has(id); id = parentOf(byId, byId.get(id)?.parentId)) shown.add(id);
  }
  return folders.filter((folder) => shown.has(folder.id));
}

// Contenuto diretto di una cartella (undefined = radice), in ordine alfabetico.
export function folderChildren<T extends Item>(folders: JournalFolder[], notes: T[], parentId: string | undefined) {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "it", { sensitivity: "base" });
  return {
    folders: folders.filter((folder) => parentOf(byId, folder.parentId) === parentId).sort(byName),
    notes: notes.filter((note) => parentOf(byId, note.folderId) === parentId).sort(byName),
  };
}

// Spostare una cartella dentro sé stessa o in una sua sottocartella creerebbe un ciclo.
export function canMoveFolder(folders: JournalFolder[], id: string, parentId: string | undefined): boolean {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  for (let current = parentId; current; current = byId.get(current)?.parentId) if (current === id) return false;
  return true;
}

// Cartelle candidate come destinazione, con il percorso ("Avventura / Capitolo 1"); escluse quelle che creano cicli.
export function folderTargets(folders: JournalFolder[], movingFolderId?: string): Array<{ id: string; path: string }> {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const path = (folder: JournalFolder): string => { const parent = byId.get(folder.parentId ?? ""); return parent && parent.id !== folder.id ? `${path(parent)} / ${folder.name}` : folder.name; };
  return folders.filter((folder) => !movingFolderId || canMoveFolder(folders, movingFolderId, folder.id))
    .map((folder) => ({ id: folder.id, path: path(folder) })).sort((a, b) => a.path.localeCompare(b.path, "it", { sensitivity: "base" }));
}
