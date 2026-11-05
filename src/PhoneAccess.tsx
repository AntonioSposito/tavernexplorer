import { useState, type FormEvent } from "react";
import App from "./App";
import { aclCandidates, EVERYONE } from "./cloudSheets";
import { storage, type PhoneSession } from "./storage";
import type { CloudSheet } from "./types";
import { Alert, Button, Card, Input, Select } from "./ui";

async function joinRoom(password: string): Promise<{ room: string; names: string[]; gmToken?: string }> {
  const joined = await fetch("/api/join", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
  const body = await joined.json().catch(() => null) as { room?: string; gmToken?: string; error?: string } | null;
  if (!joined.ok || !body?.room) throw new Error(body?.error ?? "Accesso non riuscito");
  const library = await fetch(`/api/sheets?room=${encodeURIComponent(body.room)}`);
  if (!library.ok) throw new Error("Server non raggiungibile");
  const { sheets } = await library.json() as { sheets: CloudSheet[] };
  return { room: body.room, gmToken: body.gmToken, names: aclCandidates(sheets.filter((entry) => !entry.deletedAt), []).filter((name) => name !== EVERYONE) };
}

function PhoneLogin({ onLogin }: { onLogin: (session: PhoneSession) => void }) {
  const [password, setPassword] = useState("");
  const [joined, setJoined] = useState<{ room: string; names: string[] } | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (joined) { onLogin({ room: joined.room, name }); return; }
    setError("");
    try {
      const next = await joinRoom(password);
      if (next.gmToken) { onLogin({ room: next.room, name: "GM", gmToken: next.gmToken }); return; }
      setJoined(next);
      setName(next.names[0] ?? "");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Accesso non riuscito"); }
  };
  return <div className="app"><main><Card><form className="stack" onSubmit={(event) => void submit(event)}>
    <h2>TavernExplorer</h2>
    {!joined && <Input type="password" aria-label="Password" placeholder="Password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)}/>}
    {joined && joined.names.length > 0 && <Select aria-label="Giocatore" value={name} onChange={(event) => setName(event.target.value)}>{joined.names.map((item) => <option key={item}>{item}</option>)}</Select>}
    {joined && !joined.names.length && <Alert tone="danger">Nessuna scheda assegnata ai giocatori: chiedi al GM.</Alert>}
    {error && <Alert tone="danger">{error}</Alert>}
    <Button type="submit" disabled={joined ? !name : !password}>{joined ? "Apri le schede" : "Entra"}</Button>
  </form></Card></main></div>;
}

// TavernExplorer aperto dall'URL pubblico, fuori da Owlbear.
export function PhoneApp() {
  const [session, setSession] = useState(storage.phoneSession.get);
  const change = (next: PhoneSession | null) => { storage.phoneSession.set(next); setSession(next); };
  return session ? <App phone={session} onPhoneExit={() => change(null)}/> : <PhoneLogin onLogin={change}/>;
}
