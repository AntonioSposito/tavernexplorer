// @vitest-environment jsdom
// @ts-expect-error Node types are intentionally absent from the browser build.
import { webcrypto } from "node:crypto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { STORAGE_CHARACTERS, STORAGE_CLOSED_SPELL_LEVELS, STORAGE_MONSTERS } from "./constants";
import { apiFetch, store } from "./fakeRedis";
import { importRoll20 } from "./importer";
import { DEFAULT_RULESET } from "./rulesets";

vi.mock("@upstash/redis", async () => (await import("./fakeRedis")).fakeRedisModule);
vi.mock("./privateMessages", () => ({ publishGmMessageKey: async () => undefined }));
vi.mock("./fivetoolsApi", () => ({ listBestiarySources: async () => [], listAdventures: async () => [] }));
const viewer = vi.hoisted(() => ({ name: "GM", role: "GM" as "GM" | "PLAYER" }));
const noop = () => undefined;
const unsubscribe = () => noop;
vi.mock("./obr", () => ({
  OBR: { isAvailable: true, isReady: true, onReady: (callback: () => void) => callback(), room: { id: "r1", getPermissions: async () => [], onPermissionsChange: unsubscribe }, party: { onChange: unsubscribe }, scene: { isReady: async () => false, onReadyChange: unsubscribe, items: { onChange: unsubscribe } }, notification: { show: async () => undefined } },
  DEFAULT_PERMISSIONS: { playersEditInventory: true, playersImportContent: false, playersManageTurns: false },
  getPlayerInfo: async () => ({ id: viewer.name, ...viewer }),
  getTurnState: async () => ({ round: 1, activeIndex: 0, entries: [] }),
  getSharedInventory: async () => [], getPermissions: async () => ({ playersEditInventory: true, playersImportContent: false, playersManageTurns: false }),
  getPartyCharacters: async () => [], getSharedNotes: async () => [], getPartyMembers: async () => [{ id: "marco", name: "Marco", role: "PLAYER" }], getTokenImages: async () => ({}),
  onTurnStateChange: unsubscribe, onBroadcastMessage: unsubscribe, onSharedInventoryChange: unsubscribe, onPermissionsChange: unsubscribe,
  onPartyCharactersChange: unsubscribe, onSharedNotesChange: unsubscribe, onSheetsChanged: unsubscribe, notifySheetsChanged: noop,
  getCharacterTokens: async () => [], highlightToken: async () => undefined, setTokenCharacter: async () => undefined, setTokenOwner: async () => undefined,
  setActiveCharacter: async () => undefined, showRollOnMap: async () => undefined, broadcastMessage: async () => undefined,
}));

const { default: App } = await import("./App");
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: webcrypto });
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
  vi.stubGlobal("fetch", apiFetch);
  viewer.name = "GM"; viewer.role = "GM";
  store.clear(); localStorage.clear(); host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

const settle = (ms = 50) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));
const click = async (label: string) => {
  const buttons = [...host.querySelectorAll("button")];
  // Le tab principali sono solo icone: si cercano per aria-label.
  const button = buttons.find((item) => item.getAttribute("aria-label") === label) ?? buttons.find((item) => item.textContent?.includes(label));
  expect(button, `Pulsante ${label}`).toBeTruthy();
  await act(async () => button!.click());
};
const cloudSheet = () => JSON.parse(store.get("te:room:r1:sheets")?.values().next().value ?? "null");

it("carica nel cloud le schede locali e vi salva il riposo lungo", async () => {
  const sheet = importRoll20({ character: { name: "Eroe" }, normalized: { identity: { character_name: "Eroe" }, combat: { hp: { current: 2, max: 12 }, hit_dice: { current: 0, max: 2, die: "d8" } } } });
  localStorage.setItem(STORAGE_CHARACTERS, JSON.stringify([sheet]));
  await act(async () => root.render(<App/>));
  await settle();
  expect(cloudSheet()).toMatchObject({ kind: "pc", rev: 1, acl: { view: [], edit: [] }, sheet: { name: "Eroe" } });
  expect(JSON.parse(localStorage.getItem(STORAGE_CHARACTERS) || "[]")).toEqual([]);

  await click("Riposo lungo");
  await click("Completa riposo");
  await settle(1_700);
  expect(cloudSheet().sheet.combat.hp.current).toBe(12);
  expect(cloudSheet().sheet.combat.hitDice.current).toBe(2);
  expect(cloudSheet().rev).toBe(2);
});

