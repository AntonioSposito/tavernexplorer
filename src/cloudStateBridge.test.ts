import { beforeEach, expect, it, vi } from "vitest";
import { apiFetch, store } from "./fakeRedis";

vi.mock("@upstash/redis", async () => (await import("./fakeRedis")).fakeRedisModule);
vi.mock("@owlbear-rodeo/sdk", () => ({ default: {} }));
const { fetchRoomState, putRoomState } = await import("./cloudState");
const { createStateSync } = await import("./cloudStateBridge");

const turns = (round: number) => ({ round, activeIndex: 0, entries: [] });
let local: Record<string, unknown>;
const writeLocal = vi.fn(async (key: string, value: unknown) => { local[key] = value; });
const sync = () => createStateSync("r1", async () => local, writeLocal);

beforeEach(() => {
  store.clear(); local = {}; writeLocal.mockClear();
  vi.stubGlobal("fetch", apiFetch);
});

it("al primo giro con cloud vuoto carica ciò che c'è in Owlbear", async () => {
  local = { turns: turns(3) };
  await sync()();
  expect((await fetchRoomState("r1")).turns?.value).toEqual(turns(3));
  expect(writeLocal).not.toHaveBeenCalled();
});

it("al primo giro vince ciò che il telefono ha scritto con Owlbear chiuso", async () => {
  local = { turns: turns(1) };
  await putRoomState("r1", "turns", turns(5));
  await sync()();
  expect(local.turns).toEqual(turns(5));
});

it("una modifica in Owlbear va nel cloud e una dal telefono torna in Owlbear", async () => {
  local = { turns: turns(1) };
  const run = sync();
  await run();
  local.turns = turns(2);
  await run();
  expect((await fetchRoomState("r1")).turns?.value).toEqual(turns(2));
  expect(writeLocal).not.toHaveBeenCalled();

  await putRoomState("r1", "turns", turns(9));
  await run();
  expect(local.turns).toEqual(turns(9));
  expect(writeLocal).toHaveBeenCalledTimes(1);
});

it("se il cloud non risponde la modifica locale resta e riparte al giro dopo", async () => {
  local = { turns: turns(1) };
  const run = sync();
  await run();
  local.turns = turns(2);
  vi.stubGlobal("fetch", async () => new Response("{}", { status: 500 }));
  await expect(run()).rejects.toThrow();
  expect(local.turns).toEqual(turns(2));
  vi.stubGlobal("fetch", apiFetch);
  await run();
  expect((await fetchRoomState("r1")).turns?.value).toEqual(turns(2));
});
