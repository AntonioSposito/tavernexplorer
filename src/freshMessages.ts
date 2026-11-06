import { useEffect, useState } from "react";

export const FRESH_MESSAGE_MS = 5000;

// Id dei messaggi arrivati da poco. Quelli già presenti all'apertura della chat non contano, così non lampeggia tutto lo storico.
export function useFreshMessages(messages: Array<{ id: string }>): string[] {
  const [known] = useState(() => new Set(messages.map((message) => message.id)));
  const [fresh, setFresh] = useState<string[]>([]);
  useEffect(() => {
    const added = messages.map((message) => message.id).filter((id) => !known.has(id));
    if (!added.length) return;
    for (const id of added) known.add(id);
    setFresh((current) => [...current, ...added]);
    // Niente cleanup: un messaggio successivo non deve annullare la scadenza di questi.
    setTimeout(() => setFresh((current) => current.filter((id) => !added.includes(id))), FRESH_MESSAGE_MS);
  }, [messages, known]);
  return fresh;
}
