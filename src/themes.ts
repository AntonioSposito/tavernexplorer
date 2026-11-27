import { STORAGE_THEME } from "./constants";
import { storage } from "./storage";

// Due temi come Roll20: Scuro è il default di refresh.css, Chiaro è in themes.css.
// swatch: sfondo e accento, per il campione nel selettore.
export const THEMES = [
  { id: "scuro", label: "Scuro", description: "Grigio scuro e viola", swatch: ["#1f1f1f", "#9e6bd1"] },
  { id: "chiaro", label: "Chiaro", description: "Bianco e viola", swatch: ["#f5f5f5", "#6c2e9e"] },
] as const;
export type ThemeId = typeof THEMES[number]["id"];

const known = (id: string): ThemeId => THEMES.some((theme) => theme.id === id) ? id as ThemeId : "scuro";

export function applyTheme(id: string): void {
  document.documentElement.dataset.theme = known(id);
}

export function setTheme(id: ThemeId): void {
  storage.theme.set(id);
  applyTheme(id);
}

// All'avvio e quando un'altra finestra della stessa persona (popover di Owlbear) cambia tema.
export function setupTheme(): void {
  applyTheme(storage.theme.get());
  window.addEventListener("storage", (event) => { if (event.key === STORAGE_THEME) applyTheme(storage.theme.get()); });
}
