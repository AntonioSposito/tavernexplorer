// Mostri 5e.tools con "_copy" (es. Ireena = copia del Noble del MM): il file ha solo le differenze.
// Si parte dal mostro copiato, anche di un altro manuale, e si applicano le modifiche "_mod".
// Quelle non gestite (template, incantesimi, abilità) finiscono negli avvisi d'importazione (_teWarnings).

type Obj = Record<string, unknown>;
export type FindMonster = (name: string, source: string) => Promise<Obj | undefined>;

const key = (name: unknown, source: unknown) => `${String(source)}|${String(name)}`.toLowerCase();
const nameOf = (value: unknown) => typeof value === "string" ? value : String((value as Obj | null)?.name ?? "");
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : value === undefined ? [] : [value];
// Il token del mostro copiato ha il nome dell'originale: la copia usa solo il suo.
const NOT_COPIED = ["hasToken", "tokenUrl", "token", "hasFluff", "hasFluffImages", "_copy"];

export async function resolveCopies(monsters: Obj[], find: FindMonster): Promise<Obj[]> {
  const local = new Map(monsters.map((monster) => [key(monster.name, monster.source), monster]));
  const resolve = async (raw: Obj, depth: number): Promise<Obj> => {
    const copy = raw._copy as Obj | undefined;
    if (!copy) return raw;
    const label = `${String(copy.name)} (${String(copy.source)})`;
    const found = depth < 5 ? local.get(key(copy.name, copy.source)) ?? await find(String(copy.name), String(copy.source)).catch(() => undefined) : undefined;
    if (!found) return { ...raw, _teWarnings: [`Copia di ${label} non trovata: mancano i dati del mostro originale`] };
    const base = structuredClone(await resolve(found, depth + 1));
    for (const prop of NOT_COPIED) delete base[prop];
    const result: Obj = { ...base, ...raw };
    delete result._copy;
    const warnings = list(base._teWarnings).map(String);
    for (const [prop, mods] of Object.entries((copy._mod ?? {}) as Obj)) for (const mod of list(mods)) applyMod(result, prop, mod, warnings);
    if (copy._templates) warnings.push(`Copia di ${label}: template 5e.tools non applicati, ricontrolla lo statblock`);
    result._teWarnings = warnings;
    return result;
  };
  return Promise.all(monsters.map((monster) => resolve(monster, 0)));
}

function applyMod(result: Obj, prop: string, raw: unknown, warnings: string[]) {
  const mod = (typeof raw === "string" ? { mode: raw } : raw) as Obj;
  const items = list(mod.items);
  const current = list(result[prop]);
  switch (mod.mode) {
    case "remove": delete result[prop]; return;
    case "replaceTxt": {
      const pattern = new RegExp(String(mod.replace), `${String(mod.flags ?? "").replace("g", "")}g`);
      for (const target of prop === "*" ? Object.keys(result).filter((name) => Array.isArray(result[name])) : [prop]) {
        if (Array.isArray(result[target])) result[target] = (result[target] as unknown[]).map((item) => typeof item === "object" ? replaceText(item, pattern, String(mod.with)) : item);
      }
      return;
    }
    case "appendArr": result[prop] = [...current, ...items]; return;
    case "prependArr": result[prop] = [...items, ...current]; return;
    case "insertArr": result[prop] = [...current.slice(0, Number(mod.index)), ...items, ...current.slice(Number(mod.index))]; return;
    case "appendIfNotExistsArr": result[prop] = [...current, ...items.filter((item) => !current.some((existing) => JSON.stringify(existing) === JSON.stringify(item)))]; return;
    case "replaceArr": {
      const target = mod.replace as unknown;
      const index = typeof target === "object" && target ? Number((target as Obj).index) : current.findIndex((item) => nameOf(item) === target);
      if (index >= 0 && index < current.length) { result[prop] = [...current.slice(0, index), ...items, ...current.slice(index + 1)]; return; }
      break;
    }
    case "removeArr": {
      const names = list(mod.names).map(String);
      result[prop] = current.filter((item) => !names.includes(nameOf(item)) && !items.some((removed) => JSON.stringify(removed) === JSON.stringify(item)));
      return;
    }
  }
  warnings.push(`Modifica 5e.tools "${String(mod.mode)}"${prop === "_" ? "" : ` su "${prop}"`} non applicata, ricontrolla lo statblock`);
}

// Sostituisce il testo dentro le descrizioni (non i nomi delle voci), come fa 5e.tools.
function replaceText(value: unknown, pattern: RegExp, replacement: string): unknown {
  if (typeof value === "string") return value.replace(pattern, replacement);
  if (Array.isArray(value)) return value.map((item) => replaceText(item, pattern, replacement));
  if (!value || typeof value !== "object") return value;
  const entry = { ...value as Obj };
  for (const field of ["entries", "headerEntries", "footerEntries", "items", "entry"]) if (field in entry) entry[field] = replaceText(entry[field], pattern, replacement);
  return entry;
}
