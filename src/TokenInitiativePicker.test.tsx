// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { STORAGE_CLOUD_CACHE, STORAGE_MESSAGES, STORAGE_MONSTERS } from "./constants";
import { importRoll20 } from "./importer";
import type { TurnState } from "./types";

const mock = vi.hoisted(() => ({ setTurnState: vi.fn(), setTokenCharacter: vi.fn(), close: vi.fn(), broadcast: vi.fn() }));
vi.mock("@owlbear-rodeo/sdk", () => ({ default: { player: { getId: async () => "gm-id", getName: async () => "Master" } } }));
vi.mock("./obr", () => ({
  OBR: { onReady: (callback: () => void) => callback(), room: { id: "r1" }, popover: { close: mock.close },
    scene: { items: { getItems: async () => [{ id: "t1", name: "Eroe" }, { id: "t2", name: "Lupo" }, { id: "t3", name: "Mostro" }] } } },
  getPartyMembers: async () => [{ id: "marco", name: "Marco", role: "PLAYER" }],
  getTurnState: async (): Promise<TurnState> => ({ round: 1, activeIndex: 0, entries: [] }),
  setTurnState: mock.setTurnState, setTokenCharacter: mock.setTokenCharacter,
  broadcastMessage: mock.broadcast, showRollOnMap: async () => undefined,
}));

it("collega il token al PG o al mostro scelto e tira l'iniziativa; senza scheda usa il valore scritto", async () => {
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
  window.history.replaceState(null, "", "/?initiative=t1,t2,t3");
  localStorage.setItem(STORAGE_MONSTERS, JSON.stringify([{ id: "goblin", name: "Goblin", challengeRating: "1/4", abilities: { dex: 14 } }]));
  const sheet = importRoll20({ character: { name: "Eroe" }, normalized: { identity: { character_name: "Eroe" }, combat: { initiative: 2 } } });
  localStorage.setItem(`${STORAGE_CLOUD_CACHE}/r1`, JSON.stringify([{ kind: "pc", sheet, acl: { view: [], edit: ["Marco"] } }]));
  const { TokenInitiativePicker } = await import("./TokenInitiativePicker");
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  await act(async () => root.render(<TokenInitiativePicker/>));
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

  const choose = (token: string, id: string) => act(async () => { const select = host.querySelector<HTMLSelectElement>(`select[aria-label="Scheda per ${token}"]`)!; select.value = id; select.dispatchEvent(new Event("change", { bubbles: true })); });
  await choose("Eroe", sheet.id);
  await choose("Mostro", "goblin");
  expect(host.querySelector('input[aria-label="Iniziativa per Eroe"]')).toBeNull();
  expect(host.querySelector('optgroup[label="Bestiario"]')?.textContent).toBe("Goblin · GS 1/4");
  const value = host.querySelector<HTMLInputElement>('input[aria-label="Iniziativa per Lupo"]')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(value, "14"); value.dispatchEvent(new Event("input", { bubbles: true })); });
  await act(async () => host.querySelector<HTMLButtonElement>('button[type="submit"]')!.click());

  expect(mock.setTokenCharacter).toHaveBeenCalledWith("t1", sheet.id, "marco");
  expect(mock.setTokenCharacter).toHaveBeenCalledWith("t3", "goblin");
  const turns: TurnState = mock.setTurnState.mock.calls[0][0];
  // Il turn order è ordinato per iniziativa, che qui è tirata a caso.
  expect(turns.entries).toHaveLength(3);
  expect(turns.entries).toEqual(expect.arrayContaining([expect.objectContaining({ tokenId: "t1", characterId: sheet.id, name: "Eroe" }), expect.objectContaining({ tokenId: "t2", name: "Lupo", initiative: 14 }), expect.objectContaining({ tokenId: "t3", characterId: "goblin", name: "Goblin", initiativeBonus: 2 })]));
  expect(mock.broadcast).toHaveBeenCalledWith(expect.objectContaining({ title: "Iniziativa", author: "Eroe", visibility: "everyone" }), "ALL");
  // Il tiro del mostro va solo al GM.
  expect(mock.broadcast).toHaveBeenCalledWith(expect.objectContaining({ title: "Iniziativa", author: "Goblin", visibility: "gm" }), "ALL");
  expect(JSON.parse(localStorage.getItem(STORAGE_MESSAGES)!)).toHaveLength(2);
  expect(mock.close).toHaveBeenCalled();
  await act(async () => root.unmount());
});
