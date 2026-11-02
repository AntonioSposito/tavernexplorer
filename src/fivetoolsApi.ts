import { import5eToolsCampaign, import5eToolsItems, import5eToolsMonsters, type FiveToolsItem } from "./import5etools";
import type { CampaignDocument, MonsterSheet } from "./types";

// Il sito applica una challenge Cloudflare; il mirror del progetto espone gli
// stessi file generati con CORS pubblico, adatto all'iframe di Owlbear Rodeo.
const DEFAULT_BASE = "https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data";

export interface FiveToolsSource { id: string; file: string; label: string }
export interface FiveToolsAdventure { id: string; name: string; source: string }

async function request(path: string, base = DEFAULT_BASE): Promise<Record<string, unknown>> {
  const response = await fetch(`${base.replace(/\/$/, "")}/${path}`, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`5e.tools ha risposto ${response.status}`);
  return response.json() as Promise<Record<string, unknown>>;
}

export async function listBestiarySources(): Promise<FiveToolsSource[]> {
  const index = await request("bestiary/index.json");
  return Object.entries(index).map(([id, file]) => ({ id, file: String(file), label: id })).sort((a, b) => a.id.localeCompare(b.id));
}

export async function loadBestiarySource(source: FiveToolsSource): Promise<MonsterSheet[]> {
  if (!/^[a-z0-9_.-]+$/i.test(source.file)) throw new Error("Nome sorgente 5e.tools non valido");
  return import5eToolsMonsters(await request(`bestiary/${source.file}`));
}

export async function listAdventures(): Promise<FiveToolsAdventure[]> {
  const root = await request("adventures.json");
  const rows = Array.isArray(root.adventure) ? root.adventure as Array<Record<string, unknown>> : [];
  return rows.map((row) => ({ id: String(row.id ?? row.source ?? ""), name: String(row.name ?? row.id ?? "Avventura"), source: String(row.source ?? row.id ?? "") })).filter((row) => row.id).sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadAdventure(adventure: FiveToolsAdventure): Promise<CampaignDocument> {
  if (!/^[a-z0-9-]+$/i.test(adventure.id)) throw new Error("ID avventura 5e.tools non valido");
  const document = await request(`adventure/adventure-${adventure.id.toLowerCase()}.json`);
  return import5eToolsCampaign({ ...document, adventure: [{ id: adventure.id, name: adventure.name, source: adventure.source }] });
}

let itemsCache: Promise<FiveToolsItem[]> | null = null;
// ~3 MB: scaricati alla prima ricerca e tenuti finché la pagina è aperta; un errore permette di riprovare.
export function loadItems(): Promise<FiveToolsItem[]> {
  itemsCache ??= Promise.all([request("items-base.json"), request("items.json")]).then(([base, items]) => import5eToolsItems(base, items));
  itemsCache.catch(() => { itemsCache = null; });
  return itemsCache;
}
