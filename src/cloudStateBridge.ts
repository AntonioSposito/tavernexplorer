import OBR from "@owlbear-rodeo/sdk";
import { INVENTORY_META_KEY, PERMISSIONS_META_KEY, TURN_META_KEY } from "./constants";
import { fetchRoomState, putRoomState, ROOM_STATE_KEYS, ROOM_STATE_POLL_MS, type RoomStateKey, type RoomStateValues } from "./cloudState";
import { writeRoomMetadata } from "./roomMetadata";

const META_KEYS: Record<RoomStateKey, string> = { turns: TURN_META_KEY, inventory: INVENTORY_META_KEY, permissions: PERMISSIONS_META_KEY };
type LocalState = Partial<Record<RoomStateKey, unknown>>;

// Tiene allineati due archivi: il primo giro prende dal cloud ciò che è cambiato da telefono con Owlbear chiuso,
// i successivi mandano prima le modifiche locali e poi leggono quelle remote.
// shortcut: vince l'ultima scrittura e al primo giro vince il cloud, quindi si perde ciò che i giocatori cambiano in Owlbear senza GM; versionare i valori se capita.
export function createStateSync(room: string, readLocal: () => Promise<LocalState>, writeLocal: (key: RoomStateKey, value: unknown) => Promise<void>) {
  const synced = new Map<RoomStateKey, string>();
  let started = false;

  async function pushLocal() {
    const local = await readLocal();
    for (const key of ROOM_STATE_KEYS) {
      const value = local[key];
      if (value === undefined || JSON.stringify(value) === synced.get(key)) continue;
      await putRoomState(room, key, value as RoomStateValues[typeof key]);
      synced.set(key, JSON.stringify(value));
    }
  }

  async function pullRemote() {
    const remote = await fetchRoomState(room);
    const local = await readLocal();
    for (const key of ROOM_STATE_KEYS) {
      const value = remote[key]?.value;
      if (value === undefined) continue;
      const text = JSON.stringify(value);
      if (text === synced.get(key)) continue;
      // Una modifica locale arrivata durante la lettura ha la precedenza: parte al giro dopo.
      if (started && JSON.stringify(local[key]) !== synced.get(key)) continue;
      if (text !== JSON.stringify(local[key])) await writeLocal(key, value);
      synced.set(key, text);
    }
  }

  // In coda: due giri sovrapposti potrebbero riscrivere in Owlbear un valore appena sostituito.
  let queue: Promise<unknown> = Promise.resolve();
  return (): Promise<void> => {
    const round = queue.then(async () => {
      if (started) await pushLocal();
      await pullRemote();
      if (!started) await pushLocal();
      started = true;
    });
    queue = round.catch(() => undefined);
    return round;
  };
}

// Gira nello sfondo di Owlbear, così funziona anche a pannello chiuso. Lo fa solo il GM per non moltiplicare le scritture.
export async function setupCloudStateBridge(): Promise<void> {
  if (await OBR.player.getRole() !== "GM") return;
  const readLocal = async () => {
    const metadata = await OBR.room.getMetadata();
    return Object.fromEntries(ROOM_STATE_KEYS.map((key) => [key, metadata[META_KEYS[key]]]));
  };
  const sync = createStateSync(OBR.room.id, readLocal, (key, value) => writeRoomMetadata({ [META_KEYS[key]]: value }));
  let lastError = "";
  const run = () => sync().then(() => { lastError = ""; }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Sincronizzazione cloud fallita";
    if (message !== lastError) void OBR.notification.show(`Telefono non aggiornato: ${message}`, "WARNING");
    lastError = message;
  });
  void run();
  setInterval(() => { void run(); }, ROOM_STATE_POLL_MS);
  OBR.room.onMetadataChange(() => { void run(); });
}
