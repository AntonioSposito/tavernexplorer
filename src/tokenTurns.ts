import { TOKEN_META_KEY } from "./constants";
import { effectiveSheet } from "./effects";
import type { CharacterSheet, TurnEntry } from "./types";

export interface SceneToken {
  id: string;
  name: string;
  metadata: Record<string, unknown>;
}

export function linkedCharacterId(token: SceneToken): string | undefined {
  const link = token.metadata[TOKEN_META_KEY];
  if (!link || typeof link !== "object" || !("characterId" in link)) return undefined;
  return typeof link.characterId === "string" ? link.characterId : undefined;
}

export function createTokenTurn(
  token: SceneToken,
  sheets: CharacterSheet[],
  rollInitiative: (bonus: number, sheet: CharacterSheet) => number,
  askInitiative: (name: string) => number | null,
): TurnEntry | null {
  const characterId = linkedCharacterId(token);
  const sheet = sheets.find((entry) => entry.id === characterId);
  const name = sheet?.name || token.name || "Senza nome";
  // Iniziativa con effetti, oggetti e opzioni, non quella salvata.
  const bonus = sheet && effectiveSheet(sheet).combat.initiative;
  const initiative = bonus === undefined || !sheet ? askInitiative(name) : rollInitiative(bonus, sheet);
  if (initiative === null) return null;
  return {
    id: crypto.randomUUID(), tokenId: token.id, characterId,
    name, initiative, ...(bonus === undefined ? {} : { initiativeBonus: bonus }),
  };
}
