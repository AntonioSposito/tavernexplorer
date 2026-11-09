// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, it, vi } from "vitest";
import { TOKEN_META_KEY, TURN_META_KEY } from "./constants";
import { storage } from "./storage";

const mock = vi.hoisted(() => ({ deselect: vi.fn(async () => undefined), openSheet: vi.fn(async () => undefined), toggle: vi.fn(async () => undefined), openActions: vi.fn(async () => undefined), hp: null as { total: number; max: number; cap: number } | null, setHp: vi.fn(async () => undefined), linked: false, monster: [] as string[], selection: ["t1"], turnIds: [] as string[] }));
vi.mock("@owlbear-rodeo/sdk", () => ({ default: {
  onReady: (callback: () => void) => callback(),
  theme: { getTheme: async () => ({ mode: "DARK", text: { primary: "#fff", secondary: "#aaa", disabled: "#888" } }) },
  room: { id: "room1", getMetadata: async () => ({ [TURN_META_KEY]: { round: 1, activeIndex: 0, entries: mock.turnIds.map((tokenId) => ({ tokenId })) } }) },
  player: { getSelection: async () => mock.selection, deselect: mock.deselect, getName: async () => "Anna", getRole: async () => "GM" },
  scene: { items: { getItems: async (ids: string[]) => ids.map((id) => ({ id, name: id, metadata: mock.linked ? { [TOKEN_META_KEY]: { characterId: "pc1" } } : {} })) } },
} }));
vi.mock("./tokenMenuActions", () => ({ monsterTokenSections: () => mock.monster, openTokenSheet: mock.openSheet, toggleTokenInitiative: mock.toggle, openTokenActions: mock.openActions, TOKEN_SHEET_SECTIONS: { details: "Dettagli veloci", actions: "Azioni", spells: "Magia", resources: "Risorse", abilities: "Prove e tiri salvezza", skills: "Abilità" }, getTokenHitPoints: async () => mock.hp, requestTokenHitPoints: mock.setHp }));

import { parseHitPoints, TokenHpMenu, TokenMenu } from "./TokenMenu";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => { mock.monster = []; localStorage.clear(); storage.cloudCache.set("room1", [{ kind: "pc", sheet: { id: "pc1" } } as never]); mock.hp = null; mock.setHp.mockClear(); mock.linked = false; mock.openActions.mockClear(); mock.toggle.mockClear(); mock.openSheet.mockClear(); mock.deselect.mockClear(); });

async function renderMenu() {
  document.body.innerHTML = "<div id='root'></div>";
  await act(async () => { createRoot(document.getElementById("root")!).render(<TokenMenu />); });
  const buttons = [...document.querySelectorAll("button")];
  const [sheet] = buttons; const turns = buttons.at(-1)!;
  const named = (text: string) => buttons.find((button) => button.textContent === text);
  return { sheet, turns, labels: buttons.map((button) => button.textContent), details: named("Dettagli veloci"), actions: named("Azioni")!, spells: named("Magia")!, resources: named("Risorse"), abilities: named("Prove e tiri salvezza")!, skills: named("Abilità")! };
}

it("chiude il menu e apre la scheda del token selezionato", async () => {
  mock.selection = ["t1"]; mock.turnIds = [];
  const { sheet, turns } = await renderMenu();
  expect(sheet.textContent).toBe("Apri scheda");
  expect(turns.textContent).toBe("Tira iniziativa");
  await act(async () => { sheet.click(); });
  expect(mock.openSheet).toHaveBeenCalledWith(expect.objectContaining({ id: "t1" }));
  expect(mock.deselect).toHaveBeenCalled();
});

it("con tutti i token già nei turni la voce li toglie", async () => {
  mock.selection = ["t1", "t2"]; mock.turnIds = ["t1", "t2"];
  const { sheet, turns } = await renderMenu();
  expect(sheet.disabled).toBe(true);
  expect(turns.textContent).toBe("Esci dal combattimento");
  await act(async () => { turns.click(); });
  expect(mock.toggle).toHaveBeenCalledWith([expect.objectContaining({ id: "t1" }), expect.objectContaining({ id: "t2" })]);
});