it("il GM assegna la vista dalla Libreria e il giocatore vede solo quella scheda", async () => {
  for (const name of ["Ada", "Berto"]) {
    const sheet = importRoll20({ character: { name }, normalized: { identity: { character_name: name } } });
    await apiFetch("/api/sheets", { method: "PUT", body: JSON.stringify({ room: "r1", rev: 0, entry: { kind: "pc", sheet, acl: { view: [], edit: [] }, updatedBy: "GM" } }) });
  }
  await act(async () => root.render(<App/>));
  await settle();
  await click("Libreria");
  const picker = host.querySelector<HTMLSelectElement>('select[aria-label="Può vedere: aggiungi giocatore"]')!;
  expect([...picker.options].map((option) => option.textContent)).toContain("Marco");
  await act(async () => { picker.value = "Marco"; picker.dispatchEvent(new Event("change", { bubbles: true })); });
  await settle(1_700);
  const entries = [...store.get("te:room:r1:sheets")!.values()].map((value) => JSON.parse(value));
  expect(entries.filter((entry) => entry.acl.view.includes("Marco"))).toHaveLength(1);
  const visibleName = entries.find((entry) => entry.acl.view.includes("Marco")).sheet.name;

  await act(async () => root.unmount());
  localStorage.clear(); viewer.name = "Marco"; viewer.role = "PLAYER";
  root = createRoot(host);
  await act(async () => root.render(<App/>));
  await settle();
  await click("Libreria");
  expect(host.querySelectorAll(".library-entry")).toHaveLength(1);
  expect(host.textContent).toContain(`${visibleName}`);
  expect(host.textContent).toContain("sola lettura");
  expect(host.textContent).not.toContain("Importa Roll20");
  expect(host.querySelector('select[aria-label="Può vedere: aggiungi giocatore"]')).toBeNull();
});

it("il GM crea un NPC dal bestiario e un giocatore con permesso ne vede lo statblock", async () => {
  const wolf = { schemaVersion: 1, id: "wolf", name: "Lupo", source: "XMM", creatureType: "Bestia", challengeRating: "1/4", ruleset: { id: DEFAULT_RULESET.id, version: DEFAULT_RULESET.version }, size: "M", alignment: "N", ac: 13, hp: { average: 11, formula: "2d8+2" }, speed: "40 ft.", abilities: { dex: 15 }, saves: {}, skills: {}, passivePerception: 13, traits: [], actions: [{ id: "bite", name: "Morso", description: "" }], reactions: [], legendaryActions: [], importWarnings: [] };
  localStorage.setItem(STORAGE_MONSTERS, JSON.stringify([wolf]));
  vi.stubGlobal("prompt", () => "Lupo Grigio");
  await act(async () => root.render(<App/>));
  await settle();
  await click("Bestiario");
  await click("Lupo");
  await click("Aggiungi agli NPC");
  await settle();
  const npc = [...store.get("te:room:r1:sheets")!.values()].map((value) => JSON.parse(value))[0];
  expect(npc).toMatchObject({ kind: "npc", rev: 1, acl: { view: [], edit: [] }, sheet: { name: "Lupo Grigio", ac: 13 } });
  expect(npc.sheet.id).not.toBe("wolf");
  await apiFetch("/api/sheets", { method: "PUT", body: JSON.stringify({ room: "r1", rev: 1, entry: { ...npc, acl: { view: ["Marco"], edit: [] } } }) });

  await act(async () => root.unmount());
  localStorage.clear(); viewer.name = "Marco"; viewer.role = "PLAYER";
  root = createRoot(host);
  await act(async () => root.render(<App/>));
  await settle();
  await click("Libreria");
  await click("NPC");
  await click("Lupo Grigio");
  expect(host.textContent).toContain("PF medi");
  expect(host.textContent).toContain("Morso");
  expect(host.textContent).not.toContain("Aggiungi agli NPC");
});

