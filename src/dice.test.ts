import { describe, expect, it, vi } from "vitest";
import { roll, sanitizeFormula, supportsRollMode } from "./dice";

describe("dice", () => {
  it("accetta la notazione supportata", () => {
    expect(sanitizeFormula(" 2d6 + 3 ")).toBe("2d6+3");
    expect(() => sanitizeFormula("2d6;alert(1)")).toThrow();
  });

  it("calcola formule con dadi e modificatori", () => {
    vi.spyOn(crypto, "getRandomValues").mockImplementation((array) => {
      (array as Uint32Array)[0] = 3;
      return array;
    });
    expect(roll("2d6+3")).toMatchObject({ total: 11, dice: [4, 4] });
    vi.restoreAllMocks();
  });

  it("riporta il d20 naturale solo per i tiri che iniziano con un d20", () => {
    vi.spyOn(crypto, "getRandomValues").mockImplementation((array) => {
      (array as Uint32Array)[0] = 18;
      return array;
    });
    expect(roll("1d20+5").natural).toBe(19);
    expect(roll("d20-1", "advantage").natural).toBe(19);
    expect(roll("2d6+3").natural).toBeUndefined();
    expect(roll("1d200").natural).toBeUndefined();
    vi.restoreAllMocks();
  });

  it("applica vantaggio ai test d20", () => {
    let value = 0;
    vi.spyOn(crypto, "getRandomValues").mockImplementation((array) => {
      (array as Uint32Array)[0] = value++ === 0 ? 4 : 14;
      return array;
    });
    expect(roll("1d20+5", "advantage")).toMatchObject({ total: 20, dice: [5, 15] });
    vi.restoreAllMocks();
  });

  it("riconosce i tiri che accettano vantaggio", () => {
    expect(supportsRollMode("1d20+5")).toBe(true);
    expect(supportsRollMode("d20+5")).toBe(true);
    expect(supportsRollMode(" 1d20 - 1 ")).toBe(true);
    expect(supportsRollMode("1d20+2[DEX]+2[PROF]")).toBe(true);
    expect(supportsRollMode("2d6+3")).toBe(false);
    expect(supportsRollMode("2d20")).toBe(false);
    expect(supportsRollMode("1d8+3;drop")).toBe(false);
  });

  it("applica vantaggio anche senza il conteggio esplicito", () => {
    let value = 0;
    vi.spyOn(crypto, "getRandomValues").mockImplementation((array) => {
      (array as Uint32Array)[0] = value++ === 0 ? 4 : 14;
      return array;
    });
    expect(roll("d20+5", "advantage")).toMatchObject({ total: 20, dice: [5, 15] });
    vi.restoreAllMocks();
  });
});
