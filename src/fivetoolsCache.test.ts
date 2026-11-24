import { afterEach, beforeEach, expect, it, vi } from "vitest";

const DAY = 24 * 60 * 60 * 1000;
let saved: Map<string, Response>;
const fetchMock = vi.fn(async () => Response.json({ XMM: "bestiary-xmm.json" }));
// Un modulo nuovo per ogni apertura della pagina.
const open = async () => { vi.resetModules(); return (await import("./fivetoolsApi")).listBestiarySources(); };
const sources = [{ id: "XMM", file: "bestiary-xmm.json", label: "XMM" }];

beforeEach(() => {
  saved = new Map();
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("caches", { open: async () => ({ match: async (url: string) => saved.get(url)?.clone(), put: async (url: string, response: Response) => { saved.set(url, response); } }) });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it("alla seconda apertura i file 5e.tools vengono dalla cache, alla scadenza si riscaricano", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  expect(await open()).toEqual(sources);
  await vi.waitFor(() => expect(saved.size).toBe(1));
  vi.setSystemTime(Date.now() + 6 * DAY);
  expect(await open()).toEqual(sources);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  vi.setSystemTime(Date.now() + 2 * DAY);
  expect(await open()).toEqual(sources);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it.each([
  ["assente", undefined],
  ["bloccata", { open: async () => { throw new DOMException("no", "SecurityError"); } }],
  ["piena", { open: async () => ({ match: async () => undefined, put: async (): Promise<void> => { throw new DOMException("no", "QuotaExceededError"); } }) }],
  ["rovinata", { open: async () => ({ match: async () => new Response("{", { headers: { "x-saved-at": String(Date.now()) } }), put: async (): Promise<void> => undefined }) }],
])("cache %s: si scarica come senza cache", async (_name, broken) => {
  vi.stubGlobal("caches", broken);
  expect(await open()).toEqual(sources);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("una risposta di errore non si salva", async () => {
  fetchMock.mockResolvedValueOnce(new Response("", { status: 500 }));
  await expect(open()).rejects.toThrow("500");
  expect(saved.size).toBe(0);
});