const type = async (selector: string, value: string) => {
  const input = host.querySelector<HTMLInputElement>(selector)!;
  expect(input, selector).toBeTruthy();
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
};

it("crea una nuova azione e converte un'azione importata senza cambiarne i tiri", async () => {
  const sheet = importRoll20({ character: { name: "Eroe" }, normalized: { identity: { character_name: "Eroe" } } });
  sheet.abilities.strength = { score: 16, mod: 3, save: 3, saveProficient: false };
  sheet.combat.proficiencyBonus = 2;
  sheet.actions = [{ id: "dagger", name: "Pugnale", attackBonus: 5, damage: "1d4+3", damageType: "Perforante" }];
  await apiFetch("/api/sheets", { method: "PUT", body: JSON.stringify({ room: "r1", rev: 0, entry: { kind: "pc", sheet, acl: { view: [], edit: [] }, updatedBy: "GM" } }) });
  await act(async () => root.render(<App/>));
  await settle();
  await click("Azioni");

  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Modifica Pugnale"]')!.click());
  await click("Salva");
  await click("+ Nuova azione");
  await type(".action-form input", "Spada lunga");
  await type('.action-form input[placeholder="1d8"]', "1d8");
  await click("Salva");
  await settle(1_700);

  const actions = cloudSheet().sheet.actions;
  expect(actions[0]).toMatchObject({ name: "Pugnale", attack: { ability: "none", bonus: 5, proficient: false }, damages: [{ dice: "1d4+3", critDice: "1d4", type: "Perforante" }] });
  expect(actions[0].attackBonus).toBeUndefined();
  expect(actions[1]).toMatchObject({ name: "Spada lunga", attack: { ability: "strength", proficient: true }, damages: [{ dice: "1d8", ability: "strength" }] });
  expect(host.textContent).toContain("+5 1d4+3");
  expect(host.textContent).toContain("+5 1d8+3");
});

it("l'attacco tira anche il danno, critico se il d20 naturale è nella gamma", async () => {
  const sheet = importRoll20({ character: { name: "Eroe" }, normalized: { identity: { character_name: "Eroe" } } });
  sheet.abilities.strength = { score: 16, mod: 3, save: 3, saveProficient: false };
  sheet.combat.proficiencyBonus = 2;
  sheet.actions = [{ id: "sword", name: "Spada", attack: { ability: "strength", bonus: 0, proficient: true }, critRange: 19, damages: [{ dice: "1d8", ability: "strength", bonus: 0, type: "Tagliente", critDice: "1d8" }] }];
  await apiFetch("/api/sheets", { method: "PUT", body: JSON.stringify({ room: "r1", rev: 0, entry: { kind: "pc", sheet, acl: { view: [], edit: [] }, updatedBy: "GM" } }) });
  await act(async () => root.render(<App/>));
  await settle();
  await click("Azioni");
  expect([...host.querySelectorAll(".entry-icons button")].map((button) => button.getAttribute("aria-label"))).toEqual(["Mostra in chat Spada", "Modifica Spada"]);
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Mostra in chat Spada"]')!.click());
  expect(host.querySelector<HTMLDetailsElement>(".entry")?.open).toBe(false);
  expect(host.querySelector(".app-tabs .active")?.getAttribute("aria-label")).toBe("Scheda");
  vi.spyOn(crypto, "getRandomValues").mockImplementation((array) => { (array as Uint32Array)[0] = 18; return array; });
  await act(async () => host.querySelector<HTMLButtonElement>(".entry-use")!.click());
  await click("Normale");
  vi.restoreAllMocks();
  expect(host.querySelector(".app-tabs .active")?.getAttribute("aria-label")).toBe("Scheda");
  await click("Messaggi");
  const card = host.querySelectorAll(".r20-card")[1];
  expect(card.querySelector("header")?.textContent).toBe("Spada");
  expect([...card.querySelectorAll(".r20-row")].map((row) => row.textContent)).toEqual(["Colpire24", "Danno critico9Tagliente"]);
  expect(card.querySelector(".r20-roll.crit")?.textContent).toBe("24");
  expect([...card.querySelectorAll(".r20-roll")].map((roll) => roll.getAttribute("title"))).toEqual(["Roll 1d20 + 3[STR] + 2[PROF] = (19) + 3 + 2", "Roll 1d8 + 1d8 + 3[STR] = (3) + (3) + 3"]);
  const shared = host.querySelectorAll(".r20-card")[0];
  expect([...shared.querySelectorAll(".r20-row")].map((row) => row.textContent)).toEqual(["Colpire+5critico 19-20", "Danno1d8+3Tagliente"]);
});

