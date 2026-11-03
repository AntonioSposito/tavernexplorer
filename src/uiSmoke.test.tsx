// @vitest-environment jsdom
// @ts-expect-error Node types are intentionally absent from the browser build.
import { webcrypto } from "node:crypto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "./App";
import { STORAGE_MESSAGES, STORAGE_MESSAGES_SEEN, STORAGE_MONSTERS } from "./constants";
import { DEFAULT_RULESET } from "./rulesets";
import type { MonsterSheet } from "./types";

vi.mock("./obr", () => ({
  OBR: { isAvailable: false, isReady: false },
  DEFAULT_PERMISSIONS: { playersEditInventory: true, playersImportContent: false, playersManageTurns: false },
  broadcastMessage: async () => undefined,
  getTokenImages: async () => ({}),
}));
vi.mock("./fivetoolsApi", () => ({
  listBestiarySources: async () => [{ id: "XMM", label: "XMM", file: "bestiary-xmm.json" }],
  loadBestiarySource: async () => [
    { id: "wolf", name: "Lupo", source: "XMM", creatureType: "Bestia", challengeRating: "1/4" },
    { id: "dragon", name: "Drago", source: "XMM", creatureType: "Drago", challengeRating: "10" },
  ].map((row) => ({ ...row, schemaVersion: 1 as const, ruleset: { id: DEFAULT_RULESET.id, version: DEFAULT_RULESET.version }, size: "M", alignment: "N", ac: 12, hp: { average: 10, formula: "2d8" }, speed: "30 ft.", abilities: { dex: 12 }, saves: {}, skills: {}, passivePerception: 10, traits: [], actions: [], reactions: [], legendaryActions: [], importWarnings: [] })) as MonsterSheet[],
}));

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: webcrypto });
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
  localStorage.clear(); host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

const click = async (label: string) => {
  const buttons = [...host.querySelectorAll("button")];
  // Le tab principali sono solo icone: si cercano per aria-label.
  const button = buttons.find((item) => item.getAttribute("aria-label") === label) ?? buttons.find((item) => item.textContent?.includes(label));
  expect(button, `Pulsante ${label}`).toBeTruthy();
  await act(async () => button!.click());
};

it("importa un solo mostro dal picker", async () => {
  await act(async () => root.render(<App/>));
  await click("Bestiario");
  await click("Scegli mostri");
  expect(host.textContent).toContain("2 mostri disponibili");
  const checkbox = host.querySelector<HTMLInputElement>('.monster-import-list input[type="checkbox"]');
  expect(checkbox).toBeTruthy();
  await act(async () => checkbox!.click());
  await click("Importa 1 mostro");
  expect(JSON.parse(localStorage.getItem(STORAGE_MONSTERS) || "[]")).toHaveLength(1);
  expect([...host.querySelectorAll("button")].filter((button) => button.textContent?.includes("← Bestiario"))).toHaveLength(1);
  await click("Bestiario");
  expect(host.textContent).toContain("Lupo");
  expect(host.textContent).not.toContain("Drago");
});

it("conta i messaggi non letti sulla tab Messaggi e li azzera all'apertura", async () => {
  localStorage.setItem(STORAGE_MESSAGES_SEEN, "100");
  localStorage.setItem(STORAGE_MESSAGES, JSON.stringify([
    { id: "old", kind: "text", author: "GM", authorId: "gm", body: "vecchio", visibility: "everyone", createdAt: 50 },
    { id: "a", kind: "text", author: "GM", authorId: "gm", body: "nuovo", visibility: "everyone", createdAt: 150 },
    { id: "b", kind: "text", author: "GM", authorId: "gm", body: "nuovo 2", visibility: "everyone", createdAt: 160 },
    { id: "mine", kind: "roll", author: "Io", authorId: "preview", body: "Attacco", visibility: "everyone", createdAt: 170 },
  ]));
  await act(async () => root.render(<App/>));
  expect(host.querySelector('[aria-label="3 non letti"]')).toBeTruthy();
  // La tab Messaggi aperta in una finestra separata segna i messaggi come letti.
  localStorage.setItem(STORAGE_MESSAGES_SEEN, "160");
  await act(async () => window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_MESSAGES_SEEN })));
  expect(host.querySelector('[aria-label="1 non letti"]')).toBeTruthy();
  await click("Messaggi");
  await click("Note");
  expect(host.querySelector(".app-tabs .unread")).toBeNull();
  expect(localStorage.getItem(STORAGE_MESSAGES_SEEN)).toBe("170");
});
