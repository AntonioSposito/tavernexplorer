import { storage } from "./storage";
import type { CloudSheet } from "./types";

export interface Viewer { name: string; role: "GM" | "PLAYER" }
export interface LibraryState { entries: CloudSheet[]; offline: boolean; conflict: string | null }

// Permessi applicati solo dall'estensione: chi conosce la stanza può aggirarli via API.
const sameName = (a: string, b: string) => a.trim().toLocaleLowerCase("it") === b.trim().toLocaleLowerCase("it");
export const canEditCloudSheet = (entry: CloudSheet, viewer: Viewer) =>
  viewer.role === "GM" || entry.acl.edit.some((name) => sameName(name, viewer.name));
export const canViewCloudSheet = (entry: CloudSheet, viewer: Viewer) =>
  canEditCloudSheet(entry, viewer) || entry.acl.view.some((name) => sameName(name, viewer.name));

interface Options {
  room: string;
  viewer: Viewer;
  onChange: (state: LibraryState) => void;
  fetch?: typeof fetch;
  // Avviso agli altri client dopo ogni salvataggio (es. broadcast Owlbear) e relativo ascolto.
  notify?: () => void;
  subscribe?: (onChange: () => void) => () => void;
  pollMs?: number;
  debounceMs?: number;
}

export class SheetExistsError extends Error {}

const OFFLINE = "Offline: modifiche disabilitate finché il server non risponde";

// Libreria della stanza: il server è la fonte di verità, il browser tiene solo una cache di lettura.
export function createCloudLibrary({ room, viewer, onChange, fetch: request = fetch, notify = () => undefined, subscribe, pollMs = 90_000, debounceMs = 1_500 }: Options) {
  const url = "/api/sheets";
  const server = new Map<string, CloudSheet>();
  const pending = new Map<string, CloudSheet>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const inFlight = new Set<string>();
  let offline = false;
  let conflict: string | null = null;

  const send = (method: string, body: unknown) => request(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify({ room, ...body as object }) });

  function emit() {
    const merged = [...server.values()].map((entry) => pending.get(entry.sheet.id) ?? entry);
    const entries = merged.filter((entry) => !entry.deletedAt && canViewCloudSheet(entry, viewer));
    if (!offline) storage.cloudCache.set(room, entries);
    onChange({ entries, offline, conflict });
  }

  async function refresh() {
    try {
      const response = await request(`${url}?room=${encodeURIComponent(room)}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const { sheets } = await response.json() as { sheets: CloudSheet[] };
      server.clear();
      for (const entry of sheets) server.set(entry.sheet.id, entry);
      offline = false;
      for (const id of pending.keys()) schedule(id);
    } catch {
      offline = true;
      if (!server.size) for (const entry of storage.cloudCache.get(room)) server.set(entry.sheet.id, entry);
    }
    emit();
  }

  // Risposta comune a PUT e DELETE: 200 salva, 409 adotta la versione del server e segnala il conflitto.
  async function apply(id: string, response: Response): Promise<boolean> {
    if (response.status !== 200 && response.status !== 409) throw new Error((await response.json().catch(() => null))?.error ?? `HTTP ${response.status}`);
    const { entry } = await response.json() as { entry: CloudSheet | null };
    if (entry) server.set(id, entry); else server.delete(id);
    if (response.status === 200) notify();
    if (response.status === 409) conflict = `${entry?.sheet.name ?? "Una scheda"} è stata modificata da qualcun altro: è stata ricaricata la versione del server.`;
    return response.status === 200;
  }

  function schedule(id: string) {
    clearTimeout(timers.get(id));
    timers.set(id, setTimeout(() => void flush(id), debounceMs));
  }

  async function flush(id: string) {
    timers.delete(id);
    const entry = pending.get(id);
    if (!entry) return;
    if (inFlight.has(id)) return schedule(id);
    inFlight.add(id);
    try {
      const { kind, sheet, acl } = entry;
      const saved = await apply(id, await send("PUT", { rev: server.get(id)?.rev ?? 0, entry: { kind, sheet, acl, updatedBy: viewer.name } }));
      // Una modifica arrivata durante l'invio resta in coda e riparte con la nuova rev.
      if (!saved || pending.get(id) === entry) pending.delete(id);
      else schedule(id);
    } catch {
      offline = true;
    } finally {
      inFlight.delete(id);
      emit();
    }
  }

  function editable(id: string): CloudSheet {
    if (offline) throw new Error(OFFLINE);
    const entry = pending.get(id) ?? server.get(id);
    if (!entry || entry.deletedAt) throw new Error("Scheda non trovata");
    if (!canEditCloudSheet(entry, viewer)) throw new Error("Non hai il permesso di modificare questa scheda");
    return entry;
  }

  let poll: ReturnType<typeof setInterval> | undefined;
  return {
    start() {
      for (const entry of storage.cloudCache.get(room)) server.set(entry.sheet.id, entry);
      if (server.size) emit();
      void refresh();
      // Gli avvisi coprono le modifiche altrui; il polling lento recupera solo quelli persi.
      const unsubscribe = subscribe?.(() => void refresh()) ?? (() => undefined);
      const visible = () => typeof document === "undefined" || document.visibilityState === "visible";
      const onVisible = () => { if (visible()) void refresh(); };
      poll = setInterval(() => { if (visible()) void refresh(); }, pollMs);
      if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisible);
      return () => {
        clearInterval(poll);
        unsubscribe();
        if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisible);
        for (const id of [...timers.keys()]) { clearTimeout(timers.get(id)); void flush(id); }
      };
    },
    refresh,
    update(id: string, updater: (entry: CloudSheet) => CloudSheet) {
      pending.set(id, updater(structuredClone(editable(id))));
      emit();
      schedule(id);
    },
    async add(entry: CloudSheet) {
      if (offline) throw new Error(OFFLINE);
      const { kind, sheet, acl } = entry;
      const saved = await apply(sheet.id, await send("PUT", { rev: 0, entry: { kind, sheet, acl, updatedBy: viewer.name } }));
      if (!saved) conflict = null;
      emit();
      if (!saved) throw new SheetExistsError(`${sheet.name} esiste già nella libreria`);
    },
    async remove(id: string) {
      editable(id);
      pending.delete(id);
      clearTimeout(timers.get(id));
      await apply(id, await send("DELETE", { id, rev: server.get(id)?.rev ?? 0, updatedBy: viewer.name }));
      emit();
    },
    clearConflict() { conflict = null; emit(); },
  };
}
