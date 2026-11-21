// Solo per i test: i file 5e.tools scaricati con `npm run data:5etools` (test-data/5etools, fuori da git).
// Senza la cartella l'elenco è vuoto e i test che li usano si saltano (describe.skipIf(!hasFiveToolsData)).
const files = import.meta.glob<unknown>("../test-data/5etools/**/*.json", { import: "default" });
const PREFIX = "../test-data/5etools/";

export const hasFiveToolsData = Object.keys(files).length > 0;
export const SKIP_REASON = "dati 5e.tools assenti: npm run data:5etools";

// path come nel sito, es. "class/class-bard.json".
export function readFiveTools(path: string): Promise<Record<string, unknown>> {
  const load = files[PREFIX + path];
  if (!load) throw new Error(`${path} non è in test-data/5etools (${SKIP_REASON})`);
  return load() as Promise<Record<string, unknown>>;
}
