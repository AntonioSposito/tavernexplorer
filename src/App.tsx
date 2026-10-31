import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ABILITY_LABELS, SKILL_LABELS, TOKEN_META_KEY } from "./constants";
import { roll, supportsRollMode } from "./dice";
import { importRoll20 } from "./importer";
import { import5eToolsCampaign, import5eToolsMonsters } from "./import5etools";
import { mergeMonsters } from "./monsterImport";
import { canViewMessage } from "./messageVisibility";
import { publishGmMessageKey } from "./privateMessages";
import { Notes } from "./Notes";
import { EffectsEditor } from "./EffectsEditor";
import { HitPointControl } from "./HitPointControl";
import { AssignmentPanel } from "./AssignmentPanel";
import { ModifierEditor } from "./ModifierEditor";
import { ResourcePanel } from "./ResourcePanel";
import { effectiveSheet, modifierTotal } from "./effects";
import { TurnOrder } from "./TurnOrder";
import { setTurnInitiative, stepTurn } from "./turns";
import { listAdventures, listBestiarySources, loadAdventure, loadBestiarySource, type FiveToolsAdventure, type FiveToolsSource } from "./fivetoolsApi";
import { DEFAULT_RULESET, getRuleset } from "./rulesets";
import { canEditCloudSheet, createCloudLibrary, SheetExistsError, type LibraryState } from "./cloudSheets";
import { storage } from "./storage";
import { createTavernPack, parseCharacterSheet, parseTavernPack } from "./tavernpack";
import { Alert, Badge, Button, Card, Dialog, Input, Select, Spinner } from "./ui";
import {
  DEFAULT_PERMISSIONS, OBR, addSelectedTokenToTurns, broadcastMessage, getPartyCharacters, getPermissions, getPlayerInfo, getTurnState,
  getSharedInventory, deleteSharedNote, highlightToken, notifySheetsChanged, onSheetsChanged, getPartyMembers, getSharedNotes, onBroadcastMessage, onPartyCharactersChange, onPermissionsChange, onSharedInventoryChange, onSharedNotesChange, onTurnStateChange, getFloatingPanelPosition, getTokenImages, openFloatingPanel, openPanelForPlayers, resizeFloatingPanel, type PanelSize, publishPartyCharacters, saveSharedNote, setActiveCharacter, setPermissions, setSharedInventory, setTurnState, showRollOnMap, uploadMapAsScene, uploadMonsterTokens, uploadRemoteMapAsScene,
} from "./obr";
import type { ActionEntry, AppTab, CampaignDocument, CharacterSheet, ChatMessage, MonsterSheet, NoteOrganization, PartyCharacterSummary, PermissionSettings, PlayerNote, CloudSheet, Roll20Export, RollMode, SharedInventoryItem, SharedNote, SpellEntry, TavernPack, TurnEntry, TurnState, Visibility } from "./types";

