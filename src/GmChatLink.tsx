import { useState, type FormEvent } from "react";
import { Alert, Button, Input } from "./ui";

// In Owlbear il GM collega questo browser alla chat cloud, per leggere i "Solo GM" scritti dai telefoni.
export function GmChatLink({ room, linked, onLink }: { room: string; linked: boolean; onLink: (token: string) => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/join", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) }).catch(() => null);
    const body = await response?.json().catch(() => null) as { room?: string; gmToken?: string; error?: string } | null | undefined;
    if (!body?.gmToken) { setError(body?.error ?? "Serve la password GM"); return; }
    if (body.room !== room) { setError("PHONE_ROOM è impostato su un'altra stanza"); return; }
    onLink(body.gmToken);
    setPassword("");
  };
  return <form className="stack" onSubmit={(event) => void submit(event)}>
    <p>{linked ? "Questo browser riceve anche i messaggi Solo GM inviati dai telefoni." : "Inserisci PHONE_GM_PASSWORD per ricevere qui i messaggi Solo GM inviati dai telefoni."}</p>
    {!linked && <Input type="password" aria-label="Password GM" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)}/>}
    {!linked && <Button type="submit" disabled={!password}>Collega</Button>}
    {error && <Alert tone="danger">{error}</Alert>}
  </form>;
}
