import { beforeEach, expect, it, vi } from "vitest";
import { apiFetch, store } from "./fakeRedis";
import type { MonsterSheet } from "./types";

vi.mock("@upstash/redis", async () => (await import("./fakeRedis")).fakeRedisModule);
const { gmToken } = await import("../api/_gmToken");
const { deleteCloudMonster, fetchBestiary, mergeBestiary, putMonsters } = await import("./cloudBestiary");

const monster = (id: string) => ({ id, name: id, challengeRating: "1" }) as MonsterSheet;
const ids = (items: MonsterSheet[]) => items.map((item) => item.id);
let token: string;

beforeEach(async () => {
  store.clear(); vi.stubEnv("PHONE_GM_PASSWORD", "segreta"); vi.stubGlobal("fetch", apiFetch);
  token = await gmToken("r1", "segreta");
});

it("senza token GM valido non si legge né si scrive", async () => {
  await putMonsters("r1", token, [monster("lupo")]);
  await expect(fetchBestiary("r1", "token-falso")).rejects.toThrow("401");
  await expect(fetchBestiary("r1", await gmToken("altra", "segreta"))).rejects.toThrow("401");
  await expect(putMonsters("r1", "token-falso", [monster("orco")])).rejects.toThrow("401");
  await expect(deleteCloudMonster("r1", "token-falso", "lupo")).rejects.toThrow("401");
  expect((await fetchBestiary("r1", token)).map((entry) => entry.id)).toEqual(["lupo"]);
});

it("carica a blocchi e un mostro eliminato resta segnato come tale", async () => {
  await putMonsters("r1", token, Array.from({ length: 45 }, (_, index) => monster(`m${index}`)));
  await deleteCloudMonster("r1", token, "m0");
  const entries = await fetchBestiary("r1", token);
  expect(entries).toHaveLength(45);
  expect(entries.find((entry) => entry.id === "m0")).toMatchObject({ deletedAt: expect.any(Number) });
  expect(entries.find((entry) => entry.id === "m0")?.monster).toBeUndefined();
});

it("un nuovo caricamento esplicito riporta in vita un mostro eliminato", async () => {
  await putMonsters("r1", token, [monster("lupo")]);
  await deleteCloudMonster("r1", token, "lupo");
  await putMonsters("r1", token, [monster("lupo")]);
  expect((await fetchBestiary("r1", token))[0].deletedAt).toBeUndefined();
});

it("unisce locale e cloud senza resuscitare gli eliminati", () => {
  const result = mergeBestiary([monster("a"), monster("eliminato"), monster("solo-locale")], [
    { id: "a", monster: monster("a") },
    { id: "eliminato", deletedAt: 5 },
    { id: "solo-cloud", monster: monster("solo-cloud") },
    { id: "morto-altrove", deletedAt: 5 },
  ]);
  expect(ids(result.monsters)).toEqual(["a", "solo-locale", "solo-cloud"]);
  expect(ids(result.upload)).toEqual(["solo-locale"]);
  expect(result.changed).toBe(true);
});

it("se non cambia nulla lo segnala", () => {
  expect(mergeBestiary([monster("a")], [{ id: "a", monster: monster("a") }])).toMatchObject({ changed: false, upload: [] });
});
