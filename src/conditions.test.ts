import { expect, it } from "vitest";
import { CONDITIONS, conditionRule } from "./conditions";

it("le 15 condizioni 2024 hanno una regola, trovata anche in minuscolo", () => {
  expect(CONDITIONS).toHaveLength(15);
  expect(conditionRule("poisoned")).toContain("Disadvantage on attack rolls");
  expect(conditionRule("Bless")).toBeUndefined();
});
