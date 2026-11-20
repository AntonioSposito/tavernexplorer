import { expect, it } from "vitest";
import { parseBackgrounds, parseClass, parseLevelFeats, parseLevelOptions, parseOriginFeats, parseSpecies, parseSpellCatalog, parseSpells } from "./fivetoolsCharacter";

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

it("con maxLevel legge anche gli incantesimi di livello alto", () => {
  const file = { spell: [{ name: "Sleep", source: "XPHB", level: 1, school: "E" }, { name: "Fireball", source: "XPHB", level: 3, school: "V" }] };
  const lookup = { xphb: { sleep: { class: { XPHB: { Wizard: true } } }, fireball: { class: { XPHB: { Wizard: true } } } } };
  expect(parseSpells(file, lookup).map((spell) => spell.name)).toEqual(["Sleep"]);
  expect(parseSpells(file, lookup, 9).map((spell) => spell.name)).toEqual(["Sleep", "Fireball"]);
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

it("nel catalogo unisce PHB 2024 e supplementi, tenendo la versione 2024 dei doppioni", () => {
  const xphb = { spell: [{ name: "Mind Sliver", source: "XPHB", level: 0, school: "E" }] };
  const tce = { spell: [{ name: "Mind Sliver", source: "TCE", level: 0, school: "E" }, { name: "Booming Blade", source: "TCE", level: 0, school: "V" }] };
  const xge = { spell: [{ name: "Thunderclap", source: "XGE", level: 0, school: "V" }] };
  const lookup = {
    xphb: { "mind sliver": { class: { XPHB: { Wizard: true }, WoW: { Mage: {} } } } },
    tce: { "booming blade": { class: { TCE: { Artificer: true }, XPHB: { Wizard: {}, Sorcerer: {} } } } },
  };
  expect(parseSpellCatalog([xphb, tce, xge], lookup).map((spell) => [spell.name, spell.source, spell.classes])).toEqual([
    ["Booming Blade", "TCE", ["Artificer", "Wizard", "Sorcerer"]], ["Mind Sliver", "XPHB", ["Wizard"]], ["Thunderclap", "XGE", []],
  ]);
});

const fighterFile = {
  class: [{
    name: "Fighter", source: "XPHB",
    classFeatures: ["Second Wind|Fighter|XPHB|1", { classFeature: "Fighter Subclass|Fighter|XPHB|3", gainSubclassFeature: true }, "Ability Score Improvement|Fighter|XPHB|4", { classFeature: "Subclass Feature|Fighter|XPHB|7", gainSubclassFeature: true }],
  }],
  classFeature: [
    { name: "Fighter Subclass", source: "XPHB", className: "Fighter", level: 3, entries: ["Choose a subclass."] },
    { name: "Ability Score Improvement", source: "XPHB", className: "Fighter", level: 4, entries: ["Increase scores."] },
    { name: "Ability Score Improvement", source: "PHB", className: "Fighter", level: 4, entries: ["Old."] },
    { name: "Subclass Feature", source: "XPHB", className: "Fighter", level: 7, entries: ["Gain a feature."] },
  ],
  subclass: [
    { name: "Champion", shortName: "Champion", source: "XPHB", className: "Fighter", classSource: "XPHB" },
    { name: "Rune Knight", shortName: "Rune Knight", source: "TCE", className: "Fighter", classSource: "XPHB" },
    { name: "Champion", shortName: "Champion", source: "PHB", className: "Fighter", classSource: "PHB" },
  ],
  subclassFeature: [
    { name: "Improved Critical", source: "XPHB", className: "Fighter", subclassShortName: "Champion", subclassSource: "XPHB", level: 3, entries: ["Crit on 19."] },
    { name: "Heroic Warrior", source: "XPHB", className: "Fighter", subclassShortName: "Champion", subclassSource: "XPHB", level: 7, entries: ["Heroic Inspiration."] },
  ],
};

it("dice cosa porta un livello: privilegi, sottoclassi da scegliere, aumento caratteristiche, incantesimi", () => {
  expect(parseLevelOptions(fighterFile, 3)).toMatchObject({ features: [{ name: "Fighter Subclass", description: "Choose a subclass." }], subclasses: ["Champion", "Rune Knight"], abilityIncrease: false });
  expect(parseLevelOptions(fighterFile, 3, "Champion").features.map((feature) => feature.name)).toEqual(["Fighter Subclass", "Improved Critical"]);
  expect(parseLevelOptions(fighterFile, 4)).toMatchObject({ features: [{ description: "Increase scores." }], subclasses: [], abilityIncrease: true });
  expect(parseLevelOptions(fighterFile, 7, "Champion")).toMatchObject({ features: [{ name: "Heroic Warrior" }], subclasses: [] });
  expect(parseLevelOptions(wizardFile, 2)).toMatchObject({ cantrips: 0, spells: 1 });
  expect(parseLevelFeats({ feat: [{ name: "Alert", source: "XPHB", category: "O" }, { name: "Great Weapon Master", source: "XPHB", category: "G", entries: ["Heavy."] }, { name: "Boon of Fate", source: "XPHB", category: "EB", entries: ["Fate."] }] }).map((feat) => feat.name)).toEqual(["Great Weapon Master", "Boon of Fate"]);
});
