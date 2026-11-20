import type { ActionEntry, CharacterSheet } from "./types";

// Attacchi per azione Attacco: Extra Attack 2, Guerriero Two/Three Extra Attacks 3 e 4 (dai tratti, come arrivano dal level up).
export function attacksPerAction(sheet: CharacterSheet): number {
  const names = new Set(sheet.traits.map((item) => item.name));
  return names.has("Three Extra Attacks") ? 4 : names.has("Two Extra Attacks") ? 3 : names.has("Extra Attack") ? 2 : 1;
}

// Attacco furtivo: metà del livello da ladro (per eccesso) in d6; null senza il privilegio.
export function sneakAttackDice(sheet: CharacterSheet): number | null {
  if (!sheet.traits.some((item) => item.name === "Sneak Attack")) return null;
  const rogue = sheet.classes?.find((entry) => entry.name === "Rogue")?.level ?? (sheet.identity.className === "Rogue" ? sheet.identity.level : 1);
  return Math.ceil(Math.max(1, rogue) / 2);
}

// Armi con Accurata o a distanza (regole 2024). Senza tipo d'arma vale l'attacco con Destrezza (azioni importate).
const SNEAK_WEAPONS = new Set(["Dagger", "Dart", "Rapier", "Scimitar", "Shortsword", "Whip", "Blowgun", "Hand Crossbow", "Heavy Crossbow", "Light Crossbow", "Longbow", "Shortbow", "Sling", "Musket", "Pistol"]);
export const sneakEligible = (entry: ActionEntry) => entry.weapon ? SNEAK_WEAPONS.has(entry.weapon) : entry.attack?.ability === "dexterity";
