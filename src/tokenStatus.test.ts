// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { STORAGE_MONSTERS, TOKEN_META_KEY, TOKEN_STATS_META_KEY } from "./constants";
import { importRoll20 } from "./importer";
import type { CloudSheet, MonsterSheet, TurnEntry } from "./types";

const scene = vi.hoisted(() => ({
  role: "GM" as "GM" | "PLAYER",
  turns: { round: 1, activeIndex: 0, entries: [] } as { round: number; activeIndex: number; entries: unknown[]; hideTokenStats?: boolean },
  tokens: [] as Array<{ id: string; layer: string; visible: boolean; position: { x: number; y: number }; metadata: Record<string, unknown> }>,
  local: [] as Array<{ id: string; type?: string; metadata: Record<string, unknown>; text?: { plainText: string }; width?: number; style?: { fillColor: string } }>,
  listeners: [] as Array<() => void>,
}));
const filtered = <T,>(items: T[], filter?: (item: T) => boolean) => filter ? items.filter(filter) : items;
vi.mock("@owlbear-rodeo/sdk", async (original) => {
  const sdk = await original<typeof import("@owlbear-rodeo/sdk")>();
  // I builder veri chiedono l'ID del giocatore a Owlbear: qui registrano solo i valori impostati.
  const builder = (type: string) => {
    const item: Record<string, unknown> = { id: crypto.randomUUID(), type };
    const chain: Record<string, unknown> = new Proxy({}, { get: (_target, key: string) => key === "build" ? () => item
      : (value: unknown) => { if (key === "plainText") item.text = { plainText: value }; else item[key] = value; return chain; } });
    return chain;
  };
  return { ...sdk, buildShape: () => builder("SHAPE"), buildLabel: () => builder("LABEL"), buildText: () => builder("TEXT"), buildPath: () => builder("PATH"), default: {
    room: { id: "r1", onMetadataChange: (callback: () => void) => { scene.listeners.push(callback); } },
    player: { getRole: async () => scene.role, getName: async () => "Marco" },
    scene: {
      isReady: async () => true, onReadyChange: () => undefined,
      items: { getItems: async (filter?: (item: unknown) => boolean) => filtered(scene.tokens, filter), getItemBounds: async () => ({ min: { x: 0, y: 0 }, max: { x: 100, y: 100 }, width: 100, height: 100, center: { x: 50, y: 50 } }), onChange: () => undefined },
      local: {
        getItems: async (filter?: (item: unknown) => boolean) => filtered(scene.local, filter),
        addItems: async (items: typeof scene.local) => { scene.local.push(...items); },
        deleteItems: async (ids: string[]) => { scene.local = scene.local.filter((item) => !ids.includes(item.id)); },
        updateItems: async () => undefined,
      },
    },
  } };
});
vi.mock("./obr", () => ({ getTurnState: async () => scene.turns, onSheetsChanged: () => () => undefined }));

beforeEach(() => { localStorage.clear(); scene.role = "GM"; scene.turns = { round: 1, activeIndex: 0, entries: [] }; scene.tokens = []; scene.local = []; });

const pc = () => {
  const sheet = importRoll20({ character: { name: "Ada" }, normalized: { identity: { character_name: "Ada" } } });
  sheet.combat.hp = { current: 8, max: 20, temp: 3 };
  sheet.combat.acMode = "manual"; sheet.combat.ac = 15;
  return sheet;
};
const goblin = { id: "goblin", name: "Goblin", ac: 13 } as MonsterSheet;

it("l'etichetta mostra solo le condizioni, nascoste ai giocatori se il turno è nascosto", async () => {
  const { tokenStatusText } = await import("./tokenStatus");
  const turn: TurnEntry = { id: "turn", name: "Ada", initiative: 10, hidden: true, conditions: [{ id: "c", name: "Avvelenato", remainingRounds: 2 }] };
  expect(tokenStatusText(turn, "PLAYER")).toBeNull();
  expect(tokenStatusText(turn, "GM")).toBe("Avvelenato 2r");
});

