import { describe, expect, it } from "vitest";
import { createBlankSheet } from "./blankSheet";
import { SUBCLASSES } from "./classes";
import { FEATURE_USE_NAMES } from "./classResources";
import { hasFiveToolsData, readFiveTools, SKIP_REASON } from "./fivetoolsData";
import { parseLevelOptions, type Feature } from "./fivetoolsCharacter";
import { ABILITY_FEATURES, EXPERTISE_FEATURES, applyLevelUp } from "./levelUp";

// TE-74: tabella di copertura dei privilegi PHB 2024 in docs/copertura-classi.md.
// Rigenerarla dopo una modifica: npx vitest run src/classCoverage.test.ts -u
type Kind = "sottoclasse" | "aumento caratteristiche" | "Maestria" | "incantesimi" | "risorsa" | "attacchi" | "opzione scheda" | "modificatore" | "incantesimi sempre preparati mancanti?" | "risorsa mancante?" | "scelta mancante?" | "solo testo";
// Privilegi già gestiti dall'app fuori dal level up: slot (classSync) e risorse/azioni di classe (classResources).
const SPELLS = new Set(["Spellcasting", "Pact Magic"]);
const RESOURCES = new Set(["Rage", "Bardic Inspiration", "Font of Inspiration", "Martial Arts", "Unarmored Movement", "Channel Divinity", "Wild Shape", "Second Wind", "Psionic Power", "Monk's Focus", "Favored Enemy", "Font of Magic", "Improved Warding Flare"]);
// Privilegi con "short/long rest" nel testo che non sono usi da contare: scelte cambiabili col riposo, effetti che durano
// fino al riposo, recuperi di altre risorse, riserve legate a un incantesimo (Arcane Ward, Portent).
const NOT_RESOURCES = new Set(["Weapon Mastery", "Aspect of the Wilds", "Relentless Rage", "Persistent Rage", "Superior Inspiration", "Blessing of the Trickster",
  "Wild Companion", "Cosmic Omen", "Archdruid", "War Bond", "Primal Companion", "Hunter's Prey", "Defensive Tactics", "Bastion of Law", "Celestial Resilience",
  "Fiendish Resilience", "Mystic Arcanum", "Arcane Ward", "Portent", "Memorize Spell", "The Third Eye", "Overchannel", "Greater Divine Intervention"]);
// Aiuti agli attacchi (classAttacks.ts).
const ATTACKS = new Set(["Extra Attack", "Two Extra Attacks", "Three Extra Attacks", "Sneak Attack"]);
// Testo che fa pensare a usi da contare o a una scelta del giocatore: da controllare a mano.
const USES = /expended uses|number of times equal to|(short|long) rest|you can't use this feature again until/i;
// Incantesimi di sottoclasse sempre preparati (es. "Psionic Spells", "Oath of Devotion Spells").
const ALWAYS_PREPARED = /always (have|has) .* prepared|you always have the .* spells prepared/i;
const CHOICE = /\b(choose|of your choice)\b/i;

function kindOf(className: string, feature: Feature, subclassFeature?: string): Kind {
  if (feature.name === subclassFeature) return "sottoclasse";
  if (ABILITY_FEATURES.includes(feature.name)) return "aumento caratteristiche";
  if (EXPERTISE_FEATURES[feature.name]) return "Maestria";
  if (SPELLS.has(feature.name)) return "incantesimi";
  if (RESOURCES.has(feature.name) || FEATURE_USE_NAMES.includes(feature.name)) return "risorsa";
  if (ATTACKS.has(feature.name)) return "attacchi";
  const sheet = createBlankSheet("Prova");
  sheet.classes = [{ name: className, level: 1 }];
  const base = applyLevelUp(sheet, { className, hitPoints: 1, features: [], spells: [] });
  const next = applyLevelUp(sheet, { className, hitPoints: 1, features: [feature], spells: [] });
  if (JSON.stringify(next.options) !== JSON.stringify(base.options)) return "opzione scheda";
  if (next.traits.at(-1)?.modifiers?.length) return "modificatore";
  if (/ Spells$/.test(feature.name) || ALWAYS_PREPARED.test(feature.description)) return "incantesimi sempre preparati mancanti?";
  if (!NOT_RESOURCES.has(feature.name) && USES.test(feature.description)) return "risorsa mancante?";
  if (CHOICE.test(feature.description)) return "scelta mancante?";
  return "solo testo";
}

describe.skipIf(!hasFiveToolsData)(`copertura privilegi PHB 2024${hasFiveToolsData ? "" : ` (${SKIP_REASON})`}`, () => {
  it("docs/copertura-classi.md è aggiornata", async () => {
    const rows: Array<[string, string, number, string, Kind]> = [];
    for (const [className, subclasses] of Object.entries(SUBCLASSES).filter(([name]) => name !== "Artificer")) {
      const file = await readFiveTools(`class/class-${className.toLowerCase()}.json`);
      for (let level = 1; level <= 20; level += 1) {
        const plain = parseLevelOptions(file, level);
        const classNames = new Set(plain.features.map((feature) => feature.name));
        for (const feature of plain.features) rows.push([className, "", level, feature.name, kindOf(className, feature, plain.subclassFeature)]);
        for (const subclass of subclasses) for (const feature of parseLevelOptions(file, level, subclass).features.filter((item) => !classNames.has(item.name)))
          rows.push([className, subclass, level, feature.name, kindOf(className, feature)]);
      }
    }
    const counts = new Map<Kind, number>();
    for (const row of rows) counts.set(row[4], (counts.get(row[4]) ?? 0) + 1);
    const table = [
      "# Copertura dei privilegi PHB 2024",
      "",
      "Generata da `src/classCoverage.test.ts` con i dati di `npm run data:5etools`. Rigenerare: `npx vitest run src/classCoverage.test.ts -u`.",
      "I tipi con `?` sono indovinati dal testo (\"choose\", \"expended uses\"…): da controllare a mano.",
      "",
      "| Tipo | Privilegi |", "| --- | --- |",
      ...[...counts].sort((a, b) => b[1] - a[1]).map(([kind, count]) => `| ${kind} | ${count} |`),
      "",
      "| Classe | Sottoclasse | Liv. | Privilegio | Tipo |", "| --- | --- | --- | --- | --- |",
      ...rows.map(([className, subclass, level, name, kind]) => `| ${className} | ${subclass} | ${level} | ${name} | ${kind} |`),
      "",
    ].join("\n");
    await expect(table).toMatchFileSnapshot("../docs/copertura-classi.md");
  });
});