it("riordina le azioni con Modifica ordine e salva il nuovo ordine", async () => {
  const sheet = importRoll20({ character: { name: "Eroe" }, normalized: { identity: { character_name: "Eroe" } } });
  sheet.actions = [{ id: "a", name: "Arco" }, { id: "b", name: "Bastone" }, { id: "c", name: "Coltello" }];
  await apiFetch("/api/sheets", { method: "PUT", body: JSON.stringify({ room: "r1", rev: 0, entry: { kind: "pc", sheet, acl: { view: [], edit: [] }, updatedBy: "GM" } }) });
  await act(async () => root.render(<App/>));
  await settle();
  await click("Azioni");
  await click("Modifica ordine");
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Sposta giù Arco"]')!.click());
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Sposta su Coltello"]')!.click());
  expect([...host.querySelectorAll(".order-list li span")].map((item) => item.textContent)).toEqual(["Bastone", "Coltello", "Arco"]);
  await click("Fine");
  expect([...host.querySelectorAll(".entry summary strong")].map((item) => item.textContent)).toEqual(["Bastone", "Coltello", "Arco"]);
  await settle(1_700);
  expect(cloudSheet().sheet.actions.map((action: { name: string }) => action.name)).toEqual(["Bastone", "Coltello", "Arco"]);
});

it("le magie si usano dal nome: attacco con danno o card con la CD", async () => {
  const sheet = importRoll20({ character: { name: "Maga" }, normalized: { identity: { character_name: "Maga" } } });
  sheet.spellcasting.saveDc = 13;
  sheet.spellcasting.slots = { level_2: { total: 3, used: 1 }, level_3: { total: 2, used: 0 } };
  sheet.spells = [
    { id: "bolt", name: "Dardo di fuoco", level: 0, school: "Invocazione", prepared: true, ritual: false, concentration: false, attackBonus: 5, damage: "1d10", damageType: "Fuoco", range: "36 m", description: "" },
    { id: "hold", name: "Blocca persone", level: 2, school: "Ammaliamento", prepared: true, ritual: false, concentration: true, saveDc: 13, description: "Paralizza." },
    { id: "shield", name: "Scudo", level: 2, prepared: true, ritual: false, concentration: false, description: "+5 alla CA." },
  ];
  await apiFetch("/api/sheets", { method: "PUT", body: JSON.stringify({ room: "r1", rev: 0, entry: { kind: "pc", sheet, acl: { view: [], edit: [] }, updatedBy: "GM" } }) });
  await act(async () => root.render(<App/>));
  await settle();
  await click("Magia");
  expect([...host.querySelectorAll(".spell-level")].map((section) => [section.querySelector("h2")?.textContent, section.querySelector(".slot strong")?.textContent ?? null])).toEqual([["Trucchetti", null], ["Livello 2", "2 / 3"], ["Livello 3", "2 / 2"]]);
  expect([...host.querySelectorAll<HTMLDetailsElement>(".spell-level")].every((level) => level.tagName === "DETAILS" && level.open)).toBe(true);
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Usa slot level_2"]')!.click());
  expect(host.querySelectorAll(".spell-level")[1].querySelector(".slot strong")?.textContent).toBe("1 / 3");
  expect(host.querySelectorAll(".spell-level")[1].querySelector("summary .slot strong")?.textContent).toBe("1 / 3");
  await act(async () => { host.querySelectorAll<HTMLDetailsElement>(".spell-level")[2].open = false; });
  await settle();
  expect(JSON.parse(localStorage.getItem(STORAGE_CLOSED_SPELL_LEVELS) ?? "[]")).toEqual([`${sheet.id}:3`]);
  expect([...host.querySelectorAll(".spell-level")[1].querySelectorAll(".slot button")].map((button) => `${button.textContent} ${button.getAttribute("aria-label")}`)).toEqual(["− Usa slot level_2", "+ Recupera slot level_2"]);
  const [bolt, hold, shield] = [...host.querySelectorAll<HTMLButtonElement>(".entry-use")];
  expect(shield.textContent).toBe("Scudo");
  await act(async () => bolt.click());
  await click("Normale");
  await act(async () => hold.click());
  expect([...host.querySelectorAll(".cast-choice button")].map((button) => button.textContent)).toEqual(["Livello 2 (1/3)", "Livello 3 (2/2)", "Senza slot"]);
  await click("Livello 3 (2/2)");
  expect(host.querySelectorAll(".spell-level")[2].querySelector(".slot strong")?.textContent).toBe("1 / 2");
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Recupera slot level_2"]')!.click());
  await act(async () => hold.click());
  await click("Senza slot");
  expect(host.querySelector(".app-tabs .active")?.getAttribute("aria-label")).toBe("Scheda");
  await click("Messaggi");
  const [boltCard, holdCard, notice, freeCast] = [...host.querySelectorAll(".r20-card")];
  expect(holdCard.querySelector(".r20-alert")).toBeNull();
  expect(notice.querySelector(".r20-alert")?.textContent).toBe("⚠ Slot di livello 2 recuperato a mano: 2/3");
  expect(freeCast.querySelector(".r20-alert")?.textContent).toBe("⚠ Lanciato senza slot");
  expect(boltCard.querySelector("header")?.textContent).toBe("Dardo di fuocoTrucchetto · Invocazione · Gittata 36 m");
  expect(boltCard.querySelector(".r20-label")?.textContent).toBe("Colpire");
  expect(holdCard.querySelector("header")?.textContent).toBe("Blocca personeLivello 2 · Ammaliamento · concentrazione · slot di livello 3");
  expect(holdCard.textContent).toContain("CD 13");
  expect(host.querySelector(".message header strong")?.textContent).toBe("Maga (GM)");
});