const GM_TABS: AppTab[] = ["compendium", "campaigns", "settings"];
const TAB_LABELS: Record<AppTab, string> = { sheet: "Scheda", turns: "Turni", messages: "Messaggi", notes: "Note", compendium: "Bestiario", campaigns: "Avventure", shared: "Inventario comune", party: "Party", library: "Libreria", settings: "Permessi" };
type SheetTab = "main" | "actions" | "spells" | "inventory" | "traits" | "bio" | "edit";
const SHEET_TAB_LABELS: Record<SheetTab, string> = { main: "Base", actions: "Azioni", spells: "Magia", inventory: "Zaino", traits: "Tratti", bio: "Bio", edit: "Modifica" };

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
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(storage.messages.get());
  const [notes, setNotes] = useState<PlayerNote[]>(storage.notes.get());
  const [noteOrganization, setNoteOrganization] = useState<NoteOrganization>(storage.noteOrganization.get());
  const [sharedNotes, setSharedNotes] = useState<SharedNote[]>([]);
  const [monsters, setMonsters] = useState<MonsterSheet[]>(storage.monsters.get());
  const [campaigns, setCampaigns] = useState<CampaignDocument[]>(storage.campaigns.get());
  const [sharedInventory, setSharedInventoryState] = useState<SharedInventoryItem[]>(storage.sharedInventory.get());
  const [permissions, setPermissionState] = useState<PermissionSettings>(DEFAULT_PERMISSIONS);
  const [partyCharacters, setPartyCharacters] = useState<PartyCharacterSummary[]>([]);
  const [partyMembers, setPartyMembers] = useState<Array<{ id: string; name: string; role: "GM" | "PLAYER" }>>([]);
  const [selectedMonsterId, setSelectedMonsterId] = useState<string | null>(null);
  const [pendingMonsters, setPendingMonsters] = useState<MonsterSheet[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [tokenNotice, setTokenNotice] = useState("");
  const [syncNotice, setSyncNotice] = useState("");
  const [turns, setTurns] = useState<TurnState>({ round: 1, activeIndex: 0, entries: [] });
  const [tokenImages, setTokenImages] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<AppTab>(floatingView ?? "sheet");
  const [sheetTab, setSheetTab] = useState<SheetTab>("main");
  const [rollMode, setRollMode] = useState<RollMode>("normal");
  const [visibility, setVisibility] = useState<Visibility>("everyone");
  const [player, setPlayer] = useState({ id: "preview", name: "Giocatore", role: "PLAYER" as "GM" | "PLAYER" });
  const [draft, setDraft] = useState("");
  const [rollRequest, setRollRequest] = useState<{ title: string; formula: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLInputElement>(null);
  const charactersRef = useRef(characters);
  const active = characters.find((character) => character.id === activeId) ?? null;

  const saveMessages = (next: ChatMessage[]) => { const trimmed = next.slice(-200); setMessages(trimmed); storage.messages.set(trimmed); };
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
      getPartyCharacters().then(setPartyCharacters);
      getSharedNotes().then(setSharedNotes);
      getPartyMembers().then(setPartyMembers);
      const tokenId = new URLSearchParams(window.location.search).get("token");
      if (tokenId) void OBR.scene.items.getItems([tokenId]).then(async (items) => {
        const token = items[0];
        if (!token) { setTokenNotice("Il token selezionato non è più nella scena."); return; }
        const linkedId = (token.metadata[TOKEN_META_KEY] as { characterId?: string } | undefined)?.characterId;
        if (!linkedId) { setTokenNotice(`Il token “${token.name || "senza nome"}” non ha una scheda collegata. Il GM può collegarla dal Party.`); setTab("party"); return; }
        if (charactersRef.current.some((sheet) => sheet.id === linkedId)) { setActiveId(linkedId); setTab("sheet"); return; }
        if (await OBR.player.getRole() === "GM" && storage.monsters.get().some((monster) => monster.id === linkedId)) { setSelectedMonsterId(linkedId); setTab("compendium"); return; }
        setTokenNotice(`La scheda collegata a “${token.name || "senza nome"}” non è disponibile su questo browser.`); setTab("party");
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
      const stopParty = onPartyCharactersChange(setPartyCharacters);
      const stopNotes = onSharedNotesChange(setSharedNotes);
      const stopMembers = OBR.party.onChange((members) => setPartyMembers(members.map((member) => ({ id: member.id, name: member.name, role: member.role }))));
      cleanup = () => { stopTurns(); stopMessages(); stopInventory(); stopPermissions(); stopParty(); stopNotes(); stopMembers(); stopLibrary(); };
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
  useEffect(() => { charactersRef.current = characters; if (OBR.isReady) { void publishPartyCharacters(characters).then(() => setSyncNotice("")).catch((error) => setSyncNotice(error instanceof Error ? error.message : "Sincronizzazione party fallita")); } }, [characters, player.id]);
  useEffect(() => { const sync = (event: StorageEvent) => { if (event.key?.includes("/messages/")) setMessages(storage.messages.get()); if (event.key?.includes("/monsters/")) setMonsters(storage.monsters.get()); if (event.key?.includes("/campaigns/")) setCampaigns(storage.campaigns.get()); if (event.key?.includes("/notes/")) setNotes(storage.notes.get()); if (event.key?.includes("/note-organization/")) setNoteOrganization(storage.noteOrganization.get()); }; window.addEventListener("storage", sync); return () => window.removeEventListener("storage", sync); }, []);

  async function publish(message: ChatMessage) {
    message.authorId = player.id;
    await broadcastMessage(message);
    setMessages((current) => { const next = [...current.filter((item) => item.id !== message.id), message].slice(-200); storage.messages.set(next); return next; });
  }

  async function executeRoll(title: string, formula: string, mode: RollMode) {
    try {
      const result = roll(formula, mode);
      await publish(makeMessage({ kind: "roll", author: active?.name ?? player.name, characterId: active?.id, title, body: `${result.formula} → ${result.total}`, formula: result.formula, total: result.total, dice: result.dice, visibility }));
      if (active && visibility === "everyone") await showRollOnMap(active.id, title, result.total);
      if (!floatingView) setTab("messages");
    } catch (error) {
      if (OBR.isAvailable) await OBR.notification.show(error instanceof Error ? error.message : "Tiro non valido", "ERROR");
    }
  }

  function performRoll(title: string, formula: string) { if (supportsRollMode(formula)) setRollRequest({ title, formula }); else void executeRoll(title, formula, rollMode); }

  async function shareEntry(entry: ActionEntry | SpellEntry) {
    try {
      await publish(makeMessage({ kind: "share", author: active?.name ?? player.name, characterId: active?.id, title: entry.name, body: entry.description || [entry.damage && `Danno ${entry.damage}`, entry.saveDc && `CD ${entry.saveDc}`].filter(Boolean).join(" · ") || "Nessuna descrizione", visibility }));
      if (!floatingView) setTab("messages");
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
        setNotes(pack.data.notes ?? []); storage.notes.set(pack.data.notes ?? []);
        setNoteOrganization(pack.data.noteOrganization ?? { folders: [], placements: {} }); storage.noteOrganization.set(pack.data.noteOrganization ?? { folders: [], placements: {} });
        await saveSharedInventory(pack.data.sharedInventory);
        if (pack.data.session) { saveMessages(pack.data.session.messages); await changeTurns(pack.data.session.turnState); }
        setActiveId(pack.data.characters[0]?.id ?? null); setTab("library"); return;
      }
      if (!parsed || typeof parsed !== "object") throw new Error("JSON non valido: attesa una scheda o un TavernPack");
      const sheet = "schemaVersion" in parsed ? parseCharacterSheet(parsed) : importRoll20(parsed as Roll20Export);
      if (!sheet.ruleset) sheet.ruleset = { id: DEFAULT_RULESET.id, version: DEFAULT_RULESET.version };
      if (!sheet.sharing) sheet.sharing = "private";
      if (player.role !== "GM") throw new Error("Solo il GM può importare schede nella libreria");
      if (await addToLibrary([sheet])) throw new Error(`${sheet.name} esiste già nella libreria`);
      setActiveId(sheet.id); setTab("sheet");
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
    const pack = createTavernPack({ characters, monsters, campaigns, sharedInventory, notes, noteOrganization, session: { messages, turnState: turns } });
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
      const result = roll(`1d20${signed(entry.initiativeBonus ?? 0)}`, "normal");
      if (!await changeTurns(setTurnInitiative(turns, entry.id, result.total))) return;
      await publish(makeMessage({ kind: "roll", author: player.name, title: `Iniziativa · ${entry.name}`, body: `${result.formula} → ${result.total}`, formula: result.formula, total: result.total, dice: result.dice, visibility }));
    } catch (error) { if (OBR.isAvailable) await OBR.notification.show(error instanceof Error ? error.message : "Tiro iniziativa fallito", "ERROR"); }
  }

  const visibleMessages = useMemo(() => messages.filter((message) => canViewMessage(message, player.id, player.role)), [messages, player.id, player.role]);

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
      <button className={tab === "sheet" ? "active" : ""} onClick={() => setTab("sheet")}>Scheda</button>
      <button className={tab === "turns" ? "active" : ""} onClick={() => setTab("turns")}>Turni <span>{turns.entries.length}</span></button>
      <button className={tab === "messages" ? "active" : ""} onClick={() => setTab("messages")}>Messaggi</button>
      <button className={tab === "notes" ? "active" : ""} onClick={() => setTab("notes")}>Note <span>{notes.length + sharedNotes.length}</span></button>
      {player.role === "GM" && <button className={tab === "compendium" ? "active" : ""} onClick={() => setTab("compendium")}>Bestiario</button>}
      {player.role === "GM" && <button className={tab === "campaigns" ? "active" : ""} onClick={() => setTab("campaigns")}>Avventure</button>}
      <button className={tab === "shared" ? "active" : ""} onClick={() => setTab("shared")}>Inventario comune</button>
      <button className={tab === "party" ? "active" : ""} onClick={() => setTab("party")}>Party <span>{partyCharacters.length}</span></button>
      <button className={tab === "library" ? "active" : ""} onClick={() => setTab("library")}>Libreria</button>
      {player.role === "GM" && <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>Permessi</button>}
    </nav>}

    <main>
      {!floatingView && OBR.isAvailable && <div className="popout-row"><Button variant="ghost" onClick={() => void openFloatingPanel(tab)}>Apri {TAB_LABELS[tab].toLowerCase()} in finestra ↗</Button></div>}
      {floatingView === "sheet" && <select className="floating-select" aria-label="Scheda" value={activeId ?? ""} onChange={(event) => setActiveId(event.target.value || null)}><option value="">Nessuna scheda</option>{characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}</select>}
      {tokenNotice && <Alert tone="danger">{tokenNotice}</Alert>}
      {syncNotice && <Alert tone="danger">{syncNotice}</Alert>}
      {library.offline && <Alert tone="danger">Server non raggiungibile: le schede sono in sola lettura.</Alert>}
      {library.conflict && <Alert tone="danger"><p>{library.conflict}</p><Button variant="outline" onClick={() => libraryRef.current?.clearConflict()}>OK</Button></Alert>}
      {!OBR.isAvailable && tab === "sheet" && <Alert tone="danger">Le schede sono salvate nel cloud della stanza: apri TavernExplorer dentro Owlbear Rodeo.</Alert>}
      {tab === "sheet" && (active ? <SheetView sheet={active} editable={activeEditable} sheetTab={sheetTab} setSheetTab={setSheetTab} rollMode={rollMode} setRollMode={setRollMode} visibility={visibility} setVisibility={setVisibility} onRoll={performRoll} onShare={shareEntry} onUpdate={updateActive} onRest={(summary) => { void runAction(() => publish(makeMessage({ kind: "share", author: active.name, characterId: active.id, title: "Riposo", body: summary, visibility }))); }}/> : <Empty onImport={() => fileRef.current?.click()}/>)}
      {tab === "turns" && <div className="stack"><TurnOrder state={turns} onOpenForPlayers={OBR.isAvailable && player.role === "GM" ? () => { void runAction(async () => { await openPanelForPlayers("turns"); await OBR.notification.show("Turn order aperto ai giocatori", "SUCCESS"); }); } : undefined} images={Object.fromEntries(turns.entries.flatMap((entry) => { const image = (entry.tokenId && tokenImages[entry.tokenId]) || characters.find((sheet) => sheet.id === entry.characterId)?.avatar; return image ? [[entry.id, image]] : []; }))} canManage={player.role === "GM" || permissions.playersManageTurns} onChange={(next) => void changeTurns(next)} onNext={() => void changeTurns(stepTurn(turns, 1))} onPrevious={() => void changeTurns(stepTurn(turns, -1))} onRollInitiative={(entry) => void rollTurnInitiative(entry)} onFocusToken={OBR.isAvailable ? (tokenId) => { void runAction(() => highlightToken(tokenId)); } : undefined} active={active} onAttach={async () => { if (!active || (player.role !== "GM" && !permissions.playersManageTurns)) return; try { const bonus = effectiveSheet(active).combat.initiative; await addSelectedTokenToTurns(active.id, active.name, roll(`1d20${signed(bonus)}`, "normal").total, bonus); } catch (error) { if (OBR.isAvailable) await OBR.notification.show(error instanceof Error ? error.message : "Token non collegato", "ERROR"); } }}/></div>}
      {tab === "messages" && <Messages messages={visibleMessages} draft={draft} setDraft={setDraft} visibility={visibility} setVisibility={setVisibility} onSend={sendText}/>}
      {tab === "notes" && <Notes notes={notes} sharedNotes={sharedNotes} organization={noteOrganization} player={player} onOrganizationChange={(next) => { setNoteOrganization(next); storage.noteOrganization.set(next); }} onChange={(next) => { setNotes(next); storage.notes.set(next); }} onPublish={async (note) => runAction(async () => { const shared: SharedNote = { ...note, ownerId: player.id, ownerName: player.name, writePermission: "owner" }; await saveSharedNote(shared); setSharedNotes(await getSharedNotes()); setNotes((current) => { const next = current.filter((item) => item.id !== note.id); storage.notes.set(next); return next; }); })} onSaveShared={async (note) => runAction(async () => { await saveSharedNote(note); setSharedNotes(await getSharedNotes()); })} onDeleteShared={async (id) => runAction(async () => { if (!window.confirm("Rimuovere questa nota dalla stanza?")) return; await deleteSharedNote(id); setSharedNotes(await getSharedNotes()); })} onMakePrivate={async (note) => runAction(async () => { if (!window.confirm("Rendere privata questa nota? Gli altri non potranno più leggerla.")) return; const local = { id: note.id, title: note.title, body: note.body, updatedAt: Date.now() }; setNotes((current) => { const next = [...current.filter((item) => item.id !== local.id), local]; storage.notes.set(next); return next; }); await deleteSharedNote(note.id); setSharedNotes(await getSharedNotes()); })} onSendToGm={(note) => { void runAction(async () => { if (note.body.length > 6000) throw new Error("Nota troppo lunga per un messaggio: massimo 6000 caratteri"); await publish(makeMessage({ kind: "share", author: player.name, title: note.title || "Nota", body: note.body, visibility: "gm" })); if (!floatingView) setTab("messages"); }); }}/>}
      {tab === "library" && <Library characters={characters} activeId={activeId} onSelect={(id) => { setActiveId(id); setTab("sheet"); }} onImport={() => fileRef.current?.click()} onExport={exportCharacter} onExportPack={exportPack} onSharingChange={(id, sharing) => updateSheet(id, (sheet) => ({ ...sheet, sharing }))} onDelete={(id) => { void runAction(async () => { await libraryRef.current?.remove(id); }); }}/>}
      {tab === "compendium" && player.role === "GM" && <Bestiary canManage={player.role === "GM"} canManageTurns={player.role === "GM" || permissions.playersManageTurns} monsters={monsters} pending={pendingMonsters} onPending={setPendingMonsters} selectedId={selectedMonsterId} onSelect={setSelectedMonsterId} onImport={() => contentRef.current?.click()} onImported={(next) => { setMonsters(next); storage.monsters.set(next); }} onDelete={(id) => { const next = monsters.filter((item) => item.id !== id); setMonsters(next); storage.monsters.set(next); setSelectedMonsterId(null); }} onRoll={performRoll} onShare={shareEntry} onShareContent={(title, body, target) => { void publish(makeMessage({ kind: "share", author: player.name, title, body, visibility: target })).catch((error) => { if (OBR.isAvailable) void OBR.notification.show(error instanceof Error ? error.message : "Condivisione fallita", "ERROR"); }); }} onAddTurn={async (monster) => { if (player.role !== "GM" && !permissions.playersManageTurns) return; const initiative = Math.floor((monster.abilities.dex - 10) / 2); try { await addSelectedTokenToTurns(monster.id, monster.name, roll(`1d20${signed(initiative)}`, "normal").total, initiative); } catch (error) { if (OBR.isAvailable) await OBR.notification.show(error instanceof Error ? error.message : "Token non collegato", "ERROR"); } }}/>}
      {tab === "campaigns" && player.role === "GM" && <Campaigns canManage={player.role === "GM"} canManageMaps={player.role === "GM"} documents={campaigns} selectedId={selectedCampaignId} onSelect={setSelectedCampaignId} onImport={() => contentRef.current?.click()} onImported={(next) => { setCampaigns(next); storage.campaigns.set(next); }} onDelete={(id) => { const next = campaigns.filter((item) => item.id !== id); setCampaigns(next); storage.campaigns.set(next); setSelectedCampaignId(null); }} onMap={() => { if (player.role === "GM") mapRef.current?.click(); }} onAdventureMap={async (image) => { if (player.role !== "GM") return; try { await uploadRemoteMapAsScene(image.url, image.title); if (OBR.isAvailable) await OBR.notification.show(`${image.title} caricata nelle scene`, "SUCCESS"); } catch (error) { const message = error instanceof Error ? error.message : "Caricamento mappa fallito"; if (OBR.isAvailable) await OBR.notification.show(message, "ERROR"); else window.alert(message); } }} onShare={(title, body, target) => { void publish(makeMessage({ kind: "share", author: player.name, title, body: body.slice(0, 6000), visibility: target })).catch((error) => { if (OBR.isAvailable) void OBR.notification.show(error instanceof Error ? error.message : "Condivisione fallita", "ERROR"); }); }}/>}
      {tab === "shared" && <SharedInventory editable={player.role === "GM" || permissions.playersEditInventory} items={sharedInventory} characters={characters} onChange={saveSharedInventory}/>}
      {tab === "party" && <Party characters={partyCharacters} members={partyMembers} player={player}/>}
      {tab === "settings" && player.role === "GM" && <Permissions value={permissions} onChange={async (next) => { await runAction(async () => { await setPermissions(next); setPermissionState(next); }); }}/>}
    </main>
    </div>
    <input ref={fileRef} hidden type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) importFile(file); event.target.value = ""; }}/>
    <input ref={contentRef} hidden type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) import5eToolsFile(file); event.target.value = ""; }}/>
    <input ref={mapRef} hidden type="file" accept="image/png,image/jpeg,image/webp,image/avif" onChange={async (event) => { const file = event.target.files?.[0]; if (file) { const name = window.prompt("Nome della nuova scena", file.name.replace(/\.[^.]+$/, "")); if (name) { try { await uploadMapAsScene(file, name); } catch (error) { if (OBR.isAvailable) await OBR.notification.show(error instanceof Error ? error.message : "Caricamento fallito", "ERROR"); } } } event.target.value = ""; }}/>
    <Dialog open={Boolean(rollRequest)} title={rollRequest?.title ?? "Tiro"} description={rollRequest?.formula} onClose={() => setRollRequest(null)}><div className="roll-choice"><Button onClick={() => { if (rollRequest) void executeRoll(rollRequest.title, rollRequest.formula, "normal"); setRollRequest(null); }}>Normale</Button><Button variant="secondary" onClick={() => { if (rollRequest) void executeRoll(rollRequest.title, rollRequest.formula, "advantage"); setRollRequest(null); }}>Vantaggio</Button><Button variant="secondary" onClick={() => { if (rollRequest) void executeRoll(rollRequest.title, rollRequest.formula, "disadvantage"); setRollRequest(null); }}>Svantaggio</Button></div></Dialog>
  </div>;
}

