import { expect, it } from "vitest";
import { parseBackgrounds, parseClass, parseOriginFeats, parseSpecies, parseSpells } from "./fivetoolsCharacter";

// Estratti dei file 5e.tools (5etools-src, data/): solo i campi letti dal parser.
const wizardFile = {
  class: [
    { name: "Wizard", source: "PHB", hd: { faces: 6 } },
    {
      name: "Wizard", source: "XPHB", hd: { number: 1, faces: 6 }, proficiency: ["int", "wis"], spellcastingAbility: "int",
      preparedSpellsProgression: [4, 5], cantripProgression: [3, 3], spellsKnownProgressionFixed: [6, 2],
      startingProficiencies: { skills: [{ choose: { from: ["arcana", "history", "insight"], count: 2 } }], weapons: ["simple"] },
      startingEquipment: { defaultData: [{ A: [{ item: "dagger|xphb", quantity: 2 }, { item: "traveler's clothes|xphb" }, { special: "Spellbook" }, { value: 500 }], B: [{ value: 5500 }] }] },
      classFeatures: ["Spellcasting|Wizard|XPHB|1", "Scholar|Wizard|XPHB|2", { classFeature: "Wizard Subclass|Wizard|XPHB|3", gainSubclassFeature: true }],
    },
  ],
  classFeature: [
    { name: "Spellcasting", source: "XPHB", className: "Wizard", level: 1, entries: ["You cast {@spell Fire Bolt|XPHB} spells."] },
    { name: "Scholar", source: "XPHB", className: "Wizard", level: 2, entries: ["Later."] },
  ],
};

it("legge una classe XPHB di livello 1", () => {
  expect(parseClass(wizardFile)).toEqual({
    name: "Wizard", hitDie: 6, saves: ["intelligence", "wisdom"], skills: { from: ["arcana", "history", "insight"], count: 2 },
    armor: [], weapons: ["simple"], tools: [], spellAbility: "intelligence", cantrips: 3, spells: 6, prepared: 4,
    equipment: [
      { key: "A", items: [{ ref: "dagger|xphb", name: "Dagger", quantity: 2 }, { ref: "traveler's clothes|xphb", name: "Traveler's Clothes", quantity: 1 }, { name: "Spellbook", quantity: 1 }], tools: [], copper: 500 },
      { key: "B", items: [], tools: [], copper: 5500 },
    ],
    features: [{ name: "Spellcasting", description: "You cast Fire Bolt spells." }],
  });
});

it("strumenti a scelta tra due categorie e abilità libere", () => {
  const monk = parseClass({ class: [{ name: "Monk", source: "XPHB", startingProficiencies: { toolProficiencies: [{ anyArtisansTool: 1 }, { anyMusicalInstrument: 1 }] }, startingEquipment: { defaultData: [{ A: [{ equipmentTypes: ["instrumentMusical", "toolArtisan"] }] }] } }] });
  expect(monk?.tools).toEqual([{ kinds: ["artisan", "instrument"], count: 1 }]);
  expect(monk?.equipment[0].tools).toEqual(["instrument", "artisan"]);
  const bard = parseClass({ class: [{ name: "Bard", source: "XPHB", startingProficiencies: { skills: [{ any: 3 }], toolProficiencies: [{ anyMusicalInstrument: 3 }] } }] });
  expect(bard?.skills.count).toBe(3);
  expect(bard?.skills.from).toHaveLength(18);
  expect(bard?.tools).toEqual([{ kinds: ["instrument"], count: 3 }]);
});

it("legge background, specie e talenti d'origine", () => {
  const [sage] = parseBackgrounds({ background: [
    { name: "Sage", source: "XPHB", ability: [{ choose: { weighted: { from: ["con", "int", "wis"], weights: [2, 1] } } }], feats: [{ "magic initiate; wizard|xphb": true }], skillProficiencies: [{ arcana: true, history: true }], toolProficiencies: [{ "calligrapher's supplies": true }], startingEquipment: [{ A: [{ value: 800 }], B: [{ value: 5000 }] }] },
    { name: "Sage", source: "PHB" },
  ] });
  expect(sage).toMatchObject({ name: "Sage", abilities: ["constitution", "intelligence", "wisdom"], feat: "Magic Initiate (Wizard)", skills: ["arcana", "history"], tools: [{ name: "Calligrapher's Supplies" }] });

  const [elf, human] = parseSpecies({ race: [
    { name: "Elf", source: "XPHB", size: ["M"], speed: 30, skillProficiencies: [{ choose: { from: ["insight", "perception", "survival"] } }], entries: [{ type: "entries", name: "Darkvision", entries: ["You see in the dark."] }] },
    { name: "Human", source: "XPHB", size: ["S", "M"], speed: 30, feats: [{ anyFromCategory: { category: ["O"], count: 1 } }], skillProficiencies: [{ any: 1 }], entries: [] },
  ] });
  expect(elf).toEqual({ name: "Elf", sizes: ["M"], speed: 30, skills: { from: ["insight", "perception", "survival"], count: 1 }, originFeat: false, traits: [{ name: "Darkvision", description: "You see in the dark." }] });
  expect(human).toMatchObject({ originFeat: true, skills: { count: 1 } });

  expect(parseOriginFeats({ feat: [{ name: "Tough", source: "XPHB", category: "O", entries: ["+2 HP per level."] }, { name: "Grappler", source: "XPHB", category: "G" }] })).toEqual([{ name: "Tough", description: "+2 HP per level." }]);
});

it("converte gli incantesimi con attacco, danno e TS calcolati dalla scheda", () => {
  const spells = parseSpells({ spell: [
    { name: "Fire Bolt", source: "XPHB", level: 0, school: "V", time: [{ number: 1, unit: "action" }], range: { type: "point", distance: { type: "feet", amount: 120 } }, components: { v: true, s: true }, duration: [{ type: "instant" }], entries: ["On a hit, {@damage 1d10} Fire damage."], damageInflict: ["fire"], spellAttack: ["R"] },
    { name: "Sleep", source: "XPHB", level: 1, school: "E", time: [{ number: 1, unit: "action" }], range: { type: "point", distance: { type: "feet", amount: 60 } }, components: { v: true, s: true, m: "a pinch of sand" }, duration: [{ type: "timed", duration: { type: "minute", amount: 1 }, concentration: true }], entries: ["Wisdom save."], savingThrow: ["wisdom"] },
    { name: "Fireball", source: "XPHB", level: 3, school: "V" },
  ] }, { xphb: { "fire bolt": { class: { XPHB: { Wizard: true, Sorcerer: true } } }, sleep: { class: { XPHB: { Wizard: true } } } } });
  expect(spells.map((spell) => [spell.name, spell.classes])).toEqual([["Fire Bolt", ["Wizard", "Sorcerer"]], ["Sleep", ["Wizard"]]]);
  expect(spells[0].spell).toMatchObject({ level: 0, prepared: true, school: "Evocation", range: "120 feet", spellAttack: "ranged", attack: { ability: "spell", proficient: true, bonus: 0 }, damages: [{ dice: "1d10", type: "Fuoco" }] });
  expect(spells[1].spell).toMatchObject({ concentration: true, duration: "Concentration, up to 1 minute", components: { material: true, materials: "a pinch of sand" }, save: { ability: "wisdom", dc: "spell" }, output: "attack" });
});
