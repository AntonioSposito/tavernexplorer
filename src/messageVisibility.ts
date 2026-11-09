import type { ChatMessage } from "./types";

export function canViewMessage(message: ChatMessage, playerId: string, role: "GM" | "PLAYER"): boolean {
  if (message.visibility === "everyone") return true;
  if (message.visibility === "gm" && role === "GM") return true;
  if (message.visibility === "self" && !message.authorId) return true;
  return message.authorId === playerId;
}

// Ora del messaggio; se non è di oggi anche la data GG/MM/AAAA, per capire quando è stato mandato.
export function messageTime(createdAt: number, now = new Date()): string {
  const date = new Date(createdAt);
  const time = date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  return date.toDateString() === now.toDateString() ? time : `${date.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" })} ${time}`;
}
