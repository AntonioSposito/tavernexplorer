import { Redis } from "@upstash/redis";
import type { PermissionSettings, SharedInventoryItem, TurnState } from "../src/types";

// Turni, inventario comune e permessi per chi è fuori da Owlbear: un hash con un campo per voce, vince l'ultima scrittura.
// Come per le schede, l'ID della stanza fa da chiave condivisa e i permessi li applica il client.
const redis = Redis.fromEnv();
const ID = /^[A-Za-z0-9_-]{1,100}$/;
// Stesso limite dei metadata Owlbear, dove questi valori devono tornare.
const MAX_VALUE_BYTES = 14_000;

const stateKey = (room: string) => `te:room:${room}:state`;
const fail = (error: string, status = 400) => Response.json({ error }, { status });

const validators: Record<string, (value: unknown) => boolean> = {
  turns: (value) => {
    const state = value as TurnState | null;
    return !!state && typeof state === "object" && Number.isFinite(state.round) && Number.isFinite(state.activeIndex) && Array.isArray(state.entries);
  },
  inventory: (value) => Array.isArray(value) && (value as SharedInventoryItem[]).every((item) => !!item && typeof item.id === "string" && typeof item.name === "string"),
  permissions: (value) => {
    const settings = value as PermissionSettings | null;
    return !!settings && typeof settings === "object" && [settings.playersEditInventory, settings.playersImportContent, settings.playersManageTurns].every((flag) => typeof flag === "boolean");
  },
};

export async function GET(request: Request): Promise<Response> {
  const room = new URL(request.url).searchParams.get("room") ?? "";
  if (!ID.test(room)) return fail("Stanza non valida");
  return Response.json({ state: await redis.hgetall(stateKey(room)) ?? {} });
}

export async function PUT(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null) as { room?: unknown; key?: unknown; value?: unknown } | null;
  if (typeof body?.room !== "string" || !ID.test(body.room) || typeof body.key !== "string" || !Object.hasOwn(validators, body.key) || !validators[body.key](body.value)) return fail("Richiesta non valida");
  if (JSON.stringify(body.value).length > MAX_VALUE_BYTES) return fail("Dati troppo grandi", 413);
  await redis.hset(stateKey(body.room), { [body.key]: { value: body.value, updatedAt: Date.now() } });
  return Response.json({ ok: true });
}
