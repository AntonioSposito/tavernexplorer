import { beforeEach, expect, it, vi } from "vitest";
import { store } from "./fakeRedis";

vi.mock("@upstash/redis", async () => (await import("./fakeRedis")).fakeRedisModule);
const { GET, PUT } = await import("../api/room-state");

const put = (body: unknown) => PUT(new Request("http://test/api/room-state", { method: "PUT", body: JSON.stringify(body) }));
const read = async (room = "r1") => (await (await GET(new Request(`http://test/api/room-state?room=${room}`))).json()).state;
const turns = { round: 2, activeIndex: 1, entries: [] };

beforeEach(() => { store.clear(); });

it("salva e rilegge turni, inventario e permessi", async () => {
  expect(await read()).toEqual({});
  const permissions = { playersEditInventory: false, playersImportContent: false, playersManageTurns: true };
  expect((await put({ room: "r1", key: "turns", value: turns })).status).toBe(200);
  expect((await put({ room: "r1", key: "inventory", value: [{ id: "i", name: "Corda" }] })).status).toBe(200);
  expect((await put({ room: "r1", key: "permissions", value: permissions })).status).toBe(200);
  const state = await read();
  expect(state.turns.value).toEqual(turns);
  expect(state.inventory.value).toEqual([{ id: "i", name: "Corda" }]);
  expect(state.permissions.value).toEqual(permissions);
  expect(await read("altra")).toEqual({});
});

it("rifiuta chiavi sconosciute, valori malformati e dati troppo grandi", async () => {
  expect((await put({ room: "r1", key: "__proto__", value: {} })).status).toBe(400);
  expect((await put({ room: "r1", key: "turns", value: { round: 1 } })).status).toBe(400);
  expect((await put({ room: "r1", key: "permissions", value: { playersEditInventory: true } })).status).toBe(400);
  expect((await put({ room: "bad room", key: "turns", value: turns })).status).toBe(400);
  expect((await put({ room: "r1", key: "inventory", value: [{ id: "i", name: "x".repeat(15_000) }] })).status).toBe(413);
  expect(await read()).toEqual({});
});
