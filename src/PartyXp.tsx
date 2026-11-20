import { useState } from "react";
import { xpShare } from "./experience";
import type { CharacterSheet } from "./types";
import { Button, Dialog, Input } from "./ui";

// Il GM dà i PE di un incontro ai PG scelti: lo stesso totale a ciascuno o diviso tra loro.
export function PartyXp({ characters, onGive }: { characters: CharacterSheet[]; onGive: (ids: string[], each: number) => void }) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  const [amount, setAmount] = useState("");
  const [split, setSplit] = useState(true);
  const total = Number(amount) || 0;
  const each = xpShare(total, chosen.length, split);
  const give = () => { onGive(chosen, each); setOpen(false); };
  return <>
    <Button variant="outline" disabled={!characters.length} onClick={() => { setChosen(characters.map((sheet) => sheet.id)); setAmount(""); setSplit(true); setOpen(true); }}>Punti esperienza</Button>
    <Dialog open={open} title="Dai PE al gruppo" onClose={() => setOpen(false)}>
      <div className="action-form">
        <label><span>PE dell'incontro</span><Input type="number" min="0" aria-label="PE dell'incontro" value={amount} autoFocus onChange={(event) => setAmount(event.target.value)}/></label>
        <label className="action-form-check"><input type="checkbox" checked={split} onChange={(event) => setSplit(event.target.checked)}/> Dividi tra i PG scelti</label>
        <div className="form-field"><span>PG</span>{characters.map((sheet) => <label className="action-form-check" key={sheet.id}><input type="checkbox" aria-label={`PE a ${sheet.name}`} checked={chosen.includes(sheet.id)} onChange={(event) => setChosen(event.target.checked ? [...chosen, sheet.id] : chosen.filter((id) => id !== sheet.id))}/> {sheet.name}</label>)}</div>
        <small>{chosen.length ? `${each.toLocaleString("it-IT")} PE a ciascuno dei ${chosen.length} PG` : "Scegli almeno un PG"}</small>
        <div className="action-form-buttons"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Annulla</Button><Button type="button" disabled={!each || !chosen.length} onClick={give}>Dai PE</Button></div>
      </div>
    </Dialog>
  </>;
}
