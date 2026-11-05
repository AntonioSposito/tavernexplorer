import { useState } from "react";
import { armorClass, modifierSources, setManualArmorClass } from "./effects";
import type { CharacterSheet } from "./types";
import { Button, Dialog, Input } from "./ui";

const signed = (value: number) => `${value >= 0 ? "+" : ""}${value}`;

// Valore CA della tab Base: il tooltip mostra da cosa è data, il clic apre il popup manuale/automatica.
export function ArmorClassControl({ sheet, dexMod, editable, onUpdate }: { sheet: CharacterSheet; dexMod: number; editable: boolean; onUpdate: (update: (sheet: CharacterSheet) => CharacterSheet) => void }) {
  const { total, parts, auto } = armorClass(sheet, dexMod);
  const buffs = modifierSources({ ...sheet, inventory: [] }, "ac").reduce((sum, source) => sum + source.amount, 0);
  const [draft, setDraft] = useState<{ auto: boolean; ac: string; base: string } | null>(null);
  const title = [`CA ${total}`, ...parts.map((part, index) => index === 0 ? `${part.name} ${part.amount}` : `${part.name} ${signed(part.amount)}`)].join("\n");
  const save = () => {
    if (!draft) return;
    onUpdate((next) => {
      if (draft.auto) { next.combat.acMode = "auto"; next.combat.acBase = Math.trunc(Number(draft.base)) || 10; }
      else { next.combat.acMode = "manual"; setManualArmorClass(next, Math.trunc(Number(draft.ac)) || 0); }
      return next;
    });
    setDraft(null);
  };
  const content = <><strong>{total}</strong><small>CA{auto ? " · auto" : ""}</small></>;
  return <>
    {editable
      ? <button className="metric metric-explained" title={title} onClick={() => setDraft({ auto, ac: String(total - buffs), base: String(sheet.combat.acBase ?? 10) })}>{content}</button>
      : <div className="metric metric-explained" title={title}>{content}</div>}
    <Dialog open={draft !== null} title="Classe armatura" description={title.split("\n").slice(1).join(" · ")} onClose={() => setDraft(null)}>{draft && <form className="action-form" onSubmit={(event) => { event.preventDefault(); save(); }}>
      <label className="action-form-check"><input type="checkbox" checked={draft.auto} onChange={(event) => setDraft({ ...draft, auto: event.target.checked })}/> Calcola automaticamente (come Roll20)</label>
      {draft.auto
        ? <label><span>Base senza armatura</span><Input aria-label="Base CA senza armatura" type="number" value={draft.base} onChange={(event) => setDraft({ ...draft, base: event.target.value })}/><small className="muted">Con un'armatura equipaggiata (modificatore "Armatura leggera/media/pesante (CA base)" dell'oggetto) vale la sua CA + DES (max +2 media, niente pesante). Scudi, oggetti e buff si sommano.</small></label>
        : <label><span>CA (senza buff e tratti)</span><Input aria-label="CA manuale" type="number" value={draft.ac} onChange={(event) => setDraft({ ...draft, ac: event.target.value })}/><small className="muted">Gli oggetti equipaggiati ora sono compresi; i buff attivi, i modificatori dei tratti e gli oggetti cambiati dopo si sommano.</small></label>}
      <div className="action-form-buttons"><Button type="button" variant="secondary" onClick={() => setDraft(null)}>Annulla</Button><Button type="submit">Salva</Button></div>
    </form>}</Dialog>
  </>;
}