function FloatingHandle({ view }: { view: AppTab }) {
  // Coordinate schermo: il popover si muove sotto il puntatore, quelle client restano ferme.
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null); const frame = useRef(0);
  const position = (event: ReactPointerEvent) => drag.current ? { left: Math.max(0, Math.round(drag.current.left + event.screenX - drag.current.x)), top: Math.max(0, Math.round(drag.current.top + event.screenY - drag.current.y)) } : null;
  return <div className="floating-handle" onPointerDown={(event) => { if ((event.target as HTMLElement).closest("button")) return; drag.current = { x: event.screenX, y: event.screenY, ...getFloatingPanelPosition(view) }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { const next = position(event); if (!next) return; cancelAnimationFrame(frame.current); frame.current = requestAnimationFrame(() => void openFloatingPanel(view, next)); }} onPointerUp={(event) => { const next = position(event); if (!next) return; event.currentTarget.releasePointerCapture(event.pointerId); drag.current = null; cancelAnimationFrame(frame.current); void openFloatingPanel(view, next); }}><span>⠿ {TAB_LABELS[view]}</span><Button variant="ghost" aria-label="Chiudi pannello" onClick={() => void OBR.popover.close(`it.tavernexplorer/${view}-panel`)}>×</Button></div>;
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

function SheetView({ sheet, editable, sheetTab, setSheetTab, rollMode, setRollMode, visibility, setVisibility, onRoll, onShare, onUpdate, onRest }: { sheet: CharacterSheet; editable: boolean; sheetTab: SheetTab; setSheetTab: (tab: SheetTab) => void; rollMode: RollMode; setRollMode: (mode: RollMode) => void; visibility: Visibility; setVisibility: (value: Visibility) => void; onRoll: (title: string, formula: string) => void; onShare: (entry: ActionEntry | SpellEntry) => void; onUpdate: (update: (sheet: CharacterSheet) => CharacterSheet) => void; onRest: (summary: string) => void }) {
  const ruleset = getRuleset(sheet.ruleset.id);
  const view = effectiveSheet(sheet);
  return <>
    <section className="hero">
      {sheet.avatar && <img src={sheet.avatar} alt="" referrerPolicy="no-referrer"/>}
      <div><h1>{sheet.name}</h1><p>{sheet.identity.classDisplay || `${sheet.identity.subclass} ${sheet.identity.className} ${sheet.identity.level}`} · {sheet.identity.race}</p><small>{ruleset.label} · schema {sheet.schemaVersion}</small></div>
    </section>
    <div className="roll-controls">
      <select value={rollMode} onChange={(event) => setRollMode(event.target.value as RollMode)}><option value="normal">Normale</option><option value="advantage">Vantaggio</option><option value="disadvantage">Svantaggio</option></select>
      <select value={visibility} onChange={(event) => setVisibility(event.target.value as Visibility)}><option value="everyone">Tutti</option><option value="self">Solo io</option><option value="gm">Solo GM</option></select>
    </div>
    <nav className="sheet-tabs">{(["main", "actions", "spells", "inventory", "traits", "bio", ...editable ? ["edit"] : []] as SheetTab[]).map((item) => <button key={item} className={sheetTab === item ? "active" : ""} onClick={() => setSheetTab(item)}>{SHEET_TAB_LABELS[item]}</button>)}</nav>
    {!editable && <p className="party-owner">Sola lettura</p>}
    <div className={editable ? undefined : "readonly-sheet"}>
    {sheetTab === "main" && <div className="stack"><MainSheet sheet={view} onRoll={onRoll} onUpdate={onUpdate} editable={editable}/><ResourcePanel sheet={sheet} onUpdate={onUpdate} onRest={onRest}/></div>}
    {sheetTab === "actions" && <EntryList entries={sheet.actions} onRoll={onRoll} onShare={onShare} attackModifier={modifierTotal(sheet, "attack")} damageModifier={modifierTotal(sheet, "damage")}/>}
    {sheetTab === "spells" && <Spells sheet={view} onRoll={onRoll} onShare={onShare} onUpdate={onUpdate} attackModifier={modifierTotal(sheet, "spellAttack")} damageModifier={modifierTotal(sheet, "damage")}/>}
    {sheetTab === "inventory" && <Inventory sheet={sheet} onUpdate={onUpdate}/>}
    {sheetTab === "traits" && <EntryList entries={sheet.traits.map((trait) => ({ ...trait, source: trait.source }))} onRoll={onRoll} onShare={onShare}/>}
    {sheetTab === "bio" && <section className="paper"><h2>Biografia</h2><p className="prose">{sheet.biography || "Nessuna biografia."}</p>{sheet.importWarnings.length > 0 && <details className="warnings"><summary>{sheet.importWarnings.length} note d’importazione</summary><ul>{sheet.importWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></details>}</section>}
    {sheetTab === "edit" && editable && <><CharacterEditor sheet={sheet} onUpdate={onUpdate}/><EffectsEditor sheet={sheet} onUpdate={onUpdate}/><DeepCharacterEditor sheet={sheet} onUpdate={onUpdate}/></>}
    </div>
  </>;
}

function CharacterEditor({ sheet, onUpdate }: { sheet: CharacterSheet; onUpdate: (update: (sheet: CharacterSheet) => CharacterSheet) => void }) {
  const field = (label: string, value: string | number, apply: (next: CharacterSheet, value: string) => void, type = "text") => <label><span>{label}</span><Input type={type} value={value} onChange={(event) => onUpdate((next) => { apply(next, event.target.value); return next; })}/></label>;
  return <div className="stack"><Card><h2>Identità</h2><div className="editor-grid">{field("Nome", sheet.name, (next, value) => { next.name = value; })}{field("Razza", sheet.identity.race, (next, value) => { next.identity.race = value; })}{field("Classe", sheet.identity.className, (next, value) => { next.identity.className = value; })}{field("Sottoclasse", sheet.identity.subclass, (next, value) => { next.identity.subclass = value; })}{field("Descrizione classe", sheet.identity.classDisplay, (next, value) => { next.identity.classDisplay = value; })}{field("Livello", sheet.identity.level, (next, value) => { next.identity.level = Math.max(1, Number(value) || 1); }, "number")}{field("Background", sheet.identity.background, (next, value) => { next.identity.background = value; })}{field("Allineamento", sheet.identity.alignment, (next, value) => { next.identity.alignment = value; })}</div></Card><Card><h2>Combattimento</h2><div className="editor-grid">{field("CA", sheet.combat.ac, (next, value) => { next.combat.ac = Number(value) || 0; }, "number")}{field("PF attuali", sheet.combat.hp.current, (next, value) => { next.combat.hp.current = Number(value) || 0; }, "number")}{field("PF massimi", sheet.combat.hp.max, (next, value) => { next.combat.hp.max = Number(value) || 0; }, "number")}{field("PF temporanei", sheet.combat.hp.temp, (next, value) => { next.combat.hp.temp = Number(value) || 0; }, "number")}{field("Iniziativa", sheet.combat.initiative, (next, value) => { next.combat.initiative = Number(value) || 0; }, "number")}{field("Velocità", sheet.combat.speed, (next, value) => { next.combat.speed = value; })}{field("CD incantesimi", sheet.spellcasting.saveDc, (next, value) => { next.spellcasting.saveDc = Number(value) || 0; }, "number")}{field("Attacco incantesimi", sheet.spellcasting.attackBonus, (next, value) => { next.spellcasting.attackBonus = Number(value) || 0; }, "number")}</div></Card><Card><h2>Caratteristiche</h2><div className="editor-grid">{Object.entries(sheet.abilities).map(([key, ability]) => field(ABILITY_LABELS[key] ?? key, ability.score, (next, value) => { const score = Number(value) || 0; next.abilities[key].score = score; next.abilities[key].mod = Math.floor((score - 10) / 2); }, "number"))}</div></Card><Card><h2>Biografia</h2><textarea className="ui-textarea" value={sheet.biography} onChange={(event) => onUpdate((next) => { next.biography = event.target.value; return next; })}/></Card></div>;
}

function DeepCharacterEditor({ sheet, onUpdate }: { sheet: CharacterSheet; onUpdate: (update: (sheet: CharacterSheet) => CharacterSheet) => void }) {
  const patchAction = (id: string, patch: Partial<ActionEntry>) => onUpdate((next) => { Object.assign(next.actions.find((entry) => entry.id === id)!, patch); return next; });
  return <div className="stack deep-editor"><Card><div className="editor-heading"><h2>Abilità e tiri salvezza</h2></div><div className="skill-editor">{Object.entries(sheet.skills).map(([key, skill]) => <div key={key}><span>{SKILL_LABELS[key] ?? key}</span><Input aria-label={`Bonus ${key}`} type="number" value={skill.bonus} onChange={(event) => onUpdate((next) => { next.skills[key].bonus = Number(event.target.value) || 0; return next; })}/><label><input type="checkbox" checked={skill.proficient} onChange={(event) => onUpdate((next) => { next.skills[key].proficient = event.target.checked; return next; })}/> Competente</label></div>)}</div><div className="save-editor">{Object.entries(sheet.abilities).map(([key, ability]) => <label key={key}><span>TS {ABILITY_LABELS[key] ?? key}</span><Input type="number" value={ability.save} onChange={(event) => onUpdate((next) => { next.abilities[key].save = Number(event.target.value) || 0; return next; })}/><input type="checkbox" checked={ability.saveProficient} onChange={(event) => onUpdate((next) => { next.abilities[key].saveProficient = event.target.checked; return next; })}/></label>)}</div></Card><Card><div className="editor-heading"><h2>Azioni e attacchi</h2><Button onClick={() => onUpdate((next) => { next.actions.push({ id: crypto.randomUUID(), name: "Nuova azione", description: "" }); return next; })}>Aggiungi</Button></div>{sheet.actions.map((entry) => <article className="editable-entry" key={entry.id}><Input value={entry.name} onChange={(event) => patchAction(entry.id, { name: event.target.value })}/><Input type="number" placeholder="Bonus attacco" value={entry.attackBonus ?? ""} onChange={(event) => patchAction(entry.id, { attackBonus: event.target.value === "" ? undefined : Number(event.target.value) })}/><Input placeholder="Danno, es. 1d8+3" value={entry.damage ?? ""} onChange={(event) => patchAction(entry.id, { damage: event.target.value })}/><textarea className="ui-textarea" value={entry.description ?? ""} onChange={(event) => patchAction(entry.id, { description: event.target.value })}/><Button variant="destructive" onClick={() => onUpdate((next) => { next.actions = next.actions.filter((item) => item.id !== entry.id); return next; })}>Elimina</Button></article>)}</Card><Card><div className="editor-heading"><h2>Incantesimi</h2><Button onClick={() => onUpdate((next) => { next.spells.push({ id: crypto.randomUUID(), name: "Nuovo incantesimo", level: 0, prepared: false, ritual: false, concentration: false, description: "" }); return next; })}>Aggiungi</Button></div>{sheet.spells.map((spell) => <article className="editable-entry" key={spell.id}><Input value={spell.name} onChange={(event) => onUpdate((next) => { next.spells.find((item) => item.id === spell.id)!.name = event.target.value; return next; })}/><Input type="number" min="0" max="9" value={spell.level} onChange={(event) => onUpdate((next) => { next.spells.find((item) => item.id === spell.id)!.level = Number(event.target.value) || 0; return next; })}/><div className="check-row"><label><input type="checkbox" checked={spell.prepared} onChange={(event) => onUpdate((next) => { next.spells.find((item) => item.id === spell.id)!.prepared = event.target.checked; return next; })}/> Preparato</label><label><input type="checkbox" checked={spell.ritual} onChange={(event) => onUpdate((next) => { next.spells.find((item) => item.id === spell.id)!.ritual = event.target.checked; return next; })}/> Rituale</label><label><input type="checkbox" checked={spell.concentration} onChange={(event) => onUpdate((next) => { next.spells.find((item) => item.id === spell.id)!.concentration = event.target.checked; return next; })}/> Concentrazione</label></div><textarea className="ui-textarea" value={spell.description ?? ""} onChange={(event) => onUpdate((next) => { next.spells.find((item) => item.id === spell.id)!.description = event.target.value; return next; })}/><Button variant="destructive" onClick={() => onUpdate((next) => { next.spells = next.spells.filter((item) => item.id !== spell.id); return next; })}>Elimina</Button></article>)}</Card><Card><div className="editor-heading"><h2>Inventario personale</h2><Button onClick={() => onUpdate((next) => { next.inventory.push({ id: crypto.randomUUID(), name: "Nuovo oggetto", count: 1, equipped: false, description: "" }); return next; })}>Aggiungi</Button></div>{sheet.inventory.map((item) => <article className="effect-card" key={item.id}><div className="effect-head"><label><input type="checkbox" checked={item.equipped} onChange={(event) => onUpdate((next) => { next.inventory.find((entry) => entry.id === item.id)!.equipped = event.target.checked; return next; })}/> Equipaggiato</label><Button variant="destructive" onClick={() => onUpdate((next) => { next.inventory = next.inventory.filter((entry) => entry.id !== item.id); return next; })}>Elimina</Button></div><Input aria-label="Nome oggetto" value={item.name} onChange={(event) => onUpdate((next) => { next.inventory.find((entry) => entry.id === item.id)!.name = event.target.value; return next; })}/><Input aria-label={`Quantità ${item.name}`} type="number" value={item.count ?? ""} onChange={(event) => onUpdate((next) => { next.inventory.find((entry) => entry.id === item.id)!.count = event.target.value === "" ? null : Number(event.target.value); return next; })}/><textarea className="ui-textarea" aria-label={`Descrizione ${item.name}`} value={item.description ?? ""} onChange={(event) => onUpdate((next) => { next.inventory.find((entry) => entry.id === item.id)!.description = event.target.value; return next; })}/><small className="effect-note">Proprietà numeriche applicate solo quando equipaggiato e disponibile.</small><ModifierEditor modifiers={item.modifiers ?? []} onChange={(modifiers) => onUpdate((next) => { next.inventory.find((entry) => entry.id === item.id)!.modifiers = modifiers; return next; })}/></article>)}</Card><Card><h2>Valute</h2><div className="editor-grid">{Object.entries(sheet.currency).map(([key, value]) => <label key={key}><span>{key.toUpperCase()}</span><Input type="number" value={value} onChange={(event) => onUpdate((next) => { next.currency[key] = Number(event.target.value) || 0; return next; })}/></label>)}</div></Card></div>;
}

function MainSheet({ sheet, onRoll, onUpdate, editable }: { sheet: CharacterSheet; onRoll: (title: string, formula: string) => void; onUpdate: (update: (sheet: CharacterSheet) => CharacterSheet) => void; editable: boolean }) {
  return <div className="stack">
    <section className="combat-grid">
      <Metric label="CA" value={sheet.combat.ac}/><Metric label="Iniziativa" value={signed(sheet.combat.initiative)} onClick={() => onRoll("Iniziativa", `1d20${signed(sheet.combat.initiative)}`)}/><Metric label="Velocità" value={sheet.combat.speed}/><Metric label="Competenza" value={signed(sheet.combat.proficiencyBonus)}/><Metric label="Percezione passiva" value={sheet.combat.passivePerception}/><Metric label="CD incantesimi" value={sheet.spellcasting.saveDc}/>
    </section>
    <HitPointControl sheet={sheet} editable={editable} onUpdate={onUpdate}/>
    <section className="abilities">{Object.entries(sheet.abilities).map(([key, stat]) => <article key={key}><button onClick={() => onRoll(ABILITY_LABELS[key] ?? key, `1d20${signed(stat.mod)}`)}><small>{ABILITY_LABELS[key] ?? key}</small><strong>{stat.score}</strong><span>{signed(stat.mod)}</span></button><button className={stat.saveProficient ? "proficient" : ""} onClick={() => onRoll(`TS ${ABILITY_LABELS[key] ?? key}`, `1d20${signed(stat.save)}`)}>TS {signed(stat.save)}</button></article>)}</section>
    <section className="paper"><h2>Abilità</h2><div className="skills">{Object.entries(sheet.skills).map(([key, skill]) => <button key={key} onClick={() => onRoll(SKILL_LABELS[key] ?? key, `1d20${signed(skill.bonus)}`)}><span className={skill.proficient ? "dot filled" : "dot"}/><span>{SKILL_LABELS[key] ?? key}</span><strong>{signed(skill.bonus)}</strong></button>)}</div></section>
  </div>;
}

function Metric({ label, value, onClick }: { label: string; value: string | number; onClick?: () => void }) { const content = <><strong>{value}</strong><small>{label}</small></>; return onClick ? <button className="metric" onClick={onClick}>{content}</button> : <div className="metric">{content}</div>; }

function EntryList({ entries, onRoll, onShare, attackModifier = 0, damageModifier = 0 }: { entries: ActionEntry[]; onRoll: (title: string, formula: string) => void; onShare: (entry: ActionEntry) => void; attackModifier?: number; damageModifier?: number }) {
  if (!entries.length) return <Empty/>;
  return <section className="entry-list">{entries.map((entry) => <details key={entry.id} className="entry"><summary><span><strong>{entry.name}</strong><small>{entry.source}</small></span><span>{entry.attackBonus != null && signed(entry.attackBonus + attackModifier)} {entry.damage}{damageModifier !== 0 && entry.damage && signed(damageModifier)}</span></summary><p>{entry.description || "Nessuna descrizione."}</p><div className="entry-actions">{entry.attackBonus != null && <button onClick={() => onRoll(`${entry.name} — attacco`, `1d20${signed(entry.attackBonus! + attackModifier)}`)}>Attacco</button>}{entry.damage && <button onClick={() => onRoll(`${entry.name} — danno`, `${entry.damage}${damageModifier === 0 ? "" : signed(damageModifier)}`)}>Danno</button>}<button onClick={() => onShare(entry)}>Mostra</button></div></details>)}</section>;
}

function Spells({ sheet, onRoll, onShare, onUpdate, attackModifier = 0, damageModifier = 0 }: { sheet: CharacterSheet; onRoll: (title: string, formula: string) => void; onShare: (entry: ActionEntry | SpellEntry) => void; onUpdate: (update: (sheet: CharacterSheet) => CharacterSheet) => void; attackModifier?: number; damageModifier?: number }) {
  const levels = [...new Set(sheet.spells.map((spell) => spell.level))].sort((a, b) => a - b);
  return <div className="stack"><section className="paper spell-head"><div><strong>CD {sheet.spellcasting.saveDc}</strong><small>Salvezza</small></div><div><strong>{signed(sheet.spellcasting.attackBonus)}</strong><small>Attacco</small></div></section>{Object.entries(sheet.spellcasting.slots).map(([key, slot]) => <section className="slot" key={key}><span>{key.replace("level_", "Livello ")}</span><button onClick={() => onUpdate((next) => { next.spellcasting.slots[key].used = Math.max(0, next.spellcasting.slots[key].used - 1); return next; })}>−</button><strong>{Math.max(0, slot.total - slot.used)} / {slot.total}</strong><button onClick={() => onUpdate((next) => { next.spellcasting.slots[key].used = Math.min(slot.total, next.spellcasting.slots[key].used + 1); return next; })}>+</button></section>)}{levels.map((level) => <section key={level}><h2>{level === 0 ? "Trucchetti" : `Livello ${level}`}</h2><EntryList entries={sheet.spells.filter((spell) => spell.level === level)} onRoll={onRoll} onShare={onShare} attackModifier={attackModifier} damageModifier={damageModifier}/></section>)}</div>;
}

function Inventory({ sheet, onUpdate }: { sheet: CharacterSheet; onUpdate: (update: (sheet: CharacterSheet) => CharacterSheet) => void }) {
  return <div className="stack"><section className="paper currency">{Object.entries(sheet.currency).map(([key, value]) => <span key={key}><strong>{value}</strong>{key.toUpperCase()}</span>)}</section><section className="entry-list">{sheet.inventory.map((item) => <article className="inventory-row" key={item.id}><div className="inventory-detail"><strong>{item.name}</strong>{item.description && <small>{item.description}</small>}<label><input type="checkbox" checked={item.equipped} onChange={(event) => onUpdate((next) => { next.inventory.find((entry) => entry.id === item.id)!.equipped = event.target.checked; return next; })}/> Equipaggiato</label>{item.modifiers?.length ? <small>{item.modifiers.map((modifier) => `${modifier.target} ${signed(modifier.amount)}`).join(" · ")}</small> : null}</div>{item.count != null && <div><button onClick={() => onUpdate((next) => { const found = next.inventory.find((entry) => entry.id === item.id)!; found.count = Math.max(0, (found.count ?? 0) - 1); return next; })}>−</button><strong>{item.count}</strong><button onClick={() => onUpdate((next) => { const found = next.inventory.find((entry) => entry.id === item.id)!; found.count = (found.count ?? 0) + 1; return next; })}>+</button></div>}</article>)}</section></div>;
}

function Messages({ messages, draft, setDraft, visibility, setVisibility, onSend }: { messages: ChatMessage[]; draft: string; setDraft: (value: string) => void; visibility: Visibility; setVisibility: (value: Visibility) => void; onSend: () => void }) {
  const [filter, setFilter] = useState<"all" | Visibility>("all");
  const listRef = useRef<HTMLElement>(null);
  const shown = filter === "all" ? messages : messages.filter((message) => message.visibility === filter);
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [messages.length, filter]);
  return <div className="messages">
    <nav className="message-filters" aria-label="Filtra messaggi">{([ ["all", "Tutti"], ["everyone", "Pubblici"], ["gm", "GM"], ["self", "Personali"] ] as const).map(([id, label]) => <button key={id} className={filter === id ? "active" : ""} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</nav>
    <section className="message-list" ref={listRef} aria-live="polite">{shown.length === 0 && <div className="message-empty">Nessun messaggio in questa vista.</div>}{shown.map((message) => <article key={message.id} className={`message ${message.kind}`}><header><strong>{message.author}</strong><small>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {message.visibility === "everyone" ? "tutti" : message.visibility === "gm" ? "GM" : "solo io"}</small></header>{message.title && <h3>{message.title}</h3>}<p>{message.body}</p>{message.kind === "roll" && <div className="roll-result"><span>{message.dice?.join(" + ")}</span><strong>{message.total}</strong></div>}</article>)}</section>
    <section className="composer"><textarea aria-label="Nuovo messaggio" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); if (draft.trim()) onSend(); } }} placeholder="Scrivi un messaggio…"/><div><select aria-label="Destinatari" value={visibility} onChange={(event) => setVisibility(event.target.value as Visibility)}><option value="everyone">Tutti</option><option value="self">Solo io</option><option value="gm">Solo GM</option></select><button className="primary" disabled={!draft.trim()} onClick={onSend}>Invia</button></div>{visibility === "gm" && <small className="composer-note">Il GM deve avere l'estensione aperta almeno una volta per ricevere messaggi cifrati.</small>}</section>
  </div>;
}

