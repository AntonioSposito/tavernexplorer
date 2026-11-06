import { Redis } from "@upstash/redis";
import type { MonsterSheet } from "../src/types";
import { isGmToken } from "./_gmToken.js";

// Bestiario del GM: un hash con un campo per mostro, leggibile e scrivibile solo con il token GM.
// Cancellazione logica come per le schede: un browser che ha ancora il mostro non deve ricaricarlo.
const redis = Redis.fromEnv();
const ID = /^[A-Za-z0-9_-]{1,100}$/;
const MAX_BATCH = 20;
// MAX_BATCH per questo limite resta sotto il megabyte accettato da Upstash per richiesta.
const MAX_MONSTER_BYTES = 40_000;
const MAX_MONSTERS = 3000;

const bestiaryKey = (room: string) => `te:room:${room}:bestiary`;
const fail = (error: string, status = 400) => Response.json({ error }, { status });
const validMonster = (value: unknown) => {
  const monster = value as MonsterSheet | null;
  return !!monster && typeof monster === "object" && typeof monster.id === "string" && monster.id.length > 0 && monster.id.length <= 200
    && typeof monster.name === "string" && typeof monster.challengeRating === "string";
};

async function readBody(request: Request): Promise<{ room: string; monsters?: unknown; id?: unknown } | Response> {
  const body = await request.json().catch(() => null) as { room?: unknown } | null;
  if (typeof body?.room !== "string" || !ID.test(body.room)) return fail("Richiesta non valida");
  if (!await isGmToken(body.room, request.headers.get("x-gm-token"))) return fail("Serve il token GM", 401);
  return body as { room: string };
}

export async function GET(request: Request): Promise<Response> {
  const room = new URL(request.url).searchParams.get("room") ?? "";
  if (!ID.test(room)) return fail("Stanza non valida");
  if (!await isGmToken(room, request.headers.get("x-gm-token"))) return fail("Serve il token GM", 401);
  return Response.json({ entries: await redis.hvals(bestiaryKey(room)) });
}

export async function PUT(request: Request): Promise<Response> {
  const body = await readBody(request);
  if (body instanceof Response) return body;
  const { monsters } = body;
  if (!Array.isArray(monsters) || monsters.length === 0 || monsters.length > MAX_BATCH || !monsters.every(validMonster)) return fail("Richiesta non valida");
  if (monsters.some((monster) => JSON.stringify(monster).length > MAX_MONSTER_BYTES)) return fail("Mostro troppo grande", 413);
  if (await redis.hlen(bestiaryKey(body.room)) + monsters.length > MAX_MONSTERS) return fail("Troppi mostri nella stanza", 413);
  await redis.hset(bestiaryKey(body.room), Object.fromEntries((monsters as MonsterSheet[]).map((monster) => [monster.id, { id: monster.id, monster }])));
  return Response.json({ ok: true });
}

export async function DELETE(request: Request): Promise<Response> {
  const body = await readBody(request);
  if (body instanceof Response) return body;
  if (typeof body.id !== "string" || body.id.length === 0 || body.id.length > 200) return fail("Richiesta non valida");
  await redis.hset(bestiaryKey(body.room), { [body.id]: { id: body.id, deletedAt: Date.now() } });
  return Response.json({ ok: true });
}
