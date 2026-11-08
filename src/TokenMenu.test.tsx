// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, it, vi } from "vitest";
import { TURN_META_KEY } from "./constants";

const mock = vi.hoisted(() => ({ deselect: vi.fn(async () => undefined), openSheet: vi.fn(async () => undefined), toggle: vi.fn(async () => undefined), selection: ["t1"], turnIds: [] as string[] }));
vi.mock("@owlbear-rodeo/sdk", () => ({ default: {
  onReady: (callback: () => void) => callback(),
  theme: { getTheme: async () => ({ mode: "DARK", text: { primary: "#fff", secondary: "#aaa", disabled: "#888" } }) },
  room: { getMetadata: async () => ({ [TURN_META_KEY]: { round: 1, activeIndex: 0, entries: mock.turnIds.map((tokenId) => ({ tokenId })) } }) },
  player: { getSelection: async () => mock.selection, deselect: mock.deselect },
  scene: { items: { getItems: async (ids: string[]) => ids.map((id) => ({ id, name: id, metadata: {} })) } },
} }));
vi.mock("./tokenMenuActions", () => ({ openTokenSheet: mock.openSheet, toggleTokenInitiative: mock.toggle }));

import { TokenMenu } from "./TokenMenu";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => { mock.toggle.mockClear(); mock.openSheet.mockClear(); mock.deselect.mockClear(); });

async function renderMenu() {
  document.body.innerHTML = "<div id='root'></div>";
  await act(async () => { createRoot(document.getElementById("root")!).render(<TokenMenu />); });
  const [sheet, turns] = document.querySelectorAll("button");
  return { sheet, turns };
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
