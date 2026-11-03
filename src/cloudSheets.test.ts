// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { LibraryState } from "./cloudSheets";
import type { CloudSheet } from "./types";

// Il client parla con il vero handler dell'API, sopra un Redis finto in memoria.
import { store } from "./fakeRedis";
vi.mock("@upstash/redis", async () => (await import("./fakeRedis")).fakeRedisModule);

const api = await import("../api/sheets");
const { canEditCloudSheet, canViewCloudSheet, createCloudLibrary } = await import("./cloudSheets");
let online = true;
const calls: string[] = [];
const fakeFetch = (async (input: string, init?: RequestInit) => {
  if (!online) throw new TypeError("Failed to fetch");
  const method = init?.method ?? "GET";
  calls.push(method);
  const handler = { GET: api.GET, PUT: api.PUT, DELETE: api.DELETE }[method as "GET"];
  return handler(new Request(`http://test${input}`, init));
}) as typeof fetch;

const pc = (id: string, acl = { view: [] as string[], edit: [] as string[] }) =>
  ({ kind: "pc", sheet: { schemaVersion: 1, id, name: id, identity: {}, combat: { hp: { current: 10, max: 10, temp: 0 } } }, acl, rev: 0, updatedAt: 0, updatedBy: "GM" }) as unknown as CloudSheet;
const hp = (entry: CloudSheet | undefined) => (entry?.sheet as { combat: { hp: { current: number } } } | undefined)?.combat.hp.current;

function open(name: string, role: "GM" | "PLAYER") {
  let state: LibraryState = { entries: [], offline: false, conflict: null };
  const library = createCloudLibrary({ room: "r1", viewer: { name, role }, onChange: (next) => { state = next; }, fetch: fakeFetch, debounceMs: 100 });
  return { library, get state() { return state; } };
}

beforeEach(() => { store.clear(); localStorage.clear(); calls.length = 0; online = true; vi.useFakeTimers(); });
afterEach(() => vi.useRealTimers());

it("il GM vede tutto, i giocatori solo quello che l'ACL concede", () => {
  const entry = pc("ada", { view: ["Marco"], edit: [" luca "] });
  expect(canViewCloudSheet(entry, { name: "Chiunque", role: "GM" })).toBe(true);
  expect(canViewCloudSheet(entry, { name: "marco", role: "PLAYER" })).toBe(true);
  expect(canEditCloudSheet(entry, { name: "Marco", role: "PLAYER" })).toBe(false);
  expect(canViewCloudSheet(entry, { name: "Luca", role: "PLAYER" })).toBe(true);
  expect(canEditCloudSheet(entry, { name: "Luca", role: "PLAYER" })).toBe(true);
  expect(canViewCloudSheet(entry, { name: "Sara", role: "PLAYER" })).toBe(false);
  const open = pc("ada", { view: ["*"], edit: [] });
  expect(canViewCloudSheet(open, { name: "Sara", role: "PLAYER" })).toBe(true);
  expect(canEditCloudSheet(open, { name: "Sara", role: "PLAYER" })).toBe(false);
  expect(canEditCloudSheet(pc("ada", { view: [], edit: ["*"] }), { name: "Sara", role: "PLAYER" })).toBe(true);
});

it("unisce le modifiche rapide in un solo salvataggio e i giocatori vedono solo le schede permesse", async () => {
  const gm = open("GM", "GM");
  await gm.library.add(pc("ada", { view: ["Marco"], edit: [] }));
  await gm.library.add(pc("berto"));
  for (const value of [9, 8, 7]) gm.library.update("ada", (entry) => { (entry.sheet as { combat: { hp: { current: number } } }).combat.hp.current = value; return entry; });
  expect(hp(gm.state.entries.find((entry) => entry.sheet.id === "ada"))).toBe(7);
  calls.length = 0;
  await vi.advanceTimersByTimeAsync(100);
  expect(calls).toEqual(["PUT"]);

  const marco = open("Marco", "PLAYER");
  await marco.library.refresh();
  expect(marco.state.entries.map((entry) => entry.sheet.id)).toEqual(["ada"]);
  expect(hp(marco.state.entries[0])).toBe(7);
  expect(() => marco.library.update("ada", (entry) => entry)).toThrow("permesso");
});

