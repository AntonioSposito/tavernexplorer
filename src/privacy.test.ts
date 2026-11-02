// @vitest-environment jsdom
// @ts-expect-error Node types are intentionally absent from the browser build.
import { webcrypto } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { canViewMessage } from "./messageVisibility";
import { mergeMonsters } from "./monsterImport";
import type { ChatMessage, MonsterSheet } from "./types";

const sdk = vi.hoisted(() => ({
  role: "GM" as "GM" | "PLAYER",
  metadata: {} as Record<string, unknown>,
  players: [] as Array<{ id: string; role: "GM" | "PLAYER"; metadata: Record<string, unknown> }>,
  send: vi.fn(),
}));
vi.mock("@owlbear-rodeo/sdk", () => ({ default: {
  isAvailable: true,
  player: { getRole: async () => sdk.role, getId: async () => "gm-1", setMetadata: async (value: Record<string, unknown>) => { Object.assign(sdk.metadata, value); } },
  party: { getPlayers: async () => sdk.players },
  broadcast: { sendMessage: sdk.send },
} }));

import { decryptGmMessage, encryptGmMessage, publishGmMessageKey } from "./privateMessages";
import { broadcastMessage } from "./obr";

beforeEach(() => {
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: webcrypto });
  localStorage.clear(); sdk.role = "GM"; sdk.metadata = {}; sdk.players = [];
});

describe("privacy", () => {
  const message: ChatMessage = { id: "m1", kind: "text", author: "Alice", authorId: "alice", body: "segreto", visibility: "gm", createdAt: 1 };

  it("nasconde i messaggi GM agli altri giocatori, anche quando il nome coincide", () => {
    expect(canViewMessage(message, "bob", "PLAYER")).toBe(false);
    expect(canViewMessage(message, "alice", "PLAYER")).toBe(true);
    expect(canViewMessage(message, "gm-1", "GM")).toBe(true);
  });

  it("cifra i messaggi GM prima del broadcast e li decifra solo come GM", async () => {
    await publishGmMessageKey();
    sdk.players = [{ id: "gm-1", role: "GM", metadata: sdk.metadata }];
    const envelope = await encryptGmMessage(message);
    expect(JSON.stringify(envelope)).not.toContain("segreto");
    expect(await decryptGmMessage(envelope)).toEqual(message);
    sdk.role = "PLAYER";
    expect(await decryptGmMessage(envelope)).toBeNull();
  });

  it("un GM da solo manda \"Solo GM\" senza errore e senza broadcast; un giocatore senza GM pronto riceve l'errore", async () => {
    sdk.send.mockClear();
    await expect(broadcastMessage(message)).resolves.toBeUndefined();
    expect(sdk.send).not.toHaveBeenCalled();
    sdk.role = "PLAYER";
    await expect(broadcastMessage(message)).rejects.toThrow("Nessun GM pronto");
  });

  it("preserva l'id del mostro sostituito e lascia intatti gli altri", () => {
    const old = { id: "old", name: "Drago", source: "XMM", ac: 15 } as MonsterSheet;
    const other = { id: "other", name: "Lupo", source: "XMM" } as MonsterSheet;
    const newer = { ...old, id: "new", ac: 18 };
    expect(mergeMonsters([old, other], [newer])).toEqual([{ ...newer, id: "old" }, other]);
  });
});
