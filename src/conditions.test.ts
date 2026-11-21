import { expect, it } from "vitest";
import { CONCENTRATION_RULE, CONDITIONS, EFFECT_PRESETS, conditionModifiers, withExhaustion, EXHAUSTION_LEVELS, conditionRoll, conditionRule, effectRule, rollSources, exhaustionLevel, startConcentration, type D20Roll } from "./conditions";
import { combineModes } from "./dice";
import { MODIFIER_TARGETS, ROLL_MODE_TARGETS } from "./effects";

it("le 15 condizioni 2024 hanno una regola, trovata anche in minuscolo", () => {
  expect(CONDITIONS).toHaveLength(15);
  expect(conditionRule("poisoned")).toContain("svantaggio ai tiri per colpire");
  expect(conditionRule("Avvelenato")).toBe(conditionRule("Poisoned"));
  expect(conditionRule("Bless")).toBeUndefined();
});

it("le condizioni cambiano i tiri di chi le ha: vantaggio, svantaggio, fallimento e Exhaustion", () => {
  const title = (names: string[], roll: D20Roll) => conditionRoll(names.map((name, index) => ({ id: String(index), name })), roll, "T", "1d20+2").title;
  expect(title(["Poisoned", "restrained"], "attack")).toBe("T · svantaggio (Poisoned, restrained)");
  expect(title(["Poisoned"], "check:wisdom")).toBe("T · svantaggio (Poisoned)");
  expect(title(["Restrained"], "save:dexterity")).toBe("T · svantaggio (Restrained)");
  expect(title(["Restrained", "Prone", "Blinded", "Charmed", "Deafened", "Grappled"], "save:wisdom")).toBe("T");
  expect(title(["Frightened"], "initiative")).toBe("T · svantaggio (Frightened)");
  expect(title(["Incapacitated"], "initiative")).toBe("T · svantaggio (Incapacitated)");
  expect(title(["Incapacitated"], "check:dexterity")).toBe("T");
  expect(title(["Invisible"], "attack")).toBe("T · vantaggio (Invisible)");
  expect(title(["Stunned"], "save:strength")).toBe("T · fallisce (Stunned)");
  expect(title(["Unconscious"], "initiative")).toBe("T · svantaggio (Unconscious)");
  expect(title(["Paralyzed", "Petrified"], "save:wisdom")).toBe("T");
  // Effetti spenti o scaduti non contano.
  expect(conditionRoll([{ id: "x", name: "Prone", active: false }, { id: "o", name: "Restrained", remainingRounds: 0 }], "attack", "T", "1d20").title).toBe("T");

  expect(conditionRoll([{ id: "p", name: "Prone" }], "attack", "Ascia", "1d20+5", "advantage")).toEqual({ title: "Ascia · svantaggio (Prone)", formula: "1d20+5", mode: ["advantage", "disadvantage"] });
  expect(conditionRoll([{ id: "e", name: "Exhaustion 2" }, { id: "i", name: "Invisible" }], "attack", "Ascia", "1d20+5")).toEqual({ title: "Ascia · vantaggio (Invisible) · Indebolimento 2 (−4)", formula: "1d20+5-4[EXH]", mode: ["advantage"] });
  expect(conditionRoll([{ id: "e", name: "exhaustion" }], "save:wisdom", "TS", "1d20").formula).toBe("1d20-2[EXH]");
  expect(exhaustionLevel("Exhaustion 3")).toBe(3);
  expect(exhaustionLevel("Exhaustive")).toBe(0);
  // Exhaustion 1-6 tra i suggerimenti, ognuna con le penalità del suo livello in testa alla regola.
  expect(EXHAUSTION_LEVELS).toEqual(["Indebolimento 1", "Indebolimento 2", "Indebolimento 3", "Indebolimento 4", "Indebolimento 5", "Indebolimento 6"]);
  expect(exhaustionLevel("Indebolimento 4")).toBe(4);
  expect(conditionRule("Indebolimento 3")).toMatch(/^Indebolimento livello 3\. I tuoi tiri d20 diminuiscono di 6 e la velocità di 4,5 m\.\nLivelli\./);
  expect(conditionRule("Exhaustion 6")).toMatch(/^Indebolimento livello 6\. Muori\.\n/);
  expect(conditionRule("Exhaustion")).toMatch(/^Livelli\./);

  expect(combineModes("advantage", ["advantage", "disadvantage"])).toBe("normal");
  expect(combineModes(undefined, ["disadvantage"])).toBe("disadvantage");
  expect(combineModes("normal", "advantage")).toBe("advantage");
});