function Library({ characters, activeId, onSelect, onImport, onExport, onExportPack, onSharingChange, onDelete }: { characters: CharacterSheet[]; activeId: string | null; onSelect: (id: string) => void; onImport: () => void; onExport: () => void; onExportPack: () => void; onSharingChange: (id: string, sharing: "private" | "party") => void; onDelete: (id: string) => void }) {
  return <div className="stack"><section className="library-actions"><button className="primary" onClick={onImport}>Importa JSON / TavernPack</button><button onClick={onExport} disabled={!activeId}>Esporta scheda</button><button onClick={onExportPack}>Esporta tutto</button></section>{characters.map((character) => <article className="library-card" key={character.id}><button className="character-open" onClick={() => onSelect(character.id)}>{character.avatar && <img src={character.avatar} alt=""/>}<span><strong>{character.name}</strong><small>{character.identity.classDisplay} · {getRuleset(character.ruleset.id).label}</small></span></button><Select aria-label={`Visibilità di ${character.name}`} value={character.sharing ?? "private"} onChange={(event) => onSharingChange(character.id, event.target.value as "private" | "party")}><option value="private">Solo questo browser</option><option value="party">Tutto il party</option></Select><button className="danger" onClick={() => { if (window.confirm(`Eliminare ${character.name}? È consigliato esportare prima un backup.`)) onDelete(character.id); }}>×</button></article>)}{characters.length === 0 && <Empty onImport={onImport}/>}</div>;
}

