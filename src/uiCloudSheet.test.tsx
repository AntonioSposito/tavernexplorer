// @vitest-environment jsdom
// @ts-expect-error Node types are intentionally absent from the browser build.
import { webcrypto } from "node:crypto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { STORAGE_CHARACTERS, STORAGE_CLOSED_MONSTER_SECTIONS, STORAGE_CLOSED_SPELL_LEVELS, STORAGE_LIBRARY_SORT, STORAGE_MESSAGES, STORAGE_MONSTERS, TOKEN_META_KEY } from "./constants";
import { apiFetch, store } from "./fakeRedis";
import type { ToolEntry } from "./types";
import { importRoll20 } from "./importer";
import { DEFAULT_RULESET } from "./rulesets";

vi.mock("@upstash/redis", async () => (await import("./fakeRedis")).fakeRedisModule);
vi.mock("./privateMessages", () => ({ publishGmMessageKey: async () => undefined }));
vi.mock("./fivetoolsApi", () => ({ listBestiarySources: async () => [], listAdventures: async () => [], loadSpells: async () => [{ name: "Fireball", level: 3, classes: ["Wizard"], spell: { name: "Fireball", level: 3, school: "Evocation", prepared: false, ritual: false, concentration: false } }, { name: "Sleep", level: 1, classes: ["Wizard"], spell: { name: "Sleep", level: 1, prepared: false, ritual: false, concentration: false } }], loadItems: async () => [
  { id: "Shield|XPHB", name: "Shield", source: "XPHB", detail: "XPHB · Shield · 6 lb", item: { name: "Shield", weight: 6, modifiersText: "Item Type: Shield, AC +2", description: "Uno scudo." } },
] }));
const viewer = vi.hoisted(() => ({ name: "GM", role: "GM" as "GM" | "PLAYER", tokens: [] as unknown[] }));
const noop = () => undefined;
const unsubscribe = () => noop;
vi.mock("./obr", () => ({
  OBR: { isAvailable: true, isReady: true, onReady: (callback: () => void) => callback(), room: { id: "r1", getPermissions: async () => [], onPermissionsChange: unsubscribe }, party: { onChange: unsubscribe }, scene: { isReady: async () => false, onReadyChange: unsubscribe, items: { onChange: unsubscribe, getItems: async () => viewer.tokens } }, player: { getRole: async () => viewer.role }, popover: { close: async () => undefined }, notification: { show: async () => undefined } },
  DEFAULT_PERMISSIONS: { playersEditInventory: true, playersImportContent: false, playersManageTurns: false },
  getPlayerInfo: async () => ({ id: viewer.name, ...viewer }),
  getTurnState: async () => ({ round: 1, activeIndex: 0, entries: [] }),
  getSharedInventory: async () => [], getPermissions: async () => ({ playersEditInventory: true, playersImportContent: false, playersManageTurns: false }),
  getPartyCharacters: async () => [], getPartyMembers: async () => [{ id: "marco", name: "Marco", role: "PLAYER" }], getTokenImages: async () => ({}),
  onTurnStateChange: unsubscribe, onBroadcastMessage: unsubscribe, onSharedInventoryChange: unsubscribe, onPermissionsChange: unsubscribe,
  onPartyCharactersChange: unsubscribe, onSheetsChanged: unsubscribe, notifySheetsChanged: noop,
  getCharacterTokens: async () => [], highlightToken: async () => undefined, setTokenCharacter: async () => undefined, setTokenOwner: async () => undefined,
  setActiveCharacter: async () => undefined, showRollOnMap: async () => undefined, broadcastMessage: async () => undefined,
  pickOwlbearImage: async () => "https://owlbear.example/token.png",
}));

const { default: App } = await import("./App");
const { diagramText } = await import("./journalTree");
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: webcrypto });
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
  vi.stubGlobal("fetch", apiFetch);
  viewer.name = "GM"; viewer.role = "GM"; viewer.tokens = [];
  store.clear(); localStorage.clear(); host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); window.history.replaceState(null, "", "/"); });

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

it("l'immagine token si sceglie dalle immagini Owlbear e si toglie", async () => {
  const sheet = importRoll20({ character: { name: "Eroe" }, normalized: { identity: { character_name: "Eroe" } } });
  await apiFetch("/api/sheets", { method: "PUT", body: JSON.stringify({ room: "r1", rev: 0, entry: { kind: "pc", sheet, acl: { view: [], edit: [] }, updatedBy: "GM" } }) });
  await act(async () => root.render(<App/>));
  await settle();
  await click("Modifica");
  await click("Scegli immagine token");
  await settle(1_700);
  expect(cloudSheet().sheet.avatar).toBe("https://owlbear.example/token.png");
  expect(host.querySelector<HTMLImageElement>(".hero img")?.src).toBe("https://owlbear.example/token.png");
  await click("Rimuovi immagine");
  await settle(1_700);
  expect(cloudSheet().sheet.avatar).toBeUndefined();
});

