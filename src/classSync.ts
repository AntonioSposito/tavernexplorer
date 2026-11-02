import { classDisplay, classRule, classSlotTotals } from "./classes";
import { fixProficiencyChoice } from "./effects";
import type { CharacterSheet } from "./types";

const slotOptions = (sheet: CharacterSheet) => ({ arcane: { fighter: sheet.options?.arcaneFighter, rogue: sheet.options?.arcaneRogue }, casterLevel: sheet.options?.casterLevel, slotBonus: sheet.options?.slotBonus });

// Slot calcolati dalle classi e dalle opzioni ("level_N" → totale).
export const derivedSlots = (sheet: CharacterSheet) => classSlotTotals(sheet.classes ?? [], slotOptions(sheet));

// Caratteristica da incantatore: quella della classe principale, altrimenti della prima classe che lancia incantesimi.
function spellAbility(sheet: CharacterSheet): string | undefined {
  const rules = (sheet.classes ?? []).map(classRule);
  return rules[0]?.spellAbility ?? rules.find((rule) => rule?.spellAbility)?.spellAbility;
}

// Come Roll20 con "Auto level calculations": dopo un cambio di classi o di opzioni degli slot riscrive i valori
// derivati di next. I valori importati da Roll20 (TS, CD) si correggono a differenza, così i loro bonus restano.
export function applyClassChanges(next: CharacterSheet, previous: CharacterSheet) {
  const classes = next.classes ?? [];
  if (!next.options?.autoLevel || !classes.length) return;
  const primary = classes[0];
  const level = Math.max(1, classes.reduce((sum, entry) => sum + entry.level, 0));

  fixProficiencyChoice(next);
  next.identity.level = level;
  next.identity.className = primary.name;
  next.identity.subclass = primary.subclass ?? "";
  next.identity.classDisplay = classDisplay(classes);

  const hitDie = classRule(primary)?.hitDie;
  const dice = next.combat.hitDice;
  dice.current = Math.min(level, Math.max(0, dice.current + level - dice.max));
  dice.max = level;
  if (hitDie) dice.die = `d${hitDie}`;
  if (next.options.trackHitDicePerClass) {
    const pools = new Map<string, number>();
    for (const entry of classes) { const die = classRule(entry)?.hitDie; if (die) pools.set(`d${die}`, (pools.get(`d${die}`) ?? 0) + entry.level); }
    const old = new Map((next.combat.hitDicePools ?? []).map((pool) => [pool.die, pool]));
    next.combat.hitDicePools = [...pools].sort(([a], [b]) => Number(b.slice(1)) - Number(a.slice(1))).map(([die, max]) => {
      const before = old.get(die);
      return { die, max, current: before ? Math.min(max, Math.max(0, before.current + max - before.max)) : max };
    });
    dice.current = next.combat.hitDicePools.reduce((sum, pool) => sum + pool.current, 0);
  } else delete next.combat.hitDicePools;

  // TS di classe: solo quando cambia la classe principale (un talento come Resilient resta).
  const before = previous.classes?.[0];
  const pb = next.combat.proficiencyBonus;
  if (before && (before.name !== primary.name || JSON.stringify(before.custom?.saves) !== JSON.stringify(primary.custom?.saves))) {
    const oldSaves = new Set(classRule(before)?.saves ?? []);
    const newSaves = new Set(classRule(primary)?.saves ?? []);
    for (const [key, ability] of Object.entries(next.abilities)) {
      if (oldSaves.has(key) === newSaves.has(key) || ability.saveProficient === newSaves.has(key)) continue;
      ability.saveProficient = newSaves.has(key);
      ability.save += ability.saveProficient ? pb : -pb;
    }
  }

  const ability = spellAbility(next);
  const spellcasting = next.spellcasting;
  if (ability && ability !== spellcasting.ability) {
    const mod = next.abilities[ability]?.mod ?? 0;
    const oldMod = spellcasting.ability ? next.abilities[spellcasting.ability]?.mod : undefined;
    if (oldMod === undefined) { spellcasting.saveDc = 8 + pb + mod; spellcasting.attackBonus = pb + mod; }
    else { spellcasting.saveDc += mod - oldMod; spellcasting.attackBonus += mod - oldMod; }
    spellcasting.ability = ability;
  }

  const totals = derivedSlots(next);
  spellcasting.slots = Object.fromEntries(Object.entries(totals).map(([key, total]) => [key, { total, used: Math.min(spellcasting.slots[key]?.used ?? 0, total) }]));
  // Solo magia del patto: gli slot tornano col riposo breve.
  const casters = classes.map((entry) => classRule(entry)?.caster ?? "none").filter((caster) => caster !== "none");
  if (casters.length) spellcasting.slotRecovery = casters.every((caster) => caster === "pact") ? "short" : "long";
}

// All'import: calcolo automatico acceso solo se classi e opzioni danno gli stessi slot di Roll20.
export function autoLevelMatches(sheet: CharacterSheet): boolean {
  if (!sheet.classes?.length) return false;
  const totals = derivedSlots(sheet);
  const imported = Object.fromEntries(Object.entries(sheet.spellcasting.slots).filter(([, slot]) => slot.total > 0).map(([key, slot]) => [key, slot.total]));
  const level = sheet.classes.reduce((sum, entry) => sum + entry.level, 0);
  return level === sheet.identity.level && JSON.stringify(Object.entries(totals).sort()) === JSON.stringify(Object.entries(imported).sort());
}
