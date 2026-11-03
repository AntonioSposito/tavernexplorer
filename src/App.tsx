import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { ABILITY_LABELS, ABILITY_SHORT, ABILITY_TAGS, SKILL_ABILITIES, SKILL_LABELS, TOKEN_META_KEY } from "./constants";
import { roll, supportsRollMode, type RollResult } from "./dice";
import { decodeLegacy, importRoll20 } from "./importer";
import { import5eToolsCampaign, import5eToolsMonsters } from "./import5etools";
import { mergeMonsters } from "./monsterImport";
import { canViewMessage } from "./messageVisibility";
import { publishGmMessageKey } from "./privateMessages";
import { Journal } from "./Journal";
import { EffectsEditor } from "./EffectsEditor";
import { DeathSaveControl, HitDiceControl, HitPointControl } from "./HitPointControl";
import { AssignmentPanel } from "./AssignmentPanel";
import { LibraryPanel } from "./LibraryPanel";
import { isSameCharacter, mergeReimport } from "./reimport";
import { ArmorClassControl } from "./ArmorClassControl";
import { CatalogDialog } from "./CatalogDialog";
import { ChatIcon, EditIcon } from "./icons";
import { InventoryPanel } from "./InventoryPanel";
import { ProficiencyPanel } from "./ProficiencyPanel";
import { SheetOptionsPanel } from "./SheetOptionsPanel";
import { TraitForm } from "./TraitForm";
import { CreateResource, ResourceDialog, ResourcePanel } from "./ResourcePanel";
import { counterCurrent, counterForTrait, counterFromTrait, spendCounter, unlinkCounters } from "./resources";
import { armorClass, effectiveSheet, explainCheck, explainValue, fixProficiencyChoice, modifierSources, modifierTags, modifierTotal } from "./effects";
import { setHitPointTotal } from "./hitPoints";
import { resolveAction, type ResolvedAction } from "./actions";
import { buildRollCard, describeRoll, DESCRIPTION_LIMIT, labeledBonus, type AttackRoll } from "./rollCards";
import { ActionForm } from "./ActionForm";
import { SpellForm } from "./SpellForm";
import { higherLevelBonus } from "./spells";
import { TurnOrder } from "./TurnOrder";
import { initiativeRoll } from "./initiative";
import { setTurnInitiative, stepTurn } from "./turns";
import { listAdventures, listBestiarySources, loadAdventure, loadBestiarySource, type FiveToolsAdventure, type FiveToolsSource } from "./fivetoolsApi";
import { DEFAULT_RULESET, getRuleset } from "./rulesets";
import { canEditCloudSheet, createCloudLibrary, SheetExistsError, type LibraryState } from "./cloudSheets";
import { storage } from "./storage";
import { createTavernPack, parseCharacterSheet, parseTavernPack } from "./tavernpack";
import { Alert, Badge, Button, Card, Dialog, Input, Select, Spinner } from "./ui";
import {
  DEFAULT_PERMISSIONS, OBR, addSelectedTokenToTurns, broadcastMessage, getPermissions, getPlayerInfo, getTurnState,
  getSharedInventory, highlightToken, notifySheetsChanged, onSheetsChanged, getPartyMembers, onBroadcastMessage, onPermissionsChange, onSharedInventoryChange, onTurnStateChange, getFloatingPanelPosition, getTokenImages, openFloatingPanel, pickOwlbearImage, openPanelForPlayers, resizeFloatingPanel, type PanelSize, setActiveCharacter, setPermissions, setSharedInventory, setTurnState, showRollOnMap, uploadMapAsScene, uploadMonsterTokens, uploadRemoteMapAsScene,
} from "./obr";
import type { ActionEntry, ResourceCounter, StatModifier, TraitEntry, AppTab, CampaignDocument, CharacterSheet, ChatMessage, MonsterSheet, PermissionSettings, CloudSheet, Roll20Export, RollCard, RollMode, SharedInventoryItem, SpellEntry, TavernPack, TurnEntry, TurnState, Visibility } from "./types";

const GM_TABS: AppTab[] = ["compendium", "campaigns", "settings"];
const TAB_LABELS: Record<AppTab, string> = { sheet: "Scheda", turns: "Turni", messages: "Messaggi", notes: "Note", compendium: "Bestiario", campaigns: "Avventure", shared: "Inventario comune", library: "Libreria", settings: "Permessi" };
type SheetTab = "main" | "actions" | "spells" | "inventory" | "traits" | "bio" | "options";
const SHEET_TAB_LABELS: Record<SheetTab, string> = { main: "Base", actions: "Azioni", spells: "Magia", inventory: "Zaino", traits: "Tratti", bio: "Bio", options: "Modifica" };

const signed = (value: number) => `${value >= 0 ? "+" : ""}${value}`;
const makeMessage = (partial: Partial<ChatMessage>): ChatMessage => ({
  id: crypto.randomUUID(), kind: "text", author: "Giocatore", body: "", visibility: "everyone", createdAt: Date.now(), ...partial,
});

// Migrazione una tantum: le schede salvate nel browser passano al cloud, poi il browser le dimentica.
async function migrateLocalSheets(cloud: ReturnType<typeof createCloudLibrary>, viewer: { name: string; role: "GM" | "PLAYER" }) {
  const local = storage.characters.get();
  if (!local.length) return;
  const acl = viewer.role === "GM" ? { view: [], edit: [] } : { view: [], edit: [viewer.name] };
  for (const sheet of local) {
    try { await cloud.add({ kind: "pc", sheet, acl, rev: 0, updatedAt: 0, updatedBy: viewer.name }); }
    catch (error) { if (!(error instanceof SheetExistsError)) throw error; }
  }
  storage.characters.set([]);
}