it("barra e CA per i PG, solo CA per NPC e mostri", async () => {
  const { tokenStats } = await import("./tokenStatus");
  const sheet = pc();
  expect(tokenStats({ kind: "pc", sheet } as CloudSheet, undefined)).toEqual({ hp: { current: 8, max: 20, temp: 3 }, ac: 15 });
  expect(tokenStats({ kind: "npc", sheet: { ...goblin, ac: 12 } } as CloudSheet, undefined)).toEqual({ ac: 12 });
  expect(tokenStats(undefined, goblin)).toEqual({ ac: 13 });
  expect(tokenStats(undefined, undefined)).toBeNull();
});

it("disegna barra e CA di tutti i PG per tutti, NPC e mostri solo per il GM, e le toglie quando il turn order le nasconde", async () => {
  const { setupTokenStatus } = await import("./tokenStatus");
  const sheet = pc();
  const other = { ...pc(), id: "other" };
  const deleted = { ...pc(), id: "deleted" };
  // Dal server: anche il PG che il giocatore non può aprire si vede sul token; le schede eliminate no.
  vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ sheets: [
    { kind: "pc", sheet, acl: { view: ["Marco"], edit: [] } }, { kind: "pc", sheet: other, acl: { view: [], edit: [] } },
    { kind: "pc", sheet: deleted, acl: { view: [], edit: [] }, deletedAt: 1 }, { kind: "npc", sheet: { ...goblin, id: "npc", ac: 11 }, acl: { view: ["*"], edit: [] } },
  ] })));
  localStorage.setItem(STORAGE_MONSTERS, JSON.stringify([goblin]));
  scene.tokens = [
    { id: "t-ada", layer: "CHARACTER", visible: true, position: { x: 50, y: 50 }, metadata: { [TOKEN_META_KEY]: { characterId: sheet.id } } },
    { id: "t-gob", layer: "CHARACTER", visible: true, position: { x: 50, y: 50 }, metadata: { [TOKEN_META_KEY]: { characterId: "goblin" } } },
    { id: "t-other", layer: "CHARACTER", visible: true, position: { x: 50, y: 50 }, metadata: { [TOKEN_META_KEY]: { characterId: "other" } } },
    { id: "t-deleted", layer: "CHARACTER", visible: true, position: { x: 50, y: 50 }, metadata: { [TOKEN_META_KEY]: { characterId: "deleted" } } },
    { id: "t-npc", layer: "CHARACTER", visible: true, position: { x: 50, y: 50 }, metadata: { [TOKEN_META_KEY]: { characterId: "npc" } } },
  ];
  setupTokenStatus();
  const stats = (tokenId: string) => scene.local.filter((item) => (item.metadata[TOKEN_STATS_META_KEY] as { tokenId?: string } | undefined)?.tokenId === tokenId);
  await vi.waitFor(() => expect(stats("t-gob")).toHaveLength(2));
  expect(stats("t-other")).toHaveLength(6);
  expect(stats("t-deleted")).toHaveLength(0);
  expect(stats("t-npc").map((item) => item.text?.plainText).filter(Boolean)).toEqual(["11"]);
  // Sfondo, PF (8/20 → giallo sotto metà), temporanei e testo "8/20 +3" come Roll20, più scudo e CA.
  expect(stats("t-ada")).toHaveLength(6);
  expect(stats("t-ada").map((item) => item.text?.plainText).filter(Boolean)).toEqual(["8/20 +3", "15"]);
  expect(stats("t-gob").map((item) => item.text?.plainText).filter(Boolean)).toEqual(["13"]);

  scene.role = "PLAYER";
  scene.listeners.forEach((callback) => callback());
  await vi.waitFor(() => expect(stats("t-gob")).toHaveLength(0));
  expect(stats("t-ada")).toHaveLength(6);
  expect(stats("t-other")).toHaveLength(6);
  expect(stats("t-npc")).toHaveLength(0);

  scene.turns = { ...scene.turns, hideTokenStats: true };
  scene.listeners.forEach((callback) => callback());
  await vi.waitFor(() => expect(stats("t-ada")).toHaveLength(0));
});
