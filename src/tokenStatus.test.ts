// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { STORAGE_MONSTERS, TOKEN_META_KEY, TOKEN_STATS_META_KEY, TOKEN_STATUS_META_KEY } from "./constants";
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
      isReady: async () => true, onReadyChange: () => undefined, grid: { getDpi: async () => 150 },
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

it("le icone delle condizioni sono nascoste ai giocatori se il turno è nascosto", async () => {
  const { tokenConditionIcons } = await import("./tokenStatus");
  const turn: TurnEntry = { id: "turn", name: "Ada", initiative: 10, hidden: true, conditions: [{ id: "c", name: "Poisoned", remainingRounds: 2 }] };
  expect(tokenConditionIcons(turn, "PLAYER")).toEqual([]);
  expect(tokenConditionIcons(turn, "GM")).toEqual([{ icon: "🧪", rounds: 2 }]);
});

it("gli effetti di mostri e NPC (sul token) li vedono il GM e chi può vedere il mostro", async () => {
  const { tokenConditionIcons } = await import("./tokenStatus");
  const turn: TurnEntry = { id: "turn", name: "Goblin", initiative: 10, conditions: [{ id: "c", name: "Poisoned" }] };
  expect(tokenConditionIcons(turn, "PLAYER")).toEqual([]);
  expect(tokenConditionIcons(turn, "PLAYER", undefined, undefined, true)).toEqual([{ icon: "🧪" }]);
  expect(tokenConditionIcons(turn, "GM")).toEqual([{ icon: "🧪" }]);
});

it("per i PG le icone sono gli effetti attivi della scheda: emoji per le condizioni, iniziali per gli altri, +N oltre quattro", async () => {
  const { tokenConditionIcons } = await import("./tokenStatus");
  const effect = (name: string, active = true) => ({ id: name, name, active, modifiers: [] });
  expect(tokenConditionIcons(undefined, "PLAYER", [effect("Poisoned"), effect("Bless", false), effect("Ring"), effect("Exhaustion 2"), effect("Concentrazione: Bless")])
    .map(({ icon }) => icon)).toEqual(["🧪", "Ri", "🪫", "🧠"]);
  expect(tokenConditionIcons(undefined, "PLAYER", ["Prone", "Blinded", "Stunned", "Charmed", "Deafened"].map((name) => effect(name)))).toEqual(["🛌", "🕶️", "🌀", "+2"].map((icon) => ({ icon })));
});

it("disegna le icone in alto a sinistra, grandi come lo scudo della CA", async () => {
  const { setupTokenStatus } = await import("./tokenStatus");
  vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ sheets: [] })));
  scene.tokens = [{ id: "t-gob", layer: "CHARACTER", visible: true, position: { x: 50, y: 50 }, metadata: {} }];
  scene.turns = { ...scene.turns, entries: [{ id: "e", name: "Goblin", initiative: 1, tokenId: "t-gob", conditions: [{ id: "c", name: "Prone" }, { id: "d", name: "Poisoned", remainingRounds: 3 }] }] };
  setupTokenStatus();
  const icons = () => scene.local.filter((item) => (item.metadata[TOKEN_STATUS_META_KEY] as { tokenId?: string } | undefined)?.tokenId === "t-gob");
  // Prone senza durata: cerchio ed emoji; Poisoned con 3 turni: anche il badge col numero.
  await vi.waitFor(() => expect(icons()).toHaveLength(6));
  expect(icons().map((item) => item.text?.plainText).filter(Boolean)).toEqual(["🛌", "🧪", "3"]);
  // Misura fissa in caselle (DPI 150 × 0.32), come lo scudo.
  expect(icons().find((item) => item.type === "SHAPE")).toMatchObject({ width: 48, height: 48 });
});

