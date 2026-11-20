// Punti esperienza (regole 2024): PE minimi per ogni livello, dal 1° al 20°.
export const XP_BY_LEVEL = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];

// I PE nella scheda sono testo (come arrivano da Roll20, anche "2.450" o "2,450"): solo le cifre contano.
export const parseXp = (text: string) => Number(text.replace(/\D/g, "")) || 0;

// Livello che i PE permettono: il più alto con la soglia raggiunta.
export const levelForXp = (xp: number) => XP_BY_LEVEL.filter((threshold) => xp >= threshold).length;

// Soglia del livello dopo quello attuale (null al 20°) e livello raggiungibile se i PE la superano.
export function xpProgress(xp: number, level: number): { next: number | null; readyFor: number | null } {
  const next = level >= XP_BY_LEVEL.length ? null : XP_BY_LEVEL[Math.max(1, level)];
  return { next, readyFor: next != null && xp >= next ? levelForXp(xp) : null };
}

// PE di un incontro per ciascuno dei PG scelti: lo stesso totale a tutti, o diviso (per difetto) tra loro.
export const xpShare = (total: number, players: number, split: boolean) => split ? Math.floor(total / Math.max(1, players)) : total;
