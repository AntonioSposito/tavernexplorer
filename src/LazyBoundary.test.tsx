// @vitest-environment jsdom
import { act, Component, lazy, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import { LazyBoundary } from "./LazyBoundary";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLElement;
beforeEach(() => { host = document.createElement("div"); root = createRoot(host, { onUncaughtError: () => undefined, onCaughtError: () => undefined }); });
afterEach(() => act(() => root.unmount()));
class Outer extends Component<{ children: ReactNode }, { message: string }> {
  state = { message: "" };
  static getDerivedStateFromError(error: Error) { return { message: `Fuori: ${error.message}` }; }
  render() { return this.state.message || this.props.children; }
}
const show = (children: ReactNode) => act(async () => root.render(<Outer><LazyBoundary>{children}</LazyBoundary></Outer>));

it("mostra il caricamento, poi la parte caricata", async () => {
  let load!: (module: { default: () => ReactNode }) => void;
  const Part = lazy(() => new Promise<{ default: () => ReactNode }>((resolve) => { load = resolve; }));
  await show(<Part/>);
  expect(host.querySelector("[aria-label=Caricamento]")).toBeTruthy();
  await act(async () => load({ default: () => <p>Pronta</p> }));
  expect(host.textContent).toBe("Pronta");
});

it("un file che non si carica dà un errore leggibile con Riprova", async () => {
  const Part = lazy(() => Promise.reject(new TypeError("Failed to fetch dynamically imported module: /assets/x.js")));
  await show(<Part/>);
  expect(host.textContent).toContain("non si è caricata");
  expect(host.querySelector("button")!.textContent).toBe("Riprova");
});

it("un errore diverso non diventa un problema di connessione", async () => {
  const Broken = () => { throw new Error("rotto"); };
  await show(<Broken/>);
  expect(host.textContent).toBe("Fuori: rotto");
});