it("barra e CA per i PG, solo CA per NPC e mostri", async () => {
  const { tokenStats } = await import("./tokenStatus");
  const sheet = pc();
  expect(tokenStats({ kind: "pc", sheet } as CloudSheet, undefined)).toEqual({ hp: { current: 8, max: 20, temp: 3 }, ac: 15 });
  expect(tokenStats({ kind: "npc", sheet: { ...goblin, ac: 12 } } as CloudSheet, undefined)).toEqual({ ac: 12 });
  expect(tokenStats(undefined, goblin)).toEqual({ ac: 13 });
  expect(tokenStats(undefined, undefined)).toBeNull();
});

it("disegna barra e CA di tutti i PG per tutti, NPC e mostri per il GM e per chi può vederli, e le toglie quando il turn order le nasconde", async () => {
  const { setupTokenStatus } = await import("./tokenStatus");
  const sheet = pc();
  const other = { ...pc(), id: "other" };
  const deleted = { ...pc(), id: "deleted" };
  // Dal server: anche il PG che il giocatore non può aprire si vede sul token; le schede eliminate no.
  vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ sheets: [
    { kind: "pc", sheet, acl: { view: ["Marco"], edit: [] } }, { kind: "pc", sheet: other, acl: { view: [], edit: [] } },
    { kind: "pc", sheet: deleted, acl: { view: [], edit: [] }, deletedAt: 1 }, { kind: "npc", sheet: { ...goblin, id: "npc", ac: 11 }, acl: { view: ["*"], edit: [] } },
    { kind: "npc", sheet: { ...goblin, id: "secret", ac: 9 }, acl: { view: [], edit: [] } },
  ] })));
  localStorage.setItem(STORAGE_MONSTERS, JSON.stringify([goblin]));
  scene.tokens = [
    { id: "t-ada", layer: "CHARACTER", visible: true, position: { x: 50, y: 50 }, metadata: { [TOKEN_META_KEY]: { characterId: sheet.id } } },
    { id: "t-gob", layer: "CHARACTER", visible: true, position: { x: 50, y: 50 }, metadata: { [TOKEN_META_KEY]: { characterId: "goblin" } } },
    { id: "t-other", layer: "CHARACTER", visible: true, position: { x: 50, y: 50 }, metadata: { [TOKEN_META_KEY]: { characterId: "other" } } },
    { id: "t-deleted", layer: "CHARACTER", visible: true, position: { x: 50, y: 50 }, metadata: { [TOKEN_META_KEY]: { characterId: "deleted" } } },
    { id: "t-npc", layer: "CHARACTER", visible: true, position: { x: 50, y: 50 }, metadata: { [TOKEN_META_KEY]: { characterId: "npc" } } },
    { id: "t-secret", layer: "CHARACTER", visible: true, position: { x: 50, y: 50 }, metadata: { [TOKEN_META_KEY]: { characterId: "secret" } } },
  ];
  setupTokenStatus();
  const stats = (tokenId: string) => scene.local.filter((item) => (item.metadata[TOKEN_STATS_META_KEY] as { tokenId?: string } | undefined)?.tokenId === tokenId);
  await vi.waitFor(() => expect(stats("t-gob")).toHaveLength(2));
  expect(stats("t-other")).toHaveLength(6);
  expect(stats("t-deleted")).toHaveLength(0);
  expect(stats("t-npc").map((item) => item.text?.plainText).filter(Boolean)).toEqual(["11"]);
  expect(stats("t-secret").map((item) => item.text?.plainText).filter(Boolean)).toEqual(["9"]);
  // Sfondo, PF (8/20 → giallo sotto metà), temporanei e testo "8/20 +3" come Roll20, più scudo e CA.
  expect(stats("t-ada")).toHaveLength(6);
  expect(stats("t-ada").map((item) => item.text?.plainText).filter(Boolean)).toEqual(["8/20 +3", "15"]);
  // Barra larga quanto il token (100), altezza fissa in caselle (DPI 150).
  expect(stats("t-ada").find((item) => item.type === "SHAPE")).toMatchObject({ width: 90, height: 24 });
  expect(stats("t-gob").map((item) => item.text?.plainText).filter(Boolean)).toEqual(["13"]);

  scene.role = "PLAYER";
  scene.listeners.forEach((callback) => callback());
  await vi.waitFor(() => expect(stats("t-gob")).toHaveLength(0));
  expect(stats("t-ada")).toHaveLength(6);
  expect(stats("t-other")).toHaveLength(6);
  // NPC condiviso con tutti: il giocatore ne vede la CA; quello non condiviso no.
  expect(stats("t-npc").map((item) => item.text?.plainText).filter(Boolean)).toEqual(["11"]);
  expect(stats("t-secret")).toHaveLength(0);

  scene.turns = { ...scene.turns, hideTokenStats: true };
  scene.listeners.forEach((callback) => callback());
  await vi.waitFor(() => expect(stats("t-ada")).toHaveLength(0));
});

