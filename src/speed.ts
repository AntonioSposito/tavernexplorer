// Velocità dei PG: salvata come testo ("9 m"); un quadretto della griglia vale 1,5 m.
export const SQUARE_METERS = 1.5;

// Metri dal testo della velocità: "9 m", "7,5m", "30 ft." (piedi convertiti come in buildCharacter). null se non c'è un numero.
export function speedMeters(text: string): number | null {
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*(ft|feet|piedi)?/i);
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  return match[2] ? Math.round(value * 0.3 * 10) / 10 : value;
}

// Quadretti interi percorribili: per regola il movimento avanza solo a quadretti pieni.
export const speedSquares = (meters: number) => Math.floor(meters / SQUARE_METERS + 1e-9);

export const metersText = (meters: number) => `${Math.round(meters * 10) / 10} m`;