export default function App() {
  const viewParam = new URLSearchParams(window.location.search).get("view");
  const floatingView = viewParam && viewParam in TAB_LABELS ? viewParam as AppTab : null;
  const [library, setLibrary] = useState<LibraryState>({ entries: [], offline: false, conflict: null });
  const libraryRef = useRef<ReturnType<typeof createCloudLibrary> | null>(null);
  const characters = useMemo(() => library.entries.flatMap((entry) => entry.kind === "pc" ? [entry.sheet] : []), [library.entries]);
  // PF e CA dei PG per il turn order del GM: come sui token, con effetti e oggetti.
  const pcStats = useMemo(() => Object.fromEntries(characters.map((sheet) => { const view = effectiveSheet(sheet); return [sheet.id, { current: view.combat.hp.current, max: view.combat.hp.max, temp: view.combat.hp.temp, ac: armorClass(sheet, view.abilities.dexterity?.mod ?? 0).total }]; })), [characters]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(storage.messages.get());
  const [monsters, setMonsters] = useState<MonsterSheet[]>(storage.monsters.get());
  const [campaigns, setCampaigns] = useState<CampaignDocument[]>(storage.campaigns.get());
  const [sharedInventory, setSharedInventoryState] = useState<SharedInventoryItem[]>(storage.sharedInventory.get());
  const [permissions, setPermissionState] = useState<PermissionSettings>(DEFAULT_PERMISSIONS);
  const [partyMembers, setPartyMembers] = useState<Array<{ id: string; name: string; role: "GM" | "PLAYER" }>>([]);
  const [selectedMonsterId, setSelectedMonsterId] = useState<string | null>(null);
  const [openNpcId, setOpenNpcId] = useState<string | null>(null);
  const [pendingMonsters, setPendingMonsters] = useState<MonsterSheet[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [tokenNotice, setTokenNotice] = useState("");
  const [syncNotice, setSyncNotice] = useState("");
  // Avvisi dell'importer mostrati subito dopo l'import (restano anche nella tab Modifica).
  const [importNotes, setImportNotes] = useState<{ name: string; warnings: string[] } | null>(null);
  const [turns, setTurns] = useState<TurnState>({ round: 1, activeIndex: 0, entries: [] });
  const [tokenImages, setTokenImages] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<AppTab>(floatingView ?? "sheet");
  const [sheetTab, setSheetTab] = useState<SheetTab>("main");
  const [rollMode, setRollMode] = useState<RollMode>("normal");
  const [visibility, setVisibility] = useState<Visibility>("everyone");
  const [player, setPlayer] = useState({ id: "preview", name: "Giocatore", role: "PLAYER" as "GM" | "PLAYER" });
  const [draft, setDraft] = useState("");
  const [messagesSeenAt, setMessagesSeenAt] = useState(storage.messagesSeen.get);
  const [rollRequest, setRollRequest] = useState<{ title: string; formula: string; attack?: AttackRoll; as?: RollAs } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLInputElement>(null);
  const charactersRef = useRef(characters);
  const active = characters.find((character) => character.id === activeId) ?? null;

  const saveMessages = (next: ChatMessage[]) => { const trimmed = next.slice(-200); setMessages(trimmed); storage.messages.set(trimmed); };
  // Per il collegamento dei token: il proprietario è il primo giocatore connesso che può modificare la scheda.
  const assignableSheets = library.entries.flatMap((entry) => entry.kind === "pc" ? [{
    id: entry.sheet.id, name: entry.sheet.name,
    ownerId: partyMembers.find((member) => member.role !== "GM" && canEditCloudSheet(entry, { name: member.name, role: "PLAYER" }))?.id,
  }] : []);
  const openNpcEntry = library.entries.find((entry) => entry.kind === "npc" && entry.sheet.id === openNpcId);
  const openNpc = openNpcEntry?.kind === "npc" ? openNpcEntry.sheet : null;
  const activeEntry = library.entries.find((entry) => entry.sheet.id === activeId);
  const activeEditable = !library.offline && !!activeEntry && canEditCloudSheet(activeEntry, player);
  // Ogni modifica passa dalla libreria cloud: errori di permesso o rete diventano un avviso.
  const updateSheet = (id: string, update: (sheet: CharacterSheet) => CharacterSheet) => {
    try { libraryRef.current?.update(id, (entry) => ({ ...entry, sheet: update(entry.sheet as CharacterSheet) }) as CloudSheet); }
    catch (error) { setSyncNotice(error instanceof Error ? error.message : "Modifica non salvata"); }
  };
  const updateActive = (update: (sheet: CharacterSheet) => CharacterSheet) => { if (active) updateSheet(active.id, update); };

  useEffect(() => {
    if (!OBR.isAvailable) { setPlayer({ id: "preview", name: "Modalità anteprima", role: "GM" }); return; }
    let cleanup = () => undefined;
    let stopLibrary: () => void = () => undefined;
    let disposed = false;
    OBR.onReady(() => {
      if (disposed) return;
      getPlayerInfo().then((info) => {
        if (disposed) return;
        setPlayer(info);
        const cloud = createCloudLibrary({ room: OBR.room.id, viewer: info, onChange: setLibrary, notify: notifySheetsChanged, subscribe: onSheetsChanged });
        libraryRef.current = cloud;
        stopLibrary = cloud.start();
        if (!floatingView) void migrateLocalSheets(cloud, info).catch((error) => setSyncNotice(error instanceof Error ? `Schede locali non caricate nel cloud: ${error.message}` : "Schede locali non caricate nel cloud"));
        setMessages((current) => { const visible = current.filter((message) => canViewMessage(message, info.id, info.role)); storage.messages.set(visible); return visible; });
      });
      void publishGmMessageKey().catch((error) => OBR.notification.show(error instanceof Error ? error.message : "Chiave GM non disponibile", "ERROR"));
      getTurnState().then(setTurns);
      getSharedInventory().then((items) => { if (items.length) { setSharedInventoryState(items); storage.sharedInventory.set(items); } });
      getPermissions().then(setPermissionState);
      getPartyMembers().then(setPartyMembers);
      const tokenId = new URLSearchParams(window.location.search).get("token");
      if (tokenId) void OBR.scene.items.getItems([tokenId]).then(async (items) => {
        const token = items[0];
        if (!token) { setTokenNotice("Il token selezionato non è più nella scena."); return; }
        const linkedId = (token.metadata[TOKEN_META_KEY] as { characterId?: string } | undefined)?.characterId;
        if (!linkedId) { setTokenNotice(`Il token “${token.name || "senza nome"}” non ha una scheda collegata. Il GM può collegarla dalla tab Turni.`); setTab("library"); return; }
        if (charactersRef.current.some((sheet) => sheet.id === linkedId)) { setActiveId(linkedId); setTab("sheet"); return; }
        if (await OBR.player.getRole() === "GM" && storage.monsters.get().some((monster) => monster.id === linkedId)) { setSelectedMonsterId(linkedId); setTab("compendium"); return; }
        setTokenNotice(`La scheda collegata a “${token.name || "senza nome"}” non è disponibile su questo browser.`); setTab("library");
      }).catch(() => setTokenNotice("Impossibile leggere il token selezionato."));
      const stopTurns = onTurnStateChange(setTurns);
      const stopMessages = onBroadcastMessage((message) => {
        void getPlayerInfo().then((recipient) => {
          if (!canViewMessage(message, recipient.id, recipient.role)) return;
          setMessages((current) => { const next = [...current.filter((item) => item.id !== message.id), message].slice(-200); storage.messages.set(next); return next; });
        });
      });
      const stopInventory = onSharedInventoryChange((items) => { setSharedInventoryState(items); storage.sharedInventory.set(items); });
      const stopPermissions = onPermissionsChange(setPermissionState);
      const stopMembers = OBR.party.onChange((members) => setPartyMembers(members.map((member) => ({ id: member.id, name: member.name, role: member.role }))));
      cleanup = () => { stopTurns(); stopMessages(); stopInventory(); stopPermissions(); stopMembers(); stopLibrary(); };
    });
    return () => { disposed = true; cleanup(); };
  }, [floatingView]);

  // La scheda attiva deve restare tra quelle visibili.
  useEffect(() => { if (!characters.some((sheet) => sheet.id === activeId)) setActiveId(characters[0]?.id ?? null); }, [characters, activeId]);
  // Bestiario, avventure e permessi sono riservati al GM: chi non lo è torna alla scheda.
  useEffect(() => { if (player.role !== "GM" && GM_TABS.includes(tab) && !floatingView) setTab(characters.length ? "sheet" : "library"); }, [player.role, tab, floatingView, characters.length]);
  const turnTokenIds = turns.entries.flatMap((entry) => entry.tokenId ? [entry.tokenId] : []).join(",");
  useEffect(() => { void getTokenImages(turnTokenIds ? turnTokenIds.split(",") : []).then(setTokenImages).catch(() => setTokenImages({})); }, [turnTokenIds]);
  // Solo la finestra principale decide il personaggio attivo del giocatore.
  useEffect(() => { if (OBR.isReady && !floatingView) void setActiveCharacter(activeId); }, [activeId, player.id, floatingView]);
  useEffect(() => { charactersRef.current = characters; }, [characters]);
  useEffect(() => { const sync = (event: StorageEvent) => { if (event.key?.includes("/messages/")) setMessages(storage.messages.get()); if (event.key?.includes("/messages-seen/")) setMessagesSeenAt(storage.messagesSeen.get()); if (event.key?.includes("/monsters/")) setMonsters(storage.monsters.get()); if (event.key?.includes("/campaigns/")) setCampaigns(storage.campaigns.get()); }; window.addEventListener("storage", sync); return () => window.removeEventListener("storage", sync); }, []);

  async function publish(message: ChatMessage) {
    message.authorId = player.id;
    message.playerName = player.name;
    await broadcastMessage(message);
    setMessages((current) => { const next = [...current.filter((item) => item.id !== message.id), message].slice(-200); storage.messages.set(next); return next; });
  }

  // Con `attack` il messaggio include anche il danno: critico se il d20 naturale è nella gamma, nessun danno con un 1 naturale.
  // Restituisce il risultato (null se il tiro fallisce) per chi deve usarlo, es. la cura del dado vita.
  // as: tiro di un mostro, a nome del mostro e solo al GM, invece che del personaggio attivo.
  async function executeRoll(name: string, formula: string, mode: RollMode, attack?: AttackRoll, as?: RollAs): Promise<RollResult | null> {
    try {
      const result = roll(formula, mode);
      const { card, title, body } = buildRollCard(name, formula, result, mode, attack);
      await publish(makeMessage({ kind: "roll", author: as?.author ?? active?.name ?? player.name, characterId: as ? undefined : active?.id, title, body, card, formula: result.formula, total: result.total, dice: result.dice, visibility: as?.visibility ?? visibility }));
      if (!as && active && visibility === "everyone") await showRollOnMap(active.id, title, result.total);
      return result;
    } catch (error) {
      if (OBR.isAvailable) await OBR.notification.show(error instanceof Error ? error.message : "Tiro non valido", "ERROR");
      return null;
    }
  }

  // mode: modo preimpostato dalle opzioni della scheda (es. iniziativa con vantaggio), senza chiedere.
  function performRoll(title: string, formula: string, attack?: AttackRoll, mode?: RollMode, as?: RollAs) { if (mode && mode !== "normal") void executeRoll(title, formula, mode, attack, as); else if (supportsRollMode(formula)) setRollRequest({ title, formula, attack, as }); else void executeRoll(title, formula, rollMode, attack, as); }

  // `card` arriva dalle liste della scheda con attacco, danno e TS già calcolati; senza, solo nome e descrizione.
  async function shareEntry(entry: ActionEntry | SpellEntry, card?: RollCard) {
    try {
      await publish(makeMessage({ kind: "share", author: active?.name ?? player.name, characterId: active?.id, title: entry.name, body: entry.description || [entry.damage && `Danno ${entry.damage}`, entry.saveDc && `CD ${entry.saveDc}`].filter(Boolean).join(" · ") || "Nessuna descrizione", card: card ?? { name: entry.name, subtitle: entry.range ? `Gittata ${entry.range}` : undefined, rolls: [], description: entry.description?.slice(0, DESCRIPTION_LIMIT) || "Nessuna descrizione." }, visibility }));
    } catch (error) { if (OBR.isAvailable) await OBR.notification.show(error instanceof Error ? error.message : "Condivisione fallita", "ERROR"); }
  }

  async function importFile(file: File) {
    try {
      const parsed = JSON.parse(await file.text()) as Roll20Export | CharacterSheet | TavernPack | null;
      if (parsed && "format" in parsed && parsed.format === "tavernpack") {
        const pack = parseTavernPack(parsed);
        if (!window.confirm("Importare questo TavernPack sostituendo i dati locali correnti?")) return;
        const skipped = player.role === "GM" ? await addToLibrary(pack.data.characters) : pack.data.characters.length;
        if (skipped) setSyncNotice(`${skipped} schede del TavernPack non importate: già presenti nella libreria o riservate al GM.`);
        setMonsters(pack.data.monsters); storage.monsters.set(pack.data.monsters);
        setCampaigns(pack.data.campaigns); storage.campaigns.set(pack.data.campaigns);
        await saveSharedInventory(pack.data.sharedInventory);
        if (pack.data.session) { saveMessages(pack.data.session.messages); await changeTurns(pack.data.session.turnState); }
        setActiveId(pack.data.characters[0]?.id ?? null); setTab("library"); return;
      }
      if (!parsed || typeof parsed !== "object") throw new Error("JSON non valido: attesa una scheda o un TavernPack");
      const sheet = "schemaVersion" in parsed ? parseCharacterSheet(parsed) : importRoll20(parsed as Roll20Export);
      if (!sheet.ruleset) sheet.ruleset = { id: DEFAULT_RULESET.id, version: DEFAULT_RULESET.version };
      if (player.role !== "GM") throw new Error("Solo il GM può importare schede nella libreria");
      const existing = characters.find((item) => isSameCharacter(item, sheet));
      if (existing) {
        if (!window.confirm(`${existing.name} è già nella libreria. Aggiornarla con questo file? Permessi, PF attuali, slot usati, effetti e contatori restano invariati.`)) return;
        updateSheet(existing.id, (current) => mergeReimport(current, sheet));
        setActiveId(existing.id); setTab("sheet"); if (sheet.importWarnings.length) setImportNotes({ name: sheet.name, warnings: sheet.importWarnings }); return;
      }
      if (await addToLibrary([sheet])) throw new Error(`${sheet.name} esiste già nella libreria`);
      setActiveId(sheet.id); setTab("sheet");
      if (sheet.importWarnings.length) setImportNotes({ name: sheet.name, warnings: sheet.importWarnings });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Importazione fallita";
      if (OBR.isAvailable) await OBR.notification.show(message, "ERROR"); else window.alert(message);
    }
  }

  // Carica nuove schede PG visibili solo al GM; ritorna quante erano già presenti.
  async function addToLibrary(sheets: CharacterSheet[]): Promise<number> {
    const cloud = libraryRef.current;
    if (!cloud) throw new Error("Apri TavernExplorer dentro Owlbear Rodeo per usare la libreria");
    let existing = 0;
    for (const sheet of sheets) {
      try { await cloud.add({ kind: "pc", sheet, acl: { view: [], edit: [] }, rev: 0, updatedAt: 0, updatedBy: player.name }); }
      catch (error) { if (error instanceof SheetExistsError) existing += 1; else throw error; }
    }
    return existing;
  }

  // Scheda nuova senza import: chi la crea può modificarla (il GM sempre), gli altri non la vedono.
  async function createCharacter(sheet: CharacterSheet) {
    await runAction(async () => {
      if (!libraryRef.current) throw new Error("Apri TavernExplorer dentro Owlbear Rodeo per usare la libreria");
      await libraryRef.current.add({ kind: "pc", sheet, acl: { view: [], edit: player.role === "GM" ? [] : [player.name] }, rev: 0, updatedAt: 0, updatedBy: player.name });
      // Scheda vuota: si completa nella tab Modifica; quella guidata è pronta da giocare.
      setActiveId(sheet.id); setSheetTab(sheet.classes?.length ? "main" : "options"); setTab("sheet");
    });
  }

  // Ogni NPC è una copia con id e nome propri: lo stesso mostro può diventare più NPC.
  async function addNpc(monster: MonsterSheet) {
    const name = window.prompt("Nome dell'NPC", monster.name)?.trim();
    if (!name) return;
    await runAction(async () => {
      if (!libraryRef.current) throw new Error("Apri TavernExplorer dentro Owlbear Rodeo per usare la libreria");
      await libraryRef.current.add({ kind: "npc", sheet: { ...monster, id: crypto.randomUUID(), name }, acl: { view: [], edit: [] }, rev: 0, updatedAt: 0, updatedBy: player.name });
      await OBR.notification.show(`${name} aggiunto agli NPC della Libreria`, "SUCCESS");
    });
  }

  async function import5eToolsFile(file: File) {
    try {
      const parsed = JSON.parse(await file.text()) as Record<string, unknown>;
      if (Array.isArray(parsed.monster)) {
        if (player.role !== "GM") throw new Error("Bestiario e avventure sono riservati al GM");
        setPendingMonsters(import5eToolsMonsters(parsed)); setSelectedMonsterId(null); setTab("compendium");
      } else if (Array.isArray(parsed.data)) {
        const imported = import5eToolsCampaign(parsed);
        const next = [...campaigns.filter((item) => !(item.title === imported.title && item.source === imported.source)), imported];
        setCampaigns(next); storage.campaigns.set(next); setSelectedCampaignId(imported.id); setTab("campaigns");
      } else throw new Error("JSON 5e.tools non riconosciuto: atteso `monster` oppure `data`");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Importazione 5e.tools fallita";
      if (OBR.isAvailable) await OBR.notification.show(message, "ERROR"); else window.alert(message);
    }
  }

  function exportCharacter() {
    if (!active) return;
    const blob = new Blob([JSON.stringify(active, null, 2)], { type: "application/json" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `${active.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.tavernexplorer.json`; link.click(); URL.revokeObjectURL(link.href);
  }

  function exportPack() {
    const pack = createTavernPack({ characters, monsters, campaigns, sharedInventory, session: { messages, turnState: turns } });
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `tavernexplorer-${new Date().toISOString().slice(0, 10)}.tavernpack.json`; link.click(); URL.revokeObjectURL(link.href);
  }

  async function saveSharedInventory(items: SharedInventoryItem[]) {
    if (player.role !== "GM" && !permissions.playersEditInventory) return;
    await runAction(async () => { await setSharedInventory(items); setSharedInventoryState(items); storage.sharedInventory.set(items); });
  }

  async function sendText() {
    if (!draft.trim()) return;
    try { await publish(makeMessage({ author: active?.name ?? player.name, characterId: active?.id, body: draft.trim(), visibility })); setDraft(""); }
    catch (error) { if (OBR.isAvailable) await OBR.notification.show(error instanceof Error ? error.message : "Messaggio non inviato", "ERROR"); }
  }

  async function runAction(action: () => Promise<void>): Promise<void> {
    try { await action(); }
    catch (error) {
      const message = error instanceof Error ? error.message : "Operazione fallita";
      if (OBR.isAvailable) await OBR.notification.show(message, "ERROR"); else window.alert(message);
    }
  }

  async function changeTurns(next: TurnState): Promise<boolean> {
    if (player.role !== "GM" && !permissions.playersManageTurns) return false;
    try { await setTurnState(next); setTurns(next); return true; }
    catch (error) { if (OBR.isAvailable) await OBR.notification.show(error instanceof Error ? error.message : "Turno non salvato", "ERROR"); return false; }
  }
  async function rollTurnInitiative(entry: TurnEntry) {
    if (player.role !== "GM" && !permissions.playersManageTurns) return;
    try {
      const sheet = characters.find((character) => character.id === entry.characterId);
      const { formula, mode, tiebreaker } = sheet ? initiativeRoll(sheet) : { formula: `1d20${signed(entry.initiativeBonus ?? 0)}`, mode: "normal" as const, tiebreaker: 0 };
      const result = roll(formula, mode);
      if (!await changeTurns(setTurnInitiative(turns, entry.id, result.total + tiebreaker))) return;
      const monster = !sheet && monsters.some((item) => item.id === entry.characterId);
      await publish(makeMessage({ kind: "roll", author: monster ? entry.name : player.name, title: `Iniziativa · ${entry.name}`, body: `${result.formula} → ${result.total}`, card: buildRollCard(`Iniziativa · ${entry.name}`, formula, result, mode).card, formula: result.formula, total: result.total, dice: result.dice, visibility: monster ? "gm" : visibility }));
    } catch (error) { if (OBR.isAvailable) await OBR.notification.show(error instanceof Error ? error.message : "Tiro iniziativa fallito", "ERROR"); }
  }

  const visibleMessages = useMemo(() => messages.filter((message) => canViewMessage(message, player.id, player.role)), [messages, player.id, player.role]);
  const unreadMessages = tab === "messages" ? 0 : visibleMessages.filter((message) => message.createdAt > messagesSeenAt).length;
  useEffect(() => { if (tab !== "messages") return; const latest = Math.max(messagesSeenAt, ...visibleMessages.map((message) => message.createdAt)); if (latest > messagesSeenAt) { setMessagesSeenAt(latest); storage.messagesSeen.set(latest); } }, [tab, visibleMessages, messagesSeenAt]);

  return <div className="app">
    {floatingView && <FloatingHandle view={floatingView}/>}
    {OBR.isAvailable && (floatingView ? <ResizeHandle panel={floatingView}/> : !new URLSearchParams(window.location.search).has("token") && <ResizeHandle/>)}
    {!floatingView && <>
    <header className="topbar">
      <div className="brand"><img src={import.meta.env.DEV ? "/dev/icon-dev.svg" : "/icon.svg"} alt=""/><div><strong>TavernExplorer{import.meta.env.DEV && <span className="dev-badge">DEV</span>}</strong><small>{DEFAULT_RULESET.label}</small></div></div>
      <select value={activeId ?? ""} onChange={(event) => { setActiveId(event.target.value || null); if (event.target.value) setTab("sheet"); }}>
        <option value="">Nessuna scheda</option>{characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}
      </select>
    </header>
    </>}

    <div className="app-body">
    {!floatingView && <nav className="app-tabs">
      {([
        ["sheet", null], ["turns", turns.entries.length || null], ["messages", unreadMessages || null], ["notes", library.entries.filter((entry) => entry.kind === "note").length || null], ["shared", null], ["library", null],
        // Tab solo GM in fondo, dopo un separatore.
        ...(player.role === "GM" ? [["gm-separator", null], ["compendium", null], ["campaigns", null], ["settings", null]] as const : []),
      ] as const).map(([id, count]) => id === "gm-separator" ? <span key={id} className="tab-separator" role="separator"/> : <button key={id} className={tab === id ? "active" : ""} aria-label={TAB_LABELS[id]} title={TAB_LABELS[id]} onClick={() => setTab(id)}>
        <span className="tab-icon-wrap"><span className="tab-icon" aria-hidden="true" style={{ WebkitMaskImage: `url(/tab-icons/${id}.png)`, maskImage: `url(/tab-icons/${id}.png)` }}/>
        {id === "messages" ? count != null && <span className="tab-badge unread" aria-label={`${count} non letti`}>{count}</span> : count != null && <span className="tab-badge">{count}</span>}</span>
      </button>)}
    </nav>}

    <main>
      {!floatingView && OBR.isAvailable && <div className="popout-row"><Button variant="ghost" onClick={() => void openFloatingPanel(tab)}>Apri {TAB_LABELS[tab].toLowerCase()} in finestra ↗</Button></div>}
      {floatingView === "sheet" && <select className="floating-select" aria-label="Scheda" value={activeId ?? ""} onChange={(event) => setActiveId(event.target.value || null)}><option value="">Nessuna scheda</option>{characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}</select>}
      {tokenNotice && <Alert tone="danger">{tokenNotice}</Alert>}
      {syncNotice && <Alert tone="danger">{syncNotice}</Alert>}
      {library.offline && <Alert tone="danger">Server non raggiungibile: le schede sono in sola lettura.</Alert>}
      {library.conflict && <Alert tone="danger"><p>{library.conflict}</p><Button variant="outline" onClick={() => libraryRef.current?.clearConflict()}>OK</Button></Alert>}
      {!OBR.isAvailable && tab === "sheet" && <Alert tone="danger">Le schede sono salvate nel cloud della stanza: apri TavernExplorer dentro Owlbear Rodeo.</Alert>}
      {tab === "sheet" && (active ? <SheetView sheet={active} editable={activeEditable} onRollValue={(name, formula, extras) => executeRoll(name, lucky(active, formula), "normal", extras)} sheetTab={sheetTab} setSheetTab={setSheetTab} rollMode={rollMode} setRollMode={setRollMode} visibility={visibility} setVisibility={setVisibility} onRoll={(title, formula, attack, mode) => performRoll(title, lucky(active, formula), attack, mode)} onShare={shareEntry} onUpdate={updateActive} onRest={(summary) => { void runAction(() => publish(makeMessage({ kind: "share", author: active.name, characterId: active.id, title: "Riposo", body: summary, visibility }))); }} onResourceUsed={(title, body) => { void runAction(() => publish(makeMessage({ kind: "share", author: active.name, characterId: active.id, title, body, visibility }))); }} onNotice={(title, alert) => { void runAction(() => publish(makeMessage({ kind: "share", author: active.name, characterId: active.id, title, body: alert, card: { name: title, rolls: [], alert }, visibility: "everyone" }))); }}/> : <Empty onImport={() => fileRef.current?.click()}/>)}
      {tab === "turns" && <div className="stack"><TurnOrder state={turns} showStats={player.role === "GM"} pcStats={pcStats} onPcHp={(id, value) => updateSheet(id, (next) => { next.combat = setHitPointTotal(next.combat, value, effectiveSheet(next).combat.hp.max); return next; })} onOpenForPlayers={OBR.isAvailable && player.role === "GM" ? () => { void runAction(async () => { await openPanelForPlayers("turns"); await OBR.notification.show("Turn order aperto ai giocatori", "SUCCESS"); }); } : undefined} images={Object.fromEntries(turns.entries.flatMap((entry) => { const image = (entry.tokenId && tokenImages[entry.tokenId]) || characters.find((sheet) => sheet.id === entry.characterId)?.avatar; return image ? [[entry.id, image]] : []; }))} canManage={player.role === "GM" || permissions.playersManageTurns} onChange={(next) => void changeTurns(next)} onNext={() => void changeTurns(stepTurn(turns, 1))} onPrevious={() => void changeTurns(stepTurn(turns, -1))} onRollInitiative={(entry) => void rollTurnInitiative(entry)} onFocusToken={OBR.isAvailable ? (tokenId) => { void runAction(() => highlightToken(tokenId)); } : undefined} active={active} onAttach={async () => { if (!active || (player.role !== "GM" && !permissions.playersManageTurns)) return; try { const bonus = effectiveSheet(active).combat.initiative; await addSelectedTokenToTurns(active.id, active.name, roll(`1d20${signed(bonus)}`, "normal").total, bonus); } catch (error) { if (OBR.isAvailable) await OBR.notification.show(error instanceof Error ? error.message : "Token non collegato", "ERROR"); } }}/>{player.role === "GM" && !floatingView && (assignableSheets.length > 0 || monsters.length > 0) && <AssignmentPanel sheets={assignableSheets} monsters={monsters} members={partyMembers}/>}</div>}
      {tab === "messages" && <Messages messages={visibleMessages} draft={draft} setDraft={setDraft} visibility={visibility} setVisibility={setVisibility} onSend={sendText}/>}
      {tab === "notes" && <Journal entries={library.entries} members={partyMembers} player={player} onAdd={(entry) => runAction(async () => { if (!libraryRef.current) throw new Error("Apri TavernExplorer dentro Owlbear Rodeo per usare il Journal"); await libraryRef.current.add(entry); })} onUpdate={(id, update) => { try { libraryRef.current?.update(id, update); } catch (error) { setSyncNotice(error instanceof Error ? error.message : "Modifica non salvata"); } }} onRemove={(id) => runAction(async () => { await libraryRef.current?.remove(id); })} onShare={(title, body) => { void runAction(() => publish(makeMessage({ kind: "share", author: player.name, title, body: body.slice(0, 6000) || "Nessun testo.", visibility }))); }}/>}
      {tab === "library" && openNpc && <div className="stack"><div className="library-actions"><Button variant="ghost" onClick={() => setOpenNpcId(null)}>← Libreria</Button></div><MonsterStatblock monster={openNpc} onRoll={performRoll} onShare={shareEntry}/></div>}
      {tab === "library" && !openNpc && <LibraryPanel entries={library.entries} activeId={activeId} members={partyMembers} player={player} onSelect={(id) => { setActiveId(id); setTab("sheet"); }} onOpenNpc={setOpenNpcId} onImport={() => fileRef.current?.click()} onCreate={(sheet) => { void createCharacter(sheet); }} onExport={exportCharacter} onExportPack={exportPack} onAclChange={(id, acl) => { try { libraryRef.current?.update(id, (entry) => ({ ...entry, acl })); } catch (error) { setSyncNotice(error instanceof Error ? error.message : "Permessi non salvati"); } }} onDelete={(id) => { void runAction(async () => { await libraryRef.current?.remove(id); }); }}/>}
      {tab === "compendium" && player.role === "GM" && <Bestiary canManage={player.role === "GM"} canManageTurns={player.role === "GM" || permissions.playersManageTurns} monsters={monsters} pending={pendingMonsters} onPending={setPendingMonsters} selectedId={selectedMonsterId} onSelect={setSelectedMonsterId} onImport={() => contentRef.current?.click()} onImported={(next) => { setMonsters(next); storage.monsters.set(next); }} onDelete={(id) => { const next = monsters.filter((item) => item.id !== id); setMonsters(next); storage.monsters.set(next); setSelectedMonsterId(null); }} onRoll={performRoll} onShare={shareEntry} onShareContent={(title, body, target) => { void publish(makeMessage({ kind: "share", author: player.name, title, body, visibility: target })).catch((error) => { if (OBR.isAvailable) void OBR.notification.show(error instanceof Error ? error.message : "Condivisione fallita", "ERROR"); }); }} onAddTurn={async (monster) => { if (player.role !== "GM" && !permissions.playersManageTurns) return; const initiative = Math.floor((monster.abilities.dex - 10) / 2); try { await addSelectedTokenToTurns(monster.id, monster.name, roll(`1d20${signed(initiative)}`, "normal").total, initiative); } catch (error) { if (OBR.isAvailable) await OBR.notification.show(error instanceof Error ? error.message : "Token non collegato", "ERROR"); } }} onAddNpc={(monster) => { void addNpc(monster); }}/>}
      {tab === "campaigns" && player.role === "GM" && <Campaigns canManage={player.role === "GM"} canManageMaps={player.role === "GM"} documents={campaigns} selectedId={selectedCampaignId} onSelect={setSelectedCampaignId} onImport={() => contentRef.current?.click()} onImported={(next) => { setCampaigns(next); storage.campaigns.set(next); }} onDelete={(id) => { const next = campaigns.filter((item) => item.id !== id); setCampaigns(next); storage.campaigns.set(next); setSelectedCampaignId(null); }} onMap={() => { if (player.role === "GM") mapRef.current?.click(); }} onAdventureMap={async (image) => { if (player.role !== "GM") return; try { await uploadRemoteMapAsScene(image.url, image.title); if (OBR.isAvailable) await OBR.notification.show(`${image.title} caricata nelle scene`, "SUCCESS"); } catch (error) { const message = error instanceof Error ? error.message : "Caricamento mappa fallito"; if (OBR.isAvailable) await OBR.notification.show(message, "ERROR"); else window.alert(message); } }} onShare={(title, body, target) => { void publish(makeMessage({ kind: "share", author: player.name, title, body: body.slice(0, 6000), visibility: target })).catch((error) => { if (OBR.isAvailable) void OBR.notification.show(error instanceof Error ? error.message : "Condivisione fallita", "ERROR"); }); }}/>}
      {tab === "shared" && <SharedInventory editable={player.role === "GM" || permissions.playersEditInventory} items={sharedInventory} characters={characters} onChange={saveSharedInventory}/>}
      {tab === "settings" && player.role === "GM" && <Permissions value={permissions} onChange={async (next) => { await runAction(async () => { await setPermissions(next); setPermissionState(next); }); }}/>}
    </main>
    </div>
    <input ref={fileRef} hidden type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) importFile(file); event.target.value = ""; }}/>
    <input ref={contentRef} hidden type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) import5eToolsFile(file); event.target.value = ""; }}/>
    <input ref={mapRef} hidden type="file" accept="image/png,image/jpeg,image/webp,image/avif" onChange={async (event) => { const file = event.target.files?.[0]; if (file) { const name = window.prompt("Nome della nuova scena", file.name.replace(/\.[^.]+$/, "")); if (name) { try { await uploadMapAsScene(file, name); } catch (error) { if (OBR.isAvailable) await OBR.notification.show(error instanceof Error ? error.message : "Caricamento fallito", "ERROR"); } } } event.target.value = ""; }}/>
    <Dialog open={importNotes !== null} title={`Note d’importazione · ${importNotes?.name ?? ""}`} description="Dati da ricontrollare. Le note restano nella tab Modifica della scheda." onClose={() => setImportNotes(null)}><div className="import-notes"><ul>{importNotes?.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul><div className="action-form-buttons"><Button onClick={() => setImportNotes(null)}>OK</Button></div></div></Dialog>
    <Dialog open={Boolean(rollRequest)} title={rollRequest?.title ?? "Tiro"} description={rollRequest?.formula} onClose={() => setRollRequest(null)}><div className="roll-choice"><Button onClick={() => { if (rollRequest) void executeRoll(rollRequest.title, rollRequest.formula, "normal", rollRequest.attack, rollRequest.as); setRollRequest(null); }}>Normale</Button><Button variant="secondary" onClick={() => { if (rollRequest) void executeRoll(rollRequest.title, rollRequest.formula, "advantage", rollRequest.attack, rollRequest.as); setRollRequest(null); }}>Vantaggio</Button><Button variant="secondary" onClick={() => { if (rollRequest) void executeRoll(rollRequest.title, rollRequest.formula, "disadvantage", rollRequest.attack, rollRequest.as); setRollRequest(null); }}>Svantaggio</Button></div></Dialog>
  </div>;
}

