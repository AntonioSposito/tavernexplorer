import OBR from "@owlbear-rodeo/sdk";
import { EXTENSION_ID } from "./constants";
import { roll, type RollResult } from "./dice";
import { initiativeRoll } from "./initiative";
import { postCloudMessage } from "./cloudMessages";
import { broadcastMessage, showRollOnMap } from "./obr";
import { buildRollCard } from "./rollCards";
import { storage } from "./storage";
import type { CharacterSheet, ChatMessage, MonsterSheet, RollMode, TurnEntry } from "./types";

// Popover aperto dal menu del turn order per scegliere la scheda dei token che non ne hanno una.
export const INITIATIVE_PICKER_ID = `${EXTENSION_ID}/initiative-picker`;

// gmOnly: tiro di un mostro del bestiario, che i giocatori non devono vedere.
export interface InitiativeRolled { name: string; characterId: string; formula: string; mode: RollMode; result: RollResult; gmOnly?: boolean }

// Tiro per il turn order: il valore include lo spareggio, `rolled` serve per la chat.
export function rollSheetInitiative(sheet: CharacterSheet): { initiative: number; rolled: InitiativeRolled } {
  const spec = initiativeRoll(sheet);
  const result = roll(spec.formula, spec.mode);
  return { initiative: result.total + spec.tiebreaker, rolled: { name: sheet.name, characterId: sheet.id, formula: spec.formula, mode: spec.mode, result } };
}

// Mostro del bestiario: 1d20 + modificatore di Destrezza, come "Aggiungi al turno" nel Bestiario.
export function monsterTokenTurn(tokenId: string, monster: MonsterSheet): { turn: TurnEntry; rolled: InitiativeRolled } {
  const bonus = Math.floor(((monster.abilities.dex ?? 10) - 10) / 2);
  const formula = `1d20${bonus >= 0 ? "+" : ""}${bonus}`;
  const result = roll(formula, "normal");
  return {
    turn: { id: crypto.randomUUID(), tokenId, characterId: monster.id, name: monster.name, initiative: result.total, initiativeBonus: bonus },
    rolled: { name: monster.name, characterId: monster.id, formula, mode: "normal", result, gmOnly: true },
  };
}

// Come il clic su Iniziativa nella scheda: card in chat e risultato sul token (i mostri solo al GM, senza mappa).
// Prima nella cronologia salvata, così il messaggio c'è anche se la finestra di TavernExplorer è chiusa;
// "ALL" perché chi invia (menu del token o popover) non è la finestra della chat.
export async function announceInitiative({ name, characterId, formula, mode, result, gmOnly }: InitiativeRolled) {
  const { card, title, body } = buildRollCard("Iniziativa", formula, result, mode);
  const message: ChatMessage = {
    id: crypto.randomUUID(), kind: "roll", author: name, authorId: await OBR.player.getId(), playerName: await OBR.player.getName(), characterId,
    title, body, card, formula: result.formula, total: result.total, dice: result.dice, visibility: gmOnly ? "gm" : "everyone", createdAt: Date.now(),
  };
  storage.messages.set([...storage.messages.get(), message]);
  await broadcastMessage(message, "ALL");
  await postCloudMessage(OBR.room.id, message).catch(() => undefined);
  if (!gmOnly) await showRollOnMap(characterId, title, result.total);
}
