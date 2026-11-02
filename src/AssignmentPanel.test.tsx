// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

const unsubscribe = () => () => undefined;
vi.mock("./obr", () => ({
  OBR: { isAvailable: true, onReady: (callback: () => void) => callback(),
    scene: { isReady: async () => true, onReadyChange: unsubscribe, items: { onChange: unsubscribe } },
    room: { getPermissions: async () => [], onPermissionsChange: unsubscribe } },
  getCharacterTokens: async () => [{ tokenId: "t1", tokenName: "Token goblin", characterId: "goblin", ownerId: "gm" }],
  highlightToken: async () => undefined, setTokenCharacter: async () => undefined, setTokenOwner: async () => undefined,
}));

it("un token collegato a un mostro del bestiario mostra il mostro, non \"Scheda non disponibile\"", async () => {
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
  const { AssignmentPanel } = await import("./AssignmentPanel");
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  await act(async () => root.render(<AssignmentPanel sheets={[{ id: "eroe", name: "Eroe" }]} monsters={[{ id: "goblin", name: "Goblin", challengeRating: "1/4" }]} members={[{ id: "gm", name: "Master", role: "GM" }]}/>));
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  const select = host.querySelector<HTMLSelectElement>('select[aria-label="Scheda per Token goblin"]')!;
  expect(select.value).toBe("goblin");
  expect(host.querySelector(".assign-token-item small")?.textContent).toBe("Goblin");
  expect(host.textContent).not.toContain("Scheda non disponibile");
  await act(async () => root.unmount());
});
