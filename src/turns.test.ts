import { describe, expect, it } from "vitest";
import { replaceTurnEntries, setTurnInitiative, stepTurn, tickSheetEffects } from "./turns";
import { createBlankSheet } from "./blankSheet";
import type { TurnEntry, TurnState } from "./types";

const first: TurnEntry = { id: "a", name: "Ada", initiative: 18 };
const second: TurnEntry = { id: "b", name: "Berto", initiative: 12 };
const state = (): TurnState => ({ round: 1, activeIndex: 1, entries: [first, second] });

describe("turn order", () => {
  it("mantiene il combattente attivo quando cambia l'iniziativa", () => {
    const next = setTurnInitiative(state(), "b", 22);
    expect(next.entries.map((entry) => entry.id)).toEqual(["b", "a"]);
    expect(next.entries[next.activeIndex].id).toBe("b");
  });

  it("sceglie un indice valido quando si rimuove il combattente attivo", () => {
    const next = replaceTurnEntries(state(), [first]);
    expect(next.activeIndex).toBe(0);
    expect(next.entries[0].id).toBe("a");
  });

  it("avanza e torna indietro tra round, senza scendere sotto il primo", () => {
    const after = stepTurn(state(), 1);
    expect(after.round).toBe(2);
    expect(after.activeIndex).toBe(0);
    expect(stepTurn(after, -1)).toMatchObject({ round: 1, activeIndex: 1 });
    expect(stepTurn({ ...state(), activeIndex: 0 }, -1)).toMatchObject({ round: 1, activeIndex: 0 });
  });

  it("scala le condizioni temporanee all'inizio del turno del bersaglio", () => {
    const start = { ...state(), activeIndex: 0 };
    const withCondition = { ...start, entries: start.entries.map((entry) => entry.id === "b" ? { ...entry, conditions: [{ id: "poison", name: "Avvelenato", remainingRounds: 2, lastTickRound: start.round }] } : entry) };
    const firstArrival = stepTurn(withCondition, 1);
    expect(firstArrival.entries[1].conditions?.[0].remainingRounds).toBe(2);
    const secondArrival = stepTurn(stepTurn(firstArrival, 1), 1);
    expect(secondArrival.entries[1].conditions?.[0].remainingRounds).toBe(1);
    expect(stepTurn(stepTurn(secondArrival, 1), 1).entries[1].conditions).toEqual([]);
    expect(stepTurn(stepTurn(secondArrival, -1), 1).entries[1].conditions?.[0].remainingRounds).toBe(1);
  });

  it("al turno del PG scendono le durate sulla scheda; uno scaduto resta spento", () => {
    const sheet = createBlankSheet("Ada");
    sheet.effects = [
      { id: "bless", name: "Benedizione", active: true, modifiers: [], remainingRounds: 2 },
      { id: "rage", name: "Ira", active: true, modifiers: [], remainingRounds: 1 },
      { id: "ring", name: "Anello", active: true, modifiers: [] },
      { id: "off", name: "Spento", active: false, modifiers: [], remainingRounds: 3 },
    ];
    const ticked = tickSheetEffects(sheet, 2)!;
    expect(ticked.effects?.map((effect) => [effect.name, effect.active, effect.remainingRounds])).toEqual([
      ["Benedizione", true, 1], ["Ira", false, undefined], ["Anello", true, undefined], ["Spento", false, 3],
    ]);
    expect(tickSheetEffects(ticked, 2)).toBeNull();
  });
});
