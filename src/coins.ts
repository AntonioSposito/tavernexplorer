// Monete dalla più piccola alla più grande, con il valore in monete di rame.
export const COINS = ["cp", "sp", "ep", "gp", "pp"] as const;
export const COIN_LABELS: Record<string, string> = { cp: "Rame", sp: "Argento", ep: "Electrum", gp: "Oro", pp: "Platino" };
export const COIN_SHORT: Record<string, string> = { cp: "mr", sp: "ma", ep: "me", gp: "mo", pp: "mp" };
const VALUE: Record<string, number> = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 };

export type Coins = Record<string, number>;

export const coinsValue = (coins: Coins) => COINS.reduce((total, key) => total + (coins[key] ?? 0) * VALUE[key], 0);
export const coinsText = (coins: Coins) => COINS.filter((key) => coins[key]).map((key) => `${coins[key]} ${COIN_SHORT[key]}`).reverse().join(", ") || "0";

export const earnCoins = (purse: Coins, amount: Coins): Coins => Object.fromEntries(COINS.map((key) => [key, (purse[key] ?? 0) + (amount[key] ?? 0)]));

// Toglie le monete chieste. Se ne manca un tipo, cambia una moneta più grande (es. 1 mo in 10 ma);
// se non ce ne sono, paga con monete più piccole. null se il totale non basta.
export function spendCoins(purse: Coins, cost: Coins): Coins | null {
  if (coinsValue(cost) > coinsValue(purse)) return null;
  const next: Coins = Object.fromEntries(COINS.map((key) => [key, (purse[key] ?? 0) - (cost[key] ?? 0)]));
  for (let index = 0; index < COINS.length; index++) {
    const key = COINS[index];
    while (next[key] < 0) {
      const larger = COINS.slice(index + 1).find((other) => next[other] > 0);
      // Si cambia nel taglio subito sotto (1 mp in 10 mo, non in 1000 mr), saltando l'electrum se non è quello chiesto: il ciclo ripete finché serve.
      if (larger) { const below = COINS.slice(0, COINS.indexOf(larger)).reverse().find((other) => other !== "ep" || other === key)!; next[larger] -= 1; next[below] += VALUE[larger] / VALUE[below]; continue; }
      // Nessuna moneta più grande: il debito si paga con le più piccole, dalla maggiore (i valori si dividono esattamente).
      let need = -next[key] * VALUE[key];
      next[key] = 0;
      for (const smaller of COINS.slice(0, index).reverse()) {
        const taken = Math.min(next[smaller], Math.floor(need / VALUE[smaller]));
        next[smaller] -= taken;
        need -= taken * VALUE[smaller];
      }
    }
  }
  return next;
}
