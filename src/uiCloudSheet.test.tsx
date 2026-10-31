// @vitest-environment jsdom
// @ts-expect-error Node types are intentionally absent from the browser build.
import { webcrypto } from "node:crypto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { STORAGE_CHARACTERS, STORAGE_MONSTERS } from "./constants";
import { apiFetch, store } from "./fakeRedis";
import { importRoll20 } from "./importer";
import { DEFAULT_RULESET } from "./rulesets";

vi.mock("@upstash/redis", async () => (await import("./fakeRedis")).fakeRedisModule);
vi.mock("./privateMessages", () => ({ publishGmMessageKey: async () => undefined }));
vi.mock("./fivetoolsApi", () => ({ listBestiarySources: async () => [], listAdventures: async () => [] }));
const viewer = vi.hoisted(() => ({ name: "GM", role: "GM" as "GM" | "PLAYER" }));
const noop = () => undefined;
const unsubscribe = () => noop;
vi.mock("./obr", () => ({
  OBR: { isAvailable: true, isReady: true, onReady: (callback: () => void) => callback(), room: { id: "r1", getPermissions: async () => [], onPermissionsChange: unsubscribe }, party: { onChange: unsubscribe }, scene: { isReady: async () => false, onReadyChange: unsubscribe, items: { onChange: unsubscribe } }, notification: { show: async () => undefined } },
  DEFAULT_PERMISSIONS: { playersEditInventory: true, playersImportContent: false, playersManageTurns: false },
  getPlayerInfo: async () => ({ id: viewer.name, ...viewer }),
  getTurnState: async () => ({ round: 1, activeIndex: 0, entries: [] }),
  getSharedInventory: async () => [], getPermissions: async () => ({ playersEditInventory: true, playersImportContent: false, playersManageTurns: false }),
  getPartyCharacters: async () => [], getSharedNotes: async () => [], getPartyMembers: async () => [{ id: "marco", name: "Marco", role: "PLAYER" }], getTokenImages: async () => ({}),
  onTurnStateChange: unsubscribe, onBroadcastMessage: unsubscribe, onSharedInventoryChange: unsubscribe, onPermissionsChange: unsubscribe,
  onPartyCharactersChange: unsubscribe, onSharedNotesChange: unsubscribe, onSheetsChanged: unsubscribe, notifySheetsChanged: noop,
  getCharacterTokens: async () => [], highlightToken: async () => undefined, setTokenCharacter: async () => undefined, setTokenOwner: async () => undefined,
  setActiveCharacter: async () => undefined, publishPartyCharacters: async () => undefined, broadcastMessage: async () => undefined,
}));

const { default: App } = await import("./App");
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: webcrypto });
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
  vi.stubGlobal("fetch", apiFetch);
  viewer.name = "GM"; viewer.role = "GM";
  store.clear(); localStorage.clear(); host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

const settle = (ms = 50) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));
const click = async (label: string) => {
  const button = [...host.querySelectorAll("button")].find((item) => item.textContent?.includes(label));
  expect(button, `Pulsante ${label}`).toBeTruthy();
  await act(async () => button!.click());
};
const cloudSheet = () => JSON.parse(store.get("te:room:r1:sheets")?.values().next().value ?? "null");

it("carica nel cloud le schede locali e vi salva il riposo lungo", async () => {
  const sheet = importRoll20({ character: { name: "Eroe" }, normalized: { identity: { character_name: "Eroe" }, combat: { hp: { current: 2, max: 12 }, hit_dice: { current: 0, max: 2, die: "d8" } } } });
  localStorage.setItem(STORAGE_CHARACTERS, JSON.stringify([sheet]));
  await act(async () => root.render(<App/>));
  await settle();
  expect(cloudSheet()).toMatchObject({ kind: "pc", rev: 1, acl: { view: [], edit: [] }, sheet: { name: "Eroe" } });
  expect(JSON.parse(localStorage.getItem(STORAGE_CHARACTERS) || "[]")).toEqual([]);

  await click("Riposo lungo");
  await click("Completa riposo");
  await settle(1_700);
  expect(cloudSheet().sheet.combat.hp.current).toBe(12);
  expect(cloudSheet().sheet.combat.hitDice.current).toBe(2);
  expect(cloudSheet().rev).toBe(2);
});