function FloatingHandle({ view }: { view: AppTab }) {
  const token = new URLSearchParams(window.location.search).get("token") ?? undefined;
  // Coordinate schermo: il popover si muove sotto il puntatore, quelle client restano ferme.
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null); const frame = useRef(0);
  const position = (event: ReactPointerEvent) => drag.current ? { left: Math.max(0, Math.round(drag.current.left + event.screenX - drag.current.x)), top: Math.max(0, Math.round(drag.current.top + event.screenY - drag.current.y)) } : null;
  return <div className="floating-handle" onPointerDown={(event) => { if ((event.target as HTMLElement).closest("button")) return; drag.current = { x: event.screenX, y: event.screenY, ...getFloatingPanelPosition(view) }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { const next = position(event); if (!next) return; cancelAnimationFrame(frame.current); frame.current = requestAnimationFrame(() => void openFloatingPanel(view, next, token)); }} onPointerUp={(event) => { const next = position(event); if (!next) return; event.currentTarget.releasePointerCapture(event.pointerId); drag.current = null; cancelAnimationFrame(frame.current); void openFloatingPanel(view, next, token); }}><span>⠿ {TAB_LABELS[view]}</span><Button variant="ghost" aria-label="Chiudi pannello" onClick={() => void OBR.popover.close(`it.tavernexplorer/${view}-panel`)}>×</Button></div>;
}

