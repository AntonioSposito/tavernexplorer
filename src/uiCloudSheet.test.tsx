// @vitest-environment jsdom
// @ts-expect-error Node types are intentionally absent from the browser build.
import { webcrypto } from "node:crypto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { STORAGE_CHARACTERS } from "./constants";
import { apiFetch, store } from "./fakeRedis";
import { importRoll20 } from "./importer";

vi.mock("@upstash/redis", async () => (await import("./fakeRedis")).fakeRedisModule);
vi.mock("./privateMessages", () => ({ publishGmMessageKey: async () => undefined }));
const noop = () => undefined;
const unsubscribe = () => noop;
vi.mock("./obr", () => ({
  OBR: { isAvailable: true, isReady: true, onReady: (callback: () => void) => callback(), room: { id: "r1" }, party: { onChange: unsubscribe }, notification: { show: async () => undefined } },
  DEFAULT_PERMISSIONS: { playersEditInventory: true, playersImportContent: false, playersManageTurns: false },
  getPlayerInfo: async () => ({ id: "gm", name: "GM", role: "GM" }),
  getTurnState: async () => ({ round: 1, activeIndex: 0, entries: [] }),
  getSharedInventory: async () => [], getPermissions: async () => ({ playersEditInventory: true, playersImportContent: false, playersManageTurns: false }),
  getPartyCharacters: async () => [], getSharedNotes: async () => [], getPartyMembers: async () => [], getTokenImages: async () => ({}),
  onTurnStateChange: unsubscribe, onBroadcastMessage: unsubscribe, onSharedInventoryChange: unsubscribe, onPermissionsChange: unsubscribe,
  onPartyCharactersChange: unsubscribe, onSharedNotesChange: unsubscribe, onSheetsChanged: unsubscribe, notifySheetsChanged: noop,
  setActiveCharacter: async () => undefined, publishPartyCharacters: async () => undefined, broadcastMessage: async () => undefined,
}));

const { default: App } = await import("./App");
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: webcrypto });
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
  vi.stubGlobal("fetch", apiFetch);
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