it("aggiunge e modifica un incantesimo dal suo livello", async () => {
  const sheet = importRoll20({ character: { name: "Maga" }, normalized: { identity: { character_name: "Maga" } } });
  sheet.spellcasting.slots = { level_1: { total: 2, used: 0 } };
  await apiFetch("/api/sheets", { method: "PUT", body: JSON.stringify({ room: "r1", rev: 0, entry: { kind: "pc", sheet, acl: { view: [], edit: [] }, updatedBy: "GM" } }) });
  await act(async () => root.render(<App/>));
  await settle();
  await click("Magia");
  expect([...host.querySelectorAll(".spell-add")].map((button) => button.textContent)).toEqual(["+ Aggiungi trucchetto", "+ Aggiungi incantesimo"]);
  await act(async () => host.querySelectorAll<HTMLButtonElement>(".spell-add")[1].click());
  await type(".spell-form input", "Dardo incantato");
  await type('.spell-form input[placeholder="1d4+1"]', "1d4+1");
  await click("Salva");
  expect(host.querySelectorAll(".spell-level")[1].querySelector(".entry-use")?.textContent).toBe("Dardo incantato");
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Modifica Dardo incantato"]')!.click());
  await type('.spell-form input[placeholder="36 metri"]', "36 metri");
  await click("Salva");
  await settle(1_700);
  expect(cloudSheet().sheet.spells).toMatchObject([{ name: "Dardo incantato", level: 1, range: "36 metri", damages: [{ dice: "1d4+1" }] }]);
});

