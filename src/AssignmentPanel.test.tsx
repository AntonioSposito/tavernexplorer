// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, it, vi } from "vitest";

const unsubscribe = () => () => undefined;
const mock = vi.hoisted(() => ({ tokens: [] as Array<Record<string, unknown>>, setTokenCharacter: vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined), focusToken: vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined) }));
vi.mock("./obr", () => ({
  OBR: { isAvailable: true, onReady: (callback: () => void) => callback(),
    scene: { isReady: async () => true, onReadyChange: unsubscribe, items: { onChange: unsubscribe } },
    room: { getPermissions: async () => [], onPermissionsChange: unsubscribe } },
  getCharacterTokens: async () => mock.tokens,
  focusToken: mock.focusToken, highlightToken: async () => undefined, setTokenCharacter: mock.setTokenCharacter, setTokenOwner: async () => undefined,
}));

const sheets = [{ id: "eroe", name: "Eroe", ownerId: "marco" }];
const monsters = [{ id: "goblin", name: "Goblin", challengeRating: "1/4" }, { id: "oste", name: "Oste", challengeRating: "1" }];

async function renderPanel(panelMonsters = monsters) {
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
  const { AssignmentPanel } = await import("./AssignmentPanel");
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  await act(async () => root.render(<AssignmentPanel sheets={sheets} monsters={panelMonsters} members={[{ id: "gm", name: "Master", role: "GM" }]}/>));
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  return { host, root };
}

beforeEach(() => { mock.setTokenCharacter.mockClear(); });

it("un token collegato a un mostro del bestiario mostra il mostro, non \"Scheda non disponibile\"", async () => {
  mock.tokens = [{ tokenId: "t1", tokenName: "Token goblin", characterId: "goblin", ownerId: "gm" }];
  const { host, root } = await renderPanel();
  const select = host.querySelector<HTMLSelectElement>('select[aria-label="Scheda per Token goblin"]')!;
  expect(select.value).toBe("goblin");
  expect(host.querySelector(".assign-token-item small")?.textContent).toBe("Goblin");
  expect(host.textContent).not.toContain("Scheda non disponibile");
  await act(async () => root.unmount());
});

it("mostra per primi i token del party", async () => {
  mock.tokens = [
    { tokenId: "t1", tokenName: "Libero", ownerId: "gm" },
    { tokenId: "t2", tokenName: "Token goblin", characterId: "goblin", ownerId: "gm" },
    { tokenId: "t3", tokenName: "Token eroe", characterId: "eroe", ownerId: "gm" },
  ];
  const { host, root } = await renderPanel();
  expect([...host.querySelectorAll(".assign-token-item strong")].map((item) => item.textContent)).toEqual(["Token eroe", "Libero", "Token goblin"]);
  await act(async () => root.unmount());
});

it("collega da solo i token con il nome di una scheda, PG prima dei mostri, ignorando maiuscole", async () => {
  mock.tokens = [
    { tokenId: "t1", tokenName: " eroe ", ownerId: "gm" },
    { tokenId: "t2", tokenName: "OSTE", ownerId: "gm" },
    { tokenId: "t3", tokenName: "Goblin", ownerId: "gm" },
    { tokenId: "t4", tokenName: "Sconosciuto", ownerId: "gm" },
  ];
  const { root } = await renderPanel([...monsters, { id: "eroe-mostro", name: "Eroe", challengeRating: "5" }]);
  expect(mock.setTokenCharacter.mock.calls).toEqual([["t1", "eroe", "marco"], ["t2", "oste", undefined], ["t3", "goblin", undefined]]);
  await act(async () => root.unmount());
});

it("non tocca i token già collegati né quelli scollegati a mano dal GM", async () => {
  mock.tokens = [
    { tokenId: "t1", tokenName: "Eroe", characterId: "goblin", ownerId: "gm" },
    { tokenId: "t2", tokenName: "Eroe", unlinked: true, ownerId: "gm" },
  ];
  const { root } = await renderPanel();
  expect(mock.setTokenCharacter).not.toHaveBeenCalled();
  await act(async () => root.unmount());
});

it("cliccando il nome la vista si sposta sul token", async () => {
  mock.tokens = [{ tokenId: "t1", tokenName: "Libero", ownerId: "gm" }];
  const { host, root } = await renderPanel();
  await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Vai a Libero sulla mappa"]')!.click());
  expect(mock.focusToken).toHaveBeenCalledWith("t1");
  await act(async () => root.unmount());
});
