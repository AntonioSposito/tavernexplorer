// Moduli caricati al primo uso: un file non scaricato dà un errore leggibile al posto di quello del browser.
async function loadPart<T>(part: Promise<T>): Promise<T> {
  try { return await part; } catch { throw new Error("Questa parte non si è caricata: controlla la connessione, poi ricarica la pagina."); }
}

export const fivetools = () => loadPart(import("./fivetoolsApi"));
export const roll20Importer = () => loadPart(import("./importer"));
