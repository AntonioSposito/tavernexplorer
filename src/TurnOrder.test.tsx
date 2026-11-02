// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { TurnOrder } from "./TurnOrder";
import type { TurnState } from "./types";

it("il GM vede e modifica PF e CA dei mostri nel turn order; i giocatori no", async () => {
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
  const state: TurnState = { round: 1, activeIndex: 0, entries: [{ id: "e", name: "Goblin", initiative: 12, tokenId: "t", characterId: "goblin", hp: { current: 3, max: 7 }, ac: 15 }] };
  const onChange = vi.fn();
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  const render = (showStats: boolean) => act(async () => root.render(<TurnOrder state={state} canManage showStats={showStats} images={{}} onChange={onChange} onNext={() => undefined} onPrevious={() => undefined} onRollInitiative={() => undefined} active={null} onAttach={() => undefined}/>));

  await render(false);
  expect(host.querySelector(".turn-stats")).toBeNull();
  await render(true);
  expect(host.querySelector(".turn-stats")?.textContent).toBe("PF 3/7 · CA 15");

  await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Condizioni e modifica"]')!.click());
  const input = host.querySelector<HTMLInputElement>('input[aria-label="PF di Goblin"]')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "5"); input.dispatchEvent(new Event("input", { bubbles: true })); });
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ entries: [expect.objectContaining({ hp: { current: 5, max: 7 } })] }));
  await act(async () => root.unmount());
});
