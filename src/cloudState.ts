import type { PermissionSettings, SharedInventoryItem, TurnState } from "./types";

const URL = "/api/room-state";

export interface RoomStateValues { turns: TurnState; inventory: SharedInventoryItem[]; permissions: PermissionSettings }
export type RoomStateKey = keyof RoomStateValues;
export type RoomState = { [Key in RoomStateKey]?: { value: RoomStateValues[Key]; updatedAt: number } };

export const ROOM_STATE_KEYS: RoomStateKey[] = ["turns", "inventory", "permissions"];
export const ROOM_STATE_POLL_MS = 10_000;

export async function fetchRoomState(room: string): Promise<RoomState> {
  const response = await fetch(`${URL}?room=${encodeURIComponent(room)}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json() as { state: RoomState }).state;
}

export async function putRoomState<Key extends RoomStateKey>(room: string, key: Key, value: RoomStateValues[Key]): Promise<void> {
  const response = await fetch(URL, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ room, key, value }) });
  if (!response.ok) throw new Error(`Salvataggio nel cloud fallito (HTTP ${response.status})`);
}
