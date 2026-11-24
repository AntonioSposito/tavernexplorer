import type { TraitSource } from "./types";

// Roll20 codifica la bio con escape(): %XX sono byte latin-1 (%E0 = à), non UTF-8, e decodeURIComponent li rifiuta.
// Prima si prova UTF-8 (export più vecchi), poi la decodifica di escape().
export function decodeLegacy(value: string): string {
  try {
    const unicodeFixed = value.replace(/%u([0-9a-f]{4})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
    let decoded: string;
    try { decoded = decodeURIComponent(unicodeFixed.replace(/%(?![0-9a-f]{2})/gi, "%25")); }
    catch { decoded = unicodeFixed.replace(/%([0-9a-f]{2})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16))); }
    const documentValue = new DOMParser().parseFromString(decoded, "text/html");
    return documentValue.body.textContent?.trim() ?? "";
  } catch {
    return value;
  }
}

// SOURCE dei tratti, anche come lo salva Roll20 in italiano.
const TRAIT_SOURCES: Record<string, TraitSource> = {
  racial: "Racial", razziale: "Racial", class: "Class", classe: "Class", feat: "Feat", talento: "Feat",
  background: "Background", item: "Item", oggetto: "Item", other: "Other", altro: "Other",
};
export const traitSource = (value: string): TraitSource | undefined => TRAIT_SOURCES[value.trim().toLowerCase()];
export const traitSourceText = (kind: TraitSource | undefined, type: string | undefined) => [type?.trim(), kind].filter(Boolean).join(" • ") || undefined;