const ACTION_SIZE_KEY = "it.tavernexplorer/action-size";

// Senza `panel` ridimensiona il popover dell'azione (dimensioni fisse nel manifest), altrimenti il pannello flottante.
function ResizeHandle({ panel }: { panel?: AppTab }) {
  const drag = useRef<{ x: number; y: number; width: number; height: number } | null>(null); const frame = useRef(0);
  const apply = (next: PanelSize, persist = false) => { if (panel) { void resizeFloatingPanel(panel, next, persist); return; } void OBR.action.setWidth(next.width); void OBR.action.setHeight(next.height); if (persist) try { localStorage.setItem(ACTION_SIZE_KEY, JSON.stringify(next)); } catch { /* storage non disponibile */ } };
  useEffect(() => { if (panel) return; try { const saved = JSON.parse(localStorage.getItem(ACTION_SIZE_KEY) ?? "null") as PanelSize | null; if (saved) { void OBR.action.setWidth(saved.width); void OBR.action.setHeight(saved.height); } } catch { /* dimensioni di default */ } }, [panel]);
  const min = panel ? { width: 260, height: 200 } : { width: 360, height: 400 };
  const size = (event: ReactPointerEvent) => drag.current ? { width: Math.max(min.width, Math.round(drag.current.width + event.screenX - drag.current.x)), height: Math.max(min.height, Math.round(drag.current.height + event.screenY - drag.current.y)) } : null;
  return <div className="resize-handle" title="Trascina per ridimensionare" aria-label="Ridimensiona finestra" onPointerDown={(event) => { drag.current = { x: event.screenX, y: event.screenY, width: window.innerWidth, height: window.innerHeight }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { const next = size(event); if (!next) return; cancelAnimationFrame(frame.current); frame.current = requestAnimationFrame(() => apply(next)); }} onPointerUp={(event) => { const next = size(event); if (!next) return; event.currentTarget.releasePointerCapture(event.pointerId); drag.current = null; cancelAnimationFrame(frame.current); apply(next, true); }}/>;
}

function SheetView({ sheet, editable, onRollValue, sheetTab, setSheetTab, rollMode, setRollMode, visibility, setVisibility, onRoll, onShare, onUpdate, onRest, onResourceUsed, onNotice }: { sheet: CharacterSheet; editable: boolean; sheetTab: SheetTab; setSheetTab: (tab: SheetTab) => void; rollMode: RollMode; setRollMode: (mode: RollMode) => void; visibility: Visibility; setVisibility: (value: Visibility) => void; onRoll: (title: string, formula: string, attack?: AttackRoll, mode?: RollMode) => void; onShare: (entry: ActionEntry | SpellEntry, card?: RollCard) => void; onUpdate: (update: (sheet: CharacterSheet) => CharacterSheet) => void; onRest: (summary: string) => void; onResourceUsed: (title: string, body: string) => void; onNotice: (title: string, alert: string) => void; onRollValue: (name: string, formula: string, extras?: AttackRoll) => Promise<RollResult | null> }) {
  const ruleset = getRuleset(sheet.ruleset.id);
  const view = effectiveSheet(sheet);
  const [editingAction, setEditingAction] = useState<ActionEntry | "new" | null>(null);
  const importNotes = sheet.importWarnings.length > 0 && <Card className="import-notes"><h2>Note d’importazione</h2><ul>{sheet.importWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></Card>;
  // Nuova anche quando arriva precompilata (es. "Crea azione" dallo zaino) e non è ancora nella scheda.
  const isNewAction = editingAction === "new" || (editingAction !== null && !sheet.actions.some((item) => item.id === editingAction.id));
  const saveAction = (entry: ActionEntry) => {
    onUpdate((next) => { const index = next.actions.findIndex((item) => item.id === entry.id); if (index >= 0) next.actions[index] = entry; else next.actions.push(entry); return next; });
    setEditingAction(null);
  };
  const [reordering, setReordering] = useState(false);
  const [editingTrait, setEditingTrait] = useState<TraitEntry | "new" | null>(null);
  const [reorderingTraits, setReorderingTraits] = useState(false);
  const moveTrait = (index: number, offset: number) => onUpdate((next) => { const [item] = next.traits.splice(index, 1); next.traits.splice(index + offset, 0, item); return next; });
  const saveTrait = (trait: TraitEntry) => { onUpdate((next) => { const index = next.traits.findIndex((item) => item.id === trait.id); if (index >= 0) next.traits[index] = trait; else next.traits.push(trait); return next; }); setEditingTrait(null); };
  const deleteTrait = (id: string) => { onUpdate((next) => { unlinkCounters(next, "traitId", id); next.traits = next.traits.filter((item) => item.id !== id); return next; }); setEditingTrait(null); };
  // "Crea risorsa" da zaino o tratti: bozza precompilata, entra nella scheda solo al salvataggio.
  const [editingResource, setEditingResource] = useState<ResourceCounter | null>(null);
  const moveAction = (index: number, offset: number) => onUpdate((next) => { const [item] = next.actions.splice(index, 1); next.actions.splice(index + offset, 0, item); return next; });
  const deleteAction = (id: string) => { onUpdate((next) => { next.actions = next.actions.filter((item) => item.id !== id); return next; }); setEditingAction(null); };
  return <>
    <section className="hero">
      {sheet.avatar && <img src={sheet.avatar} alt="" referrerPolicy="no-referrer"/>}
      <div><h1>{sheet.name}</h1><p>{sheet.identity.classDisplay || `${sheet.identity.subclass} ${sheet.identity.className} ${sheet.identity.level}`} · {sheet.identity.race}</p><small>{ruleset.label} · schema {sheet.schemaVersion}</small></div>
    </section>
    <div className="roll-controls">
      <select value={rollMode} onChange={(event) => setRollMode(event.target.value as RollMode)}><option value="normal">Normale</option><option value="advantage">Vantaggio</option><option value="disadvantage">Svantaggio</option></select>
      <select value={visibility} onChange={(event) => setVisibility(event.target.value as Visibility)}><option value="everyone">Tutti</option><option value="self">Solo io</option><option value="gm">Solo GM</option></select>
    </div>
    <nav className="sheet-tabs">{(["main", "actions", "spells", "inventory", "traits", "bio", ...editable ? ["options"] : []] as SheetTab[]).map((item) => <button key={item} className={sheetTab === item ? "active" : ""} onClick={() => setSheetTab(item)}>{SHEET_TAB_LABELS[item]}</button>)}</nav>
    {!editable && <p className="party-owner">Sola lettura</p>}
    <div className={editable ? undefined : "readonly-sheet"}>
    {sheetTab === "main" && <div className="stack"><MainSheet sheet={view} base={sheet} onRoll={onRoll} onRollValue={onRollValue} onUpdate={onUpdate} editable={editable}/><div className="sheet-columns"><ResourcePanel sheet={sheet} onUpdate={onUpdate} onRest={onRest} onUse={onResourceUsed}/><ProficiencyPanel sheet={view} onUpdate={onUpdate} onRoll={onRoll} onShare={onShare} editable={editable}/></div></div>}
    {sheetTab === "actions" && <div className="stack">{editable && <div className="library-actions">{!reordering && <Button onClick={() => setEditingAction("new")}>+ Nuova azione</Button>}{sheet.actions.length > 1 && <Button variant={reordering ? "default" : "outline"} onClick={() => setReordering(!reordering)}>{reordering ? "Fine" : "Modifica ordine"}</Button>}</div>}{editable && reordering ? <ol className="order-list">{sheet.actions.map((entry, index) => <li key={entry.id}><span>{entry.name}</span><Button variant="outline" aria-label={`Sposta su ${entry.name}`} disabled={index === 0} onClick={() => moveAction(index, -1)}>↑</Button><Button variant="outline" aria-label={`Sposta giù ${entry.name}`} disabled={index === sheet.actions.length - 1} onClick={() => moveAction(index, 1)}>↓</Button></li>)}</ol> : <EntryList entries={sheet.actions} sheet={view} onRoll={onRoll} onShare={onShare} onEdit={editable ? setEditingAction : undefined} onSpendResource={editable ? (id) => onUpdate((next) => spendCounter(next, id)) : undefined} attackModifier={modifierTotal(sheet, "attack")} damageModifier={modifierTotal(sheet, "damage")} valuesTitle={sourcesNote(sheet, [["attack", "Tiri per colpire"], ["damage", "Danni"]])}/>}</div>}
    {sheetTab === "spells" && <Spells sheet={view} base={sheet} editable={editable} onNotice={onNotice} onRoll={onRoll} onShare={onShare} onUpdate={onUpdate} attackModifier={modifierTotal(sheet, "spellAttack")} damageModifier={modifierTotal(sheet, "damage")}/>}
    {sheetTab === "inventory" && <InventoryPanel sheet={view} onUpdate={onUpdate} onShare={onShare} onCreateAction={setEditingAction} onOpenResource={setEditingResource} editable={editable}/>}
    {sheetTab === "traits" && <div className="stack">{editable && <div className="library-actions">{!reorderingTraits && <Button onClick={() => setEditingTrait("new")}>+ Nuovo tratto</Button>}{sheet.traits.length > 1 && <Button variant={reorderingTraits ? "default" : "outline"} onClick={() => setReorderingTraits(!reorderingTraits)}>{reorderingTraits ? "Fine" : "Modifica ordine"}</Button>}</div>}{editable && reorderingTraits ? <ol className="order-list">{sheet.traits.map((entry, index) => <li key={entry.id}><span>{entry.name}</span><Button variant="outline" aria-label={`Sposta su ${entry.name}`} disabled={index === 0} onClick={() => moveTrait(index, -1)}>↑</Button><Button variant="outline" aria-label={`Sposta giù ${entry.name}`} disabled={index === sheet.traits.length - 1} onClick={() => moveTrait(index, 1)}>↓</Button></li>)}</ol> : <EntryList entries={sheet.traits} onRoll={onRoll} onShare={onShare} onCreateAction={editable ? (entry) => setEditingAction({ id: crypto.randomUUID(), name: entry.name, description: entry.description }) : undefined} onOpenResource={editable ? (entry, counter) => setEditingResource(counter ?? counterFromTrait(entry)) : undefined} resourceOf={(entry) => counterForTrait(sheet, entry)} onEdit={editable ? (entry) => setEditingTrait(sheet.traits.find((trait) => trait.id === entry.id) ?? null) : undefined}/>}</div>}
    {sheetTab === "bio" && <section className="paper"><h2>Biografia</h2><p className="prose">{readableBiography(sheet.biography) || "Nessuna biografia."}</p></section>}
    {sheetTab === "options" && editable && <>{importNotes}<CharacterEditor sheet={sheet} onUpdate={onUpdate} classesManaged={!!sheet.options?.autoLevel && !!sheet.classes?.length}/><SheetOptionsPanel sheet={sheet} onUpdate={onUpdate}/><EffectsEditor sheet={sheet} onUpdate={onUpdate}/></>}
    </div>
    <ResourceDialog sheet={sheet} counter={editable ? editingResource : null} onUpdate={onUpdate} onClose={() => setEditingResource(null)}/>
    <Dialog open={editable && editingAction !== null} title={isNewAction ? "Nuova azione" : "Modifica azione"} onClose={() => setEditingAction(null)}>{editingAction !== null && <ActionForm action={editingAction === "new" ? null : editingAction} sheet={view} onSave={saveAction} onCancel={() => setEditingAction(null)} onDelete={editingAction === "new" || isNewAction ? undefined : () => deleteAction(editingAction.id)}/>}</Dialog>
    <Dialog open={editable && editingTrait !== null} title={editingTrait === "new" ? "Nuovo tratto" : "Modifica tratto"} onClose={() => setEditingTrait(null)}>{editingTrait !== null && <TraitForm trait={editingTrait === "new" ? null : editingTrait} onSave={saveTrait} onCancel={() => setEditingTrait(null)} onDelete={editingTrait === "new" ? undefined : () => deleteTrait(editingTrait.id)}/>}</Dialog>
  </>;
}

// Bio salvata ancora codificata da import precedenti alla correzione di decodeLegacy (es. "%3Cp%3Eio%20sono…").
const readableBiography = (bio: string) => /%[0-9a-f]{2}/i.test(bio) && !/\s/.test(bio) ? decodeLegacy(bio) : bio;

// Identità, combattimento e biografia della tab Modifica. I punteggi stanno nel box Caratteristiche delle opzioni.
// classesManaged: le classi gestiscono livello e dadi vita (calcolo automatico).
function CharacterEditor({ sheet, onUpdate, classesManaged = false }: { sheet: CharacterSheet; onUpdate: (update: (sheet: CharacterSheet) => CharacterSheet) => void; classesManaged?: boolean }) {
  const field = (label: string, value: string | number, apply: (next: CharacterSheet, value: string) => void, type = "text") => <label><span>{label}</span><Input type={type} value={value} onChange={(event) => onUpdate((next) => { apply(next, event.target.value); return next; })}/></label>;
  return <div className="stack"><Card><h2>Identità</h2><div className="avatar-picker">{sheet.avatar && <img src={sheet.avatar} alt="" referrerPolicy="no-referrer"/>}<Button variant="outline" onClick={() => { void pickOwlbearImage(sheet.name).then((url) => { if (url) onUpdate((next) => { next.avatar = url; return next; }); }).catch((error: unknown) => { const message = error instanceof Error ? error.message : "Immagine non scelta"; if (OBR.isAvailable) void OBR.notification.show(message, "ERROR"); else window.alert(message); }); }}>{sheet.avatar ? "Cambia immagine token" : "Scegli immagine token"}</Button>{sheet.avatar && <Button variant="ghost" onClick={() => onUpdate((next) => { delete next.avatar; return next; })}>Rimuovi immagine</Button>}</div><div className="editor-grid">{field("Nome", sheet.name, (next, value) => { next.name = value; })}{field("Razza", sheet.identity.race, (next, value) => { next.identity.race = value; })}{!classesManaged && <>{field("Classe", sheet.identity.className, (next, value) => { next.identity.className = value; })}{field("Sottoclasse", sheet.identity.subclass, (next, value) => { next.identity.subclass = value; })}{field("Descrizione classe", sheet.identity.classDisplay, (next, value) => { next.identity.classDisplay = value; })}{field("Livello", sheet.identity.level, (next, value) => { fixProficiencyChoice(next); next.identity.level = Math.max(1, Number(value) || 1); }, "number")}</>}{field("Background", sheet.identity.background, (next, value) => { next.identity.background = value; })}{field("Allineamento", sheet.identity.alignment, (next, value) => { next.identity.alignment = value; })}</div></Card><Card><h2>Combattimento</h2><div className="editor-grid">{field("PF massimi", sheet.combat.hp.max, (next, value) => { next.combat.hp.max = Number(value) || 0; }, "number")}{!classesManaged && <><label><span>Dado vita</span><Select value={`d${/^d?(\d+)$/i.exec(sheet.combat.hitDice.die.trim())?.[1] ?? ""}`} onChange={(event) => onUpdate((next) => { next.combat.hitDice.die = event.target.value; return next; })}>{["d6", "d8", "d10", "d12"].map((die) => <option key={die} value={die}>{die}</option>)}</Select></label>{field("Dadi vita totali", sheet.combat.hitDice.max, (next, value) => { const max = Math.max(0, Math.trunc(Number(value)) || 0); next.combat.hitDice.max = max; next.combat.hitDice.current = Math.min(next.combat.hitDice.current, max); }, "number")}</>}{field("Iniziativa", sheet.combat.initiative, (next, value) => { next.combat.initiative = Number(value) || 0; }, "number")}{field("Velocità", sheet.combat.speed, (next, value) => { next.combat.speed = value; })}{field("CD incantesimi", sheet.spellcasting.saveDc, (next, value) => { next.spellcasting.saveDc = Number(value) || 0; }, "number")}{field("Attacco incantesimi", sheet.spellcasting.attackBonus, (next, value) => { next.spellcasting.attackBonus = Number(value) || 0; }, "number")}<label><span>Recupero slot incantesimo</span><Select aria-label="Recupero slot incantesimo" value={sheet.spellcasting.slotRecovery ?? "long"} onChange={(event) => onUpdate((next) => { next.spellcasting.slotRecovery = event.target.value === "short" ? "short" : "long"; return next; })}><option value="long">Riposo lungo</option><option value="short">Riposo breve (es. Magia del Patto)</option></Select></label></div></Card><Card><h2>Biografia</h2><textarea className="ui-textarea" value={sheet.biography} onChange={(event) => onUpdate((next) => { next.biography = event.target.value; return next; })}/></Card></div>;
}

// Pagina "Core" in stile Roll20, in una colonna per il pannello di Owlbear: ogni valore si tira con un clic.
function MainSheet({ sheet, base, onRoll, onRollValue, onUpdate, editable }: { sheet: CharacterSheet; base: CharacterSheet; onRoll: (title: string, formula: string, attack?: AttackRoll, mode?: RollMode) => void; onRollValue: (name: string, formula: string, extras?: AttackRoll) => Promise<RollResult | null>; onUpdate: (update: (sheet: CharacterSheet) => CharacterSheet) => void; editable: boolean }) {
  const prof = sheet.combat.proficiencyBonus;
  const tag = (ability: string) => ABILITY_TAGS[ability] ?? "";
  return <div className="stack">
    <section className="core-stats">
      <ArmorClassControl sheet={base} dexMod={sheet.abilities.dexterity?.mod ?? 0} editable={editable} onUpdate={onUpdate}/><Metric label="Iniziativa" value={signed(sheet.combat.initiative)} title={explainCheck(base, sheet, "initiative", "Iniziativa", sheet.combat.initiative)} onClick={() => onRoll("Iniziativa", `1d20${labeledBonus([[sheet.abilities.dexterity?.mod ?? 0, "DEX"]], sheet.combat.initiative)}`, undefined, sheet.options?.initiativeMode)}/><Metric label="Velocità" value={sheet.combat.speed}/><Metric label="Competenza" value={signed(prof)}/><button className={`metric inspiration${sheet.combat.inspiration ? " on" : ""}`} aria-pressed={sheet.combat.inspiration} disabled={!editable} title={sheet.combat.inspiration ? "Hai ispirazione" : "Nessuna ispirazione"} onClick={() => onUpdate((next) => { next.combat.inspiration = !next.combat.inspiration; return next; })}><strong>{sheet.combat.inspiration ? "★" : "☆"}</strong><small>Ispirazione</small></button>
    </section>
    <div className="core-vitals"><HitPointControl sheet={sheet} editable={editable} onUpdate={onUpdate} maxTitle={explainValue(base, sheet, "hpMax", "PF massimi", sheet.combat.hp.max, false)}/><HitDiceControl sheet={sheet} editable={editable} onUpdate={onUpdate} onRollValue={onRollValue}/><DeathSaveControl sheet={sheet} editable={editable} onUpdate={onUpdate} onRollValue={onRollValue}/></div>
    <section className="paper"><h2>Caratteristiche</h2><div className="core-abilities">{Object.entries(sheet.abilities).map(([key, stat]) => <button key={key} aria-label={`Prova di ${ABILITY_LABELS[key] ?? key}`} className={explainValue(base, sheet, `ability:${key}`, "", 0) ? "value-explained" : undefined} title={explainValue(base, sheet, `ability:${key}`, ABILITY_LABELS[key] ?? key, stat.score, false)} onClick={() => onRoll(ABILITY_LABELS[key] ?? key, `1d20${labeledBonus([[stat.mod, tag(key)]], stat.mod)}`)}><small>{ABILITY_SHORT[key] ?? key}</small><strong>{stat.score}</strong><span>{signed(stat.mod)}</span></button>)}</div></section>
    <section className="paper"><h2>Tiri salvezza</h2><div className="core-list saves">{Object.entries(sheet.abilities).map(([key, stat]) => <button key={key} className={[stat.saveProficient && "proficient", explainValue(base, sheet, `save:${key}`, "", 0) && "value-explained"].filter(Boolean).join(" ") || undefined} title={explainCheck(base, sheet, `save:${key}`, `TS ${ABILITY_LABELS[key] ?? key}`, stat.save)} onClick={() => onRoll(`TS ${ABILITY_LABELS[key] ?? key}`, `1d20${labeledBonus([[stat.mod, tag(key)], [stat.saveProficient ? prof : 0, "PROF"]], stat.save)}`)}><span className={stat.saveProficient ? "dot filled" : "dot"} aria-label={stat.saveProficient ? "Competente" : undefined}/><strong>{signed(stat.save)}</strong><span>{ABILITY_LABELS[key] ?? key}</span></button>)}</div></section>
    <section className="paper"><h2>Abilità</h2><div className="core-list">{Object.entries(sheet.skills).map(([key, skill]) => <button key={key} className={[skill.proficient && "proficient", explainValue(base, sheet, `skill:${key}`, "", 0) && "value-explained"].filter(Boolean).join(" ") || undefined} title={explainCheck(base, sheet, `skill:${key}`, SKILL_LABELS[key] ?? key, skill.bonus)} onClick={() => onRoll(SKILL_LABELS[key] ?? key, `${reliableDie(sheet, skill.proficient)}${labeledBonus([[sheet.abilities[SKILL_ABILITIES[key]]?.mod ?? 0, tag(SKILL_ABILITIES[key])], [skill.proficient ? prof : 0, "PROF"]], skill.bonus)}`)}><span className={skill.proficient ? "dot filled" : "dot"} aria-label={skill.proficient ? "Competente" : undefined}/><strong>{signed(skill.bonus)}</strong><span>{SKILL_LABELS[key] ?? key} <small>({ABILITY_SHORT[SKILL_ABILITIES[key]] ?? "—"})</small></span></button>)}</div><p className="core-passive"><span>Percezione passiva</span><strong className={explainValue(base, sheet, "passivePerception", "", 0) ? "value-explained" : undefined} title={explainCheck(base, sheet, "passivePerception", "Percezione passiva", sheet.combat.passivePerception)}>{sheet.combat.passivePerception}</strong></p></section>
  </div>;
}

function Metric({ label, value, onClick, title }: { label: string; value: string | number; onClick?: () => void; title?: string }) { const content = <><strong>{value}</strong><small>{label}</small></>; const className = title ? "metric metric-explained" : "metric"; return onClick ? <button className={className} title={title} onClick={onClick}>{content}</button> : <div className={className} title={title}>{content}</div>; }
// Halfling luck: nei tiri della scheda un 1 naturale sul d20 si ritira una volta ("1d20ro1").
const lucky = (sheet: CharacterSheet, formula: string) => sheet.options?.halflingLuck ? formula.replace(/^(\s*1?d20)(?!\d)/i, "$1ro1") : formula;
// Reliable talent: nelle prove con competenza il d20 vale almeno 10.
const reliableDie = (sheet: CharacterSheet, proficient: boolean) => sheet.options?.reliableTalent && proficient ? "1d20min10" : "1d20";
// Tooltip del valore più l'eventuale nota (es. "Competente"), su righe separate.
const tooltip = (...lines: Array<string | undefined>) => lines.filter(Boolean).join("\n") || undefined;
// Tooltip dei valori delle righe (attacco e danno): ogni effetto/oggetto che li cambia.
const sourcesNote = (sheet: CharacterSheet, targets: Array<[string, string]>) => tooltip(...targets.flatMap(([target, label]) => modifierSources(sheet, target).map((source) => `${label}: ${source.name} ${signed(source.amount)}`)));


// Con `sheet` le azioni sono calcolate dalla scheda (form attacchi); senza, si usano i valori fissi (mostri, tratti).
function EntryList({ entries, sheet, onRoll, onShare, onEdit, onCast, onTogglePrepared, onCreateAction, onOpenResource, resourceOf, onSpendResource, attackModifier = 0, damageModifier = 0, valuesTitle }: { valuesTitle?: string; onCreateAction?: (entry: ActionEntry) => void; onOpenResource?: (entry: ActionEntry, counter?: ResourceCounter) => void; resourceOf?: (entry: ActionEntry) => ResourceCounter | undefined; onSpendResource?: (counterId: string) => void; entries: ActionEntry[]; sheet?: CharacterSheet; onRoll: (title: string, formula: string, attack?: AttackRoll) => void; onShare: (entry: ActionEntry, card?: RollCard) => void; onEdit?: (entry: ActionEntry) => void; onCast?: (spell: SpellEntry, run: (castLevel: number | null) => void) => void; onTogglePrepared?: (spell: SpellEntry) => void; attackModifier?: number; damageModifier?: number }) {
  if (!entries.length) return <Empty/>;
  const extra = damageModifier === 0 ? "" : signed(damageModifier);
  const tagged = (value: number) => value === 0 ? "" : `${signed(value)}[EFFECTS]`;
  return <section className="entry-list">{entries.map((entry) => {
    const resolved: ResolvedAction = sheet ? resolveAction(sheet, entry) : { attackBonus: entry.attackBonus, damage: entry.damage, damageType: entry.damageType, saveDc: entry.saveDc, critRange: 20 };
    const attack = resolved.attackBonus == null ? null : resolved.attackBonus + attackModifier;
    const save = resolved.saveDc == null ? undefined : { ability: resolved.saveAbility ? ABILITY_LABELS[resolved.saveAbility] ?? resolved.saveAbility : undefined, dc: resolved.saveDc, effect: resolved.saveEffect };
    const spell = "level" in entry ? entry as SpellEntry : null;
    const resource = entry.resourceId ? sheet?.counters?.find((counter) => counter.id === entry.resourceId) : undefined;
    const left = resource && sheet ? counterCurrent(sheet, resource) : 0;
    const subtitle = [spell && [spell.level === 0 ? "Trucchetto" : `Livello ${spell.level}`, spell.school, spell.concentration && "concentrazione", spell.ritual && "rituale", spell.innate && `innato ${spell.innate}`].filter(Boolean).join(" · "), entry.range && `Gittata ${entry.range}`].filter(Boolean).join(" · ") || undefined;
    // Gli incantesimi del form includono la descrizione nei tiri solo se richiesto, come in Roll20.
    const extras = { critRange: resolved.critRange, damageType: resolved.damageType, subtitle, save, description: spell?.includeDescription === false ? undefined : entry.description };
    const higher = spell?.higherLevel && `${spell.higherLevel.die ? `+${spell.higherLevel.count}${spell.higherLevel.die}` : ""}${spell.higherLevel.bonus ? signed(spell.higherLevel.bonus) : ""} per livello di slot superiore`;
    const components = spell?.components && [spell.components.verbal && "V", spell.components.somatic && "S", spell.components.material && `M${spell.components.materials ? ` (${spell.components.materials})` : ""}`].filter(Boolean).join(", ");
    const spellStats = [["Tempo di lancio", spell?.castingTime], ["Bersaglio", spell?.target], ["Componenti", components], ["Durata", spell?.duration], ["Cura", resolved.healing], ["Livelli superiori", higher], ["Classe", spell?.spellClass]]
      .flatMap(([label, value]) => value ? [{ label: label!, value }] : []);
    const stats = [
      ...attack != null ? [{ label: "Colpire", value: signed(attack), type: resolved.critRange < 20 ? `critico ${resolved.critRange}-20` : undefined }] : [],
      ...resolved.damage ? [{ label: "Danno", value: `${resolved.damage}${extra}`, type: resolved.damageType }] : [],
    ];
    const shareCard: RollCard = { name: entry.name, subtitle, rolls: [], stats: [...spellStats, ...stats], save, description: [entry.description, spell?.higherLevelText && `Ai livelli superiori. ${spell.higherLevelText}`].filter(Boolean).join("\n\n").slice(0, DESCRIPTION_LIMIT) || undefined };
    const details = [
      entry.range && `Gittata ${entry.range}`,
      resolved.damageType,
      resolved.saveDc != null && `TS ${resolved.saveAbility ? ABILITY_LABELS[resolved.saveAbility] ?? resolved.saveAbility : ""} CD ${resolved.saveDc}${resolved.saveEffect ? ` (${resolved.saveEffect})` : ""}`.replace("TS  CD", "CD"),
      attack != null && resolved.critRange < 20 && `Critico ${resolved.critRange}-20`,
      resource && `${resource.name} ${left}/${resource.max}`,
    ].filter(Boolean).join(" · ");
    // Il nome usa l'azione (attacco con danno, oppure solo danno); le icone condividono e modificano. preventDefault evita di aprire il dettaglio.
    // castLevel: livello dello slot usato (null = senza slot); aggiunge il danno dei livelli superiori (alla cura se manca il danno).
    const run = (castLevel: number | null) => {
      const up = spell ? higherLevelBonus(spell, castLevel) : { damage: "", crit: "" };
      // La risorsa consumata compare nella card in chat.
      const cardSubtitle = [subtitle, castLevel && `slot di livello ${castLevel}`, resource && left > 0 && `${resource.name} −1 (${left - 1}/${resource.max})`].filter(Boolean).join(" · ") || undefined;
      // L'azione collegata scala la risorsa; a 0 si tira lo stesso, con l'avviso.
      if (resource && left > 0) onSpendResource?.(resource.id);
      const alert = [spell && spell.level > 0 && !spell.innate && castLevel == null && `Lanciato senza slot${spell.ritual ? " (rituale)" : ""}`, resource && left <= 0 && `${resource.name}: esaurite`].filter(Boolean).join(" · ") || undefined;
      const rollExtras = { ...extras, subtitle: cardSubtitle, alert };
      if (spell?.output === "spellcard") onShare(entry, { ...shareCard, subtitle: cardSubtitle, alert });
      else if (attack != null) onRoll(entry.name, `${resolved.attackFormula ?? `1d20${signed(resolved.attackBonus ?? 0)}`}${tagged(attackModifier)}`, { ...rollExtras, damage: (resolved.damageFormula ?? resolved.damage) && `${resolved.damageFormula ?? resolved.damage}${tagged(damageModifier)}${up.damage}`, critDamage: (resolved.critDamageFormula ?? resolved.critDamage) && `${resolved.critDamageFormula ?? resolved.critDamage}${tagged(damageModifier)}${up.crit}` });
      else if (resolved.damage) onRoll(entry.name, `${resolved.damageFormula ?? resolved.damage}${tagged(damageModifier)}${up.damage}`, rollExtras);
      else if (resolved.healing) onRoll(entry.name, `${resolved.healingFormula ?? resolved.healing}${up.damage}`, { ...rollExtras, damageType: undefined, label: "Cura" });
      else onShare(entry, { ...shareCard, subtitle: cardSubtitle, alert });
    };
    // Un incantesimo si lancia sempre (anche senza tiri: card in chat e slot); le altre voci solo se hanno qualcosa da tirare.
    const usable = !!spell || attack != null || !!resolved.damage || !!resolved.healing || !!save || !!resource;
    // Gli incantesimi di livello (non innati) passano dalla scelta dello slot.
    const use = !usable ? null : spell && spell.level > 0 && !spell.innate && onCast ? () => onCast(spell, run) : () => run(null);
    const useTitle = spell && (spell.output === "spellcard" || (attack == null && !resolved.damage && !resolved.healing)) ? "Lancia" : attack != null ? "Tira attacco e danno" : resolved.damage ? "Tira danno" : resolved.healing ? "Tira cura" : "Mostra la CD in chat";
    const stop = (action: () => void) => (event: ReactMouseEvent) => { event.preventDefault(); action(); };
    // I trucchetti sono sempre pronti: l'interruttore vale dal 1° livello.
    const preparable = spell && spell.level > 0 ? spell : null;
    return <details key={entry.id} className={`entry${preparable && !preparable.prepared ? " unprepared" : ""}`}><summary><span>{use ? <button className="entry-use" title={useTitle} onClick={stop(use)}>{entry.name}</button> : <strong>{entry.name}</strong>}<small>{entry.source}</small>{"modifiers" in entry && modifierTags(entry.modifiers as StatModifier[] ?? []).length > 0 && <small className="inventory-mods">{modifierTags(entry.modifiers as StatModifier[]).map((tag) => <span key={tag}>{tag}</span>)}</small>}</span><span className={valuesTitle ? "entry-values value-explained" : "entry-values"} title={valuesTitle}>{attack != null && signed(attack)} {resolved.damage}{resolved.damage && extra}</span><span className="entry-icons">{preparable && <button className={`prepared-toggle${preparable.prepared ? " on" : ""}`} aria-label={`Preparato ${entry.name}`} aria-pressed={preparable.prepared} title={preparable.prepared ? "Preparato" : "Non preparato"} disabled={!onTogglePrepared} onClick={stop(() => onTogglePrepared?.(preparable))}><span className="dot"/></button>}<button aria-label={`Mostra in chat ${entry.name}`} title="Mostra in chat" onClick={stop(() => onShare(entry, shareCard))}><ChatIcon/></button>{onEdit && <button aria-label={`Modifica ${entry.name}`} title="Modifica" onClick={stop(() => onEdit(entry))}><EditIcon/></button>}</span></summary>{details && <p className="entry-meta">{details}</p>}<p>{entry.description || "Nessuna descrizione."}</p>{onCreateAction && <div className="entry-actions"><Button variant="outline" onClick={() => onCreateAction(entry)}>Crea azione</Button>{onOpenResource && <CreateResource counter={resourceOf?.(entry)} onOpen={(counter) => onOpenResource(entry, counter)}/>}</div>}</details>;
  })}</section>;
}

function Spells({ sheet, base, editable, onNotice, onRoll, onShare, onUpdate, attackModifier = 0, damageModifier = 0 }: { sheet: CharacterSheet; base: CharacterSheet; editable: boolean; onNotice: (title: string, alert: string) => void; onRoll: (title: string, formula: string, attack?: AttackRoll) => void; onShare: (entry: ActionEntry | SpellEntry) => void; onUpdate: (update: (sheet: CharacterSheet) => CharacterSheet) => void; attackModifier?: number; damageModifier?: number }) {
  // Gli slot stanno sotto il titolo del loro livello (chiavi "level_N"), anche se a quel livello non ci sono magie.
  const slotKeys = new Map(Object.keys(sheet.spellcasting.slots).map((key) => [Number(key.replace(/\D/g, "")), key]));
  // Chi modifica vede sempre i trucchetti, per poterne aggiungere.
  const levels = [...new Set([...editable ? [0] : [], ...sheet.spells.map((spell) => spell.level), ...slotKeys.keys()])].sort((a, b) => a - b);
  const [editing, setEditing] = useState<{ spell: SpellEntry | null; level: number } | null>(null);
  const [casting, setCasting] = useState<{ spell: SpellEntry; run: (castLevel: number | null) => void } | null>(null);
  const castLevels = (spell: SpellEntry) => [...slotKeys.entries()].filter(([level, key]) => level >= spell.level && sheet.spellcasting.slots[key].total > 0).sort(([a], [b]) => a - b);
  // Senza slot utilizzabili (es. scheda senza slot) si lancia subito.
  const cast = (spell: SpellEntry, run: (castLevel: number | null) => void) => { if (castLevels(spell).length) setCasting({ spell, run }); else run(null); };
  const castWith = (level: number | null) => {
    if (!casting) return;
    const key = level == null ? null : slotKeys.get(level);
    if (key) onUpdate((next) => { next.spellcasting.slots[key].used = Math.min(next.spellcasting.slots[key].total, next.spellcasting.slots[key].used + 1); return next; });
    casting.run(level);
    setCasting(null);
  };
  const saveSpell = (spell: SpellEntry) => { onUpdate((next) => { const index = next.spells.findIndex((item) => item.id === spell.id); if (index >= 0) next.spells[index] = spell; else next.spells.push(spell); return next; }); setEditing(null); };
  // Preparare un incantesimo avvisa tutto il tavolo; togliere la preparazione no.
  const togglePrepared = (spell: SpellEntry) => {
    onUpdate((next) => { const found = next.spells.find((item) => item.id === spell.id); if (found) found.prepared = !spell.prepared; return next; });
    if (!spell.prepared) onNotice("Incantesimo preparato", `${spell.name} (livello ${spell.level}) preparato`);
  };
  const [reorderingLevel, setReorderingLevel] = useState<number | null>(null);
  // Sposta un incantesimo tra quelli dello stesso livello, scambiando le posizioni nell'elenco unico della scheda.
  const moveSpell = (level: number, index: number, offset: number) => onUpdate((next) => {
    const positions = next.spells.flatMap((spell, position) => spell.level === level ? [position] : []);
    const [from, to] = [positions[index], positions[index + offset]];
    [next.spells[from], next.spells[to]] = [next.spells[to], next.spells[from]];
    return next;
  });
  const deleteSpell = (id: string) => { onUpdate((next) => { next.spells = next.spells.filter((item) => item.id !== id); return next; }); setEditing(null); };
  const [closed, setClosed] = useState(() => new Set(storage.closedSpellLevels.get()));
  const toggleLevel = (key: string, open: boolean) => {
    if (open !== closed.has(key)) return;
    const next = new Set(closed);
    if (open) next.delete(key); else next.add(key);
    setClosed(next);
    storage.closedSpellLevels.set([...next]);
  };
  // Gli slot stanno nel titolo del livello, sempre visibili: preventDefault evita di aprire o chiudere il riquadro.
  const slotRow = (key: string) => { const slot = sheet.spellcasting.slots[key]; return <div className="slot" onClick={(event) => event.preventDefault()}><span>Slot</span><button disabled={!editable} aria-label={`Usa slot ${key}`} onClick={() => onUpdate((next) => { next.spellcasting.slots[key].used = Math.min(slot.total, next.spellcasting.slots[key].used + 1); return next; })}>−</button><strong>{Math.max(0, slot.total - slot.used)} / {slot.total}</strong><button aria-label={`Recupera slot ${key}`} disabled={!editable || slot.used === 0} onClick={() => { onUpdate((next) => { next.spellcasting.slots[key].used = Math.max(0, next.spellcasting.slots[key].used - 1); return next; }); onNotice("Slot incantesimo", `Slot di livello ${key.replace(/\D/g, "")} recuperato a mano: ${Math.min(slot.total, slot.total - slot.used + 1)}/${slot.total}`); }}>+</button></div>; };
  return <div className="stack"><section className="paper spell-head"><div className={explainValue(base, sheet, "spellSaveDc", "", 0) ? "value-explained" : undefined} title={explainValue(base, sheet, "spellSaveDc", "CD incantesimi", sheet.spellcasting.saveDc, false)}><strong>CD {sheet.spellcasting.saveDc}</strong><small>Salvezza</small></div><div className={explainValue(base, sheet, "spellAttack", "", 0) ? "value-explained" : undefined} title={explainValue(base, sheet, "spellAttack", "Attacco incantesimi", sheet.spellcasting.attackBonus)}><strong>{signed(sheet.spellcasting.attackBonus)}</strong><small>Attacco</small></div></section>{levels.map((level) => { const spells = sheet.spells.filter((spell) => spell.level === level); const reordering = reorderingLevel === level; return <details key={level} className="paper spell-level" open={!closed.has(`${sheet.id}:${level}`)} onToggle={(event) => toggleLevel(`${sheet.id}:${level}`, event.currentTarget.open)}><summary><h2>{level === 0 ? "Trucchetti" : `Livello ${level}`}</h2>{slotKeys.has(level) && slotRow(slotKeys.get(level)!)}</summary>{editable && <div className="library-actions">{!reordering && <Button className="spell-add" onClick={() => setEditing({ spell: null, level })}>+ Aggiungi {level === 0 ? "trucchetto" : "incantesimo"}</Button>}{spells.length > 1 && <Button variant={reordering ? "default" : "outline"} onClick={() => setReorderingLevel(reordering ? null : level)}>{reordering ? "Fine" : "Modifica ordine"}</Button>}</div>}{reordering ? <ol className="order-list">{spells.map((spell, index) => <li key={spell.id}><span>{spell.name}</span><Button variant="outline" aria-label={`Sposta su ${spell.name}`} disabled={index === 0} onClick={() => moveSpell(level, index, -1)}>↑</Button><Button variant="outline" aria-label={`Sposta giù ${spell.name}`} disabled={index === spells.length - 1} onClick={() => moveSpell(level, index, 1)}>↓</Button></li>)}</ol> : spells.length > 0 && <EntryList entries={spells} sheet={sheet} valuesTitle={sourcesNote(base, [["spellAttack", "Attacco incantesimi"], ["damage", "Danni"]])} onRoll={onRoll} onShare={onShare} onEdit={editable ? (entry) => setEditing({ spell: entry as SpellEntry, level }) : undefined} onCast={editable ? cast : undefined} onTogglePrepared={editable ? togglePrepared : undefined} attackModifier={attackModifier} damageModifier={damageModifier}/>}</details>; })}
    <Dialog open={casting !== null} title={`Lancia ${casting?.spell.name ?? ""}`} description="Scegli lo slot: ai livelli superiori si aggiunge il danno extra." onClose={() => setCasting(null)}>{casting && <div className="cast-choice">{castLevels(casting.spell).map(([level, key]) => { const slot = sheet.spellcasting.slots[key]; const left = Math.max(0, slot.total - slot.used); return <Button key={level} variant={level === casting.spell.level ? "default" : "secondary"} disabled={left === 0} onClick={() => castWith(level)}>Livello {level} ({left}/{slot.total})</Button>; })}<Button variant="outline" onClick={() => castWith(null)}>Senza slot</Button></div>}</Dialog>
    <Dialog open={editable && editing !== null} title={editing?.spell ? "Modifica incantesimo" : `Nuovo ${editing?.level === 0 ? "trucchetto" : `incantesimo di livello ${editing?.level}`}`} onClose={() => setEditing(null)}>{editing && <SpellForm spell={editing.spell} level={editing.level} onSave={saveSpell} onCancel={() => setEditing(null)} onDelete={editing.spell ? () => deleteSpell(editing.spell!.id) : undefined}/>}</Dialog>
  </div>;
}

function Messages({ messages, draft, setDraft, visibility, setVisibility, onSend }: { messages: ChatMessage[]; draft: string; setDraft: (value: string) => void; visibility: Visibility; setVisibility: (value: Visibility) => void; onSend: () => void }) {
  const [filter, setFilter] = useState<"all" | Visibility>("all");
  const listRef = useRef<HTMLElement>(null);
  const shown = filter === "all" ? messages : messages.filter((message) => message.visibility === filter);
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [messages.length, filter]);
  return <div className="messages">
    <nav className="message-filters" aria-label="Filtra messaggi">{([ ["all", "Tutti"], ["everyone", "Pubblici"], ["gm", "GM"], ["self", "Personali"] ] as const).map(([id, label]) => <button key={id} className={filter === id ? "active" : ""} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</nav>
    <section className="message-list" ref={listRef} aria-live="polite">{shown.length === 0 && <div className="message-empty">Nessun messaggio in questa vista.</div>}{shown.map((message) => <article key={message.id} className={`message ${message.kind}`}><header><strong>{message.author}{message.playerName && message.playerName !== message.author && <span className="message-player"> ({message.playerName})</span>}</strong><small>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {message.visibility === "everyone" ? "tutti" : message.visibility === "gm" ? "GM" : "solo io"}</small></header>{message.card ? <RollCardView card={message.card}/> : <>{message.title && <h3>{message.title}</h3>}<p>{message.body}</p>{message.kind === "roll" && <div className="roll-result"><span>{message.dice?.join(" + ")}</span><strong>{message.total}</strong></div>}</>}</article>)}</section>
    <section className="composer"><textarea aria-label="Nuovo messaggio" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); if (draft.trim()) onSend(); } }} placeholder="Scrivi un messaggio…"/><div><select aria-label="Destinatari" value={visibility} onChange={(event) => setVisibility(event.target.value as Visibility)}><option value="everyone">Tutti</option><option value="self">Solo io</option><option value="gm">Solo GM</option></select><button className="primary" disabled={!draft.trim()} onClick={onSend}>Invia</button></div>{visibility === "gm" && <small className="composer-note">Il GM deve avere l'estensione aperta almeno una volta per ricevere messaggi cifrati.</small>}</section>
  </div>;
}

