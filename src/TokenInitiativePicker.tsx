import { useEffect, useState } from "react";
import { canEditCloudSheet } from "./cloudSheets";
import { TOKEN_META_KEY } from "./constants";
import { getPartyMembers, getTurnState, OBR, setTokenCharacter, setTurnState } from "./obr";
import { storage } from "./storage";
import { announceInitiative, INITIATIVE_PICKER_ID, monsterTokenTurn, rollSheetInitiative, type InitiativeRolled } from "./tokenInitiative";
import { createTokenTurn } from "./tokenTurns";
import { replaceTurnEntries } from "./turns";
import type { CloudSheet, MonsterSheet, TurnEntry } from "./types";
import { Alert, Button, Card, Input, Select } from "./ui";

type PcEntry = Extract<CloudSheet, { kind: "pc" }>;
interface Choice { sheetId: string; value: string }

// Popover del menu "Aggiungi/rimuovi dal turn order" per i token senza scheda (solo GM):
// con una scheda PG o un mostro del bestiario il token viene collegato e l'iniziativa tirata; altrimenti valore a mano.
export function TokenInitiativePicker() {
  const [tokens, setTokens] = useState<Array<{ id: string; name: string }>>([]);
  const [sheets, setSheets] = useState<PcEntry[]>([]);
  const [monsters, setMonsters] = useState<MonsterSheet[]>([]);
  const [members, setMembers] = useState<Array<{ id: string; name: string; role: "GM" | "PLAYER" }>>([]);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const ids = (new URLSearchParams(window.location.search).get("initiative") ?? "").split(",").filter(Boolean);
    OBR.onReady(() => {
      setSheets(storage.cloudCache.get(OBR.room.id).filter((entry): entry is PcEntry => entry.kind === "pc"));
      setMonsters(storage.monsters.get());
      void getPartyMembers().then(setMembers);
      void OBR.scene.items.getItems(ids).then((items) => setTokens(items.map((item) => ({ id: item.id, name: item.name || "Senza nome" }))), () => setError("Token non disponibili"));
    });
  }, []);

  const choiceOf = (id: string): Choice => choices[id] ?? { sheetId: "", value: "" };
  const setChoice = (id: string, change: Partial<Choice>) => setChoices({ ...choices, [id]: { ...choiceOf(id), ...change } });
  const close = () => OBR.popover.close(INITIATIVE_PICKER_ID);

  const submit = async () => {
    setBusy(true); setError("");
    try {
      const rolled: InitiativeRolled[] = [];
      const turns: TurnEntry[] = [];
      for (const token of tokens) {
        const choice = choiceOf(token.id);
        const monster = monsters.find((item) => item.id === choice.sheetId);
        if (monster) {
          await setTokenCharacter(token.id, monster.id);
          const added = monsterTokenTurn(token.id, monster);
          turns.push(added.turn); rolled.push(added.rolled);
          continue;
        }
        const entry = sheets.find((item) => item.sheet.id === choice.sheetId);
        if (entry) await setTokenCharacter(token.id, entry.sheet.id, members.find((member) => member.role !== "GM" && canEditCloudSheet(entry, { name: member.name, role: "PLAYER" }))?.id);
        const turn = createTokenTurn({ id: token.id, name: token.name, metadata: entry ? { [TOKEN_META_KEY]: { characterId: entry.sheet.id } } : {} }, entry ? [entry.sheet] : [],
          (_bonus, sheet) => { const roll = rollSheetInitiative(sheet); rolled.push(roll.rolled); return roll.initiative; },
          () => Number(choice.value) || 0);
        if (turn) turns.push(turn);
      }
      const current = await getTurnState();
      await setTurnState(replaceTurnEntries(current, [...current.entries, ...turns.filter((turn) => !current.entries.some((item) => item.tokenId === turn.tokenId))]));
      for (const roll of rolled) await announceInitiative(roll).catch(() => undefined);
      await close();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Turn order non salvato"); setBusy(false); }
  };

  return <Card className="stack"><h2>Aggiungi al turn order</h2>
    <p>Questi token non hanno una scheda: scegli un personaggio o un mostro del bestiario per collegarli e tirare l'iniziativa, oppure scrivi il valore. I tiri dei mostri vanno in chat solo al GM.</p>
    <form className="action-form" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      {tokens.map((token) => { const choice = choiceOf(token.id); return <div className="action-form-row" key={token.id}>
        <label><span>{token.name}</span><Select aria-label={`Scheda per ${token.name}`} value={choice.sheetId} onChange={(event) => setChoice(token.id, { sheetId: event.target.value })}>
          <option value="">Valore a mano</option>
          {sheets.length > 0 && <optgroup label="Personaggi">{sheets.map((entry) => <option key={entry.sheet.id} value={entry.sheet.id}>{entry.sheet.name}</option>)}</optgroup>}
          {monsters.length > 0 && <optgroup label="Bestiario">{monsters.map((monster) => <option key={monster.id} value={monster.id}>{monster.name} · GS {monster.challengeRating}</option>)}</optgroup>}
        </Select></label>
        {!choice.sheetId && <label><span>Iniziativa</span><Input aria-label={`Iniziativa per ${token.name}`} type="number" value={choice.value} placeholder="0" onChange={(event) => setChoice(token.id, { value: event.target.value })}/></label>}
      </div>; })}
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="action-form-buttons"><Button type="button" variant="secondary" onClick={() => void close()}>Annulla</Button><Button type="submit" disabled={busy || tokens.length === 0}>Aggiungi</Button></div>
    </form>
  </Card>;
}
