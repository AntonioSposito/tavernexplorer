// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { apiFetch, store } from "./fakeRedis";
import { PhoneApp } from "./PhoneAccess";
import { STORAGE_PHONE_SESSION } from "./constants";
import { createBlankSheet } from "./blankSheet";

vi.mock("@upstash/redis", async () => (await import("./fakeRedis")).fakeRedisModule);
vi.mock("./obr", () => ({
  OBR: { isAvailable: false, isReady: false },
  DEFAULT_PERMISSIONS: { playersEditInventory: true, playersImportContent: false, playersManageTurns: false },
  broadcastMessage: async () => undefined,
  getTokenImages: async () => ({}),
}));

const { POST } = await import("../api/join");
const join = (password: string, ip = "1.1.1.1") => POST(new Request("http://test/api/join", { method: "POST", headers: { "x-forwarded-for": ip }, body: JSON.stringify({ password }) }));
const route = (input: string, init?: RequestInit) => input === "/api/join" ? POST(new Request("http://test/api/join", init)) : apiFetch(input, init);
const putSheet = (name: string, edit: string[]) => apiFetch("/api/sheets", { method: "PUT", body: JSON.stringify({ room: "r1", rev: 0, entry: { kind: "pc", sheet: { ...createBlankSheet(name), id: name }, acl: { view: [], edit }, updatedBy: "GM" } }) });

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  store.clear(); localStorage.clear();
  vi.stubEnv("PHONE_ROOM", "r1"); vi.stubEnv("PHONE_PASSWORD", "taverna");
  vi.stubGlobal("fetch", route);
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

const type = async (selector: string, value: string) => {
  const input = host.querySelector<HTMLInputElement | HTMLSelectElement>(selector)!;
  const prototype = input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
};
const submit = () => act(async () => { host.querySelector("form")!.requestSubmit(); });

it("dà la stanza solo con la password giusta", async () => {
  expect((await join("sbagliata")).status).toBe(401);
  const right = await join("taverna");
  expect(right.status).toBe(200);
  expect(await right.json()).toEqual({ room: "r1" });
});

it("non rivela la stanza se l'accesso non è configurato", async () => {
  vi.stubEnv("PHONE_PASSWORD", "");
  expect((await join("")).status).toBe(503);
});

it("blocca i tentativi ripetuti dallo stesso indirizzo, non gli altri", async () => {
  for (let attempt = 0; attempt < 10; attempt++) expect((await join("no")).status).toBe(401);
  expect((await join("taverna")).status).toBe(429);
  expect((await join("taverna", "2.2.2.2")).status).toBe(200);
});

it("dopo password e nome mostra solo le schede del giocatore, senza tab Owlbear, e ricorda l'accesso", async () => {
  await putSheet("Aria", ["Marco"]);
  await putSheet("Borin", ["Luca"]);
  await putSheet("Segreto", []);
  await act(async () => root.render(<PhoneApp/>));
  await type('input[type="password"]', "taverna");
  await submit();
  expect([...host.querySelectorAll("option")].map((option) => option.textContent)).toEqual(["Marco", "Luca"]);
  await type("select", "Marco");
  await submit();
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  const options = [...host.querySelectorAll("header select option")].map((option) => option.textContent);
  expect(options).toEqual(["Nessuna scheda", "Aria"]);
  expect(host.querySelector('[aria-label="Turni"]')).toBeNull();
  expect(host.querySelector('[aria-label="Inventario comune"]')).toBeNull();
  expect(host.querySelector('[aria-label="Bestiario"]')).toBeNull();
  expect(JSON.parse(localStorage.getItem(STORAGE_PHONE_SESSION)!)).toEqual({ room: "r1", name: "Marco" });
});

it("Cambia giocatore riporta al login", async () => {
  localStorage.setItem(STORAGE_PHONE_SESSION, JSON.stringify({ room: "r1", name: "Marco" }));
  await act(async () => root.render(<PhoneApp/>));
  const exit = [...host.querySelectorAll("button")].find((button) => button.textContent?.includes("Cambia giocatore"))!;
  await act(async () => exit.click());
  expect(host.querySelector('input[type="password"]')).toBeTruthy();
  expect(JSON.parse(localStorage.getItem(STORAGE_PHONE_SESSION)!)).toBeNull();
});

it("sposta la barra delle tab in alto e di lato, e ricorda la scelta", async () => {
  localStorage.setItem(STORAGE_PHONE_SESSION, JSON.stringify({ room: "r1", name: "Marco" }));
  await act(async () => root.render(<PhoneApp/>));
  const toggle = (label: string) => act(async () => [...host.querySelectorAll("button")].find((button) => button.textContent === label)!.click());
  expect(host.querySelector(".app-body.tabs-top")).toBeNull();
  await toggle("Barra in alto");
  expect(host.querySelector(".app-body.tabs-top")).toBeTruthy();
  await act(async () => root.unmount());
  root = createRoot(host);
  await act(async () => root.render(<PhoneApp/>));
  expect(host.querySelector(".app-body.tabs-top")).toBeTruthy();
  await toggle("Barra di lato");
  expect(host.querySelector(".app-body.tabs-top")).toBeNull();
});
