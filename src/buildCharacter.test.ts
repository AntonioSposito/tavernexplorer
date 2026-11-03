import { expect, it } from "vitest";
import { buildCharacter, type CharacterChoices } from "./buildCharacter";
import { effectiveSheet } from "./effects";
import type { CharacterOptions } from "./fivetoolsCharacter";
import type { FiveToolsItem } from "./import5etools";
import { parseCharacterSheet } from "./tavernpack";

const item = (name: string, item: Partial<FiveToolsItem["item"]> = {}): FiveToolsItem => ({ id: `${name}|XPHB`, name, source: "XPHB", detail: "", item: { name, weight: 2, ...item } });
const ITEMS = [
  item("Chain Mail", { weight: 55, modifiersText: "Item Type: Heavy Armor, AC 16" }),
  item("Greatsword", { weight: 6, properties: "2d6 Tagliente, Heavy, Two-Handed, Mastery: Graze" }),
  item("Dagger", { weight: 1, properties: "1d4 Perforante, Finesse, Light, Thrown, Gittata 20/60" }),
  item("Dice Set", { weight: 0 }),
];

const OPTIONS: CharacterOptions = {
  classes: [
    { name: "Fighter", hitDie: 10, saves: ["strength", "constitution"], skills: { from: ["athletics", "perception"], count: 2 }, armor: ["light", "heavy", "shield"], weapons: ["simple", "martial"], tools: [], cantrips: 0, spells: 0, prepared: 0,
      equipment: [{ key: "A", items: [{ ref: "chain mail|xphb", name: "Chain Mail", quantity: 1 }, { ref: "greatsword|xphb", name: "Greatsword", quantity: 1 }], tools: [], copper: 400 }, { key: "C", items: [], tools: [], copper: 15500 }],
      features: [{ name: "Second Wind", description: "Regain HP." }] },
    { name: "Wizard", hitDie: 6, saves: ["intelligence", "wisdom"], skills: { from: ["arcana", "history", "insight"], count: 2 }, armor: [], weapons: ["simple"], tools: [], spellAbility: "intelligence", cantrips: 3, spells: 6, prepared: 4,
      equipment: [{ key: "B", items: [], tools: [], copper: 5500 }], features: [{ name: "Spellcasting", description: "Cast spells." }] },
  ],
  backgrounds: [
    { name: "Soldier", abilities: ["strength", "dexterity", "constitution"], feat: "Savage Attacker", skills: ["athletics", "intimidation"], tools: [{ kinds: ["gaming"], count: 1 }], equipment: [{ key: "A", items: [{ ref: "dagger|xphb", name: "Dagger", quantity: 2 }], tools: ["gaming"], copper: 1450 }] },
    { name: "Sage", abilities: ["constitution", "intelligence", "wisdom"], feat: "Magic Initiate (Wizard)", skills: ["arcana", "history"], tools: [{ name: "Calligrapher's Supplies" }], equipment: [{ key: "B", items: [], tools: [], copper: 5000 }] },
  ],
  species: [
    { name: "Human", sizes: ["S", "M"], speed: 30, skills: { from: ["stealth", "perception"], count: 1 }, originFeat: true, traits: [{ name: "Resourceful", description: "Heroic Inspiration." }] },
    { name: "Elf", sizes: ["M"], speed: 30, skills: { from: ["insight", "perception"], count: 1 }, originFeat: false, traits: [{ name: "Darkvision", description: "60 feet." }] },
  ],
  feats: [{ name: "Savage Attacker", description: "Reroll damage." }, { name: "Tough", description: "+2 HP per level." }, { name: "Magic Initiate", description: "Two cantrips." }],
  spells: [
    { name: "Fire Bolt", level: 0, classes: ["Wizard"], spell: { name: "Fire Bolt", level: 0, prepared: true, ritual: false, concentration: false, source: "spell" } },
    ...["Magic Missile", "Shield", "Sleep", "Mage Armor", "Detect Magic", "Feather Fall"].map((name) => ({ name, level: 1, classes: ["Wizard"], spell: { name, level: 1, prepared: false, ritual: false, concentration: false, source: "spell" } })),
  ],
};

const fighter: CharacterChoices = {
  name: "Brunhild", className: "Fighter", background: "Soldier", species: "Human",
  scores: { strength: 15, dexterity: 13, constitution: 14, intelligence: 8, wisdom: 12, charisma: 10 },
  bonuses: { strength: 2, constitution: 1 },
  classSkills: ["athletics", "perception"], speciesSkills: ["stealth"], speciesFeat: "Tough",
  classTools: [], backgroundTools: ["Dice Set"], languages: ["Dwarvish", "Giant"],
  classEquipment: "A", backgroundEquipment: "A", cantrips: [], spells: [],
};

