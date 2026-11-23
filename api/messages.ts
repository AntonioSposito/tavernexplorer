import { Redis } from "@upstash/redis";
import type { ChatMessage } from "../src/types.js";
import { isGmToken } from "./_gmToken.js";

// Chat della stanza: due liste degli ultimi messaggi. "Tutti" è leggibile da chi conosce la stanza, come le schede;
// "Solo GM" è in chiaro su Redis ma il server lo restituisce solo con un token GM valido. "Solo io" non arriva qui.
const redis = Redis.fromEnv();
const ID = /^[A-Za-z0-9_-]{1,100}$/;
const MAX_MESSAGES = 200;
const MAX_MESSAGE_BYTES = 50_000;
// Con MAX_MESSAGE_BYTES resta sotto il megabyte accettato da Upstash per richiesta.
const MAX_BATCH = 20;

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
  const body = await request.json().catch(() => null) as { room?: unknown; message?: unknown; messages?: unknown } | null;
  const messages = Array.isArray(body?.messages) ? body.messages as unknown[] : [body?.message];
  if (typeof body?.room !== "string" || !ID.test(body.room) || !messages.length || messages.length > MAX_BATCH || !messages.every(validMessage)) return fail("Richiesta non valida");
  if (messages.some((message) => JSON.stringify(message).length > MAX_MESSAGE_BYTES)) return fail("Messaggio troppo grande", 413);
  for (const visibility of ["everyone", "gm"] as const) {
    const values = messages.filter((message) => message.visibility === visibility).map((message) => JSON.stringify(message));
    if (!values.length) continue;
    const key = listKey(body.room, visibility);
    await redis.rpush(key, ...values);
    await redis.ltrim(key, -MAX_MESSAGES, -1);
  }
  return Response.json({ ok: true });
}