const MODE_LABELS: Record<RollMode, string> = { normal: "", advantage: " (vantaggio)", disadvantage: " (svantaggio)" };

// Card ispirata ai template "D&D 5e by Roll20": ogni numero ha un'etichetta, i dadi sono nel tooltip.
function RollCardView({ card }: { card: RollCard }) {
  const d20 = card.d20;
  return <div className="r20-card">
    <header><strong>{card.name}</strong>{card.subtitle && <small>{card.subtitle}</small>}</header>
    {card.alert && <p className="r20-alert" role="note">⚠ {card.alert}</p>}
    {d20 && <div className="r20-row"><span className="r20-label">{d20.label}{MODE_LABELS[d20.mode]}</span><span className="r20-values">{d20.dice.map((die, index) => <span key={index} title={d20.formula ? describeRoll(d20.formula, [die]) : undefined} className={["r20-roll", die >= d20.critRange && "crit", die === 1 && "fumble", d20.dice.length > 1 && index !== d20.kept && "dropped"].filter(Boolean).join(" ")}>{die + d20.modifier}</span>)}</span></div>}
    {card.rolls.map((row, index) => <div className="r20-row" key={index}><span className="r20-label">{row.label}</span><span className="r20-values"><span title={describeRoll(row.formula, row.dice)} className={`r20-roll${row.critical ? " crit" : ""}`}>{row.total}</span>{row.type && <em>{row.type}</em>}</span></div>)}
    {card.stats?.map((stat) => <div className="r20-row" key={stat.label}><span className="r20-label">{stat.label}</span><span className="r20-values"><strong>{stat.value}</strong>{stat.type && <em>{stat.type}</em>}</span></div>)}
    {card.save && <div className="r20-row"><span className="r20-label">Tiro salvezza</span><span className="r20-values"><strong>CD {card.save.dc}</strong>{card.save.ability && <em>{card.save.ability}</em>}</span>{card.save.effect && <small className="r20-effect">{card.save.effect}</small>}</div>}
    {card.note && <p className="r20-note">{card.note}</p>}
    {card.description && (d20 || card.rolls.length ? <details className="r20-description"><summary>Descrizione</summary><p>{card.description}</p></details> : <p className="r20-description">{card.description}</p>)}
  </div>;
}

