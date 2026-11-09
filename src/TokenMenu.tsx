import { useEffect, useState } from "react";
import OBR, { type Item } from "@owlbear-rodeo/sdk";
import { TURN_META_KEY } from "./constants";
import { canEditMonster, getTokenHitPoints, openTokenActions, openTokenSheet, requestTokenHitPoints, toggleTokenInitiative, TOKEN_SHEET_SECTIONS, type TokenHitPoints, type TokenSheetSection } from "./tokenMenuActions";
import { linkedCharacterId } from "./tokenTurns";
import { storage } from "./storage";
import type { TurnState } from "./types";

// Tendina TavernExplorer nel menu col tasto destro (embed del context menu): voci come quelle del menu di Owlbear,
// con il testo che dice già cosa fanno.
export function TokenMenu() {
  const [items, setItems] = useState<Item[]>([]);
  const [inTurnIds, setInTurnIds] = useState<string[]>([]);
  const [player, setPlayer] = useState<{ name: string; role: "GM" | "PLAYER" }>({ name: "", role: "PLAYER" });

  useEffect(() => {
    document.documentElement.classList.add("token-menu-page");
    OBR.onReady(() => {
      applyMenuTheme();
      void Promise.all([
        OBR.player.getSelection().then((ids) => ids?.length ? OBR.scene.items.getItems(ids) : []),
        OBR.room.getMetadata(),
        OBR.player.getName(),
        OBR.player.getRole(),
      ]).then(([selected, metadata, name, role]) => {
        setPlayer({ name, role });
        const entries = (metadata[TURN_META_KEY] as TurnState | undefined)?.entries ?? [];
        setItems(selected);
        setInTurnIds(selected.filter((item) => entries.some((entry) => entry.tokenId === item.id)).map((item) => item.id));
      });
    });
  }, []);

  // Deselezionare chiude il menu di Owlbear e distrugge questa pagina: va fatto solo dopo l'azione.
  const run = async (action: () => Promise<void>) => { await action(); await OBR.player.deselect(); };
  const icon = (name: string) => <span className="token-menu-icon" aria-hidden="true" style={{ WebkitMaskImage: `url(/tab-icons/${name}.png)`, maskImage: `url(/tab-icons/${name}.png)` }}/>;
  // Tutti già nei turni: la voce li toglie; altrimenti aggiunge i mancanti (selezione mista compresa).
  const remove = items.length > 0 && inTurnIds.length === items.length;
  // Azioni, magia, risorse, prove, TS e abilità: un solo token collegato a una scheda personaggio della stanza.
  // Mostri (del bestiario per il GM, condivisi in modifica per un giocatore): solo le azioni.
  const linkedId = items.length === 1 ? linkedCharacterId(items[0]) : undefined;
  const pcToken = linkedId && storage.cloudCache.characters(OBR.room.id).some((sheet) => sheet.id === linkedId) ? items[0] : undefined;
  const monsterToken = linkedId && canEditMonster(linkedId, player) ? items[0] : undefined;

  return <div className="token-menu">
    <button type="button" disabled={items.length !== 1} onClick={() => void run(() => openTokenSheet(items[0]))}>{icon("sheet")}Apri scheda</button>
    {(Object.keys(TOKEN_SHEET_SECTIONS) as TokenSheetSection[]).map((section) => <button key={section} type="button" disabled={!(pcToken ?? (section === "actions" ? monsterToken : undefined))} onClick={() => void run(() => openTokenActions((pcToken ?? monsterToken)!, section))}>{icon(section === "actions" ? "turns" : "sheet")}{TOKEN_SHEET_SECTIONS[section]}</button>)}
    <button type="button" disabled={items.length === 0} onClick={() => void run(() => toggleTokenInitiative(items))}>{icon("turns")}{remove ? "Esci dal combattimento" : "Tira iniziativa"}</button>
  </div>;
}

// Voce "Punti ferita" del menu principale (embed): il campo compare al clic sull'icona e la tendina resta aperta,
// come il raggio della luce.
export function TokenHpMenu() {
  const [token, setToken] = useState<Item | null>(null);
  const [hp, setHp] = useState<TokenHitPoints | null>(null);
  const [hpDraft, setHpDraft] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.add("token-menu-page");
    OBR.onReady(() => {
      applyMenuTheme();
      void OBR.player.getSelection().then((ids) => ids?.length === 1 ? OBR.scene.items.getItems(ids) : []).then(async ([selected]) => {
        if (!selected) return;
        setToken(selected);
        setHp(await getTokenHitPoints(selected).catch(() => null));
      });
    });
  }, []);

  const saveHp = async () => {
    const total = hp && hpDraft !== null ? parseHitPoints(hpDraft, hp.total) : null;
    setHpDraft(null);
    if (!hp || !token || total === null || total === hp.total) return;
    // Il numero cambia subito; il background salva anche se il menu si chiude prima della risposta del server.
    setHp({ ...hp, total: Math.min(total, Math.max(hp.cap, hp.total)) });
    try { await requestTokenHitPoints(token.id, total); }
    catch (error) { await OBR.notification.show(error instanceof Error ? error.message : "PF non salvati", "ERROR"); }
  };

  return <div className="token-menu">
    <label className={`token-menu-hp${hp ? "" : " disabled"}`}>
      <span className="token-menu-icon token-menu-label" aria-hidden="true">PF</span>
      <input aria-label="Punti ferita" title="Scrivi i PF (attuali + temporanei), oppure -7 per il danno e +5 per la cura" inputMode="numeric" disabled={!hp}
        value={hpDraft ?? (hp ? String(hp.total) : "—")} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setHpDraft(event.target.value)}
        onBlur={() => void saveHp()} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") setHpDraft(null); }}/>
      {hp && <small>/ {hp.max}</small>}
    </label>
  </div>;
}

// Colori del tema della stanza, come le voci native del menu (chiamata dentro OBR.onReady).
function applyMenuTheme() {
  void OBR.theme.getTheme().then((theme) => {
    document.body.style.setProperty("--menu-text", theme.text.primary);
    document.body.style.setProperty("--menu-text-secondary", theme.text.secondary);
    document.body.style.setProperty("--menu-text-disabled", theme.text.disabled);
    document.documentElement.dataset.mode = theme.mode.toLowerCase();
  });
}

// "12" imposta il totale, "-7" e "+5" lo cambiano; altro testo non cambia niente.
export function parseHitPoints(text: string, total: number): number | null {
  const match = /^\s*([+-]?)\s*(\d+)\s*$/.exec(text);
  if (!match) return null;
  return Math.max(0, match[1] ? total + Number(`${match[1]}${match[2]}`) : Number(match[2]));
}
