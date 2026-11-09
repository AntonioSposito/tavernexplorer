// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, it, vi } from "vitest";
import { TOKEN_META_KEY, TURN_META_KEY } from "./constants";
import { storage } from "./storage";

const mock = vi.hoisted(() => ({ deselect: vi.fn(async () => undefined), openSheet: vi.fn(async () => undefined), toggle: vi.fn(async () => undefined), openActions: vi.fn(async () => undefined), hp: null as { total: number; max: number; cap: number } | null, setHp: vi.fn(async () => undefined), linked: false, selection: ["t1"], turnIds: [] as string[] }));
vi.mock("@owlbear-rodeo/sdk", () => ({ default: {
  onReady: (callback: () => void) => callback(),
  theme: { getTheme: async () => ({ mode: "DARK", text: { primary: "#fff", secondary: "#aaa", disabled: "#888" } }) },
  room: { id: "room1", getMetadata: async () => ({ [TURN_META_KEY]: { round: 1, activeIndex: 0, entries: mock.turnIds.map((tokenId) => ({ tokenId })) } }) },
  player: { getSelection: async () => mock.selection, deselect: mock.deselect },
  scene: { items: { getItems: async (ids: string[]) => ids.map((id) => ({ id, name: id, metadata: mock.linked ? { [TOKEN_META_KEY]: { characterId: "pc1" } } : {} })) } },
} }));
vi.mock("./tokenMenuActions", () => ({ openTokenSheet: mock.openSheet, toggleTokenInitiative: mock.toggle, openTokenActions: mock.openActions, TOKEN_SHEET_SECTIONS: { actions: "Azioni", spells: "Magia", resources: "Risorse", abilities: "Prove caratteristica", saves: "Tiri salvezza", skills: "Abilità" }, getTokenHitPoints: async () => mock.hp, requestTokenHitPoints: mock.setHp }));

import { parseHitPoints, TokenHpMenu, TokenMenu } from "./TokenMenu";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => { localStorage.clear(); storage.cloudCache.set("room1", [{ kind: "pc", sheet: { id: "pc1" } } as never]); mock.hp = null; mock.setHp.mockClear(); mock.linked = false; mock.openActions.mockClear(); mock.toggle.mockClear(); mock.openSheet.mockClear(); mock.deselect.mockClear(); });

async function renderMenu() {
  document.body.innerHTML = "<div id='root'></div>";
  await act(async () => { createRoot(document.getElementById("root")!).render(<TokenMenu />); });
  const [sheet, actions, spells, resources, abilities, saves, skills, turns] = document.querySelectorAll("button");
  return { sheet, actions, spells, resources, abilities, saves, skills, turns };
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

it("apre magia, risorse, prove caratteristica, tiri salvezza e abilità del token collegato", async () => {
  mock.selection = ["t1"]; mock.turnIds = []; mock.linked = true;
  const { spells, resources, abilities, saves, skills } = await renderMenu();
  expect([spells, resources, abilities, saves, skills].map((button) => button.textContent)).toEqual(["Magia", "Risorse", "Prove caratteristica", "Tiri salvezza", "Abilità"]);
  await act(async () => { skills.click(); });
  expect(mock.openActions).toHaveBeenCalledWith(expect.objectContaining({ id: "t1" }), "skills");
});

it("per un mostro del bestiario apre solo le azioni; una scheda non della stanza non apre niente", async () => {
  mock.selection = ["t1"]; mock.turnIds = []; mock.linked = true;
  storage.cloudCache.set("room1", []);
  let menu = await renderMenu();
  expect([menu.actions, menu.spells, menu.skills].every((button) => button.disabled)).toBe(true);
  storage.monsters.set([{ id: "pc1" } as never]);
  menu = await renderMenu();
  expect(menu.actions.disabled).toBe(false);
  expect([menu.spells, menu.resources, menu.abilities, menu.saves, menu.skills].every((button) => button.disabled)).toBe(true);
  await act(async () => { menu.actions.click(); });
  expect(mock.openActions).toHaveBeenCalledWith(expect.objectContaining({ id: "t1" }), "actions");
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
