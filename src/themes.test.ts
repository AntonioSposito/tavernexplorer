// @vitest-environment jsdom
import { expect, it } from "vitest";
import { STORAGE_THEME } from "./constants";
import { applyTheme, setTheme, setupTheme } from "./themes";

it("tema: scelto, vecchio o sconosciuto (torna Scuro), cambiato da un'altra finestra", () => {
  setTheme("chiaro");
  expect(document.documentElement.dataset.theme).toBe("chiaro");
  expect(JSON.parse(localStorage.getItem(STORAGE_THEME)!)).toBe("chiaro");
  applyTheme("taverna");
  expect(document.documentElement.dataset.theme).toBe("scuro");
  setupTheme();
  expect(document.documentElement.dataset.theme).toBe("chiaro");
  localStorage.setItem(STORAGE_THEME, JSON.stringify("scuro"));
  window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_THEME }));
  expect(document.documentElement.dataset.theme).toBe("scuro");
});