function ContentShare({ label, onShare }: { label: string; onShare: (target: "everyone" | "gm") => void }) {
  const [target, setTarget] = useState<Visibility>("self");
  return <div className="content-share"><span>{label} · privato su questo browser</span><Select aria-label={`Destinatari ${label}`} value={target} onChange={(event) => setTarget(event.target.value as Visibility)}><option value="self">Privato</option><option value="everyone">Tutto il party</option><option value="gm">Solo GM</option></Select><Button variant="outline" disabled={target === "self"} onClick={() => { if (target !== "self") onShare(target); }}>Invia copia</Button></div>;
}

function Bestiary({ monsters, pending, onPending, selectedId, canManage, canManageTurns, onSelect, onImport, onImported, onDelete, onRoll, onShare, onShareContent, onAddTurn }: { monsters: MonsterSheet[]; pending: MonsterSheet[]; onPending: (items: MonsterSheet[]) => void; selectedId: string | null; canManage: boolean; canManageTurns: boolean; onSelect: (id: string | null) => void; onImport: () => void; onImported: (items: MonsterSheet[]) => void; onDelete: (id: string) => void; onRoll: (title: string, formula: string) => void; onShare: (entry: ActionEntry) => void; onShareContent: (title: string, body: string, target: "everyone" | "gm") => void; onAddTurn: (monster: MonsterSheet) => void }) {
  const removeSelected = () => { const selected = monsters.find((monster) => monster.id === selectedId); if (selected && canManage && window.confirm(`Eliminare ${selected.name}?`)) onDelete(selected.id); };
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
  if (!selected && !canManage) return <div className="stack"><Alert>Il GM ha riservato importazione ed eliminazione dei contenuti.</Alert><section className="monster-grid">{monsters.map((monster) => <button key={monster.id} onClick={() => onSelect(monster.id)}><strong>{monster.name}</strong><small>{monster.creatureType} · GS {monster.challengeRating}</small><span>CA {monster.ac} · PF {monster.hp.average}</span></button>)}</section>{monsters.length === 0 && <Empty/>}</div>;
  if (selected) return <div className="stack"><div className="library-actions"><Button variant="ghost" onClick={() => onSelect(null)}>← Bestiario</Button>{canManage && <Button variant="destructive" onClick={removeSelected}>Elimina mostro</Button>}</div><section className="hero">{selected.image && <img src={selected.image} alt=""/>}<div><h1>{selected.name}</h1><p>{selected.size} {selected.creatureType} · GS {selected.challengeRating}</p><small>{selected.source} · {getRuleset(selected.ruleset.id).label}</small></div></section><section className="combat-grid"><Metric label="CA" value={selected.ac}/><Metric label="PF medi" value={selected.hp.average}/><Metric label="Dadi vita" value={selected.hp.formula}/><Metric label="Velocità" value={selected.speed}/><Metric label="Percezione" value={selected.passivePerception}/><Metric label="GS" value={selected.challengeRating}/></section><ContentShare key={selected.id} label="Riepilogo mostro" onShare={(target) => onShareContent(selected.name, `${selected.creatureType} · GS ${selected.challengeRating} · CA ${selected.ac} · PF ${selected.hp.average} · ${selected.speed}`, target)}/><button className="primary" disabled={!canManageTurns} onClick={() => onAddTurn(selected)}>Collega al token e aggiungi ai turni</button>{selected.traits.length > 0 && <section><h2>Tratti</h2><EntryList entries={selected.traits} onRoll={onRoll} onShare={onShare}/></section>}<section><h2>Azioni</h2><EntryList entries={selected.actions} onRoll={onRoll} onShare={onShare}/></section>{selected.reactions.length > 0 && <section><h2>Reazioni</h2><EntryList entries={selected.reactions} onRoll={onRoll} onShare={onShare}/></section>}{selected.legendaryActions.length > 0 && <section><h2>Azioni leggendarie</h2><EntryList entries={selected.legendaryActions} onRoll={onRoll} onShare={onShare}/></section>}</div>;
  return <div className="stack"><Card className="remote-import"><h2>Catalogo 5e.tools</h2><p>Scegli un manuale, poi seleziona i mostri da importare come schede e token.</p><Button variant="outline" className="picker-button" onClick={() => setPickerOpen(true)}><span>{sources.find((source) => source.id === sourceId)?.label ?? "Scegli una sorgente"}</span><span>⌕</span></Button><Button onClick={remoteImport} disabled={loading || !sourceId}>{loading && <Spinner/>}{loading ? "Caricamento…" : "Scegli mostri"}</Button>{error && <Alert tone="danger">{error}</Alert>}</Card><CatalogDialog open={pickerOpen} title="Scegli un manuale" description="Cerca per sigla sorgente 5e.tools" items={sources.map((source) => ({ id: source.id, label: source.label, detail: source.file }))} selectedId={sourceId} onSelect={(id) => { setSourceId(id); setPickerOpen(false); }} onClose={() => setPickerOpen(false)}/>{pending.length > 0 && <MonsterImportDialog key={pending[0].id} monsters={pending} onImport={(items) => void importSelected(items)} onClose={() => onPending([])}/>}<section className="library-actions"><Button variant="outline" onClick={onImport}>Importa file 5e.tools</Button></section><section className="monster-grid">{monsters.map((monster) => <button key={monster.id} onClick={() => onSelect(monster.id)}><strong>{monster.name}</strong><small>{monster.creatureType} · GS {monster.challengeRating}</small><span>CA {monster.ac} · PF {monster.hp.average}</span></button>)}</section>{monsters.length === 0 && <Empty/>}</div>;
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

function CatalogDialog({ open, title, description, items, selectedId, onSelect, onClose }: { open: boolean; title: string; description: string; items: Array<{ id: string; label: string; detail: string }>; selectedId: string; onSelect: (id: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  useEffect(() => { if (open) setQuery(""); }, [open]);
  const visible = items.filter((item) => `${item.label} ${item.detail}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <Dialog open={open} title={title} description={description} onClose={onClose}><div className="catalog-search"><Input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Digita per cercare…" aria-label="Cerca nel catalogo"/></div><div className="catalog-list">{visible.map((item) => <button className={`catalog-option ${item.id === selectedId ? "active" : ""}`} key={item.id} onClick={() => onSelect(item.id)}><strong>{item.label}</strong><small>{item.detail}</small></button>)}{visible.length === 0 && <div className="catalog-empty">Nessun risultato</div>}</div></Dialog>;
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

function Party({ characters, members, player }: { characters: PartyCharacterSummary[]; members: Array<{ id: string; name: string; role: "GM" | "PLAYER" }>; player: { id: string; name: string; role: "GM" | "PLAYER" } }) {
  return <div className="stack"><Card><h2>Party della stanza</h2><p>Qui compaiono solo le schede impostate su “Tutto il party” nella Libreria.</p></Card>{player.role === "GM" && characters.length > 0 && <AssignmentPanel sheets={characters} members={members}/>}{characters.map((summary) => <Card className="party-card" key={`${summary.ownerId}-${summary.id}`}><header>{summary.avatar && <img src={summary.avatar} alt="" referrerPolicy="no-referrer"/>}<div><h2>{summary.name}</h2><p>{summary.classDisplay} · {summary.race}</p><small>Giocatore: {summary.ownerName} · {getRuleset(summary.ruleset.id).label}</small></div></header><section className="combat-grid"><Metric label="CA" value={summary.ac}/><Metric label="PF" value={`${summary.hp.current}/${summary.hp.max}`}/><Metric label="Iniziativa" value={signed(summary.initiative)}/><Metric label="CD magia" value={summary.spellSaveDc}/><Metric label="Attacco magia" value={signed(summary.spellAttackBonus)}/><Metric label="Livello" value={summary.level}/></section><section className="party-abilities">{Object.entries(summary.abilities).map(([key, ability]) => <div key={key}><small>{ABILITY_LABELS[key] ?? key}</small><strong>{ability.score}</strong><span>{signed(ability.mod)}</span></div>)}</section></Card>)}{characters.length === 0 && <Empty/>}</div>;
}


function Empty({ onImport }: { onImport?: () => void }) { return <section className="empty"><img src="/icon.svg" alt=""/><h2>Niente da mostrare</h2><p>{onImport ? "Importa una scheda JSON per iniziare." : "Qui non ci sono ancora contenuti."}</p>{onImport && <button className="primary" onClick={onImport}>Importa JSON</button>}</section>; }