it("la concentrazione è una sola: la nuova sostituisce la vecchia, gli altri effetti restano", () => {
  const bless = startConcentration([{ id: "p", name: "Poisoned", active: true, modifiers: [] }], "Bless");
  expect(bless).toMatchObject([{ name: "Poisoned" }, { name: "Concentrazione: Bless", active: true, description: CONCENTRATION_RULE }]);
  expect(startConcentration([...bless, { id: "m", name: "concentrazione", active: true, modifiers: [] }], "Hold Person").map((effect) => effect.name)).toEqual(["Poisoned", "Concentrazione: Hold Person"]);
  expect(effectRule("Concentrazione")).toBe(CONCENTRATION_RULE);
  expect(CONCENTRATION_RULE).toContain("massimo di 30");
  expect(effectRule("Poisoned")).toContain("svantaggio");
  expect(effectRule("Bless")).toBe(effectRule("Benedizione"));
  expect(effectRule("Anello")).toBeUndefined();
});

it("i modificatori adv:/dis: degli effetti danno vantaggio e svantaggio ai tiri scelti", () => {
  const effects = [{ id: "a", name: "Bless", active: true, modifiers: [{ id: "m", target: "adv:skill:stealth", amount: 0 }, { id: "n", target: "dis:save", amount: 0 }] }, { id: "b", name: "Faerie Fire", active: true, modifiers: [{ id: "o", target: "adv:check:dexterity", amount: 0 }] }];
  expect(conditionRoll(effects, "check:dexterity:stealth", "Furtività", "1d20+2").mode).toEqual(["advantage"]);
  expect(conditionRoll(effects, "check:dexterity:stealth", "Furtività", "1d20+2").title).toBe("Furtività · vantaggio (Bless, Faerie Fire)");
  expect(conditionRoll(effects, "check:dexterity:acrobatics", "Acrobazia", "1d20").title).toBe("Acrobazia · vantaggio (Faerie Fire)");
  expect(conditionRoll(effects, "initiative", "Iniziativa", "1d20").mode).toEqual(["advantage"]);
  expect(conditionRoll(effects, "save:wisdom", "TS", "1d20").mode).toEqual(["disadvantage"]);
  expect(conditionRoll(effects, "attack", "Ascia", "1d20").mode).toEqual([]);
  expect(conditionRoll([{ ...effects[0], active: false }], "save:wisdom", "TS", "1d20").mode).toEqual([]);
});

it("gli effetti pronti hanno descrizione, e i modificatori puntano a voci esistenti", () => {
  expect(effectRule("Ira")).toContain("barbaro");
  for (const preset of EFFECT_PRESETS) for (const mod of preset.modifiers) expect([...MODIFIER_TARGETS, ...ROLL_MODE_TARGETS].map(([value]) => value)).toContain(mod.target);
});

it("le condizioni hanno i loro modificatori; se l'effetto ne ha di suoi, valgono quelli", () => {
  expect(conditionModifiers("poisoned").map((mod) => mod.target)).toEqual(["dis:attack", "dis:check"]);
  expect(conditionModifiers("Charmed")).toEqual([]);
  const poisoned = { id: "p", name: "Poisoned", active: true, modifiers: [{ id: "m", target: "dis:attack", amount: 0 }] };
  expect(conditionRoll([poisoned], "attack", "Ascia", "1d20").mode).toEqual(["disadvantage"]);
  expect(conditionRoll([poisoned], "check:wisdom", "Saggezza", "1d20").mode).toEqual([]);
  expect(conditionRoll([{ ...poisoned, name: "Stunned", modifiers: [] }], "save:dexterity", "TS", "1d20").title).toBe("TS · fallisce (Stunned)");
});

