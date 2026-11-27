import { useState } from "react";
import { storage } from "./storage";
import { setTheme, THEMES, type ThemeId } from "./themes";
import { Card } from "./ui";

// Tema dell'interfaccia: vale solo per questo browser, in tutte le finestre aperte.
export function ThemePicker() {
  const [current, setCurrent] = useState(storage.theme.get);
  const choose = (id: ThemeId) => { setTheme(id); setCurrent(id); };
  return <Card className="theme-picker"><h2>Tema</h2><p>Vale solo per te, su questo browser.</p>
    <div className="theme-options" role="radiogroup" aria-label="Tema">{THEMES.map((theme) => <label key={theme.id} className="action-form-check theme-option" data-theme-preview={theme.id}>
      <input type="radio" name="theme" checked={current === theme.id} onChange={() => choose(theme.id)}/>
      <span className="theme-swatch" aria-hidden="true" style={{ background: `linear-gradient(135deg, ${theme.swatch[0]} 50%, ${theme.swatch[1]} 50%)` }}/><span><strong>{theme.label}</strong><small>{theme.description}</small></span>
    </label>)}</div>
  </Card>;
}
