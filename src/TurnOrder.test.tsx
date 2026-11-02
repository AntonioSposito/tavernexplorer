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
  expect(host.querySelector(".turn-stats")?.textContent).toBe("PF /7 · CA 15");

  // Modificabile dalla riga, senza aprire ⚙.
  const input = host.querySelector<HTMLInputElement>('input[aria-label="PF di Goblin"]')!;
  expect(input.value).toBe("3");
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "5"); input.dispatchEvent(new Event("input", { bubbles: true })); });
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ entries: [expect.objectContaining({ hp: { current: 5, max: 7 } })] }));
  await act(async () => root.unmount());
});

it("il GM modifica dalla riga anche i PF dei PG, che vengono dalla scheda", async () => {
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
  const state: TurnState = { round: 1, activeIndex: 0, entries: [{ id: "e", name: "Ada", initiative: 15, tokenId: "t", characterId: "ada" }] };
  const onPcHp = vi.fn();
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  await act(async () => root.render(<TurnOrder state={state} canManage showStats pcStats={{ ada: { current: 8, max: 20, temp: 3, ac: 14 } }} onPcHp={onPcHp} images={{}} onChange={() => undefined} onNext={() => undefined} onPrevious={() => undefined} onRollInitiative={() => undefined} active={null} onAttach={() => undefined}/>));
  // Il totale comprende i PF temporanei.
  expect(host.querySelector(".turn-stats")?.textContent).toBe("PF /20 (3 temp.) · CA 14");
  const input = host.querySelector<HTMLInputElement>('input[aria-label="PF di Ada"]')!;
  expect(input.value).toBe("11");
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "3"); input.dispatchEvent(new Event("input", { bubbles: true })); });
  expect(onPcHp).toHaveBeenLastCalledWith("ada", 3);
  await act(async () => root.unmount());
});
