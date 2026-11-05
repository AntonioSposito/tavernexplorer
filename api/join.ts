import { Redis } from "@upstash/redis";
import { gmToken } from "./_gmToken";

declare const process: { env: Record<string, string | undefined> };

// Accesso da telefono: la password condivisa dà l'ID della stanza, che resta la chiave delle schede.
// PHONE_GM_PASSWORD (facoltativa) dà anche il token GM, l'unico modo per leggere i messaggi "Solo GM" dal cloud.
const redis = Redis.fromEnv();
const MAX_ATTEMPTS = 10;
const WINDOW_SECONDS = 900;

const fail = (error: string, status: number) => Response.json({ error }, { status });

export async function POST(request: Request): Promise<Response> {
  const { PHONE_ROOM: room, PHONE_PASSWORD: password, PHONE_GM_PASSWORD: gmPassword } = process.env;
  if (!room || !password) return fail("Accesso da telefono non configurato", 503);
  const attempts = `te:join:${request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown"}`;
  const count = await redis.incr(attempts);
  if (count === 1) await redis.expire(attempts, WINDOW_SECONDS);
  if (count > MAX_ATTEMPTS) return fail("Troppi tentativi: riprova tra 15 minuti", 429);
  const body = await request.json().catch(() => null) as { password?: unknown } | null;
  const gm = !!gmPassword && body?.password === gmPassword;
  if (!gm && body?.password !== password) return fail("Password errata", 401);
  await redis.del(attempts);
  return Response.json(gm ? { room, gmToken: await gmToken(room, gmPassword) } : { room });
}