it("su conflitto adotta la versione del server e lo segnala", async () => {
  const gm = open("GM", "GM");
  await gm.library.add(pc("ada", { view: [], edit: ["Luca"] }));
  const luca = open("Luca", "PLAYER");
  await luca.library.refresh();
  gm.library.update("ada", (entry) => { (entry.sheet as { combat: { hp: { current: number } } }).combat.hp.current = 3; return entry; });
  luca.library.update("ada", (entry) => { (entry.sheet as { combat: { hp: { current: number } } }).combat.hp.current = 6; return entry; });
  await vi.advanceTimersByTimeAsync(100);
  expect(gm.state.conflict).toBeNull();
  expect(luca.state.conflict).toContain("ada");
  expect(hp(luca.state.entries[0])).toBe(3);
});

it("offline mostra la cache in sola lettura", async () => {
  const gm = open("GM", "GM");
  await gm.library.add(pc("ada"));
  online = false;
  const later = open("GM", "GM");
  later.library.start();
  await vi.advanceTimersByTimeAsync(0);
  expect(later.state.offline).toBe(true);
  expect(later.state.entries.map((entry) => entry.sheet.id)).toEqual(["ada"]);
  expect(() => later.library.update("ada", (entry) => entry)).toThrow("Offline");
});

it("la cancellazione nasconde la scheda a tutti", async () => {
  const gm = open("GM", "GM");
  await gm.library.add(pc("ada"));
  await gm.library.remove("ada");
  const other = open("GM", "GM");
  await other.library.refresh();
  expect(other.state.entries).toEqual([]);
});

it("avvisa gli altri dopo ogni salvataggio e rilegge solo quando arriva un avviso", async () => {
  const listeners = new Set<() => void>();
  const bus = { notify: () => listeners.forEach((listener) => listener()), subscribe: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); } };
  let gmState: LibraryState | null = null;
  let playerState: LibraryState | null = null;
  const gm = createCloudLibrary({ room: "r1", viewer: { name: "GM", role: "GM" }, onChange: (next) => { gmState = next; }, fetch: fakeFetch, debounceMs: 100, ...bus });
  const player = createCloudLibrary({ room: "r1", viewer: { name: "Marco", role: "PLAYER" }, onChange: (next) => { playerState = next; }, fetch: fakeFetch, debounceMs: 100, ...bus });
  const stopPlayer = player.start();
  await vi.advanceTimersByTimeAsync(0);
  calls.length = 0;

  await gm.add(pc("ada", { view: ["Marco"], edit: [] }));
  await vi.advanceTimersByTimeAsync(0);
  expect(calls).toEqual(["PUT", "GET"]);
  expect(playerState!.entries.map((entry) => entry.sheet.id)).toEqual(["ada"]);
  expect(gmState!.entries).toHaveLength(1);

  calls.length = 0;
  await vi.advanceTimersByTimeAsync(60_000);
  expect(calls).toEqual([]);
  stopPlayer();
  bus.notify();
  await vi.advanceTimersByTimeAsync(0);
  expect(calls).toEqual([]);
});

it("le cartelle del Journal arrivano a tutti, le note solo a chi le può vedere", async () => {
  const gm = open("GM", "GM");
  gm.library.start();
  await vi.advanceTimersByTimeAsync(0);
  await gm.library.add({ kind: "folder", sheet: { schemaVersion: 1, id: "f1", name: "Segreti" }, acl: { view: [], edit: [] }, rev: 0, updatedAt: 0, updatedBy: "GM" });
  await gm.library.add({ kind: "note", sheet: { schemaVersion: 1, id: "n1", name: "Piano", body: "…", folderId: "f1" }, acl: { view: [], edit: [] }, rev: 0, updatedAt: 0, updatedBy: "GM" });
  await gm.library.add({ kind: "note", sheet: { schemaVersion: 1, id: "n2", name: "Mappa", body: "…" }, acl: { view: ["Marco"], edit: [] }, rev: 0, updatedAt: 0, updatedBy: "GM" });
  const marco = open("Marco", "PLAYER");
  marco.library.start();
  await vi.advanceTimersByTimeAsync(0);
  expect(marco.state.entries.map((entry) => entry.sheet.id).sort()).toEqual(["f1", "n2"]);
  expect(() => marco.library.update("f1", (entry) => entry)).toThrow("permesso");
});