it("modifica PF attuali e temporanei con frecce e campo numerico, i massimi restano in sola lettura", async () => {
  const sheet = importRoll20({ character: { name: "Eroe" }, normalized: { identity: { character_name: "Eroe" }, combat: { hp: { current: 10, max: 12 } } } });
  await apiFetch("/api/sheets", { method: "PUT", body: JSON.stringify({ room: "r1", rev: 0, entry: { kind: "pc", sheet, acl: { view: [], edit: [] }, updatedBy: "GM" } }) });
  await act(async () => root.render(<App/>));
  await settle();
  const press = (label: string) => act(async () => host.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!.click());
  await press("Aumenta PF attuali");
  await press("Aumenta PF attuali");
  await press("Aumenta PF attuali");
  const temp = host.querySelector<HTMLInputElement>('input[aria-label="PF temporanei"]')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(temp, "5"); temp.dispatchEvent(new Event("input", { bubbles: true })); });
  await act(async () => { temp.focus(); temp.blur(); });
  expect(host.querySelector('[aria-label="Diminuisci PF massimi"]')).toBeNull();
  expect(host.querySelector(".hit-point-box.max strong")?.textContent).toBe("12");
  expect([...host.querySelectorAll<HTMLInputElement>(".hit-point-control:not(.hit-dice-control) .hit-point-box input")].map((input) => input.value)).toEqual(["12", "5"]);
  await settle(1_700);
  expect(cloudSheet().sheet.combat.hp).toEqual({ current: 12, max: 12, temp: 5 });
});

it("prepara un incantesimo e avvisa il tavolo in chat", async () => {
  const sheet = importRoll20({ character: { name: "Maga" }, normalized: { identity: { character_name: "Maga" } } });
  sheet.spells = [
    { id: "light", name: "Luce", level: 0, prepared: false, ritual: false, concentration: false },
    { id: "sleep", name: "Sonno", level: 1, prepared: false, ritual: false, concentration: false },
  ];
  await apiFetch("/api/sheets", { method: "PUT", body: JSON.stringify({ room: "r1", rev: 0, entry: { kind: "pc", sheet, acl: { view: [], edit: [] }, updatedBy: "GM" } }) });
  await act(async () => root.render(<App/>));
  await settle();
  await click("Magia");
  expect(host.querySelectorAll(".prepared-toggle")).toHaveLength(1);
  const toggle = () => host.querySelector<HTMLButtonElement>('[aria-label="Preparato Sonno"]')!;
  await act(async () => toggle().click());
  expect(toggle().getAttribute("aria-pressed")).toBe("true");
  await act(async () => toggle().click());
  expect(toggle().getAttribute("aria-pressed")).toBe("false");
  await act(async () => toggle().click());
  await settle(1_700);
  expect(cloudSheet().sheet.spells[1].prepared).toBe(true);
  await click("Messaggi");
  expect([...host.querySelectorAll(".r20-alert")].map((alert) => alert.textContent)).toEqual(["⚠ Sonno (livello 1) preparato", "⚠ Sonno (livello 1) preparato"]);
});

it("tira un dado vita scalandolo dagli attuali; totale e dado si cambiano in Modifica", async () => {
  const sheet = importRoll20({ character: { name: "Eroe" }, normalized: { identity: { character_name: "Eroe" }, combat: { hp: { current: 5, max: 30 }, hit_dice: { current: 1, max: 3, die: "d10" } } } });
  sheet.abilities.constitution = { score: 14, mod: 2, save: 2, saveProficient: false };
  await apiFetch("/api/sheets", { method: "PUT", body: JSON.stringify({ room: "r1", rev: 0, entry: { kind: "pc", sheet, acl: { view: [], edit: [] }, updatedBy: "GM" } }) });
  await act(async () => root.render(<App/>));
  await settle();
  expect(host.querySelector(".hit-dice-control .hit-point-box.max strong")?.textContent).toBe("3");
  vi.spyOn(crypto, "getRandomValues").mockImplementation((array) => { (array as Uint32Array)[0] = 6; return array; });
  await click("Dado vita (d10)");
  await settle();
  vi.restoreAllMocks();
  // d10 = 7, +2 COS: 5 + 9 = 14 PF.
  expect(host.querySelector<HTMLInputElement>('input[aria-label="PF attuali"]')?.value).toBe("14");
  expect(host.querySelector<HTMLInputElement>('input[aria-label="Dadi vita attuali"]')?.value).toBe("0");
  expect(host.querySelector<HTMLButtonElement>(".hit-dice-roll")?.disabled).toBe(true);
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Aumenta Dadi vita attuali"]')!.click());
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Aumenta Dadi vita attuali"]')!.click());
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Aumenta Dadi vita attuali"]')!.click());
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Aumenta Dadi vita attuali"]')!.click());
  expect(host.querySelector<HTMLInputElement>('input[aria-label="Dadi vita attuali"]')?.value).toBe("3");
  await click("Messaggi");
  expect(host.querySelector(".r20-card .r20-row")?.textContent).toBe("PF recuperati9");
  expect(host.querySelector(".r20-card .r20-roll")?.getAttribute("title")).toBe("Roll 1d10 + 2[CON] = (7) + 2");
  await click("Scheda");
  await click("Modifica");
  const select = [...host.querySelectorAll<HTMLSelectElement>("select")].find((item) => item.closest("label")?.textContent?.startsWith("Dado vita"))!;
  await act(async () => { select.value = "d8"; select.dispatchEvent(new Event("change", { bubbles: true })); });
  await settle(1_700);
  expect(cloudSheet().sheet.combat.hitDice).toEqual({ current: 3, max: 3, die: "d8" });
});

