import { Redis } from "@upstash/redis";
import type { ChatMessage } from "../src/types";
import { isGmToken } from "./_gmToken";

// Chat della stanza: due liste degli ultimi messaggi. "Tutti" è leggibile da chi conosce la stanza, come le schede;
// "Solo GM" è in chiaro su Redis ma il server lo restituisce solo con un token GM valido. "Solo io" non arriva qui.
const redis = Redis.fromEnv();
const ID = /^[A-Za-z0-9_-]{1,100}$/;
const MAX_MESSAGES = 200;
const MAX_MESSAGE_BYTES = 50_000;

const listKey = (room: string, visibility: "everyone" | "gm") => `te:room:${room}:messages:${visibility}`;
const fail = (error: string, status = 400) => Response.json({ error }, { status });

function validMessage(value: unknown): value is ChatMessage {
  const message = value as ChatMessage | null;
  return !!message && typeof message === "object" && typeof message.id === "string" && message.id.length > 0 && message.id.length <= 100
    && typeof message.author === "string" && typeof message.body === "string" && Number.isFinite(message.createdAt)
    && (message.visibility === "everyone" || message.visibility === "gm");
}

export async function GET(request: Request): Promise<Response> {
  const room = new URL(request.url).searchParams.get("room") ?? "";
  if (!ID.test(room)) return fail("Stanza non valida");
  const everyone = await redis.lrange<ChatMessage>(listKey(room, "everyone"), 0, -1);
  const gm = await isGmToken(room, request.headers.get("x-gm-token")) ? await redis.lrange<ChatMessage>(listKey(room, "gm"), 0, -1) : [];
  return Response.json({ messages: [...everyone, ...gm].sort((a, b) => a.createdAt - b.createdAt) });
}

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null) as { room?: unknown; message?: unknown } | null;
  if (typeof body?.room !== "string" || !ID.test(body.room) || !validMessage(body.message)) return fail("Richiesta non valida");
  const value = JSON.stringify(body.message);
  if (value.length > MAX_MESSAGE_BYTES) return fail("Messaggio troppo grande", 413);
  const key = listKey(body.room, body.message.visibility as "everyone" | "gm");
  await redis.rpush(key, value);
  await redis.ltrim(key, -MAX_MESSAGES, -1);
  return Response.json({ ok: true });
}
