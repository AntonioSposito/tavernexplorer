// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { importRoll20 } from "./importer";
import { createTavernPack, parseCharacterSheet, parseTavernPack } from "./tavernpack";

const pack = () => ({ format: "tavernpack", formatVersion: "1.0.0", data: { characters: [], monsters: [], campaigns: [], sharedInventory: [], notes: [] } });

describe("TavernPack validation", () => {
  it("accetta un backup vuoto valido, anche con le note del vecchio formato", () => {
    expect(parseTavernPack(pack()).data.characters).toEqual([]);
  });

  it("rifiuta un backup incompleto prima di sostituire i dati", () => {
    expect(() => parseTavernPack({ ...pack(), data: { characters: [] } })).toThrow("TavernPack: mostri");
    expect(() => parseTavernPack({ ...pack(), data: { ...pack().data, characters: [{ id: "broken" }] } })).toThrow("TavernPack: schede");
  });

  it("conserva l'arma delle azioni e le armi di Weapon Mastery nel round trip della scheda", () => {
    const sheet = importRoll20({ character: { name: "Ada" }, normalized: { identity: { character_name: "Ada" } } });
    sheet.actions = [{ id: "a", name: "Maglio", weapon: "Maul" }];
    sheet.options = { weaponMasteries: ["Maul"] };
    const parsed = parseCharacterSheet(JSON.parse(JSON.stringify(sheet)));
    expect([parsed.actions[0].weapon, parsed.options?.weaponMasteries]).toEqual(["Maul", ["Maul"]]);
  });

  it("rifiuta una scheda JSON parziale", () => {
    expect(() => parseCharacterSheet({ schemaVersion: 1, id: "x", name: "X" })).toThrow("scheda: identità");
  });
});

it("le avventure non ci sono più: i backup vecchi che le hanno si importano, i nuovi le salvano vuote", () => {
  const old = pack();
  old.data.campaigns = [{ id: "c", title: "Curse of Strahd", chapters: [{ id: "x", title: "Capitolo", body: "…", images: [], children: [] }] }] as never[];
  expect(() => parseTavernPack(old)).not.toThrow();
  const { data } = parseTavernPack({ ...pack(), data: { characters: [], monsters: [], sharedInventory: [] } });
  expect(data.characters).toEqual([]);
  expect(createTavernPack({ characters: [], monsters: [], sharedInventory: [] }).data.campaigns).toEqual([]);
});
