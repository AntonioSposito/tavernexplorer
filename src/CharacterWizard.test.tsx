// @vitest-environment jsdom
// @ts-expect-error Node types are intentionally absent from the browser build.
import { webcrypto } from "node:crypto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { CharacterOptions } from "./fivetoolsCharacter";
import type { CharacterSheet } from "./types";

const OPTIONS: CharacterOptions = {
  classes: [{ name: "Fighter", hitDie: 10, saves: ["strength", "constitution"], skills: { from: ["athletics", "perception", "survival"], count: 2 }, armor: ["heavy"], weapons: ["simple", "martial"], tools: [], cantrips: 0, spells: 0, prepared: 0,
    equipment: [{ key: "A", items: [{ ref: "chain mail|xphb", name: "Chain Mail", quantity: 1 }], tools: [], copper: 400 }, { key: "C", items: [], tools: [], copper: 15500 }], features: [{ name: "Second Wind", description: "Regain HP." }] }],
  backgrounds: [{ name: "Soldier", abilities: ["strength", "dexterity", "constitution"], feat: "Savage Attacker", skills: ["athletics", "intimidation"], tools: [{ kinds: ["gaming"], count: 1 }], equipment: [{ key: "A", items: [], tools: ["gaming"], copper: 1400 }, { key: "B", items: [], tools: [], copper: 5000 }] }],
  species: [{ name: "Human", sizes: ["M"], speed: 30, skills: { from: ["stealth", "perception"], count: 1 }, originFeat: true, traits: [{ name: "Resourceful", description: "Inspiration." }] }],
  feats: [{ name: "Tough", description: "+2 HP." }, { name: "Savage Attacker", description: "Reroll." }],
  spells: [],
};
vi.mock("./fivetoolsApi", () => ({
  loadCharacterOptions: async () => OPTIONS,
  loadItems: async () => [
    { id: "Chain Mail|XPHB", name: "Chain Mail", source: "XPHB", detail: "XPHB · Heavy Armor · 55 lb", item: { name: "Chain Mail", weight: 55, modifiersText: "Item Type: Heavy Armor, AC 16" } },
    { id: "Dice Set|XPHB", name: "Dice Set", source: "XPHB", detail: "XPHB · Gaming Set", item: { name: "Dice Set", weight: 0 } },
  ],
}));

const { CharacterWizard } = await import("./CharacterWizard");
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: webcrypto });
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 10)));
const choose = async (label: string, value: string) => {
  // Confronto diretto: il selettore CSS di jsdom non trova valori con "+".
  const select = [...host.querySelectorAll("select")].find((item) => item.getAttribute("aria-label") === label);
  expect(select, label).toBeTruthy();
  await act(async () => { select!.value = value; select!.dispatchEvent(new Event("change", { bubbles: true })); });
};
const tick = async (text: string) => {
  const input = [...host.querySelectorAll<HTMLLabelElement>("label")].find((label) => label.textContent?.includes(text))?.querySelector("input");
  expect(input, text).toBeTruthy();
  await act(async () => input!.click());
};
const next = () => host.querySelector<HTMLButtonElement>('button[type="submit"]')!;
const advance = async () => { expect(next().disabled).toBe(false); await act(async () => next().click()); };

it("crea un Guerriero passo per passo e consegna la scheda compilata", async () => {
  const created: CharacterSheet[] = [];
  await act(async () => root.render(<CharacterWizard name="Brunhild" onCreate={(sheet) => created.push(sheet)} onCancel={() => undefined}/>));
  await settle();

  expect(next().disabled).toBe(true);
  await choose("Classe", "Fighter");
  expect(host.textContent).toContain("d10");
  await advance();
  await choose("Background", "Soldier");
  await advance();
  await choose("Specie", "Human");
  expect(next().disabled).toBe(true);
  await choose("Talento d'origine (Versatile)", "Tough");
  await advance();

  for (const [ability, score] of [["Forza", 15], ["Destrezza", 13], ["Costituzione", 14], ["Intelligenza", 8], ["Saggezza", 12], ["Carisma", 10]] as const) await choose(`Punteggio ${ability}`, String(score));
  await choose("Bonus +2", "strength");
  expect(next().disabled).toBe(true);
  await choose("Bonus +1", "constitution");
  await advance();

  // Atletica viene dal background: non si può scegliere di nuovo con la classe.
  expect(host.textContent).not.toContain("AtleticaPercezione");
  await tick("Percezione");
  await tick("Sopravvivenza");
  await tick("Furtività");
  await choose("Strumento del background", "Dice Set");
  await choose("Lingua 2 (oltre al Comune)", "Dwarvish");
  await choose("Lingua 3 (oltre al Comune)", "Giant");
  await advance();

  await tick("(A) Chain Mail");
  await tick("(A) Gaming Set");
  await advance();

  expect(host.textContent).toContain("PF14");
  expect(host.textContent).toContain("CA16");
  await advance();
  expect(created).toHaveLength(1);
  expect(created[0]).toMatchObject({ name: "Brunhild", identity: { className: "Fighter", race: "Human", background: "Soldier" }, abilities: { strength: { score: 17 } } });
  expect(created[0].inventory.map((item) => item.name)).toEqual(["Chain Mail", "Dice Set"]);
});

it("con l'acquisto a punti non si superano i 27 punti", async () => {
  await act(async () => root.render(<CharacterWizard name="X" onCreate={() => undefined} onCancel={() => undefined}/>));
  await settle();
  await choose("Classe", "Fighter"); await advance();
  await choose("Background", "Soldier"); await advance();
  await choose("Specie", "Human"); await choose("Talento d'origine (Versatile)", "Tough"); await advance();
  await choose("Metodo dei punteggi", "points");
  await choose("Bonus del background", "111");
  expect(next().disabled).toBe(false);
  const type = async (label: string, value: string) => { const input = host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!; await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); }); };
  for (const ability of ["Forza", "Destrezza", "Costituzione"]) await type(`Punteggio ${ability}`, "15");
  expect(host.textContent).toContain("Punti spesi: 27 / 27");
  expect(next().disabled).toBe(false);
  await type("Punteggio Saggezza", "9");
  expect(next().disabled).toBe(true);
});

it("i tiri fatti con i dadi veri si scrivono a mano, da 3 a 18", async () => {
  await act(async () => root.render(<CharacterWizard name="X" onCreate={() => undefined} onCancel={() => undefined}/>));
  await settle();
  await choose("Classe", "Fighter"); await advance();
  await choose("Background", "Soldier"); await advance();
  await choose("Specie", "Human"); await choose("Talento d'origine (Versatile)", "Tough"); await advance();
  await choose("Metodo dei punteggi", "manual");
  await choose("Bonus del background", "111");
  expect(next().disabled).toBe(true);
  const type = async (label: string, value: string) => { const input = host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!; await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); }); };
  for (const [ability, score] of [["Forza", "17"], ["Destrezza", "9"], ["Costituzione", "14"], ["Intelligenza", "12"], ["Saggezza", "6"], ["Carisma", "18"]]) await type(`Punteggio ${ability}`, score);
  expect(next().disabled).toBe(false);
  await type("Punteggio Saggezza", "19");
  expect(next().disabled).toBe(true);
});
