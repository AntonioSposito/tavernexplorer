import { beforeEach, expect, it, vi } from "vitest";

import { store } from "./fakeRedis";
vi.mock("@upstash/redis", async () => (await import("./fakeRedis")).fakeRedisModule);

const { GET, PUT, DELETE } = await import("../api/sheets");
const sheet = (id = "pg1", extra = {}) => ({ schemaVersion: 1, id, name: "Aria", identity: {}, ...extra });
const monster = { schemaVersion: 1, id: "npc1", name: "Goblin", challengeRating: "1/4" };
const call = (handler: (request: Request) => Promise<Response>, method: string, body: unknown) =>
  handler(new Request("http://test/api/sheets", { method, body: JSON.stringify(body) }));
const put = (rev: number, entry: unknown) => call(PUT, "PUT", { room: "r1", rev, entry });
const entry = (extra = {}) => ({ kind: "pc", sheet: sheet(), acl: { view: [], edit: [] }, updatedBy: "GM", ...extra });

beforeEach(() => store.clear());

it("crea con rev 1 e rifiuta la seconda scrittura con la stessa rev di partenza", async () => {
  const first = await put(0, entry());
  expect(first.status).toBe(200);
  expect((await first.json()).entry.rev).toBe(1);
  expect((await put(1, entry({ updatedBy: "Marco" }))).status).toBe(200);
  const stale = await put(1, entry({ updatedBy: "Luca" }));
  expect(stale.status).toBe(409);
  expect((await stale.json()).entry).toMatchObject({ rev: 2, updatedBy: "Marco" });
});

it("non sovrascrive una scheda esistente come se fosse nuova", async () => {
  await put(0, entry());
  expect((await put(0, entry())).status).toBe(409);
});

it("rifiuta schede non valide o troppo grandi", async () => {
  expect((await put(0, entry({ acl: { view: "Marco", edit: [] } }))).status).toBe(400);
  expect((await put(0, entry({ sheet: sheet("../x") }))).status).toBe(400);
  expect((await put(-1, entry())).status).toBe(400);
  expect((await put(0, entry({ sheet: sheet("pg1", { biography: "x".repeat(200_001) }) }))).status).toBe(413);
});

it("la cancellazione è logica e passa dal controllo di rev", async () => {
  await put(0, entry());
  expect((await call(DELETE, "DELETE", { room: "r1", id: "pg1", rev: 0, updatedBy: "GM" })).status).toBe(409);
  expect((await call(DELETE, "DELETE", { room: "r1", id: "pg1", rev: 1, updatedBy: "GM" })).status).toBe(200);
  expect((await call(DELETE, "DELETE", { room: "r1", id: "nope", rev: 0, updatedBy: "GM" })).status).toBe(404);
  const { sheets } = await (await GET(new Request("http://test/api/sheets?room=r1"))).json();
  expect(sheets).toHaveLength(1);
  expect(sheets[0]).toMatchObject({ rev: 2, sheet: { id: "pg1" } });
  expect(sheets[0].deletedAt).toEqual(expect.any(Number));
});

it("accetta PG e NPC solo con il formato giusto", async () => {
  expect((await put(0, entry({ kind: "npc", sheet: monster }))).status).toBe(200);
  expect((await put(0, entry({ kind: "npc" }))).status).toBe(400);
  expect((await put(0, entry({ sheet: { ...monster, id: "npc2" } }))).status).toBe(400);
  expect((await put(0, entry({ kind: "boss" }))).status).toBe(400);
  const { sheets } = await (await GET(new Request("http://test/api/sheets?room=r1"))).json();
  expect(sheets[0]).toMatchObject({ kind: "npc", rev: 1, sheet: { name: "Goblin" } });
});