it("il GM assegna la vista dalla Libreria e il giocatore vede solo quella scheda", async () => {
  for (const name of ["Ada", "Berto"]) {
    const sheet = importRoll20({ character: { name }, normalized: { identity: { character_name: name } } });
    await apiFetch("/api/sheets", { method: "PUT", body: JSON.stringify({ room: "r1", rev: 0, entry: { kind: "pc", sheet, acl: { view: [], edit: [] }, updatedBy: "GM" } }) });
  }
  await act(async () => root.render(<App/>));
  await settle();
  await click("Libreria");
  const picker = host.querySelector<HTMLSelectElement>('select[aria-label="Può vedere: aggiungi giocatore"]')!;
  expect([...picker.options].map((option) => option.textContent)).toContain("Marco");
  await act(async () => { picker.value = "Marco"; picker.dispatchEvent(new Event("change", { bubbles: true })); });
  await settle(1_700);
  const entries = [...store.get("te:room:r1:sheets")!.values()].map((value) => JSON.parse(value));
  expect(entries.filter((entry) => entry.acl.view.includes("Marco"))).toHaveLength(1);
  const visibleName = entries.find((entry) => entry.acl.view.includes("Marco")).sheet.name;

  await act(async () => root.unmount());
  localStorage.clear(); viewer.name = "Marco"; viewer.role = "PLAYER";
  root = createRoot(host);
  await act(async () => root.render(<App/>));
  await settle();
  await click("Libreria");
  expect(host.querySelectorAll(".library-entry")).toHaveLength(1);
  expect(host.textContent).toContain(`${visibleName}`);
  expect(host.textContent).toContain("sola lettura");
  expect(host.textContent).not.toContain("Importa Roll20");
  expect(host.querySelector('select[aria-label="Può vedere: aggiungi giocatore"]')).toBeNull();
});

it("il GM crea un NPC dal bestiario e un giocatore con permesso ne vede lo statblock", async () => {
  const wolf = { schemaVersion: 1, id: "wolf", name: "Lupo", source: "XMM", creatureType: "Bestia", challengeRating: "1/4", ruleset: { id: DEFAULT_RULESET.id, version: DEFAULT_RULESET.version }, size: "M", alignment: "N", ac: 13, hp: { average: 11, formula: "2d8+2" }, speed: "40 ft.", abilities: { dex: 15 }, saves: {}, skills: {}, passivePerception: 13, traits: [], actions: [{ id: "bite", name: "Morso", description: "" }], reactions: [], legendaryActions: [], importWarnings: [] };
  localStorage.setItem(STORAGE_MONSTERS, JSON.stringify([wolf]));
  vi.stubGlobal("prompt", () => "Lupo Grigio");
  await act(async () => root.render(<App/>));
  await settle();
  await click("Bestiario");
  await click("Lupo");
  await click("Aggiungi agli NPC");
  await settle();
  const npc = [...store.get("te:room:r1:sheets")!.values()].map((value) => JSON.parse(value))[0];
  expect(npc).toMatchObject({ kind: "npc", rev: 1, acl: { view: [], edit: [] }, sheet: { name: "Lupo Grigio", ac: 13 } });
  expect(npc.sheet.id).not.toBe("wolf");
  await apiFetch("/api/sheets", { method: "PUT", body: JSON.stringify({ room: "r1", rev: 1, entry: { ...npc, acl: { view: ["Marco"], edit: [] } } }) });

  await act(async () => root.unmount());
  localStorage.clear(); viewer.name = "Marco"; viewer.role = "PLAYER";
  root = createRoot(host);
  await act(async () => root.render(<App/>));
  await settle();
  await click("Libreria");
  await click("NPC");
  await click("Lupo Grigio");
  expect(host.textContent).toContain("PF medi");
  expect(host.textContent).toContain("Morso");
  expect(host.textContent).not.toContain("Aggiungi agli NPC");
});
