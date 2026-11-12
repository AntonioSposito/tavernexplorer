import { describe, expect, it } from "vitest";
import { coinsText, coinsValue, earnCoins, spendCoins } from "./coins";

const purse = (cp = 0, sp = 0, ep = 0, gp = 0, pp = 0) => ({ cp, sp, ep, gp, pp });

describe("monete", () => {
  it("toglie le monete che ci sono", () => expect(spendCoins(purse(5, 0, 0, 10), { gp: 3, cp: 2 })).toEqual(purse(3, 0, 0, 7)));
  it("cambia una moneta più grande", () => expect(spendCoins(purse(0, 0, 0, 2), { sp: 3 })).toEqual(purse(0, 7, 0, 1)));
  it("cambia anche saltando un tipo", () => expect(spendCoins(purse(0, 0, 0, 0, 1), { cp: 1 })).toEqual(purse(9, 9, 0, 9, 0)));
  it("cambia in electrum solo se si spende electrum", () => expect(spendCoins(purse(0, 0, 0, 3), { ep: 1 })).toEqual(purse(0, 0, 1, 2)));
  it("paga con monete più piccole", () => expect(spendCoins(purse(50, 20, 1), { gp: 1 })).toEqual(purse(50, 15, 0)));
  it("rifiuta se il totale non basta", () => expect(spendCoins(purse(0, 0, 0, 1), { gp: 2 })).toBeNull());
  it("conserva il valore", () => {
    const before = purse(13, 7, 3, 4, 1);
    expect(coinsValue(spendCoins(before, { ep: 5, sp: 9 })!)).toBe(coinsValue(before) - 340);
  });
  it("aggiunge e descrive", () => {
    expect(earnCoins(purse(1), { gp: 5 })).toEqual(purse(1, 0, 0, 5));
    expect(coinsText({ gp: 5, cp: 2 })).toBe("5 mo, 2 mr");
  });
});
