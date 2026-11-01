import { describe, expect, it } from "vitest";
import { resolveAction } from "./actions";
import { importRoll20 } from "./importer";
import { toSpell, toSpellDraft, validateSpell } from "./spells";

const sheet = () => {
  const value = importRoll20({ character: { name: "Maga" }, normalized: { identity: { character_name: "Maga" } } });
  value.combat.proficiencyBonus = 2;
  value.abilities.wisdom = { score: 16, mod: 3, save: 3, saveProficient: false };
  value.spellcasting = { ...value.spellcasting, saveDc: 14, attackBonus: 6 };
  return value;
};
const base = { id: "s1", level: 1, prepared: true };

describe("form incantesimi", () => {
  it("Dardo incantato: danno con modificatore, componenti e livelli superiori", () => {
    const spell = toSpell({ ...toSpellDraft(null), name: " Dardo incantato ", school: "Invocazione", castingTime: "1 azione", range: "36 metri", verbal: true, somatic: true, material: true, materials: "polvere", damage: "1D4 +1", damageType: "Forza", addAbilityMod: true, higherDie: "d4", higherCount: 1 }, base);
    expect(spell).toMatchObject({ name: "Dardo incantato", level: 1, castingAbility: "spell", output: "attack", components: { verbal: true, somatic: true, material: true, materials: "polvere" }, higherLevel: { count: 1, die: "d4", bonus: 0 } });
    expect(spell.damages).toEqual([{ dice: "1d4+1", ability: "spell", bonus: 0, type: "Forza", critDice: "1d4" }]);
    expect(spell.attack).toBeUndefined();
    // "spell": modificatore = bonus attacco incantesimi (6) - competenza (2).
    expect(resolveAction(sheet(), spell)).toMatchObject({ damage: "1d4+1+4", damageFormula: "1d4+1+4[SPELL]", attackBonus: undefined });
  });

  it("caratteristica scelta: attacco e CD calcolati da quella", () => {
    const spell = toSpell({ ...toSpellDraft(null), name: "Fiamma sacra", castingAbility: "wisdom", spellAttack: "ranged", saveAbility: "dexterity", saveEffect: "nessun danno", healing: "1d8", addAbilityMod: true }, base);
    expect(resolveAction(sheet(), spell)).toMatchObject({ attackBonus: 5, saveDc: 13, saveAbility: "dexterity", saveEffect: "nessun danno", healing: "1d8+3", healingFormula: "1d8+3[WIS]" });
  });

  it("riapre un incantesimo importato senza perdere il danno", () => {
    const draft = toSpellDraft({ id: "x", name: "Raggio", level: 0, prepared: true, ritual: false, concentration: false, attackBonus: 5, damage: "1d10", damageType: "Fuoco", saveDc: 13 });
    expect(draft).toMatchObject({ spellAttack: "ranged", damage: "1d10", damageType: "Fuoco", saveAbility: "dexterity" });
    const spell = toSpell(draft, { id: "x", level: 0, prepared: true });
    expect(spell).not.toHaveProperty("attackBonus");
    expect(spell).not.toHaveProperty("saveDc");
  });

  it("valida nome e formule", () => {
    expect(validateSpell({ ...toSpellDraft(null), name: "" })).toBe("Inserisci un nome");
    expect(validateSpell({ ...toSpellDraft(null), name: "X", damage: "1d4*2" })).toMatch(/Formula non valida/);
  });
});
