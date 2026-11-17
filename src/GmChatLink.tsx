import { useState, type FormEvent } from "react";
import { Alert, Button, Input } from "./ui";

// In Owlbear il GM collega questo browser al cloud: messaggi "Solo GM" scritti fuori da Owlbear e bestiario condiviso tra i browser.
export function GmChatLink({ room, linked, onLink }: { room: string; linked: boolean; onLink: (token: string) => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/join", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) }).catch(() => null);
    const body = await response?.json().catch(() => null) as { room?: string; gmToken?: string; error?: string } | null | undefined;
    if (!body?.gmToken) { setError(body?.error ?? "Serve la password GM"); return; }
    if (body.room !== room) { setError("La password GM vale per un'altra stanza"); return; }
    onLink(body.gmToken);
    setPassword("");
  };
  return <form className="stack" onSubmit={(event) => void submit(event)}>
    <p>{linked ? "Questo browser è collegato: riceve i messaggi Solo GM scritti fuori da Owlbear e salva il bestiario nel cloud." : "Inserisci la password GM per ricevere qui i messaggi Solo GM scritti fuori da Owlbear e salvare il bestiario nel cloud, così lo ritrovi in ogni browser."}</p>
    {!linked && <Input type="password" aria-label="Password GM" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)}/>}
    {!linked && <Button type="submit" disabled={!password}>Collega</Button>}
    {error && <Alert tone="danger">{error}</Alert>}
  </form>;
}
