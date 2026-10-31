// Solo per i test: Redis in memoria con i comandi usati da api/sheets.ts.
// Lo script Lua è emulato, quindi i test provano l'handler e il client, non il Lua.
export const store = new Map<string, Map<string, string>>();
const hash = (key: string) => store.get(key) ?? store.set(key, new Map()).get(key)!;

export const fakeRedisModule = {
  Redis: { fromEnv: () => ({
    hvals: async (key: string) => [...hash(key).values()].map((value) => JSON.parse(value)),
    hlen: async (key: string) => hash(key).size,
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
  const api = await import("../api/sheets");
  const method = (init?.method ?? "GET") as "GET" | "PUT" | "DELETE";
  return api[method](new Request(`http://test${input}`, init));
}
