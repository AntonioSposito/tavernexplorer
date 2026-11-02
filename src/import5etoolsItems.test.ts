import { expect, it } from "vitest";
import { import5eToolsItems } from "./import5etools";

it("converte gli oggetti 5e.tools nei campi dello zaino, edizione 2024 prima", () => {
  const items = import5eToolsItems(
    { baseitem: [
      { name: "Leather Armor", source: "PHB", type: "LA", ac: 11, weight: 10, reprintedAs: ["Leather Armor|XPHB"] },
      { name: "Leather Armor", source: "XPHB", type: "LA|XPHB", ac: 11, weight: 10 },
      { name: "Shield", source: "XPHB", type: "S|XPHB", ac: 2, weight: 6 },
      { name: "Dagger", source: "XPHB", type: "M|XPHB", weight: 1, dmg1: "1d4", dmgType: "P", property: ["F|XPHB", { uid: "T|XPHB" }], range: "20/60", mastery: ["Nick|XPHB"] },
    ] },
    { item: [
      { name: "Ring of Protection", source: "XDMG", type: "RG|XDMG", rarity: "rare", bonusAc: "+1", bonusSavingThrow: "+1", entries: ["You gain a {@b +1} bonus."] },
      { name: "Copia", source: "X", _copy: { name: "Shield" } },
    ] },
  );
  expect(items.map((item) => item.id)).toEqual(["Dagger|XPHB", "Leather Armor|XPHB", "Ring of Protection|XDMG", "Shield|XPHB"]);
  expect(items.find((item) => item.name === "Leather Armor")!.item).toMatchObject({ weight: 10, modifiersText: "Item Type: Light Armor, AC 11" });
  expect(items.find((item) => item.name === "Shield")!.item.modifiersText).toBe("Item Type: Shield, AC +2");
  expect(items.find((item) => item.name === "Dagger")!.item.properties).toBe("1d4 Perforante, Finesse, Thrown, Gittata 20/60, Mastery: Nick");
  const ring = items.find((item) => item.name === "Ring of Protection")!;
  expect(ring.detail).toBe("XDMG · Ring · rare");
  expect(ring.item).toMatchObject({ weight: null, modifiersText: "AC +1, Saving Throws +1", description: "You gain a +1 bonus." });
});
