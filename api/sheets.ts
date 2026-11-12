import { Redis } from "@upstash/redis";
import type { CharacterSheet, CloudSheet, JournalFolder, JournalNote, MonsterSheet } from "../src/types";

// Le schede di una stanza stanno in un hash: campo = id scheda, valore = CloudSheet.
// L'ID della stanza Owlbear fa da chiave condivisa: chi non lo conosce non legge nulla.
// I permessi (acl) li applica solo il client: chi conosce la stanza può leggere e scrivere tutto.
const redis = Redis.fromEnv();
const ID = /^[A-Za-z0-9_-]{1,100}$/;
// Schede, NPC, note e cartelle del Journal insieme.
const MAX_SHEETS = 500;
const MAX_SHEET_BYTES = 200_000;
const MAX_NAMES = 50;

// Scrive solo se la revisione salvata coincide con quella attesa (0 = scheda nuova).
// Il JSON della scheda non passa per cjson.encode: trasformerebbe gli array vuoti in oggetti.
const WRITE_IF_REV = `
local current = redis.call("HGET", KEYS[1], ARGV[1])
local rev = current and cjson.decode(current).rev or 0
if rev ~= tonumber(ARGV[2]) then return current or "null" end
redis.call("HSET", KEYS[1], ARGV[1], ARGV[3])
return "ok"`;

const roomKey = (room: string) => `te:room:${room}:sheets`;
const json = (body: unknown, status = 200) => Response.json(body, { status });
const fail = (message: string, status = 400) => json({ error: message }, status);
const validRev = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;
const validName = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 100;
const validNames = (value: unknown): value is string[] => Array.isArray(value) && value.length <= MAX_NAMES && value.every(validName);

type Entry = Pick<CloudSheet, "kind" | "sheet" | "acl" | "updatedBy">;

const optionalId = (value: unknown) => value === undefined || typeof value === "string" && ID.test(value);

// Controllo strutturale minimo: PG riconoscibili da identity, NPC da challengeRating, note da body, cartelle dal genitore.
function validEntry(value: unknown): value is Entry {
  const entry = value as CloudSheet | null;
  if (!entry || typeof entry !== "object" || !validName(entry.updatedBy)) return false;
  if (!entry.acl || !validNames(entry.acl.view) || !validNames(entry.acl.edit)) return false;
  const sheet = entry.sheet as Partial<CharacterSheet & MonsterSheet & JournalNote & JournalFolder> | null;
  if (!sheet || sheet.schemaVersion !== 1 || typeof sheet.id !== "string" || !ID.test(sheet.id) || typeof sheet.name !== "string") return false;
  if (entry.kind === "note") return typeof sheet.body === "string" && optionalId(sheet.folderId) && (sheet.owner === undefined || validName(sheet.owner))
    && (sheet.diagram === undefined || Array.isArray(sheet.diagram?.nodes) && Array.isArray(sheet.diagram?.edges));
  if (entry.kind === "folder") return optionalId(sheet.parentId);
  return entry.kind === "pc" ? !!sheet.identity && typeof sheet.identity === "object"
    : entry.kind === "npc" && typeof sheet.challengeRating === "string";
}

async function readBody(request: Request): Promise<{ room: string; [key: string]: unknown } | null> {
  try {
    const body = await request.json() as { room?: unknown };
    return typeof body.room === "string" && ID.test(body.room) ? body as { room: string } : null;
  } catch {
    return null;
  }
}

// 200 con la versione salvata, 409 con quella del server (null se non esiste).
async function writeIfRev(room: string, expectedRev: number, entry: CloudSheet): Promise<Response> {
  const value = JSON.stringify(entry);
  if (value.length > MAX_SHEET_BYTES) return fail("Scheda troppo grande", 413);
  const result = await redis.eval<[string, number, string], "ok" | CloudSheet | null>(WRITE_IF_REV, [roomKey(room)], [entry.sheet.id, expectedRev, value]);
  return result === "ok" ? json({ entry }) : json({ entry: result }, 409);
}

export async function GET(request: Request): Promise<Response> {
  const room = new URL(request.url).searchParams.get("room") ?? "";
  if (!ID.test(room)) return fail("Stanza non valida");
  const entries: CloudSheet[] = await redis.hvals(roomKey(room));
  return json({ sheets: entries });
}

export async function PUT(request: Request): Promise<Response> {
  const body = await readBody(request);
  if (!body || !validRev(body.rev) || !validEntry(body.entry)) return fail("Richiesta non valida");
  if (body.rev === 0 && await redis.hlen(roomKey(body.room)) >= MAX_SHEETS) return fail("Troppe schede nella stanza", 413);
  const { kind, sheet, acl, updatedBy } = body.entry;
  return writeIfRev(body.room, body.rev, { kind, sheet, acl, updatedBy, rev: body.rev + 1, updatedAt: Date.now() } as CloudSheet);
}

// Cancellazione logica: la scheda resta con deletedAt, così i client offline non la ricreano.
export async function DELETE(request: Request): Promise<Response> {
  const body = await readBody(request);
  if (!body || typeof body.id !== "string" || !ID.test(body.id) || !validRev(body.rev) || !validName(body.updatedBy)) return fail("Richiesta non valida");
  const current = await redis.hget<CloudSheet>(roomKey(body.room), body.id);
  if (!current) return fail("Scheda non trovata", 404);
  const now = Date.now();
  return writeIfRev(body.room, body.rev, { ...current, rev: body.rev + 1, updatedAt: now, updatedBy: body.updatedBy, deletedAt: now });
}