it("la CA sul token di un mostro comprende gli effetti accesi del token", async () => {
  const { tokenStats } = await import("./tokenStatus");
  const turn: TurnEntry = { id: "t", name: "Goblin", initiative: 10, ac: 13, conditions: [
    { id: "a", name: "Shield of Faith", active: true, modifiers: [{ id: "m", target: "ac", amount: 2 }] },
    { id: "b", name: "Spento", active: false, modifiers: [{ id: "n", target: "ac", amount: 5 }] },
    { id: "c", name: "Prone", remainingRounds: 1 },
  ] };
  expect(tokenStats(undefined, goblin, turn)?.ac).toBe(15);
});

it("un PG a 0 PF ha per prima l'icona dei tiri contro la morte, con successi e fallimenti", async () => {
  const { tokenConditionIcons } = await import("./tokenStatus");
  const effect = (name: string) => ({ id: name, name, active: true, modifiers: [] });
  expect(tokenConditionIcons(undefined, "PLAYER", ["Prone", "Blinded", "Stunned", "Charmed"].map(effect), { successes: 2, failures: 1 }))
    .toEqual([{ icon: "💀", successes: 2, failures: 1 }, { icon: "🛌" }, { icon: "🕶️" }, { icon: "+2" }]);
  expect(tokenConditionIcons(undefined, "PLAYER", [], undefined)).toEqual([]);
});

it("disegna sul token del PG a 0 PF il teschio con i successi in verde e i fallimenti in rosso", async () => {
  const { setupTokenStatus } = await import("./tokenStatus");
  const sheet = pc();
  sheet.combat.hp = { current: 0, max: 20, temp: 0 };
  sheet.combat.deathSaves = { successes: 2, failures: 1 };
  vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ sheets: [{ kind: "pc", sheet, acl: { view: [], edit: [] } }] })));
  scene.tokens = [{ id: "t-ada", layer: "CHARACTER", visible: true, position: { x: 50, y: 50 }, metadata: { [TOKEN_META_KEY]: { characterId: sheet.id } } }];
  scene.role = "PLAYER";
  setupTokenStatus();
  const icons = () => scene.local.filter((item) => (item.metadata[TOKEN_STATUS_META_KEY] as { tokenId?: string } | undefined)?.tokenId === "t-ada");
  await vi.waitFor(() => expect(icons().map((item) => item.text?.plainText).filter(Boolean)).toEqual(["💀", "2", "1"]));
  expect(icons().filter((item) => item.type === "SHAPE").map((item) => (item as { fillColor?: string }).fillColor)).toEqual(["#334155", "#22c55e", "#ef4444"]);
});

it("l'icona dell'Indebolimento ha il livello nel badge", async () => {
  const { tokenConditionIcons } = await import("./tokenStatus");
  expect(tokenConditionIcons(undefined, "PLAYER", [{ id: "e", name: "Indebolimento 3", active: true, modifiers: [] }, { id: "o", name: "Exhaustion", active: true, modifiers: [] }]))
    .toEqual([{ icon: "🪫", level: 3 }, { icon: "🪫", level: 1 }]);
});
