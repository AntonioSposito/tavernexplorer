import OBR from "@owlbear-rodeo/sdk";
import { EXTENSION_ID } from "./constants";
import { roll, type RollResult } from "./dice";
import { initiativeRoll } from "./initiative";
import { postCloudMessages } from "./cloudMessages";
import { broadcastMessage, showRollsOnMap } from "./obr";
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
// "ALL" perché chi invia (menu del token o popover) non è la finestra della chat. Tutti i tiri insieme: una lettura del
// giocatore, una richiesta al cloud e una scrittura sulla mappa; un avviso che non parte non blocca gli altri.
export async function announceInitiatives(rolled: InitiativeRolled[]): Promise<void> {
  if (!rolled.length) return;
  const [authorId, playerName] = await Promise.all([OBR.player.getId(), OBR.player.getName()]);
  const messages = rolled.map(({ name, characterId, formula, mode, result, gmOnly }): ChatMessage => {
    const { card, title, body } = buildRollCard("Iniziativa", formula, result, mode);
    return {
      id: crypto.randomUUID(), kind: "roll", author: name, authorId, playerName, characterId,
      // gmOnly: tiro di un mostro (card blu).
      title, body, card: gmOnly ? { ...card, monster: true } : card, formula: result.formula, total: result.total, dice: result.dice, visibility: gmOnly ? "gm" : "everyone", createdAt: Date.now(),
    };
  });
  storage.messages.set([...storage.messages.get(), ...messages]);
  for (const message of messages) await broadcastMessage(message, "ALL").catch(() => undefined);
  await postCloudMessages(OBR.room.id, messages).catch(() => undefined);
  await showRollsOnMap(rolled.flatMap((roll, index) => roll.gmOnly ? [] : [{ characterId: roll.characterId, label: messages[index].title ?? "", total: roll.result.total }]));
}
