// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { FRESH_MESSAGE_MS, useFreshMessages } from "./freshMessages";

function List({ messages }: { messages: Array<{ id: string }> }) {
  return <p>{useFreshMessages(messages).join(",")}</p>;
}

it("evidenzia solo i messaggi arrivati dopo l'apertura e li spegne dopo il tempo previsto", async () => {
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
  vi.useFakeTimers();
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  await act(async () => root.render(<List messages={[{ id: "vecchio" }]}/>));
  expect(host.textContent).toBe("");

  await act(async () => root.render(<List messages={[{ id: "vecchio" }, { id: "a" }]}/>));
  expect(host.textContent).toBe("a");

  await act(async () => { vi.advanceTimersByTime(FRESH_MESSAGE_MS / 2); });
  await act(async () => root.render(<List messages={[{ id: "vecchio" }, { id: "a" }, { id: "b" }]}/>));
  expect(host.textContent).toBe("a,b");

  await act(async () => { vi.advanceTimersByTime(FRESH_MESSAGE_MS / 2); });
  expect(host.textContent).toBe("b");

  await act(async () => { vi.advanceTimersByTime(FRESH_MESSAGE_MS); });
  expect(host.textContent).toBe("");
  await act(async () => root.unmount());
  vi.useRealTimers();
});