it("TS contro la morte solo a 0 PF: un 1 naturale colora due fallimenti", async () => {
  const sheet = importRoll20({ character: { name: "Eroe" }, normalized: { identity: { character_name: "Eroe" }, combat: { hp: { current: 0, max: 10 } } } });
  await apiFetch("/api/sheets", { method: "PUT", body: JSON.stringify({ room: "r1", rev: 0, entry: { kind: "pc", sheet, acl: { view: [], edit: [] }, updatedBy: "GM" } }) });
  await act(async () => root.render(<App/>));
  await settle();
  vi.spyOn(crypto, "getRandomValues").mockImplementation((array) => { (array as Uint32Array)[0] = 0; return array; });
  await click("TS morte");
  await settle();
  vi.restoreAllMocks();
  expect(host.querySelectorAll(".death-dot.failure")).toHaveLength(2);
  expect(host.querySelectorAll(".death-dot.success")).toHaveLength(0);
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Aumenta PF attuali"]')!.click());
  expect(host.querySelectorAll(".death-dot.failure")).toHaveLength(0);
  expect([...host.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "TS morte")?.disabled).toBe(true);
});

it("attiva e toglie l'ispirazione dalla tab Base", async () => {
  const sheet = importRoll20({ character: { name: "Eroe" }, normalized: { identity: { character_name: "Eroe" } } });
  await apiFetch("/api/sheets", { method: "PUT", body: JSON.stringify({ room: "r1", rev: 0, entry: { kind: "pc", sheet, acl: { view: [], edit: [] }, updatedBy: "GM" } }) });
  await act(async () => root.render(<App/>));
  await settle();
  const box = () => host.querySelector<HTMLButtonElement>(".inspiration")!;
  expect(box().getAttribute("aria-pressed")).toBe("false");
  await act(async () => box().click());
  expect(box().getAttribute("aria-pressed")).toBe("true");
  await settle(1_700);
  expect(cloudSheet().sheet.combat.inspiration).toBe(true);
});

it("il riposo breve chiede i dadi vita da spendere nella finestra di conferma", async () => {
  const sheet = importRoll20({ character: { name: "Eroe" }, normalized: { identity: { character_name: "Eroe" }, combat: { hp: { current: 3, max: 30 }, hit_dice: { current: 2, max: 3, die: "d8" } } } });
  await apiFetch("/api/sheets", { method: "PUT", body: JSON.stringify({ room: "r1", rev: 0, entry: { kind: "pc", sheet, acl: { view: [], edit: [] }, updatedBy: "GM" } }) });
  await act(async () => root.render(<App/>));
  await settle();
  expect(host.querySelector('input[aria-label="Dadi vita da spendere"]')).toBeNull();
  await click("Riposo breve");
  await type('input[aria-label="Dadi vita da spendere"]', "5");
  expect(host.querySelector<HTMLInputElement>('input[aria-label="Dadi vita da spendere"]')?.value).toBe("2");
  await click("Completa riposo");
  await settle(1_700);
  expect(cloudSheet().sheet.combat.hitDice.current).toBe(0);
  expect(cloudSheet().sheet.combat.hp.current).toBeGreaterThan(3);
});

