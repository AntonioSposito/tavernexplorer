// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { importRoll20 } from "./importer";

const fixture = {
  _meta: { sheet: "ogl5e", version: "1.2" },
  character: { id: "roll20-1", name: "Duston", bio_text: "%3Cp%3ECiao%20%u2019oste%3C%2Fp%3E" },
  normalized: {
    identity: { character_name: "", race: "Umano", class: "Warlock", subclass: "Fiend", class_display: "Fiend Warlock 4", level: 4, experience: "4400" },
    combat: { ac: 12, hp: { current: 35, max: 35 }, hit_dice: { current: 4, max: 4 }, initiative: 1, proficiency_bonus: 2, passive_perception: 11, speed: "6q" },
    abilities: { charisma: { score: 18, mod: 4, save: 6, save_proficient: true } },
    skills: { persuasion: { ability: "charisma", bonus: 6, proficient: true } },
    spellcasting: { save_dc: 14, attack_bonus: 6, slots: { level_2: { total: 2, expended: 1 } }, spells: { cantrips: [{ name: "Eldritch Blast", level: 0, description: "Infligge 1d10 danni da forza." }] } },
    attacks: [{ name: "Eldritch Blast", attack_bonus: "+6", damage: "1d10 + 4", damage_type: "forza", _rowid: "attack-1" }],
    inventory: [{ name: "Dagger", count: 2, _rowid: "item-1" }],
    traits: [{ name: "Lucky", source: "Talento", description: "Fortunato", _rowid: "trait-1" }],
    currency: { gp: 8 },
  },
};

describe("import Roll20 ogl5e", () => {
  it("decodifica la bio di Roll20 con lettere accentate in latin-1 (escape)", () => {
    const sheet = importRoll20({ ...fixture, character: { ...fixture.character, bio_text: "%3Cp%3Eio%20sono%20Vor%2C%20in%20una%20comunit%E0%20%E8%20%u2019ok%3C/p%3E" } });
    expect(sheet.biography).toBe("io sono Vor, in una comunità è ’ok");
  });

  it("separa SOURCE e SOURCE TYPE dei tratti dalle righe raw, anche con i valori italiani", () => {
    const sheet = importRoll20({ ...fixture, normalized: { ...fixture.normalized, traits: [
      { name: "Darkvision", source: "Orco • Razziale", description: "", _rowid: "t1" },
      { name: "Mercante", source: "mercante • Background", description: "", _rowid: "t2" },
      { name: "Vecchio", source: "Talento", description: "", _rowid: "t3" },
    ] }, raw: { repeating: { repeating_traits: [{ _rowid: "t1", source: "Razziale", source_type: "Orco" }, { _rowid: "t2", source: "Background", source_type: "mercante" }] } } });
    expect(sheet.traits.map(({ source, sourceKind, sourceType }) => [source, sourceKind, sourceType])).toEqual([["Orco • Racial", "Racial", "Orco"], ["mercante • Background", "Background", "mercante"], ["Talento", undefined, undefined]]);
  });

  it("unisce nome e tipo delle competenze divisi dall'exporter e legge gli strumenti", () => {
    const sheet = importRoll20({ ...fixture, normalized: { ...fixture.normalized,
      proficiencies: [
        { name: "Comune", type: "", _rowid: "p1" }, { name: "", type: "LANGUAGE", _rowid: "p1_prof" },
        { name: "Abissale", type: "", _rowid: "p2" },
        { name: "Semplici", type: "", _rowid: "p3" }, { name: "", type: "ARMA", _rowid: "p3_prof" },
        { name: "", type: "ALTRO", _rowid: "p4_prof" }, { name: "Thieves Tools", type: "", _rowid: "p4" },
      ],
      tools: [
        { name: "Strumenti da scasso", ability: "DEXTERITY", bonus: "6", _rowid: "t1" },
        { name: "Disguise Kit", ability: "QUERY", bonus: "?{Attribute?|Strength,@{strength_mod}|Charisma,@{charisma_mod}}+1+4", _rowid: "t2" },
        { name: "Liuto", ability: "CHARISMA", bonus: "5", _rowid: "t3" },
      ],
    }, raw: { repeating: { repeating_tool: [{ _rowid: "t2", toolbonus_base: "(@{pb}*2)" }] } } });
    expect(sheet.proficiencies?.map(({ name, type }) => [name, type])).toEqual([["Comune", "LANGUAGE"], ["Abissale", "LANGUAGE"], ["Semplici", "WEAPON"], ["Thieves Tools", "OTHER"]]);
    // MODS = totale − caratteristica − competenza (Maestria da raw = 2×2, CAR +4 dal fixture).
    expect(sheet.tools?.map(({ name, ability, proficiency, mods }) => [name, ability, proficiency, mods])).toEqual([["Strumenti da scasso", "dexterity", "proficient", 4], ["Disguise Kit", "", "expertise", 1], ["Liuto", "charisma", "proficient", -1]]);
  });

  it("usa normalized come fonte e applica il profilo versionato", () => {
    const sheet = importRoll20(fixture);
    expect(sheet.name).toBe("Duston");
    expect(sheet.ruleset).toEqual({ id: "dnd-5.5", version: "2024.1" });
    expect(sheet.actions[0]).toMatchObject({ name: "Eldritch Blast", attackBonus: 6, damage: "1d10+4" });
    expect(sheet.spells[0]).toMatchObject({ name: "Eldritch Blast", damage: "1d10+4" });
    expect(sheet.spellcasting.slots.level_2).toEqual({ total: 2, used: 1 });
    expect(sheet.biography).toBe("Ciao ’oste");
    expect(sheet.importWarnings.some((warning) => warning.includes("character.name"))).toBe(true);
  });

  it("rifiuta sheet diverse da ogl5e", () => {
    expect(() => importRoll20({ ...fixture, _meta: { sheet: "pathfinder", version: "1.2" } })).toThrow("non supportata");
  });
});
