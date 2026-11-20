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

it("carica tanti mostri e un mostro eliminato resta segnato come tale", async () => {
  await putMonsters("r1", token, Array.from({ length: 45 }, (_, index) => monster(`m${index}`)));
  await deleteCloudMonster("r1", token, "m0");
  const entries = await fetchBestiary("r1", token);
  expect(entries).toHaveLength(45);
  expect(entries.find((entry) => entry.id === "m0")).toMatchObject({ deletedAt: expect.any(Number) });
  expect(entries.find((entry) => entry.id === "m0")?.monster).toBeUndefined();
});

it("un mostro rifiutato non blocca gli altri e viene nominato nell'errore", async () => {
  const huge = { ...monster("drago"), traits: [{ name: "x", description: "x".repeat(50_000) }] } as MonsterSheet;
  await expect(putMonsters("r1", token, [monster("lupo"), huge, monster("orco")])).rejects.toThrow("Mostri non salvati nel cloud: drago (HTTP 413)");
  expect((await fetchBestiary("r1", token)).map((entry) => entry.id).sort()).toEqual(["lupo", "orco"]);
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

it("prende la versione più recente di un mostro modificato in un altro browser", () => {
  const result = mergeBestiary([{ ...monster("a"), updatedAt: 1 }, monster("b")], [{ id: "a", monster: { ...monster("a"), name: "Nuovo", updatedAt: 2 } }, { id: "b", monster: { ...monster("b"), name: "Vecchio" } }]);
  expect(result.monsters.map((item) => item.name)).toEqual(["Nuovo", monster("b").name]);
  expect(result).toMatchObject({ changed: true, upload: [] });
});

it("se non cambia nulla lo segnala", () => {
  expect(mergeBestiary([monster("a")], [{ id: "a", monster: monster("a") }])).toMatchObject({ changed: false, upload: [] });
});

it("al limite di 3000 mostri si modificano quelli esistenti e le lapidi vecchie fanno posto", async () => {
  const month = 31 * 24 * 60 * 60 * 1000;
  store.set("te:room:r1:bestiary", new Map(Array.from({ length: 3000 }, (_, index) => [`m${index}`, JSON.stringify(index < 2 ? { id: `m${index}`, deletedAt: Date.now() - (index ? month : 0) } : { id: `m${index}`, monster: monster(`m${index}`) })])));
  await putMonsters("r1", token, [{ ...monster("m5"), name: "Lupo grande" }]);
  await putMonsters("r1", token, [monster("nuovo")]);
  await expect(putMonsters("r1", token, [monster("altro")])).rejects.toThrow("413");
  const entries = await fetchBestiary("r1", token);
  expect(entries.find((item) => item.id === "m5")?.monster?.name).toBe("Lupo grande");
  expect(entries.some((item) => item.id === "m1")).toBe(false);
  expect(entries.some((item) => item.id === "m0")).toBe(true);
});
