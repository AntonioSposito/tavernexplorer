import { expect, it } from "vitest";
import { armorClass, effectiveSheet, modifierSources, setManualArmorClass } from "./effects";
import { importRoll20 } from "./importer";
import { actionFromItem, parseItemModifiers } from "./itemModifiers";

it("legge il campo Modifiers degli oggetti Roll20", () => {
  const { modifiers, unknown } = parseItemModifiers("Item Type: Light Armor, AC 11, AC +1, Strength +2, Wisdom Save -1, Saving Throws +1, Sleight of Hand +3, Volare +5");
  expect(modifiers.map(({ target, amount }) => `${target} ${amount}`)).toEqual([
    "ac 1", "ability:strength 2", "save:wisdom -1",
    "save:strength 1", "save:dexterity 1", "save:constitution 1", "save:intelligence 1", "save:wisdom 1", "save:charisma 1",
    "skill:sleight_of_hand 3",
  ]);
  expect(unknown).toEqual(["Volare +5"]);
});

it("non conta due volte i modificatori già sommati da Roll20 e segue lo stato attuale degli oggetti", () => {
  const sheet = importRoll20({ character: { name: "Eroe" }, normalized: {
    identity: { character_name: "Eroe" }, combat: { ac: 15 },
    inventory: [
      { name: "Anello di protezione", equipped: true, modifiers: "AC +1", _rowid: "ring" },
      { name: "Scudo", equipped: false, modifiers: "AC +2", _rowid: "shield" },
    ],
  } });
  expect(effectiveSheet(sheet).combat.ac).toBe(15);
  sheet.inventory[1].equipped = true;
  expect(effectiveSheet(sheet).combat.ac).toBe(17);
  expect(modifierSources(sheet, "ac")).toEqual([{ name: "Anello di protezione", amount: 1 }, { name: "Scudo", amount: 2 }]);
  sheet.inventory = sheet.inventory.filter((item) => item.id !== "ring");
  expect(effectiveSheet(sheet).combat.ac).toBe(16);
});

it("CA automatica come Roll20: armatura + DES con limiti, scudo e base senza armatura", () => {
  const sheet = importRoll20({ character: { name: "Eroe" }, normalized: {
    identity: { character_name: "Eroe" }, combat: { ac: 99 }, abilities: { dexterity: { score: 18, mod: 4 } },
    inventory: [
      { name: "Cuoio", equipped: true, modifiers: "Item Type: Light Armor, AC 11", _rowid: "leather" },
      { name: "Mezza armatura", equipped: false, modifiers: "Item Type: Medium Armor, AC 15", _rowid: "half" },
      { name: "Scudo", equipped: true, modifiers: "Item Type: Shield, AC 2", _rowid: "shield" },
    ],
  } });
  sheet.combat.acMode = "auto";
  expect(armorClass(sheet).parts).toEqual([{ name: "Cuoio", amount: 11 }, { name: "DES", amount: 4 }, { name: "Scudo", amount: 2 }]);
  expect(effectiveSheet(sheet).combat.ac).toBe(17);
  sheet.inventory[1].equipped = true;
  expect(effectiveSheet(sheet).combat.ac).toBe(19);
  sheet.inventory.forEach((item) => { item.equipped = false; });
  sheet.combat.acBase = 13;
  expect(effectiveSheet(sheet).combat.ac).toBe(17);
});

it("CA manuale scritta: gli oggetti equipaggiati ora sono compresi, i cambi successivi si sommano", () => {
  const sheet = importRoll20({ character: { name: "Eroe" }, normalized: { identity: { character_name: "Eroe" }, combat: { ac: 15 }, inventory: [{ name: "Anello", equipped: false, modifiers: "AC +1", _rowid: "ring" }] } });
  sheet.inventory[0].equipped = true;
  setManualArmorClass(sheet, 18);
  expect(effectiveSheet(sheet).combat.ac).toBe(18);
  sheet.inventory[0].equipped = false;
  expect(effectiveSheet(sheet).combat.ac).toBe(17);
});

it("precompila l'azione di un'arma dalle proprietà importate da 5e.tools", () => {
  const sheet = importRoll20({ character: { name: "Eroe" }, normalized: { identity: { character_name: "Eroe" }, abilities: { strength: { score: 10, mod: 0 }, dexterity: { score: 16, mod: 3 } } } });
  const dagger = actionFromItem({ id: "d", name: "Dagger", count: 1, equipped: true, properties: "1d4 Perforante, Finesse, Light, Thrown, Gittata 20/60, Mastery: Nick" }, sheet);
  expect(dagger).toMatchObject({ name: "Dagger", range: "20/60", attack: { ability: "dexterity", bonus: 0, proficient: true }, damages: [{ dice: "1d4", ability: "dexterity", type: "Perforante", critDice: "1d4" }] });
  const sword = actionFromItem({ id: "s", name: "Longsword", count: 1, equipped: true, properties: "1d8 Tagliente (1d10 a due mani), Versatile" }, sheet);
  expect(sword).toMatchObject({ attack: { ability: "strength" }, damages: [{ dice: "1d8", ability: "strength", type: "Tagliente" }] });
  expect(actionFromItem({ id: "r", name: "Corda", count: 1, equipped: false }, sheet).damages).toEqual([]);
});
