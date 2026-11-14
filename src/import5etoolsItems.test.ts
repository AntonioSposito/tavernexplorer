import { expect, it } from "vitest";
import { import5eToolsItems } from "./import5etools";

it("converte gli oggetti 5e.tools nei campi dello zaino, edizione 2024 prima", async () => {
  const items = await import5eToolsItems(
    { baseitem: [
      { name: "Leather Armor", source: "PHB", type: "LA", ac: 11, weight: 10, reprintedAs: ["Leather Armor|XPHB"] },
      { name: "Leather Armor", source: "XPHB", type: "LA|XPHB", ac: 11, weight: 10 },
      { name: "Shield", source: "XPHB", type: "S|XPHB", ac: 2, weight: 6 },
      { name: "Dagger", source: "XPHB", type: "M|XPHB", weight: 1, dmg1: "1d4", dmgType: "P", property: ["F|XPHB", { uid: "T|XPHB" }], range: "20/60", mastery: ["Nick|XPHB"] },
    ], itemMastery: [{ name: "Nick", source: "XPHB", entries: ["The extra attack of the {@variantrule Light|XPHB} property is part of the Attack action."] }] },
    { item: [
      { name: "Ring of Protection", source: "XDMG", type: "RG|XDMG", rarity: "rare", bonusAc: "+1", bonusSavingThrow: "+1", entries: ["You gain a {@b +1} bonus."] },
      { name: "Copia", source: "X", _copy: { name: "Shield" } },
    ] },
  );
  expect(items.map((item) => item.id)).toEqual(["Dagger|XPHB", "Leather Armor|XPHB", "Ring of Protection|XDMG", "Shield|XPHB"]);
  expect(items.find((item) => item.name === "Leather Armor")!.item).toMatchObject({ weight: 10, modifiersText: "Item Type: Light Armor, AC 11" });
  expect(items.find((item) => item.name === "Shield")!.item.modifiersText).toBe("Item Type: Shield, AC +2");
  expect(items.find((item) => item.name === "Dagger")!.item.properties).toBe("1d4 Perforante, Finesse, Thrown, Gittata 20/60, Mastery: Nick");
  expect(items.find((item) => item.name === "Dagger")!.item.description).toBe("Mastery: Nick. The extra attack of the Light property is part of the Attack action.");
  const ring = items.find((item) => item.name === "Ring of Protection")!;
  expect(ring.detail).toBe("XDMG · Ring · rare");
  expect(ring.item).toMatchObject({ weight: null, modifiersText: "AC +1, Saving Throws +1", description: "You gain a +1 bonus." });
});

it("include i gruppi (Arcane Focus) e gli oggetti copiati da un altro, con le modifiche", async () => {
  const items = await import5eToolsItems({ baseitem: [] }, {
    item: [
      { name: "Ashen Band of Courage", source: "ICC", type: "RG", rarity: "rare", reprintedAs: ["Band|XX"], entries: ["While wearing this ring, you can't be frightened.", "It glows."] },
      { name: "Ashen Band of Endless Courage", source: "ICC", _copy: { name: "Ashen Band of Courage", source: "ICC", _mod: { entries: { mode: "replaceArr", replace: { regex: "^While wearing this ring," }, items: "While wearing this ring, you are immune to Charmed." } } }, rarity: "legendary" },
      { name: "Orfano", source: "X", _copy: { name: "Assente", source: "X" } },
    ],
    itemGroup: [
      { name: "Arcane Focus", source: "PHB", type: "SCF", reprintedAs: ["Arcane Focus|XPHB"], items: ["Crystal|PHB"] },
      { name: "Arcane Focus", source: "XPHB", type: "SCF|XPHB", entries: ["A focus."], items: ["Crystal|XPHB", "Orb|XPHB"] },
    ],
  });
  expect(items.map((item) => item.id)).toEqual(["Arcane Focus|XPHB", "Ashen Band of Endless Courage|ICC"]);
  expect(items[0]).toMatchObject({ detail: "XPHB · Spellcasting Focus", item: { description: "A focus.\n\nVarianti: Crystal, Orb." } });
  expect(items[1]).toMatchObject({ detail: "ICC · Ring · legendary", item: { description: "While wearing this ring, you are immune to Charmed.\n\nIt glows." } });
});

it("un'arma magica senza maestria prende quella dell'arma di base", async () => {
  const items = await import5eToolsItems(
    { baseitem: [{ name: "Shortsword", source: "PHB", type: "M", reprintedAs: ["Shortsword|XPHB"] }, { name: "Shortsword", source: "XPHB", type: "M|XPHB", dmg1: "1d6", dmgType: "P", mastery: ["Vex|XPHB"] }], itemMastery: [{ name: "Vex", source: "XPHB", entries: ["Advantage."] }] },
    { item: [{ name: "Flame Tongue Shortsword", source: "DMG", baseItem: "shortsword|phb", type: "M", dmg1: "1d6", dmgType: "P" }] },
  );
  expect(items.find((item) => item.name === "Flame Tongue Shortsword")!.item.properties).toBe("1d6 Perforante, Mastery: Vex");
});
