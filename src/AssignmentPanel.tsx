import { useCallback, useEffect, useState } from "react";
import { getCharacterTokens, highlightToken, OBR, setTokenCharacter, setTokenOwner, type CharacterToken } from "./obr";
import { Alert, Button, Card, Input, Select } from "./ui";

interface PartyMember { id: string; name: string; role: "GM" | "PLAYER" }

interface AssignmentPanelProps {
  // ownerId: giocatore connesso che riceve i token collegati alla scheda.
  sheets: Array<{ id: string; name: string; ownerId?: string }>;
  members: PartyMember[];
}

export function AssignmentPanel({ sheets, members }: AssignmentPanelProps) {
  const [tokens, setTokens] = useState<CharacterToken[]>([]);
  const [sceneReady, setSceneReady] = useState(false);
  const [ownerOnly, setOwnerOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);

  const refresh = useCallback(async () => {
    const ready = OBR.isAvailable && await OBR.scene.isReady();
    setSceneReady(ready);
    setTokens(ready ? await getCharacterTokens() : []);
  }, []);

  const reload = useCallback(() => { void refresh().catch((error) => setNotice({ text: error instanceof Error ? error.message : "Token non disponibili", error: true })); }, [refresh]);

  useEffect(() => {
    if (!OBR.isAvailable) return;
    let disposed = false;
    let stopScene: () => void = () => {};
    let stopItems: () => void = () => {};
    let stopPermissions: () => void = () => {};
    OBR.onReady(() => {
      if (disposed) return;
      reload();
      void OBR.room.getPermissions().then((permissions) => setOwnerOnly(permissions.includes("CHARACTER_OWNER_ONLY"))).catch((error) => setNotice({ text: error instanceof Error ? error.message : "Permessi Owlbear non disponibili", error: true }));
      stopScene = OBR.scene.onReadyChange(reload);
      stopItems = OBR.scene.items.onChange(reload);
      stopPermissions = OBR.room.onPermissionsChange((permissions) => setOwnerOnly(permissions.includes("CHARACTER_OWNER_ONLY")));
    });
    return () => { disposed = true; stopScene(); stopItems(); stopPermissions(); };
  }, [reload]);

  const run = async (action: () => Promise<void>, success: string) => {
    setBusy(true);
    setNotice(null);
    try {
      await action();
      await refresh();
      setNotice({ text: success, error: false });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Assegnazione fallita", error: true });
    } finally {
      setBusy(false);
    }
  };

  const sheetName = (id: string) => sheets.find((sheet) => sheet.id === id)?.name;
  const visibleTokens = tokens.filter((token) => `${token.tokenName} ${sheetName(token.characterId ?? "") ?? ""}`.toLocaleLowerCase("it").includes(search.toLocaleLowerCase("it")));

  return <Card className="assign-panel">
    <h2>Assegna personaggi e token</h2>
    <p>Collega i token alle schede del party. Il token passa al primo giocatore connesso che può modificare la scheda; puoi cambiarlo qui sotto.</p>
    {notice && <Alert tone={notice.error ? "danger" : "success"}>{notice.text}</Alert>}

    <div className="assign-heading"><h3>Token sulla scena → personaggi</h3><Button variant="outline" onClick={reload}>Aggiorna</Button></div>
    {!ownerOnly && <p className="assign-empty">Il proprietario del token controlla chi può muoverlo solo se attivi “Owner Only” nei permessi Personaggi di Owlbear.</p>}
    {!sceneReady ? <p className="assign-empty">Apri una scena Owlbear per vedere i token.</p> : <>
      <Input type="search" aria-label="Cerca token" placeholder="Cerca token…" value={search} onChange={(event) => setSearch(event.target.value)}/>
      <small className="assign-count">{tokens.length} token · {tokens.filter((token) => !token.characterId).length} da collegare</small>
      <div className="assign-grid">
        {visibleTokens.map((token) => <div className="assign-item assign-token-item" key={token.tokenId}>
          <span><strong>{token.tokenName}</strong><small>{token.characterId ? sheetName(token.characterId) ?? "Scheda non disponibile" : "Nessuna scheda collegata"}</small></span>
          <div className="assign-token-actions">
            <label><small>Scheda</small><Select aria-label={`Scheda per ${token.tokenName}`} value={token.characterId ?? ""} disabled={busy} onChange={(event) => {
              const characterId = event.target.value || null;
              void run(() => setTokenCharacter(token.tokenId, characterId, sheets.find((sheet) => sheet.id === characterId)?.ownerId), characterId ? `${token.tokenName} collegato a ${sheetName(characterId)} e assegnato al proprietario della scheda.` : `${token.tokenName} scollegato.`);
            }}>
              <option value="">Nessuna scheda</option>
              {token.characterId && !sheetName(token.characterId) && <option value={token.characterId}>Scheda non disponibile</option>}
              {sheets.map((sheet) => <option key={sheet.id} value={sheet.id}>{sheet.name}</option>)}
            </Select></label>
            <label><small>Proprietario token</small><Select aria-label={`Proprietario token ${token.tokenName}`} value={token.ownerId} disabled={busy} onChange={(event) => {
              const ownerId = event.target.value;
              void run(() => setTokenOwner(token.tokenId, ownerId), `${token.tokenName} assegnato a ${members.find((member) => member.id === ownerId)?.name ?? "giocatore"}.`);
            }}>
              {!members.some((member) => member.id === token.ownerId) && <option value={token.ownerId}>Proprietario non connesso</option>}
              {members.map((member) => <option key={member.id} value={member.id}>{member.name}{member.role === "GM" ? " · GM" : ""}</option>)}
            </Select></label>
            <Button variant="ghost" title={`Trova ${token.tokenName} sulla mappa`} aria-label={`Trova ${token.tokenName} sulla mappa`} onClick={() => { void run(() => highlightToken(token.tokenId), `${token.tokenName} evidenziato sulla mappa.`); }}>⌖</Button>
          </div>
        </div>)}
      </div>
      {tokens.length === 0 && <p className="assign-empty">Nessun token nello strato Personaggi.</p>}
      {tokens.length > 0 && visibleTokens.length === 0 && <p className="assign-empty">Nessun token corrisponde alla ricerca.</p>}
    </>}
  </Card>;
}
