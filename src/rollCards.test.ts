import { describe, expect, it } from "vitest";
import { buildRollCard, describeRoll, labeledBonus } from "./rollCards";

const attack = { critRange: 19, damage: "5", critDamage: "9", damageType: "Tagliente", subtitle: "Gittata 1,5 m", save: { ability: "Destrezza", dc: 13, effect: "dimezza" }, description: "Lama" };

describe("formule etichettate", () => {
  it("labeledBonus salta gli zeri e mette il resto in BONUS", () => {
    expect(labeledBonus([[2, "DEX"], [2, "PROF"], [0, "MAGIC"]], 5)).toBe("+2[DEX]+2[PROF]+1[BONUS]");
    expect(labeledBonus([[-1, "STR"]], -1)).toBe("-1[STR]");
  });

  it("describeRoll scompone dadi e modificatori", () => {
    expect(describeRoll("1d20+2[DEX]+2[PROF]", [10])).toBe("Roll 1d20 + 2[DEX] + 2[PROF] = (10) + 2 + 2");
    expect(describeRoll("1d8+1d8-1[STR]", [5, 4])).toBe("Roll 1d8 + 1d8 - 1[STR] = (5) + (4) - 1");
    expect(describeRoll("2d6", [3, 4])).toBe("Roll 2d6 = (3 + 4)");
  });
});

describe("buildRollCard", () => {
  it("prova semplice: d20 etichettato, nessun danno", () => {
    const { card, title } = buildRollCard("Atletica", "1d20+3", { formula: "1d20+3", total: 15, dice: [12], natural: 12 }, "normal");
    expect(title).toBe("Atletica");
    expect(card.d20).toEqual({ label: "Tiro", formula: "1d20+3", dice: [12], modifier: 3, kept: 0, mode: "normal", critRange: 20 });
    expect(card.rolls).toEqual([]);
  });

  it("attacco con vantaggio: tiene entrambi i d20 e tira il danno", () => {
    const { card, body } = buildRollCard("Spada", "1d20+5", { formula: "2d20kh1+5", total: 16, dice: [4, 11], natural: 11 }, "advantage", attack);
    expect(card.d20).toMatchObject({ label: "Colpire", dice: [4, 11], modifier: 5, kept: 1, critRange: 19 });
    expect(card.rolls).toEqual([{ label: "Danno", formula: "5", total: 5, dice: [], type: "Tagliente", critical: false }]);
    expect(card).toMatchObject({ subtitle: "Gittata 1,5 m", save: attack.save, description: "Lama" });
    expect(body).toBe("2d20kh1+5 → 16 · Danno 5 → 5 Tagliente");
  });

  it("critico nella gamma estesa usa il danno critico", () => {
    const { card, title } = buildRollCard("Spada", "1d20+5", { formula: "1d20+5", total: 24, dice: [19], natural: 19 }, "normal", attack);
    expect(title).toBe("Spada — CRITICO!");
    expect(card.rolls[0]).toMatchObject({ label: "Danno critico", total: 9, critical: true });
  });

  it("1 naturale: niente danno e nota di mancato", () => {
    const { card, title } = buildRollCard("Spada", "1d20+5", { formula: "1d20+5", total: 6, dice: [1], natural: 1 }, "normal", attack);
    expect(title).toBe("Spada — 1 naturale, mancato");
    expect(card.rolls).toEqual([]);
    expect(card.note).toBeTruthy();
  });

  it("tiro di danno senza d20", () => {
    const { card } = buildRollCard("Spada", "1d8+3[STR]", { formula: "1d8+3", total: 7, dice: [4] }, "normal", attack);
    expect(card.d20).toBeUndefined();
    expect(card.rolls).toEqual([{ label: "Danno", formula: "1d8+3[STR]", total: 7, dice: [4], type: "Tagliente" }]);
  });
});
