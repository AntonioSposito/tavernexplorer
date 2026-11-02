import type { CharacterSheet } from "./types";

export type HitPointField = "current" | "max" | "temp";
type Combat = CharacterSheet["combat"];

// Frecce e campi dei PF. effectiveMax = massimo con gli effetti attivi: i PF attuali salendo non lo superano
// (se erano già sopra restano), scendendo si fermano a 0. Tornare sopra 0 azzera i tiri salvezza contro la morte.
export function adjustHitPoints(combat: Combat, field: HitPointField, delta: number, effectiveMax = combat.hp.max): Combat {
  if (!Number.isSafeInteger(delta)) throw new Error("Inserisci un numero intero di PF");
  const hp = { ...combat.hp };
  let deathSaves = combat.deathSaves;
  if (field === "current") {
    hp.current = delta > 0 ? Math.max(hp.current, Math.min(Math.max(0, effectiveMax), hp.current + delta)) : Math.max(0, hp.current + delta);
    if (combat.hp.current === 0 && hp.current > 0) deathSaves = { successes: 0, failures: 0 };
  } else if (field === "temp") {
    hp.temp = Math.max(0, hp.temp + delta);
  } else {
    hp.max = Math.max(1, hp.max + delta);
    hp.current = Math.min(hp.current, Math.max(0, effectiveMax + hp.max - combat.hp.max));
  }
  return { ...combat, hp, deathSaves };
}

// Totale dei PF (attuali + temporanei) scritto nel turn order: scendendo è danno e consuma prima i temporanei,
// salendo è cura dei PF attuali (i temporanei restano).
export function setHitPointTotal(combat: Combat, total: number, effectiveMax = combat.hp.max): Combat {
  const delta = Math.max(0, Math.trunc(total)) - (combat.hp.current + combat.hp.temp);
  if (delta >= 0) return adjustHitPoints(combat, "current", delta, effectiveMax);
  const fromTemp = Math.min(combat.hp.temp, -delta);
  const reduced = adjustHitPoints(combat, "temp", -fromTemp, effectiveMax);
  return adjustHitPoints(reduced, "current", delta + fromTemp, effectiveMax);
}

// Tiro salvezza contro la morte dal d20 naturale: 20 = torna a 1 PF e azzera i tiri, 1 = due fallimenti,
// da 10 in su successo, sotto fallimento. I contatori si fermano a 3 (stabile o morto).
// bonus: Death save modifier delle opzioni; 20 e 1 naturali restano speciali.
export function applyDeathSave(combat: Combat, natural: number, bonus = 0): Combat {
  if (natural === 20) return { ...combat, hp: { ...combat.hp, current: Math.max(1, combat.hp.current) }, deathSaves: { successes: 0, failures: 0 } };
  const { successes, failures } = combat.deathSaves;
  const deathSaves = natural !== 1 && natural + bonus >= 10
    ? { successes: Math.min(3, successes + 1), failures }
    : { successes, failures: Math.min(3, failures + (natural === 1 ? 2 : 1)) };
  return { ...combat, deathSaves };
}
