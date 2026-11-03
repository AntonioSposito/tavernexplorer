import { expect, it } from "vitest";
import { canMoveFolder, folderChildren, folderTargets, visibleFolders } from "./journalTree";
import type { JournalFolder, JournalNote } from "./types";

const folder = (id: string, name: string, parentId?: string): JournalFolder => ({ schemaVersion: 1, id, name, ...parentId ? { parentId } : {} });
const note = (id: string, name: string, folderId?: string): JournalNote => ({ schemaVersion: 1, id, name, body: "", ...folderId ? { folderId } : {} });
// Avventura / Capitolo 1 / Segreti; Png.
const FOLDERS = [folder("adv", "Avventura"), folder("ch1", "Capitolo 1", "adv"), folder("sec", "Segreti", "ch1"), folder("npc", "Png")];

it("il giocatore vede solo le cartelle che portano a una nota visibile", () => {
  expect(visibleFolders(FOLDERS, [], true)).toEqual(FOLDERS);
  expect(visibleFolders(FOLDERS, [note("n1", "Indizio", "ch1")], false).map((item) => item.id)).toEqual(["adv", "ch1"]);
  expect(visibleFolders(FOLDERS, [note("n1", "Root")], false)).toEqual([]);
});

it("il contenuto di una cartella è in ordine alfabetico; i genitori mancanti valgono come radice", () => {
  const notes = [note("b", "beta"), note("a", "Alfa"), note("x", "Persa", "cancellata"), note("c", "Dentro", "adv")];
  const root = folderChildren([...FOLDERS, folder("orfana", "Orfana", "cancellata")], notes, undefined);
  expect(root.folders.map((item) => item.name)).toEqual(["Avventura", "Orfana", "Png"]);
  expect(root.notes.map((item) => item.name)).toEqual(["Alfa", "beta", "Persa"]);
  expect(folderChildren(FOLDERS, notes, "adv")).toMatchObject({ folders: [{ id: "ch1" }], notes: [{ id: "c" }] });
});

it("una cartella non si sposta dentro sé stessa o nelle sue sottocartelle", () => {
  expect(canMoveFolder(FOLDERS, "adv", "sec")).toBe(false);
  expect(canMoveFolder(FOLDERS, "adv", "adv")).toBe(false);
  expect(canMoveFolder(FOLDERS, "sec", "npc")).toBe(true);
  expect(canMoveFolder(FOLDERS, "ch1", undefined)).toBe(true);
  expect(folderTargets(FOLDERS, "ch1").map((item) => item.path)).toEqual(["Avventura", "Png"]);
  expect(folderTargets(FOLDERS).map((item) => item.path)).toEqual(["Avventura", "Avventura / Capitolo 1", "Avventura / Capitolo 1 / Segreti", "Png"]);
});
