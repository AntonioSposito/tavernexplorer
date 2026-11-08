// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { STORAGE_CLOUD_CACHE, TOKEN_META_KEY, TURN_META_KEY } from "./constants";
import { createBlankSheet } from "./blankSheet";
import type { CharacterSheet, CloudSheet } from "./types";

const mock = vi.hoisted(() => ({
  role: "PLAYER", metadata: {} as Record<string, unknown>, written: [] as unknown[], notify: vi.fn(), error: vi.fn(),
  listener: null as null | ((event: { data: unknown; connectionId: string }) => void), items: [] as unknown[],
}));
vi.mock("@owlbear-rodeo/sdk", () => ({ default: {
  room: { id: "r1", getMetadata: async () => mock.metadata },
  player: { getRole: async () => mock.role, getName: async () => "Anna", getConnectionId: async () => "me" },
  scene: { items: { getItems: async () => mock.items } },
  broadcast: { onMessage: (_channel: string, callback: typeof mock.listener) => { mock.listener = callback; return () => undefined; } },
  notification: { show: mock.error },
} }));
vi.mock("./obr", () => ({ notifySheetsChanged: mock.notify }));
vi.mock("./roomMetadata", () => ({ writeRoomMetadata: async (value: unknown) => { mock.written.push(value); } }));

import { setTokenHitPoints, setupTokenHitPoints } from "./tokenMenuActions";

const token = (characterId: string) => ({ id: "t1", name: "Eroe", metadata: { [TOKEN_META_KEY]: { characterId } } }) as never;

function pc(edit: string[], rev = 4): CloudSheet {
  const sheet = createBlankSheet("Eroe");
  sheet.id = "eroe";
  sheet.combat.hp = { current: 10, max: 20, temp: 3 };
  return { kind: "pc", sheet, acl: { view: [], edit }, rev, updatedAt: 0, updatedBy: "GM" } as CloudSheet;
}

// Server finto: GET restituisce `server`, PUT salva solo con la rev giusta (altrimenti 409 con la versione del server).
function serve(server: CloudSheet) {
  const calls: Array<{ method: string; rev?: number; entry?: CloudSheet }> = [];
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method !== "PUT") { calls.push({ method: "GET" }); return new Response(JSON.stringify({ sheets: [server] })); }
    const body = JSON.parse(String(init.body)) as { rev: number; entry: CloudSheet };
    calls.push({ method: "PUT", rev: body.rev, entry: body.entry });
    if (body.rev !== server.rev) return new Response(JSON.stringify({ entry: server }), { status: 409 });
    return new Response(JSON.stringify({ entry: { ...body.entry, rev: server.rev + 1 } }));
  }));
  return calls;
}

const cache = (entries: CloudSheet[]) => localStorage.setItem(`${STORAGE_CLOUD_CACHE}/r1`, JSON.stringify(entries));

beforeEach(() => { mock.role = "PLAYER"; mock.metadata = {}; mock.written = []; mock.notify.mockClear(); mock.error.mockClear(); localStorage.clear(); });

it("salva subito dalla cache: il danno consuma prima i temporanei", async () => {
  const entry = pc(["Anna"]);
  cache([entry]);
  const calls = serve(entry);
  expect(await setTokenHitPoints(token("eroe"), 8)).toBe(8);
  expect(calls.map((call) => call.method)).toEqual(["PUT"]);
  expect((calls[0].entry?.sheet as CharacterSheet).combat.hp).toMatchObject({ current: 8, temp: 0 });
  expect(JSON.parse(localStorage.getItem(`${STORAGE_CLOUD_CACHE}/r1`)!)[0].rev).toBe(5);
  expect(mock.notify).toHaveBeenCalled();
});

it("la cura non supera il massimo", async () => {
  const entry = pc(["Anna"]);
  cache([entry]);
  serve(entry);
  expect(await setTokenHitPoints(token("eroe"), 99)).toBe(23);
});

it("con la cache vecchia riprova una volta sulla versione del server", async () => {
  cache([pc(["Anna"], 2)]);
  const calls = serve(pc(["Anna"], 7));
  expect(await setTokenHitPoints(token("eroe"), 5)).toBe(5);
  expect(calls.map((call) => `${call.method} ${call.rev}`)).toEqual(["PUT 2", "PUT 7"]);
});

it("senza cache legge la scheda dal server", async () => {
  const calls = serve(pc(["Anna"]));
  expect(await setTokenHitPoints(token("eroe"), 5)).toBe(5);
  expect(calls.map((call) => call.method)).toEqual(["GET", "PUT"]);
});

it("chi non può modificare la scheda non salva", async () => {
  const entry = pc([]);
  cache([entry]);
  const calls = serve(entry);
  await expect(setTokenHitPoints(token("eroe"), 5)).rejects.toThrow("permesso");
  expect(calls).toHaveLength(0);
});

it("NPC e mostri: il GM cambia i PF della voce del turn order senza chiamare il server", async () => {
  const calls = serve(pc(["Anna"]));
  mock.role = "GM";
  mock.metadata = { [TURN_META_KEY]: { round: 1, activeIndex: 0, entries: [{ id: "e1", tokenId: "t1", name: "Orco", initiative: 10, hp: { current: 15, max: 15 } }] } };
  expect(await setTokenHitPoints(token("orco"), 4)).toBe(4);
  expect(calls).toHaveLength(0);
  expect(mock.written).toEqual([{ [TURN_META_KEY]: expect.objectContaining({ entries: [expect.objectContaining({ hp: { current: 4, max: 15 } })] }) }]);
});

it("il background salva le richieste di questo browser e ignora quelle degli altri", async () => {
  const entry = pc(["Anna"]);
  cache([entry]);
  const calls = serve(entry);
  mock.items = [token("eroe")];
  setupTokenHitPoints();
  mock.listener?.({ data: { tokenId: "t1", total: 6 }, connectionId: "someone-else" });
  await vi.waitFor(() => expect(mock.listener).not.toBeNull());
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(calls).toHaveLength(0);
  mock.listener?.({ data: { tokenId: "t1", total: 6 }, connectionId: "me" });
  await vi.waitFor(() => expect(calls.map((call) => call.method)).toEqual(["PUT"]));
  expect((calls[0].entry?.sheet as CharacterSheet).combat.hp.current).toBe(6);
});
