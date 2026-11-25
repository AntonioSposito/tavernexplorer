import { MASTERY_WEAPONS } from "./constants";
import type { ActionEntry, AttackType, SpellEntry } from "./types";

export const ATTACK_TYPES: Record<AttackType, string> = { melee: "Mischia", ranged: "A distanza", both: "Mischia o a distanza" };

// Armi del PHB 2024 (5e.tools items-base.json); le altre di MASTERY_WEAPONS sono in mischia con portata 5 ft.
const REACH_WEAPONS = ["Glaive", "Halberd", "Lance", "Pike", "Whip"];
const THROWN: Record<string, string> = { Dagger: "20/60", Handaxe: "20/60", Javelin: "30/120", "Light Hammer": "20/60", Spear: "20/60", Trident: "20/60" };
const RANGED: Record<string, string> = {
  Blowgun: "25/100", Dart: "20/60", "Hand Crossbow": "30/120", "Heavy Crossbow": "100/400", "Light Crossbow": "80/320", Longbow: "150/600",
  Musket: "40/120", Pistol: "30/90", Shortbow: "80/320", Sling: "30/120",
};

// Tipo d'arma dal nome (es. "Flame Tongue Shortsword" → Shortsword): il nome più lungo vince.
export const weaponFromName = (name: string) => Object.keys(MASTERY_WEAPONS).sort((a, b) => b.length - a.length).find((weapon) => new RegExp(`\\b${weapon}\\b`, "i").test(name));

interface AttackReach { type?: AttackType; range?: string }

// "Melee Attack Roll: +5, reach 5 ft. or range 20/60 ft. Hit: …" (2024) o "Melee Weapon Attack: …" (2014).
function fromStatblock(description: string): AttackReach {
  const match = /\b(Melee or Ranged|Melee|Ranged) (?:Weapon Attack|Spell Attack|Attack Roll|Attack):([\s\S]*?)(?=\b(?:Hit|Miss|Hit or Miss):|$)/i.exec(description);
  if (!match) return {};
  const kind = match[1].toLowerCase();
  const reach = /\breach (\d+(?:\.\d+)?) ?(?:ft|feet)/i.exec(match[2])?.[1];
  const range = /\branged? (\d+(?:\/\d+)?) ?(?:ft|feet)/i.exec(match[2])?.[1];
  return { type: kind === "melee" ? "melee" : kind === "ranged" ? "ranged" : "both", range: [reach, range].filter(Boolean).map((feet) => `${feet} ft`).join(" o ") || undefined };
}

function fromWeapon(weapon: string | undefined): AttackReach {
  if (!weapon || !(weapon in MASTERY_WEAPONS)) return {};
  if (RANGED[weapon]) return { type: "ranged", range: `${RANGED[weapon]} ft` };
  if (THROWN[weapon]) return { type: "both", range: `5 ft o ${THROWN[weapon]} ft` };
  return { type: "melee", range: `${REACH_WEAPONS.includes(weapon) ? 10 : 5} ft` };
}

// "150/600" o "36 m" è a distanza; fino a 10 ft (3 m) è in mischia.
function typeFromRange(range: string | undefined): AttackType | undefined {
  const match = /^(\d+(?:[.,]\d+)?)\s*(\/\s*\d+)?\s*(m|ft|feet|metri|piedi)?\b/i.exec(range?.trim() ?? "");
  if (!match) return undefined;
  const metres = /^m/i.test(match[3] ?? "");
  return match[2] || Number(match[1].replace(",", ".")) > (metres ? 3 : 10) ? "ranged" : "melee";
}

// Tipo e portata dell'attacco. I valori scritti nella voce prevalgono; il resto viene dallo statblock, dall'arma o dalla gittata,
// così valgono anche per le voci già salvate.
export function attackReach(entry: ActionEntry | SpellEntry): AttackReach {
  if ("level" in entry) return { type: entry.spellAttack, range: entry.range };
  const statblock = fromStatblock(entry.description ?? "");
  const attacks = entry.attack != null || entry.attackBonus != null;
  const known = statblock.type ? statblock : attacks ? fromWeapon(entry.weapon ?? weaponFromName(entry.name)) : {};
  const type = entry.attackType ?? known.type ?? (attacks ? typeFromRange(entry.range) : undefined);
  const written = entry.range?.trim().replace(/^(\d+(?:\/\d+)?)$/, "$1 ft");
  // Le armi da lancio salvano solo la gittata del lancio ("20/60").
  if (written) return { type, range: type === "both" && /^\d+\/\d+ ft\.?$/.test(written) ? `5 ft o ${written}` : written };
  // La portata ricavata non vale per un tipo scelto a mano diverso.
  return { type, range: type === known.type ? known.range : undefined };
}

// "Mischia 5 ft", "A distanza 150/600 ft"; senza tipo resta "Gittata …".
export function reachLabel(entry: ActionEntry | SpellEntry): string | undefined {
  const { type, range } = attackReach(entry);
  return type ? [ATTACK_TYPES[type], range].filter(Boolean).join(" ") : range && `Gittata ${range}`;
}