it("una condizione salvata dal popup senza modificatori non ha più quelli predefiniti; una vecchia sì", () => {
  const prone = { id: "p", name: "Prono", active: true, modifiers: [] };
  expect(conditionRoll([prone], "attack", "Ascia", "1d20").mode).toEqual(["disadvantage"]);
  expect(conditionRoll([{ ...prone, edited: true as const }], "attack", "Ascia", "1d20").mode).toEqual([]);
});

it("i pallini dell'Indebolimento tengono un solo effetto acceso col livello scelto, e a 0 lo tolgono", () => {
  const poisoned = { id: "p", name: "Avvelenato", active: true, modifiers: [] };
  const old = { id: "x", name: "Exhaustion 1", active: false, modifiers: [] };
  const three = withExhaustion([poisoned, old], 3);
  expect(three.map((effect) => [effect.id, effect.name, effect.active])).toEqual([["p", "Avvelenato", true], ["x", "Indebolimento 3", true]]);
  expect(three[1].description).toMatch(/^Indebolimento livello 3\./);
  expect(withExhaustion(three, 0)).toEqual([poisoned]);
});

it("i tratti danno vantaggio ai tiri come gli effetti: TS contro la morte, concentrazione, TS di caratteristica", () => {
  const sheet = { effects: [], traits: [
    { id: "durable", name: "Durable", modifiers: [{ id: "a", target: "adv:save:death", amount: 0 }] },
    { id: "war", name: "War Caster", modifiers: [{ id: "b", target: "adv:save:concentration", amount: 0 }] },
    { id: "gnome", name: "Gnomish Cunning", modifiers: [{ id: "c", target: "adv:save:wisdom", amount: 0 }] },
    { id: "tough", name: "Tough", modifiers: [{ id: "d", target: "hpMax", amount: 2 }] },
  ] };
  expect(rollSources(sheet).map((source) => source.name)).toEqual(["Durable", "War Caster", "Gnomish Cunning"]);
  expect(conditionRoll(rollSources(sheet), "save:death", "TS contro la morte", "1d20")).toMatchObject({ title: "TS contro la morte · vantaggio (Durable)", mode: ["advantage"] });
  expect(conditionRoll(rollSources(sheet), "save:concentration", "TS concentrazione", "1d20").mode).toEqual(["advantage"]);
  expect(conditionRoll(rollSources(sheet), "save:constitution", "TS Costituzione", "1d20").mode).toEqual([]);
  expect(conditionRoll(rollSources(sheet), "save:wisdom", "TS Saggezza", "1d20").mode).toEqual(["advantage"]);
  // Un vantaggio a tutti i TS di Costituzione vale anche per la concentrazione.
  expect(conditionRoll([{ id: "e", name: "Bear", modifiers: [{ id: "f", target: "adv:save:constitution", amount: 0 }] }], "save:concentration", "T", "1d20").mode).toEqual(["advantage"]);
});

it("il vantaggio contro una condizione è solo un promemoria nel titolo dei TS", () => {
  const dwarf = rollSources({ traits: [{ id: "dw", name: "Dwarven Resilience", modifiers: [{ id: "p", target: "adv:against:poisoned", amount: 0 }] }] });
  expect(conditionRoll(dwarf, "save:constitution", "TS Costituzione", "1d20+2")).toEqual({ title: "TS Costituzione · vantaggio se contro Avvelenato (Dwarven Resilience)", formula: "1d20+2", mode: [] });
  expect(conditionRoll(dwarf, "check:strength", "Prova", "1d20").title).toBe("Prova");
  expect(conditionRoll(dwarf, "save:death", "TS contro la morte", "1d20").title).toBe("TS contro la morte");
  expect(conditionRoll(dwarf, "save:concentration", "TS concentrazione", "1d20").title).toBe("TS concentrazione");
  expect(ROLL_MODE_TARGETS.map(([target]) => target)).toEqual(expect.arrayContaining(["adv:save:death", "adv:save:concentration", "adv:against:poisoned", "dis:against:charmed"]));
  expect(ROLL_MODE_TARGETS.some(([target]) => target === "adv:against:exhaustion")).toBe(false);
});
