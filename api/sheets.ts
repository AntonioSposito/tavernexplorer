import { Redis } from "@upstash/redis";
import type { CloudSheet } from "../src/types";

// Le schede di una stanza stanno in un hash: campo = id scheda, valore = CloudSheet.
// L'ID della stanza Owlbear fa da chiave condivisa: chi non lo conosce non legge nulla.
const redis = Redis.fromEnv();
const ID = /^[A-Za-z0-9_-]{1,100}$/;
const MAX_SHEETS = 50;
const MAX_SHEET_BYTES = 200_000;

const roomKey = (room: string) => `te:room:${room}:sheets`;
const json = (body: unknown, status = 200) => Response.json(body, { status });
const fail = (message: string, status = 400) => json({ error: message }, status);

function validSheet(value: unknown): value is CloudSheet {
  const entry = value as CloudSheet | null;
  return !!entry && typeof entry === "object" && typeof entry.ownerId === "string" && ID.test(entry.ownerId)
    && typeof entry.ownerName === "string" && typeof entry.updatedAt === "number"
    && !!entry.sheet && entry.sheet.schemaVersion === 1 && typeof entry.sheet.id === "string" && ID.test(entry.sheet.id)
    && JSON.stringify(entry).length <= MAX_SHEET_BYTES;
}

async function readBody(request: Request): Promise<{ room: string; [key: string]: unknown } | null> {
  try {
    const body = await request.json() as { room?: unknown };
    return typeof body.room === "string" && ID.test(body.room) ? body as { room: string } : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request): Promise<Response> {
  const room = new URL(request.url).searchParams.get("room") ?? "";
  if (!ID.test(room)) return fail("Stanza non valida");
  const entries: CloudSheet[] = await redis.hvals(roomKey(room));
  return json({ sheets: entries });
}

export async function PUT(request: Request): Promise<Response> {
  const body = await readBody(request);
  const sheets = body?.sheets;
  if (!body || !Array.isArray(sheets) || !sheets.length || sheets.length > MAX_SHEETS) return fail("Richiesta non valida");
  if (!sheets.every(validSheet)) return fail("Scheda non valida o troppo grande");
  await redis.hset(roomKey(body.room), Object.fromEntries(sheets.map((entry) => [entry.sheet.id, entry])));
  return new Response(null, { status: 204 });
}

export async function DELETE(request: Request): Promise<Response> {
  const body = await readBody(request);
  const ids = body?.ids;
  if (!body || !Array.isArray(ids) || !ids.length || ids.length > MAX_SHEETS || !ids.every((id) => typeof id === "string" && ID.test(id))) return fail("Richiesta non valida");
  await redis.hdel(roomKey(body.room), ...ids);
  return new Response(null, { status: 204 });
}
