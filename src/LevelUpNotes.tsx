import type { CharacterSheet } from "./types";
import { Alert, Button } from "./ui";

// Avviso nei Tratti con le cose da sistemare a mano dopo il level up; resta finché non lo si chiude.
export function LevelUpNotes({ notes, onClose }: { notes: NonNullable<CharacterSheet["levelUpNotes"]>; onClose: () => void }) {
  return <Alert className="level-up-notes">
    <h3>Da sistemare a mano dopo il level up</h3>
    {notes.map((note, index) => <div key={index}><strong>{note.title}</strong><ul>{note.lines.map((line) => <li key={line}>{line}</li>)}</ul></div>)}
    <Button type="button" variant="secondary" onClick={() => { if (window.confirm("Chiudere l'avviso? Una volta chiuso non sarà più visualizzabile fino al prossimo level up.")) onClose(); }}>Chiudi avviso</Button>
  </Alert>;
}
