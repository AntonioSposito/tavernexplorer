import { useCallback, useEffect, useRef, useState } from "react";
import { focusToken, getCharacterTokens, highlightToken, OBR, setTokenCharacter, setTokenOwner, type CharacterToken } from "./obr";
import { Alert, Button, Card, Input, Select } from "./ui";

interface PartyMember { id: string; name: string; role: "GM" | "PLAYER" }

interface AssignmentPanelProps {
  // ownerId: giocatore connesso che riceve i token collegati alla scheda.
  sheets: Array<{ id: string; name: string; ownerId?: string }>;
  // Mostri del bestiario del GM (anche quelli condivisi con i giocatori): il token si collega senza cambiare proprietario.
  monsters: Array<{ id: string; name: string; challengeRating: string }>;
  members: PartyMember[];
}

const normalizedName = (name: string) => name.trim().toLocaleLowerCase("it");

export function AssignmentPanel({ sheets, monsters, members }: AssignmentPanelProps) {
  const [tokens, setTokens] = useState<CharacterToken[]>([]);
  const [sceneReady, setSceneReady] = useState(false);
  const [ownerOnly, setOwnerOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const autoLinked = useRef(new Set<string>());

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

  const run = useCallback(async (action: () => Promise<void>, success: string) => {
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
  }, [refresh]);

  // Token libero con il nome di una scheda: si collega da solo. A parità di nome vincono i PG, poi i mostri.
  useEffect(() => {
    const candidates: Array<{ id: string; name: string; ownerId?: string }> = [...sheets, ...monsters];
    const matches = tokens.flatMap((token) => {
      if (token.characterId || token.unlinked || autoLinked.current.has(token.tokenId)) return [];
      const sheet = candidates.find((candidate) => normalizedName(candidate.name) === normalizedName(token.tokenName));
      return sheet ? [{ token, sheet }] : [];
    });
    if (!matches.length) return;
    // Ogni scrittura fa ripartire refresh ed effetto: senza questo segno lo stesso token si ricollegherebbe.
    for (const { token } of matches) autoLinked.current.add(token.tokenId);
    void run(async () => {
      for (const { token, sheet } of matches) await setTokenCharacter(token.tokenId, sheet.id, sheet.ownerId);
    }, matches.length === 1 ? `${matches[0].token.tokenName} collegato a ${matches[0].sheet.name}.` : `${matches.length} token collegati alle schede con lo stesso nome.`);
  }, [tokens, sheets, monsters, run]);

  const sheetName = (id: string) => sheets.find((sheet) => sheet.id === id)?.name ?? monsters.find((monster) => monster.id === id)?.name;
  const isParty = (token: CharacterToken) => sheets.some((sheet) => sheet.id === token.characterId);
  const visibleTokens = tokens.filter((token) => `${token.tokenName} ${sheetName(token.characterId ?? "") ?? ""}`.toLocaleLowerCase("it").includes(search.toLocaleLowerCase("it"))).sort((a, b) => Number(isParty(b)) - Number(isParty(a)));

  return <Card className="assign-panel"><details className="assign-details">
    <summary><h2>Assegna personaggi e token</h2></summary>
    <p>Collega i token alle schede del party. Il token passa al primo giocatore connesso che può modificare la scheda; puoi cambiarlo qui sotto.</p>
    {notice && <Alert tone={notice.error ? "danger" : "success"}>{notice.text}</Alert>}

    <div className="assign-heading"><h3>Token sulla scena → personaggi</h3><Button variant="outline" onClick={reload}>Aggiorna</Button></div>
    {!ownerOnly && <p className="assign-empty">Il proprietario del token controlla chi può muoverlo solo se attivi “Owner Only” nei permessi Personaggi di Owlbear.</p>}
    {!sceneReady ? <p className="assign-empty">Apri una scena Owlbear per vedere i token.</p> : <>
      <Input type="search" aria-label="Cerca token" placeholder="Cerca token…" value={search} onChange={(event) => setSearch(event.target.value)}/>
      <small className="assign-count">{tokens.length} token · {tokens.filter((token) => !token.characterId).length} da collegare</small>
      <div className="assign-grid">
        {visibleTokens.map((token) => <div className="assign-item assign-token-item" key={token.tokenId}>
          <span><button type="button" className="assign-token-name" title={`Vai a ${token.tokenName} sulla mappa`} aria-label={`Vai a ${token.tokenName} sulla mappa`} onClick={() => { void run(() => focusToken(token.tokenId), `Vista spostata su ${token.tokenName}.`); }}><strong>{token.tokenName}</strong></button><small>{token.characterId ? sheetName(token.characterId) ?? "Scheda non disponibile" : "Nessuna scheda collegata"}</small></span>
          <div className="assign-token-actions">
            <label><small>Scheda</small><Select aria-label={`Scheda per ${token.tokenName}`} value={token.characterId ?? ""} disabled={busy} onChange={(event) => {
              const characterId = event.target.value || null;
              const sheet = sheets.find((item) => item.id === characterId);
              void run(() => setTokenCharacter(token.tokenId, characterId, sheet?.ownerId), !characterId ? `${token.tokenName} scollegato.` : sheet ? `${token.tokenName} collegato a ${sheet.name} e assegnato al proprietario della scheda.` : `${token.tokenName} collegato a ${sheetName(characterId)}.`);
            }}>
              <option value="">Nessuna scheda</option>
              {token.characterId && !sheetName(token.characterId) && <option value={token.characterId}>Scheda non disponibile</option>}
              <optgroup label="Personaggi">{sheets.map((sheet) => <option key={sheet.id} value={sheet.id}>{sheet.name}</option>)}</optgroup>
              {monsters.length > 0 && <optgroup label="Bestiario">{monsters.map((monster) => <option key={monster.id} value={monster.id}>{monster.name} · GS {monster.challengeRating}</option>)}</optgroup>}
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
  </details></Card>;
}
