import { expect, it } from "vitest";
import { metersText, speedMeters, speedSquares } from "./speed";

it("legge i metri dal testo della velocità, piedi convertiti", () => {
  expect(speedMeters("9 m")).toBe(9);
  expect(speedMeters("7,5m")).toBe(7.5);
  expect(speedMeters("30 ft.")).toBe(9);
  expect(speedMeters("")).toBeNull();
});

it("quadretti interi da 1,5 m", () => {
  expect(speedSquares(9)).toBe(6);
  expect(speedSquares(10)).toBe(6);
  expect(speedSquares(4.5)).toBe(3);
  expect(metersText(6 * 1.5)).toBe("9 m");
});
