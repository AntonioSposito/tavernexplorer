import { describe, expect, it } from "vitest";
import { importRoll20 } from "./importer";
import { counterCurrent, counterFromItem, deleteCounter, linkActions, setCounterCurrent, spendCounter, unlinkCounters } from "./resources";
import { takeLongRest } from "./rest";
import { parseCharacterSheet } from "./tavernpack";

const archer = () => {
  const sheet = importRoll20({ character: { name: "Arciere" }, normalized: { identity: { character_name: "Arciere" }, combat: { hp: { current: 5, max: 10 } }, inventory: [{ name: "Frecce", count: 20, _rowid: "arrows" }] } });
  sheet.counters = [counterFromItem(sheet.inventory[0])];
  return sheet;
};

describe("risorse collegate allo zaino", () => {
  it("la risorsa creata da un oggetto parte dalla sua quantità", () => {
    const sheet = archer();
    expect(sheet.counters![0]).toMatchObject({ name: "Frecce", current: 20, max: 20, recovery: "none", itemId: sheet.inventory[0].id });
  });

  it("−/+ della risorsa cambiano la quantità e la quantità dello zaino si vede nella risorsa", () => {
    const sheet = archer();
    const counter = sheet.counters![0];
    setCounterCurrent(sheet, counter.id, 19);
    expect(sheet.inventory[0].count).toBe(19);
    sheet.inventory[0].count = 25;
    expect(counterCurrent(sheet, counter)).toBe(25);
    expect(counter.current).toBe(19);
  });

  it("il riposo ripristina anche l'oggetto e non riduce le frecce in più", () => {
    const sheet = archer();
    sheet.counters![0].recovery = "long";
    sheet.inventory[0].count = 3;
    expect(takeLongRest(sheet).sheet.inventory[0].count).toBe(20);
    sheet.inventory[0].count = 30;
    const rested = takeLongRest(sheet).sheet;
    expect(rested.inventory[0].count).toBe(30);
    expect(rested.counters![0].current).toBe(20);
  });

  it("eliminando l'oggetto la risorsa resta con l'ultima quantità", () => {
    const sheet = archer();
    sheet.inventory[0].count = 7;
    unlinkCounters(sheet, "itemId", sheet.inventory[0].id);
    sheet.inventory = [];
    expect(sheet.counters![0].itemId).toBeUndefined();
    expect(counterCurrent(sheet, sheet.counters![0])).toBe(7);
  });

  it("un'azione collegata scala la risorsa e l'oggetto, a 0 si ferma", () => {
    const sheet = archer();
    const counter = sheet.counters![0];
    sheet.actions = [{ id: "bow", name: "Arco lungo" }, { id: "dagger", name: "Pugnale", resourceId: "altra" }];
    linkActions(sheet, counter.id, ["bow"]);
    expect(sheet.actions.map((action) => action.resourceId)).toEqual([counter.id, "altra"]);
    spendCounter(sheet, counter.id);
    expect(sheet.inventory[0].count).toBe(19);
    sheet.inventory[0].count = 0;
    spendCounter(sheet, counter.id);
    expect(sheet.inventory[0].count).toBe(0);
    linkActions(sheet, counter.id, []);
    expect(sheet.actions[0].resourceId).toBeUndefined();
  });

  it("eliminando la risorsa le azioni restano senza collegamento", () => {
    const sheet = archer();
    sheet.actions = [{ id: "bow", name: "Arco lungo", resourceId: sheet.counters![0].id }];
    deleteCounter(sheet, sheet.counters![0].id);
    expect(sheet.counters).toEqual([]);
    expect(sheet.actions[0].resourceId).toBeUndefined();
  });

  it("il TavernPack accetta il collegamento", () => {
    const sheet = archer();
    expect(parseCharacterSheet(JSON.parse(JSON.stringify(sheet))).counters![0].itemId).toBe(sheet.inventory[0].id);
  });
});
