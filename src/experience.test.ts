import { expect, it } from "vitest";
import { levelForXp, parseXp, xpProgress, xpShare } from "./experience";

it("legge i PE scritti come testo, anche con separatori o vuoti", () => {
  expect([parseXp("2.450"), parseXp("2,450"), parseXp(""), parseXp("abc")]).toEqual([2450, 2450, 0, 0]);
});

it("dice la soglia del livello dopo e per quale livello i PE bastano", () => {
  expect(levelForXp(0)).toBe(1);
  expect(levelForXp(6500)).toBe(5);
  expect(xpProgress(2450, 4)).toEqual({ next: 6500, readyFor: null });
  expect(xpProgress(6500, 4)).toEqual({ next: 6500, readyFor: 5 });
  expect(xpProgress(15000, 4)).toEqual({ next: 6500, readyFor: 6 });
  expect(xpProgress(400000, 20)).toEqual({ next: null, readyFor: null });
});

it("divide i PE dell'incontro per difetto, o li dà interi a ciascuno", () => {
  expect([xpShare(1000, 3, true), xpShare(1000, 3, false), xpShare(500, 0, true)]).toEqual([333, 1000, 500]);
});