it("la Libreria si ordina in ordine alfabetico e si cerca come il bestiario", async () => {
  for (const name of ["Zeno", "ada", "Berto"]) {
    const sheet = importRoll20({ character: { name }, normalized: { identity: { character_name: name } } });
    await apiFetch("/api/sheets", { method: "PUT", body: JSON.stringify({ room: "r1", rev: 0, entry: { kind: "pc", sheet, acl: { view: [], edit: [] }, updatedBy: "GM" } }) });
  }
  await act(async () => root.render(<App/>));
  await settle();
  await click("Libreria");
  const names = () => [...host.querySelectorAll(".library-entry strong")].map((item) => item.textContent);
  await click("Ordine alfabetico");
  expect(names()).toEqual(["ada", "Berto", "Zeno"]);
  expect(localStorage.getItem(STORAGE_LIBRARY_SORT)).toBe("true");

  await click("Cerca nel party");
  await type('input[aria-label="Cerca nel catalogo"]', "ber");
  expect([...host.querySelectorAll(".catalog-option strong")].map((item) => item.textContent)).toEqual(["Berto"]);
  await act(async () => host.querySelector<HTMLButtonElement>(".catalog-option")!.click());
  expect(host.querySelector(".hero h1")?.textContent).toBe("Berto");
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

it("il GM rende incantatore un mostro: Magia come le schede PG, con CD calcolata, slot e incantesimi tirati dal mostro", async () => {
  const mage = { schemaVersion: 1, id: "mage", name: "Mago", source: "MM", creatureType: "Umanoide", challengeRating: "6", ruleset: { id: DEFAULT_RULESET.id, version: DEFAULT_RULESET.version }, size: "M", alignment: "N", ac: 12, hp: { average: 40, formula: "9d8" }, speed: "30 ft.", abilities: { int: 17 }, saves: {}, skills: {}, passivePerception: 11, traits: [], actions: [], reactions: [], legendaryActions: [], importWarnings: [],
    spells: [{ id: "bolt", name: "Dardo di fuoco", level: 0, prepared: true, ritual: false, concentration: false, description: "", attackBonus: 6, damage: "2d10" }] };
  localStorage.setItem(STORAGE_MONSTERS, JSON.stringify([mage]));
  await act(async () => root.render(<App/>));
  await settle();
  await click("Bestiario");
  await click("Mago");
  expect(host.textContent).not.toContain("Incantesimi");
  await click("Modifica");
  await act(async () => host.querySelector<HTMLInputElement>('.action-form legend input[type="checkbox"]')!.click());
  await type('input[aria-label="Livello incantatore"]', "3");
  // INT 17 (+3) e competenza +3 a GS 6: CD 14, attacco +6.
  expect(host.querySelector(".form-note")?.textContent).toBe("CD 14 · attacco +6 · slot fino al 2° livello");
  await click("Salva");
  const stored = () => JSON.parse(localStorage.getItem(STORAGE_MONSTERS) ?? "[]")[0];
  expect(stored().spellcasting).toEqual({ ability: "intelligence", attackModifier: 0, dcModifier: 0, casterLevel: 3, slots: { level_1: { total: 4, used: 0 }, level_2: { total: 2, used: 0 } } });
  expect(host.querySelector(".spell-head")?.textContent).toContain("CD 14");
  await click("Usa slot level_1");
  expect(stored().spellcasting.slots.level_1.used).toBe(1);
  await click("Dardo di fuoco");
  await settle();
  expect(JSON.parse(localStorage.getItem(STORAGE_MESSAGES) ?? "[]").at(-1)).toMatchObject({ author: "Mago", visibility: "gm" });
});

it("la finestra del token di un mostro mostra solo la parte scelta dal menu, come le schede PG", async () => {
  const mage = { schemaVersion: 1, id: "mage", name: "Mago", source: "MM", creatureType: "Umanoide", challengeRating: "6", ruleset: { id: DEFAULT_RULESET.id, version: DEFAULT_RULESET.version }, size: "M", alignment: "N", ac: 12, hp: { average: 40, formula: "9d8" }, speed: "30 ft.", abilities: { int: 17 }, saves: { int: 6 }, skills: {}, passivePerception: 11, traits: [], actions: [{ id: "a", name: "Bastone", description: "" }], reactions: [], legendaryActions: [], importWarnings: [],
    spellcasting: { ability: "intelligence", attackModifier: 0, dcModifier: 0, casterLevel: 1, slots: { level_1: { total: 2, used: 0 } } }, spells: [{ id: "bolt", name: "Dardo di fuoco", level: 0, prepared: true, ritual: false, concentration: false, description: "" }] };
  localStorage.setItem(STORAGE_MONSTERS, JSON.stringify([mage]));
  viewer.tokens = [{ id: "t1", name: "Mago", metadata: { [TOKEN_META_KEY]: { characterId: "mage" } } }];
  const open = async (section: string) => {
    window.history.replaceState(null, "", `/?view=sheet&token=t1&section=${section}`);
    await act(async () => root.render(<App key={section}/>));
    await settle();
  };
  // Prove e TS nella stessa finestra, con gli stessi riquadri della scheda PG.
  await open("abilities");
  expect(host.querySelector("h2")?.textContent).toBe("Prove e tiri salvezza · Mago");
  expect([...host.querySelectorAll(".paper h2")].map((title) => title.textContent)).toEqual(["Caratteristiche", "Tiri salvezza"]);
  expect(host.querySelector('[aria-label="Prova di Intelligenza"]')?.textContent).toBe("INT17+3");
  expect([...host.querySelectorAll(".core-list.saves .proficient")].map((save) => save.textContent)).toEqual(["+6Intelligenza"]);
  expect(host.textContent).not.toContain("Bastone");
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Prova di Intelligenza"]')!.click());
  await settle();
  expect(JSON.parse(localStorage.getItem(STORAGE_MESSAGES) ?? "[]").at(-1)).toMatchObject({ author: "Mago", visibility: "gm" });
  await open("skills");
  expect(host.textContent).toContain("+3Arcano (INT)");
  expect(host.textContent).toContain("Percezione passiva11");
  await open("details");
  expect([...host.querySelectorAll(".quick-details dt")].map((label) => label.textContent)).toEqual(["CA", "PF", "Velocità", "GS", "Sensi"]);
  expect(host.querySelector(".quick-details")?.textContent).toContain("Percezione passiva 11");
  await open("spells");
  expect(host.textContent).toContain("Dardo di fuoco");
  expect(host.textContent).not.toContain("Bastone");
  await open("actions");
  expect(host.textContent).toContain("Bastone");
  expect(host.textContent).not.toContain("Dardo di fuoco");
});

it("il GM condivide un mostro del bestiario dai permessi del mostro", async () => {
  const wolf = { schemaVersion: 1, id: "wolf", name: "Lupo", source: "XMM", creatureType: "Bestia", challengeRating: "1/4", ruleset: { id: DEFAULT_RULESET.id, version: DEFAULT_RULESET.version }, size: "M", alignment: "N", ac: 13, hp: { average: 11, formula: "2d8+2" }, speed: "40 ft.", abilities: { dex: 15 }, saves: {}, skills: {}, passivePerception: 13, traits: [], actions: [{ id: "bite", name: "Morso", description: "" }], reactions: [], legendaryActions: [], importWarnings: [] };
  localStorage.setItem(STORAGE_MONSTERS, JSON.stringify([wolf]));
  await act(async () => root.render(<App/>));
  await settle();
  await click("Bestiario");
  await click("Lupo");
  expect(host.textContent).not.toContain("Aggiungi agli NPC");
  expect(host.textContent).not.toContain("Riepilogo mostro");
  // Tutto ciò che il mostro manda in chat è solo per il GM, salvo scelta diversa nel selettore del mostro.
  const lastMessage = () => JSON.parse(localStorage.getItem(STORAGE_MESSAGES) ?? "[]").at(-1);
  await click("Mostra in chat");
  await settle();
  expect(lastMessage()).toMatchObject({ title: "Lupo", visibility: "gm", body: expect.stringContaining("CA 13") });
  await click("Mostra in chat Morso");
  await settle();
  expect(lastMessage()).toMatchObject({ kind: "share", author: "Lupo", title: "Morso", visibility: "gm", card: { monster: true } });
  await choose("Visibilità tiri del mostro", "everyone");
  await choose("Modo tiri del mostro", "advantage");
  await click("Prova di Destrezza");
  await settle();
  expect(lastMessage()).toMatchObject({ kind: "roll", author: "Lupo", visibility: "everyone", card: { monster: true } });
  // Card dei mostri in blu (classe "monster"), sia per i tiri sia per le voci mandate in chat.
  await click("Messaggi");
  expect([...host.querySelectorAll(".r20-card.monster header strong")].map((title) => title.textContent)).toEqual(["Morso", "Destrezza"]);
  await click("Bestiario");
  expect(lastMessage().dice).toHaveLength(2);
  await click("Mostra in chat");
  await settle();
  expect(lastMessage()).toMatchObject({ title: "Lupo", visibility: "everyone" });
  await choose("Può vedere: aggiungi giocatore", "Marco");
  await settle();
  expect(cloudEntries()).toEqual([expect.objectContaining({ kind: "npc", acl: { view: ["Marco"], edit: [] }, sheet: expect.objectContaining({ id: "wolf", name: "Lupo" }) })]);
  // Il giocatore che può solo vedere legge lo statblock nel Bestiario, senza tiri.
  await act(async () => root.unmount());
  localStorage.clear(); viewer.name = "Marco"; viewer.role = "PLAYER";
  root = createRoot(host);
  await act(async () => root.render(<App/>));
  await settle();
  await click("Bestiario");
  await click("Lupo");
  expect(host.textContent).toContain("Morso");
  expect(host.querySelector(".monster-readonly")).toBeTruthy();
  expect(host.querySelector('select[aria-label="Può vedere: aggiungi giocatore"]')).toBeNull();

  // Con il permesso di modifica può tirare.
  await act(async () => root.unmount());
  localStorage.clear(); viewer.name = "GM"; viewer.role = "GM";
  localStorage.setItem(STORAGE_MONSTERS, JSON.stringify([wolf]));
  root = createRoot(host);
  await act(async () => root.render(<App/>));
  await settle();
  await click("Bestiario");
  await click("Lupo");
  await choose("Può modificare: aggiungi giocatore", "Marco");
  await settle(1_700);
  expect(cloudEntries()[0].acl).toEqual({ view: ["Marco"], edit: ["Marco"] });
  await act(async () => root.unmount());
  localStorage.clear(); viewer.name = "Marco"; viewer.role = "PLAYER";
  root = createRoot(host);
  await act(async () => root.render(<App/>));
  await settle();
  await click("Bestiario");
  await click("Lupo");
  expect(host.querySelector(".monster-readonly")).toBeNull();
}, 15_000);

it("il Bestiario ha cartelle come il Journal: il GM sposta un mostro, il giocatore vede la cartella del mostro condiviso", async () => {
  const wolf = { schemaVersion: 1, id: "wolf", name: "Lupo", source: "XMM", creatureType: "Bestia", challengeRating: "1/4", ruleset: { id: DEFAULT_RULESET.id, version: DEFAULT_RULESET.version }, size: "M", alignment: "N", ac: 13, hp: { average: 11, formula: "2d8+2" }, speed: "40 ft.", abilities: { dex: 15 }, saves: {}, skills: {}, passivePerception: 13, traits: [], actions: [{ id: "bite", name: "Morso", description: "" }], reactions: [], legendaryActions: [], importWarnings: [] };
  localStorage.setItem(STORAGE_MONSTERS, JSON.stringify([wolf]));
  await act(async () => root.render(<App/>));
  await settle();
  await click("Bestiario");
  await click("Nuova cartella");
  await type('input[aria-label="Nome della cartella"]', "Foresta");
  await click("Salva");
  await settle();
  const folder = cloudEntries().find((entry) => entry.kind === "folder");
  expect(folder).toMatchObject({ sheet: { name: "Foresta", area: "bestiary" } });
  await click("Lupo");
  await choose("Cartella", folder.sheet.id);
  await choose("Può vedere: aggiungi giocatore", "Marco");
  await settle();
  expect(JSON.parse(localStorage.getItem(STORAGE_MONSTERS)!)[0].folderId).toBe(folder.sheet.id);
  await click("← Bestiario");
  expect(host.querySelector(".journal-folder summary")?.textContent).toContain("Foresta");
  expect(host.querySelector(".journal-folder .journal-open")?.textContent).toBe("Lupo");
  const tag = host.querySelector(".journal-folder .inventory-mods");
  expect(tag?.textContent).toBe("Visibile");
  expect(tag?.getAttribute("title")).toBe("Può vedere: Marco");
  await click("Note");
  expect(host.textContent).not.toContain("Foresta");

  await act(async () => root.unmount());
  localStorage.clear(); viewer.name = "Marco"; viewer.role = "PLAYER";
  root = createRoot(host);
  await act(async () => root.render(<App/>));
  await settle();
  await click("Bestiario");
  expect(host.querySelector(".journal-folder summary")?.textContent).toContain("Foresta");
  expect(host.querySelector(".journal-folder .journal-open")?.textContent).toBe("Lupo");
  expect(host.querySelector(".inventory-mods")).toBeNull();
}, 15_000);

it("il GM crea, modifica e duplica un mostro; la modifica arriva anche alla copia condivisa", async () => {
  await act(async () => root.render(<App/>));
  await settle();
  await click("Bestiario");
  await click("Nuovo mostro");
  await type('input[aria-label="Nome del mostro"]', "Bandito");
  await type('input[aria-label="CA"]', "12");
  await type('input[aria-label="Punteggio DES"]', "14");
  await type('input[aria-label="TS DES"]', "4");
  await type('input[aria-label="Abilità Furtività"]', "6");
  // "Competente" come su Roll20: modificatore (SAG 10 → +0) più bonus competenza (+2 a GS 0).
  await act(async () => host.querySelector<HTMLInputElement>('input[aria-label="Competente Percezione"]')!.click());
  await type('input[aria-label="Resistenze ai danni"]', "veleno");
  await click("Salva");
  const stored = () => JSON.parse(localStorage.getItem(STORAGE_MONSTERS) ?? "[]");
  expect(stored()).toEqual([expect.objectContaining({ name: "Bandito", ac: 12, abilities: expect.objectContaining({ dex: 14 }), saves: { dex: 4 }, skills: { stealth: 6, perception: 2 }, resistances: "veleno", updatedAt: expect.any(Number) })]);
  expect(stored()[0]).not.toHaveProperty("languages");
  expect(host.querySelector(".statblock-details")?.textContent).toBe("Resistenze ai danni veleno");
  expect(host.querySelector(".statblock-head h1")?.textContent).toBe("Bandito");
  expect(host.querySelector('[aria-label="Prova di Destrezza"]')?.textContent).toContain("+2");
  expect(host.querySelector('[aria-label="TS Destrezza"]')?.textContent).toBe("TS +4");
  expect(host.querySelector('[aria-label="TS Forza"]')?.textContent).toBe("TS +0");
  expect([...host.querySelectorAll(".statblock-line .proficient")].map((skill) => skill.textContent)).toEqual(["Percezione +2", "Furtività +6"]);
  // Le abilità non impostate si tirano con il modificatore della caratteristica.
  await click("Acrobazia +2");
  await settle();
  expect(JSON.parse(localStorage.getItem(STORAGE_MESSAGES) ?? "[]").at(-1)).toMatchObject({ author: "Bandito", visibility: "gm" });

  await choose("Può vedere: aggiungi giocatore", "Marco");
  await settle();
  await click("Modifica");
  await type('input[aria-label="CA"]', "15");
  await click("Salva");
  await settle(1_700);
  expect(stored()[0].ac).toBe(15);
  expect(cloudEntries().find((entry) => entry.kind === "npc").sheet.ac).toBe(15);

  await click("Duplica");
  await type('input[aria-label="Nome del mostro"]', "Bandito capo");
  await click("Salva");
  expect(stored().map((monster: { name: string }) => monster.name)).toEqual(["Bandito", "Bandito capo"]);
  expect(stored()[1].id).not.toBe(stored()[0].id);
}, 15_000);

it("il GM aggiunge, modifica ed elimina tratti e azioni del mostro nei popup", async () => {
  const wolf = { schemaVersion: 1, id: "wolf", name: "Lupo", source: "XMM", creatureType: "Bestia", challengeRating: "1/4", ruleset: { id: DEFAULT_RULESET.id, version: DEFAULT_RULESET.version }, size: "M", alignment: "N", ac: 13, hp: { average: 11, formula: "2d8+2" }, speed: "40 ft.", abilities: { dex: 15 }, saves: {}, skills: {}, passivePerception: 13, traits: [], actions: [{ id: "bite", name: "Morso", description: "" }], reactions: [], legendaryActions: [], importWarnings: [] };
  localStorage.setItem(STORAGE_MONSTERS, JSON.stringify([wolf]));
  vi.stubGlobal("confirm", () => true);
  await act(async () => root.render(<App/>));
  await settle();
  await click("Bestiario");
  await click("Lupo");
  await click("Nuova reazione");
  await type('input[aria-label="Nome voce"]', "Schivata");
  await click("Salva");
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Modifica Morso"]')!.click());
  await type('input[aria-label="Bonus attacco"]', "4");
  await type('input[aria-label="Danno"]', "2d4+2");
  await type('input[aria-label="Tipo di danno"]', "perforante");
  // Riempita una riga ne compare un'altra, come "Danno 2" di Roll20.
  await type('input[aria-label="Danno 2"]', "1d6");
  await type('input[aria-label="Tipo di danno 2"]', "veleno");
  await click("Salva");
  const stored = () => JSON.parse(localStorage.getItem(STORAGE_MONSTERS)!)[0];
  expect(stored().reactions).toEqual([expect.objectContaining({ name: "Schivata" })]);
  expect(stored().actions).toEqual([expect.objectContaining({ name: "Morso", attackBonus: 4, damage: "2d4+2+1d6", damageType: "perforante / veleno", damages: [
    { dice: "2d4", bonus: 2, ability: "none", type: "perforante", critDice: "2d4" }, { dice: "1d6", bonus: 0, ability: "none", type: "veleno", critDice: "1d6" }] })]);
  // In chat ogni danno ha la sua riga con il suo tipo.
  const rollBite = async () => { await click("Morso"); await settle(); return JSON.parse(localStorage.getItem(STORAGE_MESSAGES) ?? "[]").at(-1).card; };
  // Con un 1 naturale l'attacco manca e non ci sono danni: si ritira.
  let card = await rollBite();
  while (card.note) card = await rollBite();
  expect(card.rolls.map((row: { formula: string; type: string }) => [row.formula, row.type])).toEqual(expect.arrayContaining([[expect.stringMatching(/^2d4/), "perforante"], [expect.stringMatching(/^(1d6|1d6\+1d6)$/), "veleno"]]));
  expect(card.rolls).toHaveLength(2);
  expect(host.textContent).toContain("Reazioni");
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Modifica Schivata"]')!.click());
  await act(async () => [...host.querySelectorAll<HTMLButtonElement>(".ui-dialog button")].find((button) => button.textContent === "Elimina")!.click());
  expect(stored().reactions).toEqual([]);
  // Le sezioni sono riquadri richiudibili; lo stato vale per tutti i mostri.
  const actionsBox = [...host.querySelectorAll<HTMLDetailsElement>("details.statblock-section")].find((box) => box.querySelector("summary h2")?.textContent === "Azioni")!;
  expect(actionsBox.open).toBe(true);
  await act(async () => { actionsBox.open = false; actionsBox.dispatchEvent(new Event("toggle")); });
  expect(JSON.parse(localStorage.getItem(STORAGE_CLOSED_MONSTER_SECTIONS) ?? "[]")).toEqual(["actions"]);
});

it("gli NPC già nella libreria passano nel bestiario e la Libreria mostra solo il party", async () => {
  const innkeeper = { ...{ schemaVersion: 1, ruleset: { id: DEFAULT_RULESET.id, version: DEFAULT_RULESET.version }, source: "XMM", size: "M", alignment: "N", ac: 10, hp: { average: 4, formula: "1d8" }, speed: "30 ft.", abilities: { dex: 10 }, saves: {}, skills: {}, passivePerception: 10, traits: [], actions: [], reactions: [], legendaryActions: [], importWarnings: [] }, id: "oste", name: "Oste", creatureType: "Umanoide", challengeRating: "0" };
  await apiFetch("/api/sheets", { method: "PUT", body: JSON.stringify({ room: "r1", rev: 0, entry: { kind: "npc", sheet: innkeeper, acl: { view: ["Marco"], edit: [] }, updatedBy: "GM" } }) });
  await act(async () => root.render(<App/>));
  await settle();
  expect(JSON.parse(localStorage.getItem(STORAGE_MONSTERS) ?? "[]").map((monster: { id: string }) => monster.id)).toEqual(["oste"]);
  await click("Libreria");
  expect(host.textContent).not.toContain("Oste");
  expect([...host.querySelectorAll("button")].some((button) => button.textContent === "NPC")).toBe(false);
  await click("Bestiario");
  await click("Oste");
  expect(host.textContent).toContain("Marco");
});

it("un giocatore crea un personaggio da zero, lo modifica e il punteggio aggiorna i derivati", async () => {
  viewer.name = "Marco"; viewer.role = "PLAYER";
  await act(async () => root.render(<App/>));
  await settle();
  await click("Libreria");
  await click("Nuovo personaggio");
  await type('input[aria-label="Nome del personaggio"]', "Lia");
  await click("Scheda vuota");
  await settle();
  expect(cloudSheet()).toMatchObject({ kind: "pc", acl: { view: [], edit: ["Marco"] }, sheet: { name: "Lia", identity: { level: 1 } } });
  expect(host.querySelector(".hero h1")?.textContent).toBe("Lia");
  await type('input[aria-label="Punteggio Destrezza"]', "14");
  await settle(1_700);
  expect(cloudSheet().sheet.combat.initiative).toBe(2);
  await click("Base");
  expect(host.querySelector<HTMLElement>(".metric-explained[title^='Iniziativa']")?.title).toMatch(/^Iniziativa \+2\n/);
});

it("il bestiario si cerca con il pulsante ⌕e i tiri dei mostri vanno solo al GM a nome del mostro", async () => {
  const monster = (id: string, name: string, actions: unknown[]) => ({ schemaVersion: 1, id, name, source: "XMM", creatureType: "Umanoide", challengeRating: "1/2", ruleset: { id: DEFAULT_RULESET.id, version: DEFAULT_RULESET.version }, size: "M", alignment: "CM", ac: 13, hp: { average: 15, formula: "2d8+6" }, speed: "30 ft.", abilities: { dex: 12 }, saves: {}, skills: {}, passivePerception: 10, traits: [], actions, reactions: [], legendaryActions: [], importWarnings: [] });
  localStorage.setItem(STORAGE_MONSTERS, JSON.stringify([monster("wolf", "Lupo", []), monster("orc", "Orco", [{ id: "club", name: "Clava", damage: "1d6+2" }])]));
  await act(async () => root.render(<App/>));
  await settle();
  await click("Bestiario");
  await click("Cerca nel bestiario");
  await type('input[aria-label="Cerca nel catalogo"]', "orc");
  expect([...host.querySelectorAll(".catalog-option strong")].map((item) => item.textContent)).toEqual(["Orco"]);
  await act(async () => host.querySelector<HTMLButtonElement>(".catalog-option")!.click());
  expect(host.querySelector(".statblock-head h1")?.textContent).toBe("Orco");

  await click("Clava");
  await settle();
  const messages = JSON.parse(localStorage.getItem(STORAGE_MESSAGES) ?? "[]");
  expect(messages.at(-1)).toMatchObject({ kind: "roll", author: "Orco", visibility: "gm", title: "Clava" });
  expect(messages.at(-1).characterId).toBeUndefined();
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

it("lanciare un incantesimo non preparato mostra l'avviso in chat", async () => {
  const sheet = importRoll20({ character: { name: "Maga" }, normalized: { identity: { character_name: "Maga" } } });
  sheet.spellcasting.slots = { level_1: { total: 2, used: 0 } };
  sheet.spells = [
    { id: "sleep", name: "Sonno", level: 1, prepared: false, ritual: false, concentration: false },
    { id: "armor", name: "Armatura magica", level: 1, prepared: true, ritual: false, concentration: false },
    { id: "innate", name: "Passo velato", level: 1, prepared: false, innate: "1/giorno", ritual: false, concentration: false },
  ];
  await apiFetch("/api/sheets", { method: "PUT", body: JSON.stringify({ room: "r1", rev: 0, entry: { kind: "pc", sheet, acl: { view: [], edit: [] }, updatedBy: "GM" } }) });
  await act(async () => root.render(<App/>));
  await settle();
  await click("Magia");
  const [sleep, armor, innate] = [...host.querySelectorAll<HTMLButtonElement>(".entry-use")];
  await act(async () => sleep.click());
  await click("Livello 1 (2/2)");
  await act(async () => armor.click());
  await click("Livello 1 (1/2)");
  await act(async () => innate.click());
  await click("Messaggi");
  expect([...host.querySelectorAll(".r20-card")].map((card) => card.querySelector(".r20-alert")?.textContent ?? null)).toEqual(["⚠ Incantesimo non preparato", null, null]);
});

it("importa un incantesimo da 5e.tools nella scheda, senza doppioni", async () => {
  const sheet = importRoll20({ character: { name: "Maga" }, normalized: { identity: { character_name: "Maga" } } });
  sheet.spells = [{ id: "sleep", name: "Sleep", level: 1, prepared: true, ritual: false, concentration: false }];
  await apiFetch("/api/sheets", { method: "PUT", body: JSON.stringify({ room: "r1", rev: 0, entry: { kind: "pc", sheet, acl: { view: [], edit: [] }, updatedBy: "GM" } }) });
  await act(async () => root.render(<App/>));
  await settle();
  await click("Magia");
  await click("Importa da 5e.tools");
  await settle();
  expect([...host.querySelectorAll(".catalog-option")].map((option) => option.textContent)).toEqual([expect.stringContaining("Fireball")]);
  await click("Fireball");
  await settle(1_700);
  expect(cloudSheet().sheet.spells).toMatchObject([{ name: "Sleep" }, { name: "Fireball", level: 3, prepared: false }]);
  expect([...host.querySelectorAll(".spell-level h2")].map((title) => title.textContent)).toContain("Livello 3");
});

it("in Owlbear la chat riceve dal cloud i messaggi scritti da telefono, una volta sola", async () => {
  const body = JSON.stringify({ room: "r1", message: { id: "dal-telefono", kind: "text", author: "Marco", body: "arrivo dal telefono", visibility: "everyone", createdAt: 1 } });
  await apiFetch("/api/messages", { method: "POST", body });
  await act(async () => root.render(<App/>));
  await settle();
  await click("Messaggi");
  expect([...host.querySelectorAll(".message")].filter((message) => message.textContent?.includes("arrivo dal telefono"))).toHaveLength(1);
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

it("modifica una risorsa nel popup e chiede conferma prima di eliminarla", async () => {
  const sheet = importRoll20({ character: { name: "Eroe" }, normalized: { identity: { character_name: "Eroe" } } });
  sheet.counters = [{ id: "ki", name: "Ki", current: 2, max: 3, recovery: "short" }];
  await apiFetch("/api/sheets", { method: "PUT", body: JSON.stringify({ room: "r1", rev: 0, entry: { kind: "pc", sheet, acl: { view: [], edit: [] }, updatedBy: "GM" } }) });
  await act(async () => root.render(<App/>));
  await settle();
  const dialogButton = (label: string) => act(async () => [...host.querySelectorAll<HTMLButtonElement>(".ui-dialog button")].find((button) => button.textContent === label)!.click());
  expect(host.querySelector('input[aria-label="Nome risorsa"]')).toBeNull();
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Modifica Ki"]')!.click());
  await type('input[aria-label="Nome risorsa"]', "Punti Ki");
  await type('input[aria-label="Massimo risorsa"]', "1");
  await dialogButton("Salva");
  expect(host.querySelector(".ui-dialog")).toBeNull();
  expect(host.textContent).toContain("1 / 1");

  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Modifica Punti Ki"]')!.click());
  await dialogButton("Elimina");
  expect(host.querySelector(".ui-dialog p")?.textContent).toBe("Punti Ki verrà rimossa dalla scheda.");
  await click("Annulla");
  expect(host.querySelector('[aria-label="Modifica Punti Ki"]')).not.toBeNull();
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Modifica Punti Ki"]')!.click());
  await dialogButton("Elimina");
  await dialogButton("Elimina");
  expect(host.querySelector('[aria-label="Modifica Punti Ki"]')).toBeNull();
});

it("aggiunge una risorsa dal pulsante e ne cambia l'ordine", async () => {
  const sheet = importRoll20({ character: { name: "Eroe" }, normalized: { identity: { character_name: "Eroe" } } });
  sheet.counters = [{ id: "ki", name: "Ki", current: 2, max: 3, recovery: "short" }];
  await apiFetch("/api/sheets", { method: "PUT", body: JSON.stringify({ room: "r1", rev: 0, entry: { kind: "pc", sheet, acl: { view: [], edit: [] }, updatedBy: "GM" } }) });
  await act(async () => root.render(<App/>));
  await settle();
  await click("+ Nuova risorsa");
  await type('input[aria-label="Nome risorsa"]', "Ira");
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

it("crea, modifica ed elimina competenze e strumenti dalla tab Base", async () => {
  const sheet = importRoll20({ character: { name: "Eroe" }, normalized: { identity: { character_name: "Eroe" }, proficiencies: [{ name: "Comune", type: "LANGUAGE", _rowid: "common" }] } });
  sheet.combat.proficiencyBonus = 2;
  await apiFetch("/api/sheets", { method: "PUT", body: JSON.stringify({ room: "r1", rev: 0, entry: { kind: "pc", sheet, acl: { view: [], edit: [] }, updatedBy: "GM" } }) });
  await act(async () => root.render(<App/>));
  await settle();
  const select = async (label: string, value: string) => {
    const element = host.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!;
    await act(async () => { element.value = value; element.dispatchEvent(new Event("change", { bubbles: true })); });
  };

  await click("+ Nuova competenza");
  await type('input[aria-label="Nome competenza"]', "Strumenti da scasso");
  await select("Tipo competenza", "TOOL");
  await select("Caratteristica strumento", "dexterity");
  await select("Bonus competenza strumento", "expertise");
  await type('input[aria-label="Mod strumento"]', "1");
  await click("Salva");
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Modifica Comune"]')!.click());
  await type('input[aria-label="Nome competenza"]', "Elfico");
  await click("Salva");
  await settle(1_700);

  let saved = cloudSheet().sheet;
  expect(saved.proficiencies).toEqual([{ id: "common", name: "Elfico", type: "LANGUAGE" }]);
  expect(saved.tools).toMatchObject([{ name: "Strumenti da scasso", ability: "dexterity", proficiency: "expertise", mods: 1 }]);
  expect(host.textContent).toContain("(DES) +5");
  expect(host.querySelector('[aria-label="Mostra in chat Elfico"]')).not.toBeNull();

  // Il nome dello strumento tira 1d20 + caratteristica + competenza + mod.
  await click("Strumenti da scasso");
  await settle();
  expect(JSON.parse(localStorage.getItem(STORAGE_MESSAGES) ?? "[]").at(-1).card.d20.formula).toContain("1d20+4[PROF]+1[MOD]");

  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Modifica Elfico"]')!.click());
  await act(async () => [...host.querySelectorAll<HTMLButtonElement>(".ui-dialog button")].find((button) => button.textContent === "Elimina")!.click());
  await settle(1_700);
  saved = cloudSheet().sheet;
  expect(saved.proficiencies).toEqual([]);
  expect(saved.tools).toHaveLength(1);
});

it("crea e modifica un buff nel popup, senza salvare se si annulla", async () => {
  const sheet = importRoll20({ character: { name: "Eroe" }, normalized: { identity: { character_name: "Eroe" } } });
  await apiFetch("/api/sheets", { method: "PUT", body: JSON.stringify({ room: "r1", rev: 0, entry: { kind: "pc", sheet, acl: { view: [], edit: [] }, updatedBy: "GM" } }) });
  await act(async () => root.render(<App/>));
  await settle();
  const dialogButton = (label: string) => act(async () => [...host.querySelectorAll<HTMLButtonElement>(".ui-dialog button")].find((button) => button.textContent === label)!.click());
  await click("Modifica");
  await click("Aggiungi");
  await type('input[aria-label="Nome effetto"]', "Benedizione");
  await dialogButton("Annulla");
  expect(host.querySelector('[aria-label="Modifica Benedizione"]')).toBeNull();

  await click("Aggiungi");
  await type('input[aria-label="Nome effetto"]', "Benedizione");
  await dialogButton("Salva");
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Modifica Benedizione"]')!.click());
  await type('input[aria-label="Nome effetto"]', "Benedetto");
  await dialogButton("Salva");
  await settle(1_700);
  expect(cloudSheet().sheet.effects).toMatchObject([{ name: "Benedetto", active: true, modifiers: [] }]);
});

it("strumento con caratteristica a scelta: chiede la caratteristica e poi tira", async () => {
  const sheet = importRoll20({ character: { name: "Eroe" }, normalized: { identity: { character_name: "Eroe" } } });
  sheet.combat.proficiencyBonus = 2;
  sheet.abilities.charisma = { score: 16, mod: 3, save: 3, saveProficient: false };
  // Formato salvato prima di proficiency/mods: solo il bonus (competenza + mod).
  sheet.tools = [{ id: "kit", name: "Disguise Kit", ability: "", bonus: 2 } as unknown as ToolEntry];
  await apiFetch("/api/sheets", { method: "PUT", body: JSON.stringify({ room: "r1", rev: 0, entry: { kind: "pc", sheet, acl: { view: [], edit: [] }, updatedBy: "GM" } }) });
  await act(async () => root.render(<App/>));
  await settle();
  await click("Disguise Kit");
  expect(host.querySelector(".ui-dialog")?.textContent).toContain("Scegli la caratteristica");
  expect(host.querySelector(".ui-dialog")?.textContent).toContain("Carisma +5");
  await act(async () => [...host.querySelectorAll<HTMLButtonElement>(".ui-dialog button")].find((button) => button.textContent?.startsWith("Carisma"))!.click());
  await settle();
  expect(JSON.parse(localStorage.getItem(STORAGE_MESSAGES) ?? "[]").at(-1).card.d20.formula).toContain("1d20+3[CHA]+2[PROF]");
});

it("crea, modifica ed elimina oggetti dello zaino nel popup", async () => {
  const sheet = importRoll20({ character: { name: "Eroe" }, normalized: { identity: { character_name: "Eroe" }, inventory: [{ name: "Leather Armor", count: 1, weight: null, equipped: false, properties: "AC", modifiers: "+1", description: "", _rowid: "armor" }] } });
  expect(sheet.inventory[0]).toMatchObject({ weight: null, properties: "AC", modifiersText: "+1" });
  await apiFetch("/api/sheets", { method: "PUT", body: JSON.stringify({ room: "r1", rev: 0, entry: { kind: "pc", sheet, acl: { view: [], edit: [] }, updatedBy: "GM" } }) });
  await act(async () => root.render(<App/>));
  await settle();
  const dialogButton = (label: string) => act(async () => [...host.querySelectorAll<HTMLButtonElement>(".ui-dialog button")].find((button) => button.textContent === label)!.click());
  await click("Zaino");

  await click("+ Nuovo oggetto");
  await type('input[aria-label="Nome oggetto"]', "Frecce");
  await type('input[aria-label="Quantità oggetto"]', "20");
  await type('input[aria-label="Peso oggetto"]', "0.5");
  await dialogButton("Salva");
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Modifica Leather Armor"]')!.click());
  await type('input[aria-label="Nome oggetto"]', "Armatura di cuoio");
  await dialogButton("Salva");
  await act(async () => host.querySelector<HTMLInputElement>('[aria-label="Equipaggiato Armatura di cuoio"]')!.click());
  await type('input[aria-label="Quantità Frecce"]', "18");
  await settle(1_700);

  let saved = cloudSheet().sheet.inventory;
  expect(saved).toMatchObject([{ id: "armor", name: "Armatura di cuoio", equipped: true, properties: "AC", modifiersText: "+1" }, { name: "Frecce", count: 18, weight: 1, equipped: false }]);
  expect(host.querySelector('[aria-label="Mostra in chat Frecce"]')).not.toBeNull();

  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Modifica Frecce"]')!.click());
  await dialogButton("Elimina");
  await settle(1_700);
  saved = cloudSheet().sheet.inventory;
  expect(saved.map((item: { name: string }) => item.name)).toEqual(["Armatura di cuoio"]);
});

it("modifica le monete direttamente e mostra il carico dello zaino", async () => {
  const sheet = importRoll20({ character: { name: "Eroe" }, normalized: { identity: { character_name: "Eroe" }, currency: { cp: 60, sp: null, gp: 12 }, inventory: [{ name: "Frecce", count: 20, weight: 0.05, _rowid: "arrows" }, { name: "Corda", count: null, weight: 10, _rowid: "rope" }] } });
  sheet.abilities.strength = { score: 10, mod: 0, save: 0, saveProficient: false };
  await apiFetch("/api/sheets", { method: "PUT", body: JSON.stringify({ room: "r1", rev: 0, entry: { kind: "pc", sheet, acl: { view: [], edit: [] }, updatedBy: "GM" } }) });
  await act(async () => root.render(<App/>));
  await settle();
  await click("Zaino");
  expect(host.textContent).toContain("Carico 5,5 / 75 kg");

  await type('input[aria-label="Monete Argento"]', "7");
  await type('input[aria-label="Monete Oro"]', "");
  await settle(1_700);
  expect(cloudSheet().sheet.currency).toEqual({ cp: 60, sp: 7, gp: 0 });
  expect(host.querySelector<HTMLInputElement>('input[aria-label="Monete Platino"]')!.value).toBe("0");
});

it("la CA si passa al calcolo automatico dal popup e mostra da cosa è data", async () => {
  const sheet = importRoll20({ character: { name: "Eroe" }, normalized: { identity: { character_name: "Eroe" }, combat: { ac: 12 }, abilities: { dexterity: { score: 14, mod: 2 } }, inventory: [{ name: "Cuoio", equipped: true, modifiers: "Item Type: Light Armor, AC 11", _rowid: "leather" }] } });
  sheet.combat.acMode = "manual";
  await apiFetch("/api/sheets", { method: "PUT", body: JSON.stringify({ room: "r1", rev: 0, entry: { kind: "pc", sheet, acl: { view: [], edit: [] }, updatedBy: "GM" } }) });
  await act(async () => root.render(<App/>));
  await settle();
  const metric = () => host.querySelector<HTMLButtonElement>("button.metric-explained")!;
  expect(metric().title).toBe("CA 12\nBase 12");
  await act(async () => metric().click());
  await act(async () => host.querySelector<HTMLInputElement>(".ui-dialog .action-form-check input")!.click());
  await act(async () => [...host.querySelectorAll<HTMLButtonElement>(".ui-dialog button")].find((button) => button.textContent === "Salva")!.click());
  expect(metric().title).toBe("CA 13\nCuoio 11\nDES +2");
  await settle(1_700);
  expect(cloudSheet().sheet.combat).toMatchObject({ acMode: "auto", acBase: 10 });
});

it("nel popup dell'oggetto un modificatore somma caratteristica e competenza", async () => {
  const sheet = importRoll20({ character: { name: "Eroe" }, normalized: { identity: { character_name: "Eroe", level: 1 }, combat: { ac: 10, proficiency_bonus: 2 }, abilities: { wisdom: { score: 16, mod: 3 } } } });
  sheet.inventory = [{ id: "robe", name: "Veste", count: 1, equipped: true, modifiers: [{ id: "m1", target: "ac", amount: 1 }] }];
  await apiFetch("/api/sheets", { method: "PUT", body: JSON.stringify({ room: "r1", rev: 0, entry: { kind: "pc", sheet, acl: { view: [], edit: [] }, updatedBy: "GM" } }) });
  await act(async () => root.render(<App/>));
  await settle();
  await click("Zaino");
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Modifica Veste"]')!.click());
  const select = host.querySelector<HTMLSelectElement>('select[aria-label="Aggiungi modificatore di caratteristica"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(select, "wisdom");
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await act(async () => host.querySelector<HTMLInputElement>('input[aria-label="Aggiungi bonus di competenza"]')!.click());
  await click("Salva");
  await settle(1_700);
  expect(cloudSheet().sheet.inventory[0].modifiers[0]).toMatchObject({ target: "ac", amount: 1, ability: "wisdom", proficient: true });
  expect(host.querySelector(".inventory-mods")?.textContent).toBe("Classe armatura +1 +Saggezza +Competenza");
});

it("nel popup Nuovo oggetto importa i campi da 5e.tools", async () => {
  const sheet = importRoll20({ character: { name: "Eroe" }, normalized: { identity: { character_name: "Eroe" } } });
  await apiFetch("/api/sheets", { method: "PUT", body: JSON.stringify({ room: "r1", rev: 0, entry: { kind: "pc", sheet, acl: { view: [], edit: [] }, updatedBy: "GM" } }) });
  await act(async () => root.render(<App/>));
  await settle();
  await click("Zaino");
  await click("+ Nuovo oggetto");
  await click("Importa da 5e.tools");
  await settle();
  await click("Shield");
  expect(host.querySelector<HTMLInputElement>('input[aria-label="Nome oggetto"]')!.value).toBe("Shield");
  expect(host.querySelector<HTMLSelectElement>('select[aria-label="Caratteristica modificata"]')!.value).toBe("ac");
  expect(host.querySelector<HTMLInputElement>('input[aria-label="Valore modificatore"]')!.value).toBe("2");
  await act(async () => [...host.querySelectorAll<HTMLButtonElement>(".ui-dialog button")].find((button) => button.textContent === "Salva")!.click());
  await settle(1_700);
  expect(cloudSheet().sheet.inventory).toMatchObject([{ name: "Shield", count: 1, weight: 6, modifiers: [{ target: "ac", amount: 2 }], description: "Uno scudo." }]);
  expect(cloudSheet().sheet.inventory[0].modifiersText).toBeUndefined();
});

it("dallo zaino apre Nuova azione precompilata e la crea solo al salvataggio", async () => {
  const sheet = importRoll20({ character: { name: "Eroe" }, normalized: { identity: { character_name: "Eroe" }, inventory: [{ name: "Longsword", count: 1, properties: "1d8 Tagliente, Versatile", _rowid: "sword" }] } });
  await apiFetch("/api/sheets", { method: "PUT", body: JSON.stringify({ room: "r1", rev: 0, entry: { kind: "pc", sheet, acl: { view: [], edit: [] }, updatedBy: "GM" } }) });
  await act(async () => root.render(<App/>));
  await settle();
  const dialogButton = (label: string) => act(async () => [...host.querySelectorAll<HTMLButtonElement>(".ui-dialog button")].find((button) => button.textContent === label)!.click());
  await click("Zaino");
  await click("Crea azione");
  expect(host.querySelector(".ui-dialog h2")?.textContent).toBe("Nuova azione");
  expect([...host.querySelectorAll(".ui-dialog button")].some((button) => button.textContent === "Elimina")).toBe(false);
  await dialogButton("Annulla");
  await settle(1_700);
  expect(cloudSheet().sheet.actions).toEqual([]);

  await click("Crea azione");
  await dialogButton("Salva");
  await settle(1_700);
  expect(cloudSheet().sheet.actions).toMatchObject([{ name: "Longsword", attack: { ability: "strength", proficient: true }, damages: [{ dice: "1d8", type: "Tagliente" }] }]);
});

it("Crea risorsa dallo zaino e dai tratti: frecce collegate alla quantità, tratto con recupero scelto", async () => {
  const sheet = importRoll20({ character: { name: "Eroe" }, normalized: { identity: { character_name: "Eroe" }, inventory: [{ name: "Frecce", count: 20, _rowid: "arrows" }], traits: [{ name: "Recupero energie", description: "Recuperi PF.", _rowid: "wind" }] } });
  sheet.actions = [{ id: "bow", name: "Arco lungo", damage: "1d8" }];
  await apiFetch("/api/sheets", { method: "PUT", body: JSON.stringify({ room: "r1", rev: 0, entry: { kind: "pc", sheet, acl: { view: [], edit: [] }, updatedBy: "GM" } }) });
  await act(async () => root.render(<App/>));
  await settle();
  const dialogButton = (label: string) => act(async () => [...host.querySelectorAll<HTMLButtonElement>(".ui-dialog button")].find((button) => button.textContent === label)!.click());
  await click("Zaino");
  await click("Crea risorsa");
  expect(host.querySelector(".ui-dialog h2")?.textContent).toBe("Nuova risorsa");
  expect(host.querySelector<HTMLInputElement>('input[aria-label="Massimo risorsa"]')!.value).toBe("20");
  // Dal popup risorsa si sceglie l'azione che la consuma.
  const bow = [...host.querySelectorAll<HTMLLabelElement>(".ui-dialog label")].find((label) => label.textContent?.includes("Arco lungo"))!.querySelector("input")!;
  await act(async () => bow.click());
  await dialogButton("Aggiungi");
  expect([...host.querySelectorAll("button")].some((button) => button.textContent === "Crea risorsa")).toBe(false);
  await click("Modifica risorsa");
  expect(host.querySelector(".ui-dialog h2")?.textContent).toBe("Modifica risorsa");
  await dialogButton("Annulla");

  await click("Tratti");
  await click("Crea risorsa");
  const recovery = host.querySelector<HTMLSelectElement>('select[aria-label="Recupero risorsa"]')!;
  await act(async () => { recovery.value = "short"; recovery.dispatchEvent(new Event("change", { bubbles: true })); });
  await dialogButton("Aggiungi");
  await settle(1_700);
  const saved = cloudSheet().sheet;
  expect(saved.counters).toMatchObject([
    { name: "Frecce", current: 20, max: 20, recovery: "none", itemId: saved.inventory[0].id },
    { name: "Recupero energie", current: 1, max: 1, recovery: "short", traitId: saved.traits[0].id },
  ]);
  expect(saved.actions[0].resourceId).toBe(saved.counters[0].id);

  // Usare l'azione scala una freccia dallo zaino.
  await click("Azioni");
  await click("Arco lungo");
  await settle(1_700);
  expect(cloudSheet().sheet.inventory[0].count).toBe(19);

  await click("Scheda");
  await click("Base");
  await click("Riduci Frecce");
  await settle(1_700);
  expect(cloudSheet().sheet.inventory[0].count).toBe(18);
  expect(host.textContent).toContain("18 / 20");

  // Nome e tasto chat mostrano la risorsa senza consumarla.
  await click("Mostra in chat Frecce");
  await act(async () => host.querySelector<HTMLButtonElement>(".resource-row .entry-use")!.click());
  await settle(1_700);
  expect(cloudSheet().sheet.inventory[0].count).toBe(18);

  await click("Messaggi");
  expect(host.textContent).toContain("Frecce −1 (19/20)");
  expect(host.textContent).toContain("Eroe usa Frecce: 18/20");
  expect(host.textContent?.match(/Eroe: 18\/20/g)).toHaveLength(2);
}, 10_000);

it("riordina lo zaino e mette in cima gli equipaggiati senza cambiare l'ordine salvato", async () => {
  const sheet = importRoll20({ character: { name: "Eroe" }, normalized: { identity: { character_name: "Eroe" }, inventory: [
    { name: "Corda", _rowid: "rope" }, { name: "Torcia", _rowid: "torch" }, { name: "Spada", equipped: true, _rowid: "sword" },
  ] } });
  await apiFetch("/api/sheets", { method: "PUT", body: JSON.stringify({ room: "r1", rev: 0, entry: { kind: "pc", sheet, acl: { view: [], edit: [] }, updatedBy: "GM" } }) });
  await act(async () => root.render(<App/>));
  await settle();
  const names = () => [...host.querySelectorAll(".inventory-item summary strong")].map((node) => node.textContent);
  await click("Zaino");
  await click("Modifica ordine");
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Sposta su Torcia"]')!.click());
  await click("Fine");
  expect(names()).toEqual(["Torcia", "Corda", "Spada"]);

  await act(async () => [...host.querySelectorAll<HTMLLabelElement>("label")].find((label) => label.textContent?.includes("Equipaggiati in cima"))!.querySelector("input")!.click());
  expect(names()).toEqual(["Spada", "Torcia", "Corda"]);
  await settle(1_700);
  expect(cloudSheet().sheet.inventory.map((item: { name: string }) => item.name)).toEqual(["Torcia", "Corda", "Spada"]);
});

it("nella tab Tratti crea, modifica e riordina i tratti con il form Roll20", async () => {
  const sheet = importRoll20({ character: { name: "Eroe" }, normalized: { identity: { character_name: "Eroe" }, traits: [{ name: "Scurovisione", source: "Elfo • Racial", description: "Vedi al buio.", _rowid: "dark" }] } });
  await apiFetch("/api/sheets", { method: "PUT", body: JSON.stringify({ room: "r1", rev: 0, entry: { kind: "pc", sheet, acl: { view: [], edit: [] }, updatedBy: "GM" } }) });
  await act(async () => root.render(<App/>));
  await settle();
  const dialogButton = (label: string) => act(async () => [...host.querySelectorAll<HTMLButtonElement>(".ui-dialog button")].find((button) => button.textContent === label)!.click());
  await click("Tratti");
  await click("+ Nuovo tratto");
  await type('input[aria-label="Nome tratto"]', "Mercante");
  const source = host.querySelector<HTMLSelectElement>('select[aria-label="Source tratto"]')!;
  expect([...source.options].map((option) => option.textContent)).toEqual(["Choose...", "Racial", "Class", "Feat", "Background", "Item", "Other"]);
  await act(async () => { source.value = "Background"; source.dispatchEvent(new Event("change", { bubbles: true })); });
  await type('input[aria-label="Source type tratto"]', "background");
  await dialogButton("Salva");

  // Tratto salvato prima del form: il testo "Elfo • Racial" riempie i due campi.
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Modifica Scurovisione"]')!.click());
  expect(host.querySelector<HTMLSelectElement>('select[aria-label="Source tratto"]')!.value).toBe("Racial");
  expect(host.querySelector<HTMLInputElement>('input[aria-label="Source type tratto"]')!.value).toBe("Elfo");
  await dialogButton("Annulla");

  await click("Modifica ordine");
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Sposta su Mercante"]')!.click());
  await click("Fine");
  await settle(1_700);
  expect(cloudSheet().sheet.traits).toMatchObject([{ name: "Mercante", source: "background • Background", sourceKind: "Background", sourceType: "background" }, { name: "Scurovisione" }]);
});

it("nel popup oggetto aggiunge modificatori scelti dalla lista", async () => {
  const sheet = importRoll20({ character: { name: "Eroe" }, normalized: { identity: { character_name: "Eroe" }, combat: { ac: 12 } } });
  await apiFetch("/api/sheets", { method: "PUT", body: JSON.stringify({ room: "r1", rev: 0, entry: { kind: "pc", sheet, acl: { view: [], edit: [] }, updatedBy: "GM" } }) });
  await act(async () => root.render(<App/>));
  await settle();
  await click("Zaino");
  await click("+ Nuovo oggetto");
  await type('input[aria-label="Nome oggetto"]', "Anello");
  await act(async () => host.querySelector<HTMLInputElement>(".ui-dialog .action-form-check input")!.click());
  await click("+ Modificatore");
  expect(host.querySelector(".ui-dialog")).not.toBeNull();
  const target = host.querySelector<HTMLSelectElement>('select[aria-label="Caratteristica modificata"]')!;
  await act(async () => { target.value = "save:wisdom"; target.dispatchEvent(new Event("change", { bubbles: true })); });
  await type('input[aria-label="Valore modificatore"]', "2");
  await act(async () => [...host.querySelectorAll<HTMLButtonElement>(".ui-dialog button")].find((button) => button.textContent === "Salva")!.click());
  await settle(1_700);
  expect(cloudSheet().sheet.inventory).toMatchObject([{ name: "Anello", equipped: true, modifiers: [{ target: "save:wisdom", amount: 2 }] }]);
  expect(host.querySelector(".inventory-mods")?.textContent).toBe("TS Saggezza +2");
});

it("un oggetto salvato con il vecchio testo Roll20 passa alla lista quando si riapre il form", async () => {
  const sheet = importRoll20({ character: { name: "Eroe" }, normalized: { identity: { character_name: "Eroe" } } });
  sheet.inventory = [{ id: "leather", name: "Cuoio", count: 1, equipped: true, modifiersText: "Item Type: Light Armor, AC 11, Volare +5" }];
  await apiFetch("/api/sheets", { method: "PUT", body: JSON.stringify({ room: "r1", rev: 0, entry: { kind: "pc", sheet, acl: { view: [], edit: [] }, updatedBy: "GM" } }) });
  await act(async () => root.render(<App/>));
  await settle();
  await click("Zaino");
  expect(host.querySelector(".inventory-mods")?.textContent).toBe("Armatura leggera (CA base) 11");
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Modifica Cuoio"]')!.click());
  expect(host.querySelector<HTMLSelectElement>('select[aria-label="Caratteristica modificata"]')!.value).toBe("armor:light");
  expect(host.querySelector(".ui-dialog")?.textContent).toContain("Testo Roll20 non riconosciuto: Volare +5");
  await act(async () => [...host.querySelectorAll<HTMLButtonElement>(".ui-dialog button")].find((button) => button.textContent === "Salva")!.click());
  await settle(1_700);
  expect(cloudSheet().sheet.inventory).toMatchObject([{ modifiers: [{ target: "armor:light", amount: 11 }], modifiersText: "Volare +5" }]);
});

it("un tratto ha modificatori sempre attivi e crea un'azione precompilata", async () => {
  const sheet = importRoll20({ character: { name: "Eroe" }, normalized: { identity: { character_name: "Eroe" }, combat: { initiative: 1 }, traits: [{ name: "Allerta", source: "Feat", description: "Sempre pronto.", _rowid: "alert" }] } });
  await apiFetch("/api/sheets", { method: "PUT", body: JSON.stringify({ room: "r1", rev: 0, entry: { kind: "pc", sheet, acl: { view: [], edit: [] }, updatedBy: "GM" } }) });
  await act(async () => root.render(<App/>));
  await settle();
  const dialogButton = (label: string) => act(async () => [...host.querySelectorAll<HTMLButtonElement>(".ui-dialog button")].find((button) => button.textContent === label)!.click());
  await click("Tratti");
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Modifica Allerta"]')!.click());
  await click("+ Modificatore");
  const target = host.querySelector<HTMLSelectElement>('select[aria-label="Caratteristica modificata"]')!;
  await act(async () => { target.value = "initiative"; target.dispatchEvent(new Event("change", { bubbles: true })); });
  await type('input[aria-label="Valore modificatore"]', "5");
  await dialogButton("Salva");

  await click("Crea azione");
  expect(host.querySelector(".ui-dialog h2")?.textContent).toBe("Nuova azione");
  await dialogButton("Salva");
  await settle(1_700);
  const saved = cloudSheet().sheet;
  expect(saved.traits[0].modifiers).toMatchObject([{ target: "initiative", amount: 5 }]);
  expect(host.querySelector(".entry .inventory-mods")?.textContent).toBe("Iniziativa +5");
  expect(saved.actions).toMatchObject([{ name: "Allerta", description: "Sempre pronto." }]);

  await click("Scheda");
  await click("Base");
  expect(host.querySelector<HTMLElement>(".metric-explained[title^='Iniziativa']")?.title).toBe("Iniziativa +6\nDestrezza +0\nAllerta +5\nAltro +1");
});

it("la tab Modifica salva le opzioni e cambia i valori della scheda", async () => {
  const sheet = importRoll20({ character: { name: "Eroe" }, normalized: { identity: { character_name: "Eroe" }, combat: { initiative: 2 } } });
  await apiFetch("/api/sheets", { method: "PUT", body: JSON.stringify({ room: "r1", rev: 0, entry: { kind: "pc", sheet, acl: { view: [], edit: [] }, updatedBy: "GM" } }) });
  await act(async () => root.render(<App/>));
  await settle();
  await click("Modifica");
  await type('input[aria-label="Modificatore iniziativa"]', "3");
  const style = host.querySelector<HTMLSelectElement>('select[aria-label="Stile iniziativa"]')!;
  await act(async () => { style.value = "advantage"; style.dispatchEvent(new Event("change", { bubbles: true })); });
  await settle(1_700);
  expect(cloudSheet().sheet.options).toMatchObject({ bonuses: { initiative: 3 }, initiativeMode: "advantage" });
  await click("Base");
  expect(host.querySelector<HTMLElement>(".metric-explained[title^='Iniziativa']")?.title).toBe("Iniziativa +5\nDestrezza +0\nOpzioni +3\nAltro +2");
});

it("nella tab Modifica aggiunge una multiclasse e aggiorna livello e slot", async () => {
  const sheet = importRoll20({ character: { name: "Eroe" }, normalized: { identity: { character_name: "Eroe", class: "Wizard", level: 1 }, combat: { proficiency_bonus: 2 }, spellcasting: { ability: "@{intelligence_mod}+", slots: { level_1: { total: 2, expended: 0 } } } }, raw: { attributes: { base_level: { current: "1" } } } });
  await apiFetch("/api/sheets", { method: "PUT", body: JSON.stringify({ room: "r1", rev: 0, entry: { kind: "pc", sheet, acl: { view: [], edit: [] }, updatedBy: "GM" } }) });
  await act(async () => root.render(<App/>));
  await settle();
  await click("Modifica");
  await click("+ Multiclasse");
  const second = host.querySelector<HTMLSelectElement>('select[aria-label="2ª classe: classe"]')!;
  await act(async () => { second.value = "Cleric"; second.dispatchEvent(new Event("change", { bubbles: true })); });
  await type('input[aria-label="2ª classe: livello"]', "2");
  await settle(1_700);
  expect(cloudSheet().sheet).toMatchObject({ classes: [{ name: "Wizard", level: 1 }, { name: "Cleric", level: 2 }], identity: { level: 3, classDisplay: "Wizard 1 / Cleric 2" } });
  expect(cloudSheet().sheet.spellcasting.slots).toEqual({ level_1: { total: 4, used: 0 }, level_2: { total: 2, used: 0 } });
});

it("in Modifica ogni abilità ha competenza, Maestria e bonus in una sola riga", async () => {
  const sheet = importRoll20({ character: { name: "Eroe" }, normalized: { identity: { character_name: "Eroe", level: 1 }, combat: { proficiency_bonus: 2 }, abilities: { wisdom: { score: 12, mod: 1, save: 1 } }, skills: { insight: { ability: "wisdom", bonus: 1, proficient: false } } } });
  await apiFetch("/api/sheets", { method: "PUT", body: JSON.stringify({ room: "r1", rev: 0, entry: { kind: "pc", sheet, acl: { view: [], edit: [] }, updatedBy: "GM" } }) });
  await act(async () => root.render(<App/>));
  await settle();
  await click("Modifica");
  expect(host.querySelector('[aria-label="Bonus insight"]')).toBeNull();
  const expertise = () => host.querySelector<HTMLInputElement>('input[aria-label="Maestria Intuizione"]')!;
  expect(expertise().disabled).toBe(true);
  await act(async () => host.querySelector<HTMLInputElement>('input[aria-label="Competenza Intuizione"]')!.click());
  await act(async () => expertise().click());
  await type('input[aria-label="Bonus aggiuntivo Intuizione"]', "1");
  await settle(1_700);
  const saved = cloudSheet().sheet;
  expect(saved.skills.insight).toMatchObject({ proficient: true, bonus: 3 });
  expect(saved.options).toMatchObject({ expertise: ["insight"], bonuses: { "skill:insight": 1 } });

  await act(async () => host.querySelector<HTMLInputElement>('input[aria-label="Competenza TS Saggezza"]')!.click());
  await type('input[aria-label="Bonus aggiuntivo TS Saggezza"]', "1");
  await settle(1_700);
  expect(cloudSheet().sheet.abilities.wisdom).toMatchObject({ saveProficient: true, save: 3 });
  expect(cloudSheet().sheet.options.bonuses).toMatchObject({ "save:wisdom": 1 });

  expect([...host.querySelectorAll(".options-panel h2, .stack h2")].filter((node) => node.textContent === "Caratteristiche")).toHaveLength(1);
  await type('input[aria-label="Punteggio Saggezza"]', "14");
  await type('input[aria-label="Bonus aggiuntivo Saggezza"]', "2");
  await settle(1_700);
  expect(cloudSheet().sheet.abilities.wisdom).toMatchObject({ score: 14, mod: 2 });
  expect(cloudSheet().sheet.options.bonuses).toMatchObject({ "ability:wisdom": 2 });
}, 15_000);

const choose = async (label: string, value: string) => {
  const select = [...host.querySelectorAll("select")].find((item) => item.getAttribute("aria-label") === label);
  expect(select, label).toBeTruthy();
  await act(async () => { select!.value = value; select!.dispatchEvent(new Event("change", { bubbles: true })); });
};
const cloudEntries = () => [...(store.get("te:room:r1:sheets")?.values() ?? [])].map((value) => JSON.parse(value));

it("Journal: il GM crea cartelle e note con i permessi, il giocatore vede solo ciò che gli è concesso", async () => {
  await act(async () => root.render(<App/>));
  await settle();
  await click("Note");
  await click("Nuova cartella");
  await type('input[aria-label="Nome della cartella"]', "Avventura");
  await click("Salva");
  await settle();
  const folder = cloudEntries().find((entry) => entry.kind === "folder");
  expect(folder).toMatchObject({ sheet: { name: "Avventura" }, acl: { view: [], edit: [] } });

  await click("Nuova nota");
  await type('input[aria-label="Titolo della nota"]', "Indizio");
  await act(async () => { const area = host.querySelector<HTMLTextAreaElement>('textarea[aria-label="Testo della nota"]')!; Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(area, "La chiave è nel pozzo."); area.dispatchEvent(new Event("input", { bubbles: true })); });
  await choose("Cartella", folder.sheet.id);
  await choose("Può vedere: aggiungi giocatore", "Marco");
  await click("Salva");
  await settle();
  await click("Nuova nota");
  await type('input[aria-label="Titolo della nota"]', "Piano segreto");
  await click("Salva");
  await settle();
  expect(cloudEntries().filter((entry) => entry.kind === "note").map((entry) => [entry.sheet.name, entry.sheet.folderId ?? null, entry.acl.view])).toEqual([["Indizio", folder.sheet.id, ["Marco"]], ["Piano segreto", null, []]]);

  await act(async () => root.unmount());
  localStorage.clear(); viewer.name = "Marco"; viewer.role = "PLAYER";
  root = createRoot(host);
  await act(async () => root.render(<App/>));
  await settle();
  await click("Note");
  expect(host.querySelector(".journal-folder strong")?.textContent).toBe("Avventura");
  expect([...host.querySelectorAll(".journal-open")].map((item) => item.textContent)).toEqual(["Indizio"]);
  expect(host.textContent).not.toContain("Nuova cartella");
  expect(host.querySelector('button[aria-label="Modifica Indizio"]')).toBeNull();
  await click("Indizio");
  expect(host.querySelector(".ui-dialog")?.textContent).toContain("La chiave è nel pozzo.");
});

it("Journal: eliminando una cartella il suo contenuto sale di un livello", async () => {
  const put = (entry: unknown) => apiFetch("/api/sheets", { method: "PUT", body: JSON.stringify({ room: "r1", rev: 0, entry }) });
  const acl = { view: [], edit: [] };
  await put({ kind: "folder", sheet: { schemaVersion: 1, id: "outer", name: "Fuori" }, acl, updatedBy: "GM" });
  await put({ kind: "folder", sheet: { schemaVersion: 1, id: "inner", name: "Dentro", parentId: "outer" }, acl, updatedBy: "GM" });
  await put({ kind: "note", sheet: { schemaVersion: 1, id: "n1", name: "Nota", body: "", folderId: "inner" }, acl, updatedBy: "GM" });
  await act(async () => root.render(<App/>));
  await settle();
  await click("Note");
  vi.spyOn(window, "confirm").mockReturnValue(true);
  await click("Modifica Dentro");
  await click("Elimina");
  await settle(1_700);
  const byId = Object.fromEntries(cloudEntries().map((entry) => [entry.sheet.id, entry]));
  expect(byId.inner.deletedAt).toEqual(expect.any(Number));
  expect(byId.n1.sheet.folderId).toBe("outer");
  expect([...host.querySelectorAll(".journal-folder strong")].map((item) => item.textContent)).toEqual(["Fuori"]);
  vi.restoreAllMocks();
});

it("Journal: il giocatore crea un diagramma che vedono solo lui e il GM e lo manda in chat", async () => {
  viewer.name = "Marco"; viewer.role = "PLAYER";
  await act(async () => root.render(<App/>));
  await settle();
  await click("Note");
  await click("Nuova nota");
  await type('input[aria-label="Titolo della nota"]', "Sospetti");
  await choose("Tipo di nota", "diagram");
  expect(host.querySelector('textarea[aria-label="Testo della nota"]')).toBeNull();
  await click("Salva");
  await settle();
  const note = cloudEntries().find((entry) => entry.kind === "note");
  expect(note).toMatchObject({ sheet: { name: "Sospetti", body: "", diagram: { nodes: [], edges: [] } }, acl: { view: [], edit: ["Marco"] } });
  expect(diagramText({ nodes: [{ id: "a", x: 0, y: 0, label: "Barone" }, { id: "b", x: 0, y: 0, label: "Locandiere" }, { id: "c", x: 0, y: 0, label: "Pozzo" }], edges: [{ id: "e", source: "a", target: "b", label: "ricatta" }] }))
    .toBe("Barone → Locandiere (ricatta)\nPozzo");
});

// React Flow in jsdom: servono ResizeObserver e DOMMatrixReadOnly (come da documentazione di xyflow).
const stubReactFlow = () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal("DOMMatrixReadOnly", class { m22 = 1; constructor(transform?: string) { const scale = transform?.match(/scale\(([^)]+)\)/); this.m22 = scale ? Number(scale[1]) : 1; } });
};
const putNote = (id: string, sheet: Record<string, unknown>, acl: { view: string[]; edit: string[] }) =>
  apiFetch("/api/sheets", { method: "PUT", body: JSON.stringify({ room: "r1", rev: 0, entry: { kind: "note", sheet: { schemaVersion: 1, id, body: "", ...sheet }, acl, updatedBy: "GM" } }) });
const asPlayer = async (name: string) => {
  await act(async () => root.unmount());
  localStorage.clear(); viewer.name = name; viewer.role = "PLAYER";
  root = createRoot(host);
  await act(async () => root.render(<App/>));
  await settle();
  await click("Note");
};
// Il diagramma è caricato con lazy: si aspetta che React Flow mostri i riquadri.
const openDiagram = async (name: string) => { await click(name); await vi.waitFor(() => expect(host.querySelector(".react-flow__node")).not.toBeNull(), { timeout: 10_000 }); await settle(); };
const noteById = (id: string) => cloudEntries().find((entry) => entry.sheet.id === id);
const diagram = { nodes: [{ id: "a", x: 0, y: 0, label: "Barone" }, { id: "b", x: 200, y: 120, label: "Locandiere" }], edges: [{ id: "e", source: "a", target: "b", label: "ricatta" }] };

it("Diagramma: chi può solo vedere lo legge senza modificarlo e lo manda in chat come testo", async () => {
  stubReactFlow();
  await putNote("d1", { name: "Intrighi", diagram }, { view: ["Marco"], edit: [] });
  await asPlayer("Marco");
  await openDiagram("Intrighi");
  const dialog = host.querySelector(".ui-dialog")!;
  expect([...dialog.querySelectorAll(".react-flow__node")].map((node) => node.textContent)).toEqual(["Barone", "Locandiere"]);
  expect(dialog.textContent).not.toContain("Aggiungi riquadro");
  expect(dialog.textContent).not.toContain("Modifica");
  expect(dialog.querySelector(".react-flow__node.draggable")).toBeNull();
  await click("Mostra in chat");
  await settle();
  expect(JSON.parse(localStorage.getItem(STORAGE_MESSAGES) ?? "[]").at(-1)).toMatchObject({ title: "Intrighi", body: "Barone → Locandiere (ricatta)" });
});

it("Diagramma: chi può modificare aggiunge e rinomina riquadri; si salva da solo e resta dopo la riapertura", async () => {
  stubReactFlow();
  await putNote("d1", { name: "Intrighi", diagram }, { view: [], edit: ["Marco"] });
  await asPlayer("Marco");
  await openDiagram("Intrighi");
  await click("Aggiungi riquadro");
  await type('input[aria-label="Testo del riquadro"]', "Pozzo");
  await click("Salva");
  // Riquadro vuoto: il popup non salva.
  await click("Aggiungi riquadro");
  await click("Salva");
  expect(host.querySelector('input[aria-label="Testo del riquadro"]')).not.toBeNull();
  await click("Annulla");
  // Doppio clic su un riquadro: popup di modifica.
  const barone = [...host.querySelectorAll(".react-flow__node")].find((node) => node.textContent === "Barone")!;
  await act(async () => barone.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })));
  expect(host.querySelector<HTMLInputElement>('input[aria-label="Testo del riquadro"]')?.value).toBe("Barone");
  await type('input[aria-label="Testo del riquadro"]', "Barone Vex");
  await click("Salva");
  await settle(1_700);
  expect(noteById("d1").sheet.diagram.nodes.map((node: { label: string }) => node.label)).toEqual(["Barone Vex", "Locandiere", "Pozzo"]);
  expect(noteById("d1").sheet.diagram.edges).toEqual(diagram.edges);
  expect(noteById("d1").updatedBy).toBe("Marco");
  // Esc chiude tutto ma le modifiche sono già salvate; riaprendo ci sono.
  await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
  expect(host.querySelector(".ui-dialog")).toBeNull();
  await openDiagram("Intrighi");
  expect([...host.querySelectorAll(".react-flow__node")].map((node) => node.textContent)).toEqual(["Barone Vex", "Locandiere", "Pozzo"]);
});

it("Diagramma: eliminare un riquadro toglie anche le sue frecce; rinominare la nota non perde il diagramma", async () => {
  stubReactFlow();
  await putNote("d1", { name: "Intrighi", diagram }, { view: [], edit: ["Marco"] });
  await asPlayer("Marco");
  await openDiagram("Intrighi");
  const locandiere = [...host.querySelectorAll(".react-flow__node")].find((node) => node.textContent === "Locandiere")!;
  await act(async () => locandiere.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })));
  await click("Elimina");
  await settle(1_700);
  expect(noteById("d1").sheet.diagram).toEqual({ nodes: [diagram.nodes[0]], edges: [] });
  await click("Chiudi");
  await click("Modifica Intrighi");
  expect(host.querySelector('select[aria-label="Tipo di nota"]')).toBeNull();
  expect(host.querySelector('textarea[aria-label="Testo della nota"]')).toBeNull();
  await type('input[aria-label="Titolo della nota"]', "Intrighi di corte");
  await click("Salva");
  await settle(1_700);
  expect(noteById("d1").sheet).toMatchObject({ name: "Intrighi di corte", diagram: { nodes: [diagram.nodes[0]], edges: [] } });
});

it("Journal: il giocatore elimina le proprie note ma non quelle del GM che può solo modificare", async () => {
  await putNote("mine", { name: "Mia", body: "x" }, { view: [], edit: ["Marco"] });
  await putNote("shared", { name: "Del GM", body: "y" }, { view: [], edit: ["*"] });
  await putNote("other", { name: "Di Luca", body: "z" }, { view: [], edit: ["Luca"] });
  await asPlayer("Marco");
  expect([...host.querySelectorAll(".journal-open")].map((item) => item.textContent)).toEqual(["Del GM", "Mia"]);
  await click("Modifica Del GM");
  expect([...host.querySelectorAll(".ui-dialog button")].map((button) => button.textContent)).not.toContain("Elimina");
  await click("Annulla");
  vi.spyOn(window, "confirm").mockReturnValue(true);
  await click("Modifica Mia");
  await click("Elimina");
  await settle();
  expect(noteById("mine").deletedAt).toEqual(expect.any(Number));
  expect(noteById("shared").deletedAt).toBeUndefined();
  expect([...host.querySelectorAll(".journal-open")].map((item) => item.textContent)).toEqual(["Del GM"]);
  vi.restoreAllMocks();
});

it("API note: accetta note senza diagramma o con diagramma valido, rifiuta diagrammi malformati", async () => {
  const acl = { view: [], edit: [] };
  expect((await putNote("t1", { name: "Testo", body: "ciao" }, acl)).status).toBe(200);
  expect((await putNote("t2", { name: "Diag", diagram }, acl)).status).toBe(200);
  expect((await putNote("t3", { name: "Rotto", diagram: { nodes: "x", edges: [] } }, acl)).status).toBe(400);
  expect((await putNote("t4", { name: "Rotto", diagram: null }, acl)).status).toBe(400);
  expect((await putNote("t5", { name: "Rotto", diagram: { nodes: [] } }, acl)).status).toBe(400);
  const huge = { nodes: Array.from({ length: 3_000 }, (_, index) => ({ id: `n${index}`, x: 0, y: 0, label: "x".repeat(60) })), edges: [] };
  expect((await putNote("t6", { name: "Enorme", diagram: huge }, acl)).status).toBe(413);
});
