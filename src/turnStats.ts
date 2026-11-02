import { linkedCharacterId, type SceneToken } from "./tokenTurns";
import type { MonsterSheet, TurnState } from "./types";

// PF e CA di mostri e NPC stanno nel turn order: le loro schede hanno solo i PF medi, uguali per ogni token.
// Le voci seguono il collegamento attuale del token: se cambia scheda (Assegna, popover, Bestiario) si ricaricano
// PF medi e CA; se è la stessa scheda restano i PF attuali, cioè i danni subiti. Restituisce null se non cambia nulla.
export function fillTurnStats(state: TurnState, tokens: SceneToken[], statblocks: Map<string, Pick<MonsterSheet, "name" | "ac" | "hp">>): TurnState | null {
  const tokensById = new Map(tokens.map((token) => [token.id, token]));
  let changed = false;
  const entries = state.entries.map((entry) => {
    const token = entry.tokenId ? tokensById.get(entry.tokenId) : undefined;
    if (!token) return entry;
    const characterId = linkedCharacterId(token);
    const statblock = characterId ? statblocks.get(characterId) : undefined;
    if (characterId === entry.characterId && (!statblock || entry.hp)) return entry;
    changed = true;
    const next = { ...entry, characterId };
    delete next.hp; delete next.ac;
    if (!statblock) return next;
    const max = Math.max(1, statblock.hp.average);
    return { ...next, hp: { current: max, max }, ac: statblock.ac };
  });
  return changed ? { ...state, entries } : null;
}
