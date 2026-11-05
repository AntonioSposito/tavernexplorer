import { beforeEach, expect, it, vi } from "vitest";
import { store } from "./fakeRedis";

vi.mock("@upstash/redis", async () => (await import("./fakeRedis")).fakeRedisModule);
const { GET, POST } = await import("../api/messages");
const { gmToken } = await import("../api/_gmToken");

const message = (id: string, visibility: string, createdAt = 1) => ({ id, kind: "text", author: "Ada", body: "ciao", visibility, createdAt });
const post = (body: unknown) => POST(new Request("http://test/api/messages", { method: "POST", body: JSON.stringify(body) }));
const read = async (token?: string) => (await (await GET(new Request("http://test/api/messages?room=r1", { headers: token ? { "x-gm-token": token } : {} }))).json()).messages as Array<{ id: string }>;

beforeEach(() => { store.clear(); vi.stubEnv("PHONE_GM_PASSWORD", "segreta"); });

it("i messaggi Solo GM si leggono solo con il token GM giusto", async () => {
  await post({ room: "r1", message: message("pub", "everyone", 2) });
  await post({ room: "r1", message: message("gm", "gm", 1) });
  expect((await read()).map((item) => item.id)).toEqual(["pub"]);
  expect((await read("token-falso")).map((item) => item.id)).toEqual(["pub"]);
  expect((await read(await gmToken("altra", "segreta"))).map((item) => item.id)).toEqual(["pub"]);
  expect((await read(await gmToken("r1", "sbagliata"))).map((item) => item.id)).toEqual(["pub"]);
  expect((await read(await gmToken("r1", "segreta"))).map((item) => item.id)).toEqual(["gm", "pub"]);
});

it("senza PHONE_GM_PASSWORD nessun token vale", async () => {
  await post({ room: "r1", message: message("gm", "gm") });
  const token = await gmToken("r1", "segreta");
  vi.stubEnv("PHONE_GM_PASSWORD", "");
  expect(await read(token)).toEqual([]);
});

it("rifiuta i messaggi Solo io, malformati o troppo grandi, e tiene gli ultimi 200", async () => {
  expect((await post({ room: "r1", message: message("self", "self") })).status).toBe(400);
  expect((await post({ room: "r 1", message: message("a", "everyone") })).status).toBe(400);
  expect((await post({ room: "r1", message: { id: "a" } })).status).toBe(400);
  expect((await post({ room: "r1", message: { ...message("big", "everyone"), body: "x".repeat(50_001) } })).status).toBe(413);
  for (let index = 0; index < 205; index++) await post({ room: "r1", message: message(`m${index}`, "everyone", index) });
  const all = await read();
  expect(all).toHaveLength(200);
  expect(all[0].id).toBe("m5");
});
