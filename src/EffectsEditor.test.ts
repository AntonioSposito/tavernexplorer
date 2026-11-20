import { expect, it } from "vitest";
import { named } from "./EffectsEditor";

const targets = (effect: ReturnType<typeof named>) => effect.modifiers.map((mod) => mod.target);

it("cambiando nome, modificatori e round seguono il nuovo effetto finché non li cambi a mano", () => {
  const poisoned = named({ id: "e", name: "", active: true, modifiers: [] }, "Poisoned");
  expect(targets(poisoned)).toEqual(["dis:attack", "dis:check"]);
  const haste = named(poisoned, "Velocità");
  expect(targets(haste)).toEqual(["ac", "adv:save:dexterity"]);
  expect(haste.remainingRounds).toBe(10);
  const custom = named(haste, "Mio effetto");
  expect(custom.modifiers).toEqual([]);
  expect(custom.remainingRounds).toBeUndefined();
  const edited = { ...poisoned, modifiers: [poisoned.modifiers[0]], remainingRounds: 3 };
  expect(named(edited, "Invisible")).toMatchObject({ modifiers: edited.modifiers, remainingRounds: 3 });
});

it("scelto dal menu Effetto pronto, l'effetto sostituisce sempre modificatori e round", () => {
  const edited = { ...named({ id: "e", name: "", active: true, modifiers: [] }, "Avvelenato"), remainingRounds: 3 };
  edited.modifiers = [edited.modifiers[0]];
  const haste = named(edited, "Velocità", true);
  expect(haste.modifiers.map((mod) => mod.target)).toEqual(["ac", "adv:save:dexterity"]);
  expect(haste.remainingRounds).toBe(10);
});
