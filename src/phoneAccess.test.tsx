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

it("dopo password e nome mostra solo le schede del giocatore, senza tab GM, e ricorda l'accesso", async () => {
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
  expect(host.querySelector('[aria-label="Turni"]')).toBeTruthy();
  expect(host.querySelector('[aria-label="Inventario comune"]')).toBeTruthy();
  expect(host.querySelector('[aria-label="Bestiario"]')).toBeTruthy();
  expect(JSON.parse(localStorage.getItem(STORAGE_PHONE_SESSION)!)).toEqual({ room: "r1", name: "Marco" });
});

const chatMessage = (id: string, visibility: string, body: string) => apiFetch("/api/messages", { method: "POST", body: JSON.stringify({ room: "r1", message: { id, kind: "text", author: "Ada", authorId: "ada", body, visibility, createdAt: 1 } }) });
const openChat = async () => {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Messaggi"]')!.click());
  return [...host.querySelectorAll(".message")].map((message) => message.textContent);
};

it("con la password GM entra come GM senza scegliere il nome e legge i messaggi Solo GM dal cloud", async () => {
  vi.stubEnv("PHONE_GM_PASSWORD", "segreta");
  await chatMessage("pub", "everyone", "per tutti");
  await chatMessage("gm", "gm", "solo per te");
  await act(async () => root.render(<PhoneApp/>));
  await type('input[type="password"]', "segreta");
  await submit();
  const chat = await openChat();
  expect(chat).toEqual([expect.stringContaining("per tutti"), expect.stringContaining("solo per te")]);
  expect(host.querySelector('[aria-label="Bestiario"]')).toBeTruthy();
  expect(host.querySelector('[aria-label="Permessi"]')).toBeTruthy();
  expect(JSON.parse(localStorage.getItem(STORAGE_PHONE_SESSION)!)).toMatchObject({ room: "r1", name: "GM", gmToken: expect.stringMatching(/^[0-9a-f]{64}$/) });
});

it("un giocatore che si finge GM nella sessione locale non riceve i messaggi Solo GM", async () => {
  vi.stubEnv("PHONE_GM_PASSWORD", "segreta");
  await chatMessage("pub", "everyone", "per tutti");
  await chatMessage("gm", "gm", "solo per te");
  localStorage.setItem(STORAGE_PHONE_SESSION, JSON.stringify({ room: "r1", name: "GM", gmToken: "0".repeat(64) }));
  await act(async () => root.render(<PhoneApp/>));
  expect(await openChat()).toEqual([expect.stringContaining("per tutti")]);
});

it("il telefono riceve la chat e i suoi messaggi finiscono nel cloud, tranne Solo io", async () => {
  localStorage.setItem(STORAGE_PHONE_SESSION, JSON.stringify({ room: "r1", name: "Marco" }));
  await chatMessage("pub", "everyone", "dal tavolo");
  await act(async () => root.render(<PhoneApp/>));
  expect(await openChat()).toEqual([expect.stringContaining("dal tavolo")]);
  const send = async (body: string, visibility: string) => {
    await type('select[aria-label="Destinatari"]', visibility);
    const box = host.querySelector<HTMLTextAreaElement>('textarea[aria-label="Nuovo messaggio"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(box, body);
      box.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => [...host.querySelectorAll("button")].find((button) => button.textContent === "Invia")!.click());
  };
  await send("ciao a tutti", "everyone");
  await send("appunto mio", "self");
  const { messages } = await (await apiFetch("/api/messages?room=r1")).json() as { messages: Array<{ body: string }> };
  expect(messages.map((message) => message.body)).toEqual(["dal tavolo", "ciao a tutti"]);
  expect(host.querySelector(".ui-alert-danger")).toBeNull();
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

const tabs = () => [...host.querySelectorAll(".app-tabs button")].map((button) => button.getAttribute("aria-label"));
const openTab = (label: string) => act(async () => host.querySelector<HTMLButtonElement>(`.app-tabs button[aria-label="${label}"]`)!.click());
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
const roomState = async () => (await (await apiFetch("/api/room-state?room=r1")).json()).state;
const setRoomState = (key: string, value: unknown) => apiFetch("/api/room-state", { method: "PUT", body: JSON.stringify({ room: "r1", key, value }) });
const turnEntry = { id: "e1", name: "Goblin", initiative: 12 };

it("il giocatore vede turni e inventario comune dal cloud e, se autorizzato, avanza il turno", async () => {
  await setRoomState("turns", { round: 1, activeIndex: 0, entries: [turnEntry, { ...turnEntry, id: "e2", name: "Orco", initiative: 8 }] });
  await setRoomState("inventory", [{ id: "i1", name: "Corda", quantity: 1, description: "", updatedAt: 1 }]);
  await setRoomState("permissions", { playersEditInventory: true, playersImportContent: false, playersManageTurns: true });
  localStorage.setItem(STORAGE_PHONE_SESSION, JSON.stringify({ room: "r1", name: "Marco" }));
  await act(async () => root.render(<PhoneApp/>));
  await settle();
  expect(tabs()).toEqual(expect.arrayContaining(["Turni", "Inventario comune", "Bestiario"]));
  expect(tabs()).not.toContain("Permessi");
  await openTab("Inventario comune");
  expect(host.textContent).toContain("Corda");
  await openTab("Turni");
  expect(host.textContent).toContain("Goblin");
  expect(host.textContent).not.toContain("Collega scheda e token selezionato");
  await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Turno successivo"]')!.click());
  await settle();
  expect((await roomState()).turns.value.activeIndex).toBe(1);
});

it("senza permesso il giocatore non può avanzare il turno", async () => {
  await setRoomState("turns", { round: 1, activeIndex: 0, entries: [turnEntry] });
  localStorage.setItem(STORAGE_PHONE_SESSION, JSON.stringify({ room: "r1", name: "Marco" }));
  await act(async () => root.render(<PhoneApp/>));
  await settle();
  await openTab("Turni");
  expect(host.querySelector<HTMLButtonElement>('button[aria-label="Turno successivo"]')!.disabled).toBe(true);
});

it("il GM ha Bestiario e Permessi ma non Avventure, e il token non valido non legge il bestiario", async () => {
  vi.stubEnv("PHONE_GM_PASSWORD", "segreta");
  const { gmToken } = await import("../api/_gmToken");
  const token = await gmToken("r1", "segreta");
  await apiFetch("/api/bestiary", { method: "PUT", headers: { "x-gm-token": token }, body: JSON.stringify({ room: "r1", monsters: [{ id: "lupo", name: "Lupo Mannaro", challengeRating: "3", creatureType: "Bestia", source: "MM", ac: 12, hp: { average: 20, formula: "" }, abilities: {} }] }) });
  localStorage.setItem(STORAGE_PHONE_SESSION, JSON.stringify({ room: "r1", name: "GM", gmToken: token }));
  await act(async () => root.render(<PhoneApp/>));
  await settle();
  expect(tabs()).toEqual(expect.arrayContaining(["Turni", "Inventario comune", "Bestiario", "Permessi"]));
  expect(tabs()).not.toContain("Avventure");
  await openTab("Bestiario");
  await settle();
  expect(host.textContent).toContain("Lupo Mannaro");
  await openTab("Permessi");
  await act(async () => host.querySelector<HTMLInputElement>('.permission-row input[type="checkbox"]')!.click());
  await settle();
  expect((await roomState()).permissions.value.playersEditInventory).toBe(false);
});
