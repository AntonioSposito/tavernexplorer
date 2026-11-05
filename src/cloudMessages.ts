import type { ChatMessage } from "./types";

const URL = "/api/messages";

// La chat nel cloud arriva anche a chi è fuori da Owlbear. "Solo io" resta su questo dispositivo.
export async function postCloudMessage(room: string, message: ChatMessage): Promise<void> {
  if (message.visibility === "self") return;
  const response = await fetch(URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ room, message }) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}

export async function fetchCloudMessages(room: string, gmToken?: string | null): Promise<ChatMessage[]> {
  const response = await fetch(`${URL}?room=${encodeURIComponent(room)}`, gmToken ? { headers: { "x-gm-token": gmToken } } : undefined);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json() as { messages: ChatMessage[] }).messages;
}

// Unisce per id, in ordine di invio. Restituisce current se non c'è nulla di nuovo.
export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const known = new Set(current.map((message) => message.id));
  const fresh = incoming.filter((message) => !known.has(message.id));
  return fresh.length ? [...current, ...fresh].sort((a, b) => a.createdAt - b.createdAt).slice(-200) : current;
}