it("con una selezione mista la voce aggiunge i mancanti", async () => {
  mock.selection = ["t1", "t2"]; mock.turnIds = ["t1"];
  const { turns } = await renderMenu();
  expect(turns.textContent).toBe("Tira iniziativa");
});

it("apre le azioni solo per un token collegato a una scheda", async () => {
  mock.selection = ["t1"]; mock.turnIds = [];
  expect((await renderMenu()).actions.disabled).toBe(true);
  mock.linked = true;
  const { actions } = await renderMenu();
  expect(actions.textContent).toBe("Azioni");
  await act(async () => { actions.click(); });
  expect(mock.openActions).toHaveBeenCalledWith(expect.objectContaining({ id: "t1" }), "actions");
  expect(mock.deselect).toHaveBeenCalled();
});

it("per un PG: magia, risorse, prove e tiri salvezza in una voce, abilità; niente Dettagli veloci", async () => {
  mock.selection = ["t1"]; mock.turnIds = []; mock.linked = true;
  const { labels, skills } = await renderMenu();
  expect(labels).toEqual(["Apri scheda", "Azioni", "Magia", "Risorse", "Prove e tiri salvezza", "Abilità", "Tira iniziativa"]);
  await act(async () => { skills.click(); });
  expect(mock.openActions).toHaveBeenCalledWith(expect.objectContaining({ id: "t1" }), "skills");
});

it("per un mostro modificabile apre le voci che ha (Magia solo se incantatore); una scheda non della stanza non apre niente", async () => {
  mock.selection = ["t1"]; mock.turnIds = []; mock.linked = true;
  storage.cloudCache.set("room1", []);
  let menu = await renderMenu();
  expect([menu.actions, menu.spells, menu.skills].every((button) => button.disabled)).toBe(true);
  mock.monster = ["details", "actions", "abilities", "skills"];
  menu = await renderMenu();
  // Mostro: "Dettagli veloci" dopo "Apri scheda", niente Risorse.
  expect(menu.labels).toEqual(["Apri scheda", "Dettagli veloci", "Azioni", "Magia", "Prove e tiri salvezza", "Abilità", "Tira iniziativa"]);
  expect([menu.details!, menu.actions, menu.abilities, menu.skills].map((button) => button.disabled)).toEqual([false, false, false, false]);
  expect(menu.spells.disabled).toBe(true);
  await act(async () => { menu.details!.click(); });
  expect(mock.openActions).toHaveBeenCalledWith(expect.objectContaining({ id: "t1" }), "details");
});

it("legge i PF come totale oppure come danno e cura", () => {
  expect(parseHitPoints("12", 30)).toBe(12);
  expect(parseHitPoints("-7", 30)).toBe(23);
  expect(parseHitPoints("+5", 30)).toBe(35);
  expect(parseHitPoints("-50", 30)).toBe(0);
  expect(parseHitPoints("abc", 30)).toBeNull();
});

async function renderHp() {
  document.body.innerHTML = "<div id='root'></div>";
  await act(async () => { createRoot(document.getElementById("root")!).render(<TokenHpMenu />); });
}

it("cambia i PF dalla voce del menu senza chiuderlo", async () => {
  mock.selection = ["t1"]; mock.turnIds = []; mock.hp = { total: 15, max: 20, cap: 20 };
  await renderHp();
  const input = document.querySelector<HTMLInputElement>('input[aria-label="Punti ferita"]')!;
  expect(input.value).toBe("15");
  expect(document.querySelector(".token-menu-hp small")?.textContent).toBe("/ 20");
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => { setValue.call(input, "+9"); input.dispatchEvent(new Event("input", { bubbles: true })); });
  await act(async () => { input.focus(); input.blur(); });
  expect(mock.setHp).toHaveBeenCalledWith("t1", 24);
  expect(input.value).toBe("20");
  expect(mock.deselect).not.toHaveBeenCalled();
});

it("senza PF modificabili il campo è disattivato", async () => {
  mock.selection = ["t1"]; mock.turnIds = [];
  await renderHp();
  expect(document.querySelector<HTMLInputElement>('input[aria-label="Punti ferita"]')!.disabled).toBe(true);
});
