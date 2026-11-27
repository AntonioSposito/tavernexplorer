// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { LibraryPanel } from "./LibraryPanel";

it("libreria in caricamento: skeleton al posto di \"Nessuna scheda\"", async () => {
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  const noop = () => undefined;
  const render = (loading: boolean) => act(async () => root.render(<LibraryPanel loading={loading} entries={[]} activeId={null} members={[]} player={{ name: "Master", role: "GM" }}
    onSelect={noop} onImport={noop} onCreate={noop} onExport={noop} onExportPack={noop} onAclChange={noop} onDelete={noop}/>));
  await render(true);
  expect(host.querySelector(".ui-skeleton")).not.toBeNull();
  expect(host.textContent).not.toContain("Nessuna scheda");
  await render(false);
  expect(host.querySelector(".ui-skeleton")).toBeNull();
  expect(host.textContent).toContain("Nessuna scheda");
  act(() => root.unmount());
});
