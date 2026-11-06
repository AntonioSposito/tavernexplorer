// Solo per i test: Redis in memoria con i comandi usati da api/sheets.ts.
// Lo script Lua è emulato, quindi i test provano l'handler e il client, non il Lua.
export const store = new Map<string, Map<string, string>>();
const hash = (key: string) => store.get(key) ?? store.set(key, new Map()).get(key)!;

export const fakeRedisModule = {
  Redis: { fromEnv: () => ({
    hvals: async (key: string) => [...hash(key).values()].map((value) => JSON.parse(value)),
    incr: async (key: string) => { const next = Number(hash(key).get("count") ?? 0) + 1; hash(key).set("count", String(next)); return next; },
    expire: async () => 1,
    rpush: async (key: string, value: string) => { const list = hash(key); list.set(String(list.size), value); return list.size; },
    ltrim: async (key: string, start: number) => { const list = hash(key); const values = [...list.values()].slice(start); list.clear(); values.forEach((value, index) => list.set(String(index), value)); return "OK"; },
    lrange: async (key: string) => [...hash(key).values()].map((value) => JSON.parse(value)),
    del: async (key: string) => Number(store.delete(key)),
    hlen: async (key: string) => hash(key).size,
    hset: async (key: string, fields: Record<string, unknown>) => { for (const [field, value] of Object.entries(fields)) hash(key).set(field, JSON.stringify(value)); return 1; },
    hgetall: async (key: string) => hash(key).size ? Object.fromEntries([...hash(key)].map(([field, value]) => [field, JSON.parse(value)])) : null,
    hget: async (key: string, field: string) => { const value = hash(key).get(field); return value ? JSON.parse(value) : null; },
    eval: async (_script: string, [key]: string[], [field, rev, value]: [string, number, string]) => {
      const current = hash(key).get(field);
      if ((current ? JSON.parse(current).rev ?? 0 : 0) !== rev) return current ? JSON.parse(current) : null;
      hash(key).set(field, value);
      return "ok";
    },
  }) },
};

// fetch che passa direttamente agli handler dell'API, senza rete.
export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  if (input.startsWith("/api/messages")) {
    const messages = await import("../api/messages");
    return messages[(init?.method ?? "GET") as "GET" | "POST"](new Request(`http://test${input}`, init));
  }
  if (input.startsWith("/api/room-state")) {
    const state = await import("../api/room-state");
    return state[(init?.method ?? "GET") as "GET" | "PUT"](new Request(`http://test${input}`, init));
  }
  if (input.startsWith("/api/bestiary")) {
    const bestiary = await import("../api/bestiary");
    return bestiary[(init?.method ?? "GET") as "GET" | "PUT" | "DELETE"](new Request(`http://test${input}`, init));
  }
  const api = await import("../api/sheets");
  const method = (init?.method ?? "GET") as "GET" | "PUT" | "DELETE";
  return api[method](new Request(`http://test${input}`, init));
}
