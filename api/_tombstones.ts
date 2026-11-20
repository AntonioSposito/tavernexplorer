import type { Redis } from "@upstash/redis";

// Le voci cancellate restano come "lapidi" (deletedAt) perché i client offline non le ricreino.
// Dopo 30 giorni si tolgono, così non occupano per sempre il limite della stanza.
const TOMBSTONE_MS = 30 * 24 * 60 * 60 * 1000;

// Toglie le lapidi scadute e restituisce le voci rimaste, per campo. Si chiama solo quando la stanza è al limite.
export async function dropOldTombstones(redis: Redis, key: string): Promise<Record<string, { deletedAt?: number }>> {
  const entries = await redis.hgetall<Record<string, { deletedAt?: number }>>(key) ?? {};
  const expired = Object.keys(entries).filter((field) => (entries[field].deletedAt ?? Infinity) < Date.now() - TOMBSTONE_MS);
  if (expired.length) await redis.hdel(key, ...expired);
  for (const field of expired) delete entries[field];
  return entries;
}