it("chiede conferma prima di eliminare una risorsa personale", async () => {
  const sheet = importRoll20({ character: { name: "Eroe" }, normalized: { identity: { character_name: "Eroe" } } });
  sheet.counters = [{ id: "ki", name: "Ki", current: 2, max: 3, recovery: "short" }];
  await apiFetch("/api/sheets", { method: "PUT", body: JSON.stringify({ room: "r1", rev: 0, entry: { kind: "pc", sheet, acl: { view: [], edit: [] }, updatedBy: "GM" } }) });
  await act(async () => root.render(<App/>));
  await settle();
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Elimina Ki"]')!.click());
  expect(host.querySelector(".ui-dialog p")?.textContent).toBe("Ki verrà rimossa dalla scheda.");
  await click("Annulla");
  expect(host.querySelector('[aria-label="Elimina Ki"]')).not.toBeNull();
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Elimina Ki"]')!.click());
  await act(async () => [...host.querySelectorAll<HTMLButtonElement>(".ui-dialog button")].find((button) => button.textContent === "Elimina")!.click());
  expect(host.querySelector('[aria-label="Elimina Ki"]')).toBeNull();
});

it("aggiunge una risorsa dal pulsante e ne cambia l'ordine", async () => {
  const sheet = importRoll20({ character: { name: "Eroe" }, normalized: { identity: { character_name: "Eroe" } } });
  sheet.counters = [{ id: "ki", name: "Ki", current: 2, max: 3, recovery: "short" }];
  await apiFetch("/api/sheets", { method: "PUT", body: JSON.stringify({ room: "r1", rev: 0, entry: { kind: "pc", sheet, acl: { view: [], edit: [] }, updatedBy: "GM" } }) });
  await act(async () => root.render(<App/>));
  await settle();
  await click("+ Nuova risorsa");
  await type('input[aria-label="Nome nuova risorsa"]', "Ira");
  await click("Aggiungi");
  await click("Modifica ordine");
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Sposta su Ira"]')!.click());
  await click("Fine");
  await settle(1_700);
  expect(cloudSheet().sheet.counters.map((counter: { name: string }) => counter.name)).toEqual(["Ira", "Ki"]);
});

it("riordina gli incantesimi dentro il loro livello; gli slot nel titolo non chiudono il riquadro", async () => {
  const sheet = importRoll20({ character: { name: "Maga" }, normalized: { identity: { character_name: "Maga" } } });
  sheet.spellcasting.slots = { level_1: { total: 2, used: 0 } };
  sheet.spells = [
    { id: "a", name: "Armatura magica", level: 1, prepared: true, ritual: false, concentration: false },
    { id: "l", name: "Luce", level: 0, prepared: true, ritual: false, concentration: false },
    { id: "s", name: "Sonno", level: 1, prepared: true, ritual: false, concentration: false },
  ];
  await apiFetch("/api/sheets", { method: "PUT", body: JSON.stringify({ room: "r1", rev: 0, entry: { kind: "pc", sheet, acl: { view: [], edit: [] }, updatedBy: "GM" } }) });
  await act(async () => root.render(<App/>));
  await settle();
  await click("Magia");
  const levelOne = () => host.querySelectorAll<HTMLDetailsElement>(".spell-level")[1];
  await act(async () => levelOne().querySelector<HTMLButtonElement>('[aria-label="Usa slot level_1"]')!.click());
  expect(levelOne().open).toBe(true);
  expect(levelOne().querySelector("summary .slot strong")?.textContent).toBe("1 / 2");
  await act(async () => [...levelOne().querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Modifica ordine")!.click());
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Sposta su Sonno"]')!.click());
  await click("Fine");
  expect([...levelOne().querySelectorAll(".entry-use")].map((button) => button.textContent)).toEqual(["Sonno", "Armatura magica"]);
  await settle(1_700);
  expect(cloudSheet().sheet.spells.map((spell: { name: string }) => spell.name)).toEqual(["Sonno", "Luce", "Armatura magica"]);
});
