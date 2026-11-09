import { expect, it } from "vitest";
import { resolveCopies } from "./fivetoolsCopy";
import { import5eToolsMonsters } from "./import5etools";

const noble = {
  name: "Noble", source: "MM", ac: [{ ac: 15, from: ["{@item breastplate|phb}"] }], hp: { average: 9, formula: "2d8" }, speed: { walk: 30 }, hasToken: true,
  str: 11, dex: 12, con: 11, int: 12, wis: 14, cha: 16, cr: "1/8",
  action: [{ name: "Rapier", entries: ["The noble attacks with a rapier."] }],
  reaction: [{ name: "Parry", entries: ["The noble adds 2 to its AC."] }],
};

it("una copia prende CA, velocità e azioni dall'originale di un altro manuale e applica le modifiche", async () => {
  const ireena = {
    name: "Ireena Kolyana", source: "CoS", hp: { average: 14, formula: "2d8" },
    _copy: { name: "Noble", source: "MM", _mod: { "*": { mode: "replaceTxt", replace: "the noble", with: "Ireena", flags: "i" }, action: { mode: "appendArr", items: { name: "Dagger", entries: ["Stab."] } }, reaction: "remove" } },
  };
  const asked: string[] = [];
  const [resolved] = await resolveCopies([ireena], async (name, source) => { asked.push(`${name}|${source}`); return name === "Noble" ? structuredClone(noble) : undefined; });
  expect(asked).toEqual(["Noble|MM"]);
  const [monster] = import5eToolsMonsters({ monster: [resolved] });
  expect(monster).toMatchObject({ name: "Ireena Kolyana", source: "CoS", ac: 15, speed: "30 ft.", hp: { average: 14 }, challengeRating: "1/8", reactions: [], importWarnings: [] });
  expect(monster.actions.map((action) => [action.name, action.description])).toEqual([["Rapier", "Ireena attacks with a rapier."], ["Dagger", "Stab."]]);
  // Il token dell'originale ha un altro nome: la copia non lo eredita.
  expect(monster.image).toBeUndefined();
});

it("copia nello stesso file, originale mancante e modifiche non gestite finiscono negli avvisi", async () => {
  const resolved = await resolveCopies([
    noble,
    { name: "Noble Twin", source: "MM", _copy: { name: "Noble", source: "MM", _mod: { skill: { mode: "addSkills", skills: { perception: 1 } } } } },
    { name: "Ghost Copy", source: "XX", _copy: { name: "Missing", source: "XX" } },
  ], async () => undefined);
  const [, twin, ghost] = import5eToolsMonsters({ monster: resolved });
  expect(twin).toMatchObject({ ac: 15, speed: "30 ft." });
  expect(twin.importWarnings).toEqual([expect.stringContaining('"addSkills"')]);
  expect(ghost.importWarnings).toEqual([expect.stringContaining("Missing (XX) non trovata")]);
});