function ContentShare({ label, onShare }: { label: string; onShare: (target: "everyone" | "gm") => void }) {
  const [target, setTarget] = useState<Visibility>("self");
  return <div className="content-share"><span>{label} · privato su questo browser</span><Select aria-label={`Destinatari ${label}`} value={target} onChange={(event) => setTarget(event.target.value as Visibility)}><option value="self">Privato</option><option value="everyone">Tutto il party</option><option value="gm">Solo GM</option></Select><Button variant="outline" disabled={target === "self"} onClick={() => { if (target !== "self") onShare(target); }}>Invia copia</Button></div>;
}

function Bestiary({ monsters, pending, onPending, selectedId, canManage, canManageTurns, onSelect, onImport, onImported, onDelete, onRoll, onShare, onShareContent, onAddTurn, onAddNpc }: { monsters: MonsterSheet[]; pending: MonsterSheet[]; onPending: (items: MonsterSheet[]) => void; selectedId: string | null; canManage: boolean; canManageTurns: boolean; onSelect: (id: string | null) => void; onImport: () => void; onImported: (items: MonsterSheet[]) => void; onDelete: (id: string) => void; onRoll: PerformRoll; onShare: (entry: ActionEntry) => void; onShareContent: (title: string, body: string, target: "everyone" | "gm") => void; onAddTurn: (monster: MonsterSheet) => void; onAddNpc: (monster: MonsterSheet) => void }) {
  const removeSelected = () => { const selected = monsters.find((monster) => monster.id === selectedId); if (selected && canManage && window.confirm(`Eliminare ${selected.name}?`)) onDelete(selected.id); };
  const [searching, setSearching] = useState(false);
  const [sources, setSources] = useState<FiveToolsSource[]>([]); const [sourceId, setSourceId] = useState(""); const [pickerOpen, setPickerOpen] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  useEffect(() => { if (!canManage) return; listBestiarySources().then((rows) => { setSources(rows); setSourceId(rows.find((row) => row.id === "XMM")?.id ?? rows[0]?.id ?? ""); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Catalogo non disponibile")); }, [canManage]);
  async function remoteImport() { const source = sources.find((row) => row.id === sourceId); if (!source) return; setLoading(true); setError(""); try { onPending(await loadBestiarySource(source)); } catch (reason) { setError(reason instanceof Error ? reason.message : "Importazione fallita"); } finally { setLoading(false); } }
  async function importSelected(selected: MonsterSheet[]) {
    if (!canManage || !selected.length) return;
    const next = mergeMonsters(monsters, selected);
    onImported(next); onPending([]); onSelect(next.find((item) => item.name === selected[0].name && item.source === selected[0].source)?.id ?? null);
    if (OBR.isAvailable) {
      try { const count = await uploadMonsterTokens(selected); await OBR.notification.show(`${count} token caricati`, "SUCCESS"); }
      catch (reason) { if (OBR.isAvailable) await OBR.notification.show(reason instanceof Error ? reason.message : "Schede importate, caricamento token fallito", "ERROR"); }
    }
  }
  const selected = monsters.find((monster) => monster.id === selectedId);
  // Ricerca come per i manuali: il risultato scelto apre il mostro.
  const grid = <>{monsters.length > 0 && <div className="library-actions"><Button variant="outline" className="picker-button" onClick={() => setSearching(true)}><span>Cerca nel bestiario</span><span>⌕</span></Button></div>}
    <CatalogDialog open={searching} title="Cerca nel bestiario" description="Cerca per nome, tipo, GS o manuale" items={monsters.map((monster) => ({ id: monster.id, label: monster.name, detail: `${monster.creatureType} · GS ${monster.challengeRating} · ${monster.source}` }))} selectedId={selectedId ?? ""} onSelect={(id) => { setSearching(false); onSelect(id); }} onClose={() => setSearching(false)}/>
    <section className="monster-grid">{monsters.map((monster) => <button key={monster.id} onClick={() => onSelect(monster.id)}><strong>{monster.name}</strong><small>{monster.creatureType} · GS {monster.challengeRating}</small><span>CA {monster.ac} · PF {monster.hp.average}</span></button>)}</section>{monsters.length === 0 && <Empty/>}</>;
  if (!selected && !canManage) return <div className="stack"><Alert>Il GM ha riservato importazione ed eliminazione dei contenuti.</Alert>{grid}</div>;
  if (selected) return <div className="stack"><div className="library-actions"><Button variant="ghost" onClick={() => onSelect(null)}>← Bestiario</Button>{canManage && <Button variant="outline" onClick={() => onAddNpc(selected)}>Aggiungi agli NPC</Button>}{canManage && <Button variant="destructive" onClick={removeSelected}>Elimina mostro</Button>}</div><MonsterStatblock monster={selected} onRoll={onRoll} onShare={onShare}><ContentShare key={selected.id} label="Riepilogo mostro" onShare={(target) => onShareContent(selected.name, `${selected.creatureType} · GS ${selected.challengeRating} · CA ${selected.ac} · PF ${selected.hp.average} · ${selected.speed}`, target)}/><button className="primary" disabled={!canManageTurns} onClick={() => onAddTurn(selected)}>Collega al token e aggiungi ai turni</button></MonsterStatblock></div>;
  return <div className="stack"><Card className="remote-import"><h2>Catalogo 5e.tools</h2><p>Scegli un manuale, poi seleziona i mostri da importare come schede e token.</p><Button variant="outline" className="picker-button" onClick={() => setPickerOpen(true)}><span>{sources.find((source) => source.id === sourceId)?.label ?? "Scegli una sorgente"}</span><span>⌕</span></Button><Button onClick={remoteImport} disabled={loading || !sourceId}>{loading && <Spinner/>}{loading ? "Caricamento…" : "Scegli mostri"}</Button>{error && <Alert tone="danger">{error}</Alert>}</Card><CatalogDialog open={pickerOpen} title="Scegli un manuale" description="Cerca per sigla sorgente 5e.tools" items={sources.map((source) => ({ id: source.id, label: source.label, detail: source.file }))} selectedId={sourceId} onSelect={(id) => { setSourceId(id); setPickerOpen(false); }} onClose={() => setPickerOpen(false)}/>{pending.length > 0 && <MonsterImportDialog key={pending[0].id} monsters={pending} onImport={(items) => void importSelected(items)} onClose={() => onPending([])}/>}<section className="library-actions"><Button variant="outline" onClick={onImport}>Importa file 5e.tools</Button></section>{grid}</div>;
}

function MonsterImportDialog({ monsters, onImport, onClose }: { monsters: MonsterSheet[]; onImport: (items: MonsterSheet[]) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const visible = monsters.filter((monster) => `${monster.name} ${monster.source} ${monster.creatureType}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const selectedSet = new Set(selected);
  const visibleIds = visible.map((monster) => monster.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id));
  return <Dialog open title="Importa mostri e token" description={`${monsters.length} mostri disponibili · ${selected.length} selezionati`} onClose={onClose}>
    <div className="catalog-search"><Input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca un mostro…" aria-label="Cerca mostri"/></div>
    <div className="monster-import-actions"><Button variant="outline" disabled={!visible.length} onClick={() => setSelected(allVisibleSelected ? selected.filter((id) => !visibleIds.includes(id)) : [...new Set([...selected, ...visibleIds])])}>{allVisibleSelected ? "Deseleziona risultati" : "Seleziona risultati"}</Button><Button variant="ghost" disabled={!selected.length} onClick={() => setSelected([])}>Azzera</Button></div>
    <div className="catalog-list monster-import-list">{visible.map((monster) => <label className="monster-import-row" key={monster.id}><input type="checkbox" checked={selectedSet.has(monster.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, monster.id] : selected.filter((id) => id !== monster.id))}/><span><strong>{monster.name}</strong><small>{monster.source} · {monster.creatureType} · GS {monster.challengeRating}</small></span></label>)}{visible.length === 0 && <div className="catalog-empty">Nessun risultato</div>}</div>
    <div className="monster-import-actions"><Button variant="secondary" onClick={onClose}>Annulla</Button><Button disabled={!selected.length} onClick={() => onImport(monsters.filter((monster) => selectedSet.has(monster.id)))}>Importa {selected.length} {selected.length === 1 ? "mostro" : "mostri"}</Button></div>
  </Dialog>;
}

function ChapterView({ chapter, canManageMaps, onShare, onMap }: { chapter: CampaignDocument["chapters"][number]; canManageMaps: boolean; onShare: (title: string, body: string, target: "everyone" | "gm") => void; onMap: (image: CampaignDocument["chapters"][number]["images"][number]) => void }) {
  return <details className="chapter"><summary>{chapter.title}</summary><div><ContentShare label="Estratto (max 6000 caratteri)" onShare={(target) => onShare(chapter.title, chapter.body, target)}/><p>{chapter.body}</p>{chapter.images.length > 0 && <section className="chapter-images">{chapter.images.map((image) => <article className={image.kind !== "image" ? "adventure-map" : "adventure-image"} key={`${image.title}-${image.url}`}><a href={image.url} target="_blank" rel="noreferrer">{image.title}</a><Badge>{image.kind === "mapPlayer" ? "Mappa giocatori" : image.kind === "map" ? "Mappa GM" : "Immagine"}</Badge><Button variant="secondary" disabled={!canManageMaps} onClick={() => onMap(image)}>Carica come scena</Button></article>)}</section>}{chapter.children.map((child) => <ChapterView key={child.id} chapter={child} canManageMaps={canManageMaps} onShare={onShare} onMap={onMap}/>)}</div></details>;
}

function Campaigns({ documents, selectedId, canManage, canManageMaps, onSelect, onImport, onImported, onDelete, onMap, onAdventureMap, onShare }: { documents: CampaignDocument[]; selectedId: string | null; canManage: boolean; canManageMaps: boolean; onSelect: (id: string | null) => void; onImport: () => void; onImported: (items: CampaignDocument[]) => void; onDelete: (id: string) => void; onMap: () => void; onAdventureMap: (image: CampaignDocument["chapters"][number]["images"][number]) => void; onShare: (title: string, body: string, target: "everyone" | "gm") => void }) {
  const removeSelected = () => { const selected = documents.find((document) => document.id === selectedId); if (selected && canManage && window.confirm(`Eliminare ${selected.title}?`)) onDelete(selected.id); };
  const [catalog, setCatalog] = useState<FiveToolsAdventure[]>([]); const [adventureId, setAdventureId] = useState(""); const [pickerOpen, setPickerOpen] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  useEffect(() => { if (!canManage) return; listAdventures().then((rows) => { setCatalog(rows); setAdventureId(rows[0]?.id ?? ""); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Catalogo non disponibile")); }, [canManage]);
  async function remoteImport() { const adventure = catalog.find((row) => row.id === adventureId); if (!adventure) return; setLoading(true); setError(""); try { const imported = await loadAdventure(adventure); const next = [...documents.filter((item) => !(item.title === imported.title && item.source === imported.source)), imported]; onImported(next); onSelect(imported.id); } catch (reason) { setError(reason instanceof Error ? reason.message : "Importazione fallita"); } finally { setLoading(false); } }
  const selected = documents.find((document) => document.id === selectedId);
  if (!selected && !canManage) return <div className="stack"><Alert>Il GM ha riservato importazione ed eliminazione dei contenuti.</Alert>{documents.map((document) => <button className="campaign-card" key={document.id} onClick={() => onSelect(document.id)}><strong>{document.title}</strong><small>{document.source} · {document.chapters.length} capitoli</small></button>)}{documents.length === 0 && <Empty/>}</div>;
  if (selected) return <div className="stack"><div className="library-actions"><Button variant="ghost" onClick={() => onSelect(null)}>← Avventure</Button>{canManage && <Button variant="destructive" onClick={removeSelected}>Elimina avventura</Button>}</div><section className="paper"><h2>{selected.title}</h2><p>{selected.source} · {getRuleset(selected.ruleset.id).label}</p><button className="primary" disabled={!canManageMaps} onClick={onMap}>Carica una mappa dal dispositivo</button></section><section className="chapters">{selected.chapters.map((chapter) => <ChapterView key={chapter.id} chapter={chapter} canManageMaps={canManageMaps} onShare={onShare} onMap={onAdventureMap}/>)}</section></div>;
  return <div className="stack"><Card className="remote-import"><h2>Avventure 5e.tools</h2><p>Scegli un'avventura: viene scaricata su richiesta e normalizzata in capitoli TavernExplorer.</p><Button variant="outline" className="picker-button" onClick={() => setPickerOpen(true)}><span>{catalog.find((adventure) => adventure.id === adventureId)?.name ?? "Cerca un'avventura"}</span><span>⌕</span></Button><Button disabled={loading || !adventureId} onClick={remoteImport}>{loading && <Spinner/>}{loading ? "Importazione…" : "Importa avventura"}</Button>{error && <Alert tone="danger">{error}</Alert>}</Card><CatalogDialog open={pickerOpen} title="Cerca un'avventura" description="Ricerca interattiva nel catalogo 5e.tools" items={catalog.map((adventure) => ({ id: adventure.id, label: adventure.name, detail: adventure.source }))} selectedId={adventureId} onSelect={(id) => { setAdventureId(id); setPickerOpen(false); }} onClose={() => setPickerOpen(false)}/><section className="library-actions"><Button variant="outline" onClick={onImport}>Importa file 5e.tools</Button><Button variant="secondary" onClick={onMap}>Carica mappa</Button></section>{documents.map((document) => <button className="campaign-card" key={document.id} onClick={() => onSelect(document.id)}><strong>{document.title}</strong><small>{document.source} · {document.chapters.length} capitoli</small></button>)}{documents.length === 0 && <Empty/>}</div>;
}


function SharedInventory({ items, characters, editable, onChange }: { items: SharedInventoryItem[]; characters: CharacterSheet[]; editable: boolean; onChange: (items: SharedInventoryItem[]) => Promise<void> }) {
  const [name, setName] = useState(""); const [quantity, setQuantity] = useState(1); const [description, setDescription] = useState("");
  const update = (id: string, change: Partial<SharedInventoryItem>) => onChange(items.map((item) => item.id === id ? { ...item, ...change, updatedAt: Date.now() } : item));
  if (!editable) return <div className="stack"><Alert>Il GM ha impostato questo inventario in sola lettura.</Alert><Card>{items.map((item) => <article className="shared-row" key={item.id}><span><strong>{item.name}</strong><small>{item.description}</small></span><strong>× {item.quantity}</strong></article>)}{items.length === 0 && <p>Nessun oggetto condiviso.</p>}</Card></div>;
  return <div className="stack"><Card><h2>Inventario comune</h2><p>Sincronizzato nella stanza Owlbear. In anteprima resta salvato nel browser.</p></Card><form className="inventory-form" onSubmit={(event) => { event.preventDefault(); if (!name.trim()) return; void onChange([...items, { id: crypto.randomUUID(), name: name.trim(), quantity: Math.max(0, quantity), description: description.trim(), updatedAt: Date.now() }]); setName(""); setQuantity(1); setDescription(""); }}><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Oggetto"/><Input type="number" min="0" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))}/><Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Note"/><Button>Aggiungi</Button></form><Card>{items.map((item) => <article className="shared-row" key={item.id}><span><strong>{item.name}</strong><small>{item.description}</small><Select value={item.assignedTo ?? ""} onChange={(event) => void update(item.id, { assignedTo: event.target.value || undefined })}><option value="">Gruppo</option>{characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}</Select></span><div><Button variant="outline" onClick={() => void update(item.id, { quantity: Math.max(0, item.quantity - 1) })}>−</Button><strong>{item.quantity}</strong><Button variant="outline" onClick={() => void update(item.id, { quantity: item.quantity + 1 })}>+</Button></div><Button variant="destructive" onClick={() => void onChange(items.filter((entry) => entry.id !== item.id))}>×</Button></article>)}{items.length === 0 && <p>Nessun oggetto condiviso.</p>}</Card></div>;
}

function Permissions({ value, onChange }: { value: PermissionSettings; onChange: (value: PermissionSettings) => Promise<void> }) {
  const options: Array<{ key: keyof PermissionSettings; title: string; description: string }> = [
    { key: "playersEditInventory", title: "Modificare inventario comune", description: "Aggiungere, assegnare, cambiare quantità ed eliminare oggetti." },
    { key: "playersManageTurns", title: "Gestire ordine dei turni", description: "Cambiare iniziativa, avanzare e rimuovere partecipanti." },
  ];
  return <div className="stack"><Card><h2>Autorizzazioni stanza</h2><p>Queste impostazioni sono condivise tramite i metadata Owlbear e possono essere cambiate solo dal GM.</p></Card><Card>{options.map((option) => <label className="permission-row" key={option.key}><span><strong>{option.title}</strong><small>{option.description}</small></span><input type="checkbox" checked={value[option.key]} onChange={(event) => void onChange({ ...value, [option.key]: event.target.checked })}/></label>)}</Card></div>;
}

// Statblock in sola lettura, usato dal Bestiario e dagli NPC della Libreria. children va tra i valori e le azioni.
type RollAs = { author: string; visibility: Visibility };
type PerformRoll = (title: string, formula: string, attack?: AttackRoll, mode?: RollMode, as?: RollAs) => void;

// I tiri dei mostri (bestiario e NPC) vanno sempre e solo al GM, a nome del mostro.
function MonsterStatblock({ monster, onRoll: performRoll, onShare, children }: { monster: MonsterSheet; onRoll: PerformRoll; onShare: (entry: ActionEntry) => void; children?: ReactNode }) {
  const onRoll = (title: string, formula: string, attack?: AttackRoll) => performRoll(title, formula, attack, undefined, { author: monster.name, visibility: "gm" });
  return <><section className="hero">{monster.image && <img src={monster.image} alt=""/>}<div><h1>{monster.name}</h1><p>{monster.size} {monster.creatureType} · GS {monster.challengeRating}</p><small>{monster.source} · {getRuleset(monster.ruleset.id).label}</small></div></section><section className="combat-grid"><Metric label="CA" value={monster.ac}/><Metric label="PF medi" value={monster.hp.average}/><Metric label="Dadi vita" value={monster.hp.formula}/><Metric label="Velocità" value={monster.speed}/><Metric label="Percezione" value={monster.passivePerception}/><Metric label="GS" value={monster.challengeRating}/></section>{children}{monster.traits.length > 0 && <section><h2>Tratti</h2><EntryList entries={monster.traits} onRoll={onRoll} onShare={onShare}/></section>}<section><h2>Azioni</h2><EntryList entries={monster.actions} onRoll={onRoll} onShare={onShare}/></section>{monster.reactions.length > 0 && <section><h2>Reazioni</h2><EntryList entries={monster.reactions} onRoll={onRoll} onShare={onShare}/></section>}{monster.legendaryActions.length > 0 && <section><h2>Azioni leggendarie</h2><EntryList entries={monster.legendaryActions} onRoll={onRoll} onShare={onShare}/></section>}</>;
}

function Empty({ onImport }: { onImport?: () => void }) { return <section className="empty"><img src="/icon.svg" alt=""/><h2>Niente da mostrare</h2><p>{onImport ? "Importa una scheda JSON per iniziare." : "Qui non ci sono ancora contenuti."}</p>{onImport && <button className="primary" onClick={onImport}>Importa JSON</button>}</section>; }
