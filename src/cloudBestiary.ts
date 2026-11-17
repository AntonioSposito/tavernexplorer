import type { MonsterSheet } from "./types";

const URL = "/api/bestiary";

export const BESTIARY_POLL_MS = 60_000;
export interface BestiaryEntry { id: string; monster?: MonsterSheet; deletedAt?: number }

const request = (method: "PUT" | "DELETE", gmToken: string, body: unknown) => fetch(URL, { method, headers: { "content-type": "application/json", "x-gm-token": gmToken }, body: JSON.stringify(body) });
const failure = (status: number) => new Error(`Bestiario non salvato nel cloud (HTTP ${status})`);

async function send(method: "PUT" | "DELETE", gmToken: string, body: unknown): Promise<void> {
  const response = await request(method, gmToken, body);
  if (!response.ok) throw failure(response.status);
}

export async function fetchBestiary(room: string, gmToken: string): Promise<BestiaryEntry[]> {
  const response = await fetch(`${URL}?room=${encodeURIComponent(room)}`, { headers: { "x-gm-token": gmToken } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json() as { entries: BestiaryEntry[] }).entries;
}

// Un mostro per richiesta: uno rifiutato (es. troppo grande) non blocca gli altri. Token non valido: inutile proseguire.
export async function putMonsters(room: string, gmToken: string, monsters: MonsterSheet[]): Promise<void> {
  const rejected: string[] = [];
  for (const monster of monsters) {
    const response = await request("PUT", gmToken, { room, monsters: [monster] });
    if (response.status === 401) throw failure(401);
    if (!response.ok) rejected.push(`${monster.name} (HTTP ${response.status})`);
  }
  if (rejected.length) throw new Error(`Mostri non salvati nel cloud: ${rejected.join(", ")}`);
}

export const deleteCloudMonster = (room: string, gmToken: string, id: string) => send("DELETE", gmToken, { room, id });

// Toglie i mostri eliminati altrove, aggiunge quelli nuovi, prende le modifiche più recenti fatte altrove
// e indica quali il cloud non ha ancora mai visto.
export function mergeBestiary(local: MonsterSheet[], remote: BestiaryEntry[]): { monsters: MonsterSheet[]; upload: MonsterSheet[]; changed: boolean } {
  const known = new Map(remote.map((entry) => [entry.id, entry]));
  const localIds = new Set(local.map((monster) => monster.id));
  const kept = local.filter((monster) => !known.get(monster.id)?.deletedAt).map((monster) => { const remote = known.get(monster.id)?.monster; return remote && (remote.updatedAt ?? 0) > (monster.updatedAt ?? 0) ? remote : monster; });
  const updated = kept.some((monster, index) => monster !== local.filter((item) => !known.get(item.id)?.deletedAt)[index]);
  const added = remote.flatMap((entry) => entry.monster && !entry.deletedAt && !localIds.has(entry.id) ? [entry.monster] : []);
  return { monsters: [...kept, ...added], upload: kept.filter((monster) => !known.has(monster.id)), changed: added.length > 0 || kept.length !== local.length || updated };
}
