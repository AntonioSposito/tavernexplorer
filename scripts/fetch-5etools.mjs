// Scarica in test-data/5etools/ i file 5e.tools che usa l'app, a un commit fissato: i test delle classi girano senza rete.
// Uso: npm run data:5etools  (la cartella è in .gitignore)
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const COMMIT = "c286d15651c5b79004496132c22164f59728480d";
const BASE = `https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/${COMMIT}/data`;
const OUT = join(import.meta.dirname, "..", "test-data", "5etools");
const CLASSES = ["barbarian", "bard", "cleric", "druid", "fighter", "monk", "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard"];

async function get(path) {
  const response = await fetch(`${BASE}/${path}`);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  const text = await response.text();
  await mkdir(dirname(join(OUT, path)), { recursive: true });
  await writeFile(join(OUT, path), text);
  return JSON.parse(text);
}

const spellIndex = await get("spells/index.json");
const paths = [
  ...CLASSES.map((name) => `class/class-${name}.json`),
  "races.json", "backgrounds.json", "feats.json", "optionalfeatures.json", "generated/gendata-spell-source-lookup.json",
  ...Object.values(spellIndex).map((file) => `spells/${file}`),
];
await Promise.all(paths.map(get));
await writeFile(join(OUT, "COMMIT"), COMMIT);
console.log(`${paths.length + 1} file di 5e.tools (${COMMIT.slice(0, 7)}) in ${OUT}`);
