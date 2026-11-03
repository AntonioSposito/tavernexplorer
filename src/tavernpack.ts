import { DEFAULT_RULESET } from "./rulesets";
import type { CampaignDocument, CharacterSheet, ChatMessage, MonsterSheet, SharedInventoryItem, TavernPack, TurnState } from "./types";

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function requireShape(ok: boolean, path: string): void {
  if (!ok) throw new Error(`Dato non valido: ${path}`);
}

function validateCounter(value: unknown): boolean {
  const counter = record(value);
  return !!counter && typeof counter.id === "string" && typeof counter.name === "string"
    && typeof counter.current === "number" && Number.isInteger(counter.current) && counter.current >= 0
    && typeof counter.max === "number" && Number.isInteger(counter.max) && counter.max >= 1 && counter.current <= counter.max
    && (counter.recovery === "none" || counter.recovery === "short" || counter.recovery === "long")
    && (counter.itemId === undefined || typeof counter.itemId === "string") && (counter.traitId === undefined || typeof counter.traitId === "string");
}

export function parseCharacterSheet(value: unknown): CharacterSheet {
  const sheet = record(value);
  const identity = record(sheet?.identity);
  const combat = record(sheet?.combat);
  const hp = record(combat?.hp);
  const spellcasting = record(sheet?.spellcasting);
  requireShape(sheet?.schemaVersion === 1 && typeof sheet.id === "string" && !!sheet.id && typeof sheet.name === "string" && !!sheet.name, "scheda: id, nome o versione");
  requireShape(!!identity && !!combat && !!hp && !!spellcasting, "scheda: identità, combattimento o magia");
  requireShape(typeof hp?.current === "number" && typeof hp.max === "number" && !!record(combat?.hitDice) && !!record(combat?.deathSaves) && !!record(sheet?.abilities) && !!record(sheet?.skills) && !!record(spellcasting?.slots), "scheda: statistiche");
  requireShape(spellcasting?.slotRecovery === undefined || spellcasting.slotRecovery === "short" || spellcasting.slotRecovery === "long", "scheda: recupero slot");
  for (const key of ["actions", "spells", "inventory", "traits", "importWarnings"]) requireShape(Array.isArray(sheet?.[key]), `scheda: ${key}`);
  requireShape(sheet?.counters === undefined || Array.isArray(sheet.counters) && sheet.counters.every(validateCounter), "scheda: contatori");
  requireShape(!!record(sheet?.currency), "scheda: monete");
  return sheet as unknown as CharacterSheet;
}

function validateMonster(value: unknown): boolean {
  const monster = record(value);
  return !!monster && typeof monster.id === "string" && typeof monster.name === "string" && !!record(monster.hp) && !!record(monster.abilities)
    && ["traits", "actions", "reactions", "legendaryActions"].every((key) => Array.isArray(monster[key]));
}

function validateChapter(value: unknown): boolean {
  const chapter = record(value);
  return !!chapter && typeof chapter.id === "string" && typeof chapter.title === "string" && typeof chapter.body === "string"
    && Array.isArray(chapter.images) && Array.isArray(chapter.children) && chapter.children.every(validateChapter);
}

function validateCampaign(value: unknown): boolean {
  const campaign = record(value);
  return !!campaign && typeof campaign.id === "string" && typeof campaign.title === "string"
    && Array.isArray(campaign.chapters) && campaign.chapters.every(validateChapter);
}

export function createTavernPack(data: { characters: CharacterSheet[]; monsters: MonsterSheet[]; campaigns: CampaignDocument[]; sharedInventory: SharedInventoryItem[]; session?: { messages: ChatMessage[]; turnState: TurnState } }): TavernPack {
  return {
    $schema: "https://tavernexplorer.vercel.app/tavernpack.schema.json",
    format: "tavernpack",
    formatVersion: "1.0.0",
    exportedAt: new Date().toISOString(),
    rulesets: [{ id: DEFAULT_RULESET.id, version: DEFAULT_RULESET.version }],
    data: structuredClone(data),
  };
}

export function parseTavernPack(value: unknown): TavernPack {
  const pack = record(value);
  if (pack?.format !== "tavernpack" || pack.formatVersion !== "1.0.0") throw new Error("Formato TavernPack non supportato");
  const data = record(pack.data);
  requireShape(!!data, "TavernPack: dati mancanti");
  requireShape(Array.isArray(data?.characters) && data.characters.every((sheet: unknown) => { try { parseCharacterSheet(sheet); return true; } catch { return false; } }), "TavernPack: schede");
  requireShape(Array.isArray(data?.monsters) && data.monsters.every(validateMonster), "TavernPack: mostri");
  requireShape(Array.isArray(data?.campaigns) && data.campaigns.every(validateCampaign), "TavernPack: avventure");
  requireShape(Array.isArray(data?.sharedInventory) && data.sharedInventory.every((item: unknown) => { const row = record(item); return !!row && typeof row.id === "string" && typeof row.name === "string" && typeof row.quantity === "number"; }), "TavernPack: inventario");
  const session = record(data?.session);
  requireShape(data?.session === undefined || !!session && Array.isArray(session.messages) && Array.isArray(record(session.turnState)?.entries), "TavernPack: sessione");
  return pack as unknown as TavernPack;
}
