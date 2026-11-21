import type { CloudSheet } from "./types";

// Solo in sviluppo fuori da Owlbear: /api/sheets finto che salva nel localStorage, così si creano schede di prova
// senza toccare il Redis vero. Stessa logica di revisione di api/sheets.ts (rev attesa diversa = 409).
const KEY = "tavernexplorer/dev-sheets";
const load = (): Record<string, CloudSheet> => { try { return JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { return {}; } };

export async function devSheetsFetch(_url: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const sheets = load();
  if (!init?.method || init.method === "GET") return Response.json({ sheets: Object.values(sheets) });
  const body = JSON.parse(String(init.body)) as { rev: number; id?: string; updatedBy?: string; entry?: Pick<CloudSheet, "kind" | "sheet" | "acl" | "updatedBy"> };
  const id = body.entry?.sheet.id ?? body.id!;
  const current = sheets[id];
  if ((current?.rev ?? 0) !== body.rev) return Response.json({ entry: current ?? null }, { status: 409 });
  const now = Date.now();
  const entry = init.method === "DELETE"
    ? { ...current, rev: body.rev + 1, updatedAt: now, updatedBy: body.updatedBy!, deletedAt: now }
    : { ...body.entry!, rev: body.rev + 1, updatedAt: now } as CloudSheet;
  localStorage.setItem(KEY, JSON.stringify({ ...sheets, [id]: entry }));
  return Response.json({ entry });
}