it("Guerriero Soldato Umano: caratteristiche, competenze, PF, CA, zaino e attacchi", () => {
  const sheet = buildCharacter(fighter, OPTIONS, ITEMS);
  expect(parseCharacterSheet(sheet)).toBe(sheet);
  expect(sheet.abilities.strength).toMatchObject({ score: 17, mod: 3, save: 5, saveProficient: true });
  expect(sheet.abilities.constitution).toMatchObject({ score: 15, mod: 2, save: 4, saveProficient: true });
  // Atletica da classe e background conta una volta sola.
  expect(sheet.skills.athletics).toMatchObject({ proficient: true, bonus: 5 });
  expect(sheet.skills.intimidation).toMatchObject({ proficient: true, bonus: 2 });
  expect(sheet.skills.stealth).toMatchObject({ proficient: true, bonus: 3 });
  expect(sheet.identity).toMatchObject({ className: "Fighter", level: 1, race: "Human", background: "Soldier" });
  expect(sheet.combat.hitDice).toMatchObject({ max: 1, die: "d10" });
  // d10 + COS 2, più Tough +2.
  expect(sheet.combat.hp).toEqual({ current: 14, max: 12, temp: 0 });
  const view = effectiveSheet(sheet);
  expect(view.combat.hp.max).toBe(14);
  expect(view.combat.ac).toBe(16);
  expect(sheet.combat.speed).toBe("9 m");
  expect(sheet.inventory.map((entry) => [entry.name, entry.count, entry.equipped])).toEqual([["Chain Mail", 1, true], ["Greatsword", 1, false], ["Dagger", 2, false], ["Dice Set", 1, false]]);
  expect(sheet.currency).toMatchObject({ gp: 18, sp: 5, cp: 0 });
  expect(sheet.actions.map((action) => action.name)).toEqual(["Greatsword", "Dagger"]);
  expect(sheet.tools?.map((tool) => tool.name)).toEqual(["Dice Set"]);
  expect(sheet.proficiencies?.map((entry) => entry.name)).toEqual(["Common", "Dwarvish", "Giant", "light armor", "heavy armor", "Shields", "simple weapons", "martial weapons"]);
  expect(sheet.traits.map((entry) => [entry.name, entry.sourceKind])).toEqual([["Second Wind", "Class"], ["Resourceful", "Racial"], ["Savage Attacker", "Feat"], ["Tough", "Feat"]]);
  expect(sheet.spells).toEqual([]);
});

it("Mago Saggio Elfo: CD, slot e libro degli incantesimi con 4 preparati", () => {
  const sheet = buildCharacter({
    ...fighter, name: "Elara", className: "Wizard", background: "Sage", species: "Elf", speciesFeat: undefined,
    scores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 15, wisdom: 12, charisma: 10 },
    bonuses: { intelligence: 2, wisdom: 1 }, classSkills: ["insight", "history"], speciesSkills: ["perception"], backgroundTools: [],
    classEquipment: "B", backgroundEquipment: "B",
    cantrips: ["Fire Bolt"], spells: ["Magic Missile", "Shield", "Sleep", "Mage Armor", "Detect Magic", "Feather Fall"],
  }, OPTIONS, ITEMS);
  expect(sheet.abilities.intelligence).toMatchObject({ score: 17, mod: 3, save: 5 });
  expect(sheet.spellcasting).toMatchObject({ ability: "intelligence", saveDc: 13, attackBonus: 5, slots: { level_1: { total: 2, used: 0 } } });
  // d6 + COS 1.
  expect(sheet.combat.hp.max).toBe(7);
  expect(sheet.spells.map((spell) => [spell.name, spell.prepared])).toEqual([["Fire Bolt", true], ["Magic Missile", true], ["Shield", true], ["Sleep", true], ["Mage Armor", true], ["Detect Magic", false], ["Feather Fall", false]]);
  expect(sheet.tools?.map((tool) => tool.name)).toEqual(["Calligrapher's Supplies"]);
  expect(sheet.currency.gp).toBe(105);
  expect(sheet.traits.find((entry) => entry.sourceKind === "Feat")).toMatchObject({ name: "Magic Initiate", description: "Two cantrips." });
});

it("punteggi oltre 20 si fermano a 20 e senza classe valida dà errore", () => {
  expect(buildCharacter({ ...fighter, scores: { ...fighter.scores, strength: 19 }, bonuses: { strength: 2 } }, OPTIONS, ITEMS).abilities.strength.score).toBe(20);
  expect(() => buildCharacter({ ...fighter, className: "Nessuna" }, OPTIONS, ITEMS)).toThrow("Scegli classe");
});

it("lo stesso oggetto da classe e background diventa una riga con la quantità sommata", () => {
  const options = structuredClone(OPTIONS);
  options.classes[0].equipment[0].items.push({ ref: "dagger|xphb", name: "Dagger", quantity: 1 });
  const sheet = buildCharacter(fighter, options, ITEMS);
  expect(sheet.inventory.filter((entry) => entry.name === "Dagger").map((entry) => entry.count)).toEqual([3]);
});
