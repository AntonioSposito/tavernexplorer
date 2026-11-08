import { useEffect, useState } from "react";
import OBR, { type Item } from "@owlbear-rodeo/sdk";
import { TURN_META_KEY } from "./constants";
import { openTokenSheet, toggleTokenInitiative } from "./tokenMenuActions";
import type { TurnState } from "./types";

// Tendina TavernExplorer nel menu col tasto destro (embed del context menu): voci come quelle del menu di Owlbear,
// con il testo che dice già cosa fanno.
export function TokenMenu() {
  const [items, setItems] = useState<Item[]>([]);
  const [inTurnIds, setInTurnIds] = useState<string[]>([]);

  useEffect(() => {
    document.documentElement.classList.add("token-menu-page");
    OBR.onReady(() => {
      // Colori del tema della stanza, come le voci native del menu.
      void OBR.theme.getTheme().then((theme) => {
        document.body.style.setProperty("--menu-text", theme.text.primary);
        document.body.style.setProperty("--menu-text-secondary", theme.text.secondary);
        document.body.style.setProperty("--menu-text-disabled", theme.text.disabled);
        document.documentElement.dataset.mode = theme.mode.toLowerCase();
      });
      void Promise.all([
        OBR.player.getSelection().then((ids) => ids?.length ? OBR.scene.items.getItems(ids) : []),
        OBR.room.getMetadata(),
      ]).then(([selected, metadata]) => {
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

  return <div className="token-menu">
    <button type="button" disabled={items.length !== 1} onClick={() => void run(() => openTokenSheet(items[0]))}>{icon("sheet")}Apri scheda</button>
    <button type="button" disabled={items.length === 0} onClick={() => void run(() => toggleTokenInitiative(items))}>{icon("turns")}{remove ? "Esci dal combattimento" : "Tira iniziativa"}</button>
  </div>;
}
