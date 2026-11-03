# TavernExplorer

Estensione per Owlbear Rodeo con schede personaggio versionate, import Roll20,
turn order condiviso, tiri e messaggi. Il primo profilo disponibile è **D&D 5.5
(regole 2024)**.

## Avvio locale

```bash
corepack enable
pnpm install
pnpm dev
```

Su Windows `corepack enable` richiede i permessi di amministratore; in
alternativa usare `corepack pnpm install` e `corepack pnpm dev`.

Nel profilo Owlbear Rodeo aggiungere l'estensione usando:

```text
http://localhost:5173/manifest.json
```

Poi abilitarla nella stanza. Il browser potrebbe richiedere il permesso di
caricare contenuti locali.

## Produzione

```bash
pnpm build
```

Pubblicare l'intera cartella `dist` su un host HTTPS e usare l'URL pubblico di
`manifest.json` come link d'installazione.

### Deploy su Vercel

Il repository include `vercel.json`. Collegare il repository a Vercel e lasciare
le impostazioni rilevate dal progetto; il deploy esegue `pnpm install
--frozen-lockfile`, `pnpm build` e pubblica `dist`.

Il link da aggiungere al profilo Owlbear sarà:

```text
https://NOME-PROGETTO.vercel.app/manifest.json
```

Ogni deploy di produzione aggiorna automaticamente l'estensione. Prima di
modifiche incompatibili è necessario aumentare `version` in `package.json` e in
`public/manifest.json`.

### API delle schede (Upstash)

`api/sheets.ts` è una Vercel Function che salva le schede in Upstash Redis
(integrazione del Marketplace Vercel, regione `fra1`). Richiede le variabili
`KV_REST_API_URL` e `KV_REST_API_TOKEN` (o `UPSTASH_REDIS_REST_URL` e
`UPSTASH_REDIS_REST_TOKEN`), che restano solo lato server.

`pnpm dev` serve solo il frontend. Per provare l'API in locale:

```bash
vercel link
vercel env pull .env.local
vercel dev
```

## Dati e sincronizzazione

- Schede dei personaggi e NPC: libreria cloud della stanza (Upstash, tramite
  `api/sheets`), con chiave l'id della stanza Owlbear. Il browser ne tiene solo
  una cache di lettura: se il server non risponde le schede restano visibili in
  sola lettura. All'apertura le schede salvate localmente dalle versioni
  precedenti vengono caricate nel cloud una volta sola e poi rimosse dal browser.
- Bestiario, avventure e ultimi 200 messaggi: storage locale del browser.
- Owlbear documenta **200 MB di spazio cloud nel piano gratuito** per i dati
  dell'account ([piani e cloud storage](https://docs.owlbear.rodeo/docs/migration/migrate-from-1-to-2/#cloud-storage)).
  È distinto dai metadata della stanza usati qui per sincronizzare
  inventario e turni. L'[API room](https://docs.owlbear.rodeo/extensions/apis/room/#setmetadata)
  documenta per quei metadata un limite totale inferiore a **16 kB**.
- I metadata condivisi della stanza sono controllati prima di ogni scrittura:
  TavernExplorer applica una propria soglia prudenziale di 14.000 byte, lasciando
  margine sotto il limite documentato. Se lo spazio finisce, la modifica non viene pubblicata e
  l'estensione mostra l'errore. Esportare un TavernPack e ridurre i dati condivisi.
- Turn order: metadata della stanza Owlbear, sincronizzati con i partecipanti.
  Il GM puo' avanzare o tornare al turno precedente, ritirare l'iniziativa e
  annotare condizioni con durata in round. Le condizioni scadono all'inizio
  del turno del combattente dopo il numero di round indicato.
- Inventario comune: metadata della stanza Owlbear, con copia locale di sicurezza.
- Note (Journal, come su Roll20): note e cartelle salvate nella libreria cloud
  della stanza. Solo il GM crea note e cartelle e le organizza, anche
  trascinandole; per ogni nota sceglie chi può vederla e chi modificarla. Una
  nota nuova la vede solo il GM. I giocatori vedono solo le note concesse e le
  cartelle che le contengono. Eliminando una cartella il suo contenuto sale di
  un livello. Ogni nota si può mostrare in chat.
- Libreria: due sezioni, **Party** (schede dei personaggi) e **NPC** (statblock
  aggiunti dal Bestiario con «Aggiungi agli NPC»). Solo il GM importa schede
  (export Roll20 o TavernPack) e crea NPC; reimportare lo stesso personaggio
  Roll20 aggiorna la scheda esistente mantenendo permessi e stato di gioco.
  Per ogni scheda il GM sceglie **Può vedere** e **Può modificare** per nome
  Owlbear o **Tutti**; di base solo il GM vede e modifica. Chi può modificare
  può anche vedere. Le modifiche si salvano dopo un secondo e mezzo; gli altri
  client ricevono un avviso via broadcast Owlbear e rileggono la libreria, con
  un controllo di riserva ogni 90 secondi a pannello visibile. Due modifiche
  concorrenti alla stessa scheda non si sovrascrivono: la seconda riceve la
  versione del server e un avviso.
- Turn order e messaggi possono essere aperti come pannelli flottanti sulla mappa.
- Buff, debuff e proprietà numeriche degli oggetti equipaggiati modificano CA,
  iniziativa, PF massimi, caratteristiche, tiri salvezza, abilità, CD, attacchi
  e danni senza riscrivere i valori di base. Gli oggetti nello zaino e gli
  effetti disattivati non si applicano. La durata degli effetti sulla scheda
  si aggiorna manualmente; le condizioni del tracker scadono per round.
- La scheda include contatori personalizzati con recupero a riposo breve,
  lungo o mai. Il riposo breve può spendere dadi vita e recupera i contatori
  assegnati; il riposo lungo ripristina PF, slot e dadi vita, e azzera i PF temporanei
  secondo il profilo di regole. Per la Magia del Patto si può scegliere il
  recupero degli slot al riposo breve. Ogni riposo richiede conferma e viene
  registrato nei messaggi con la visibilità selezionata.
- Le mappe individuate nelle avventure 5e.tools possono essere caricate
  direttamente come scene Owlbear.
- Collegamento token/scheda: metadata del token. Nella tab **Turni** il GM vede
  tutti i token dello strato Personaggi della scena, inclusi quelli senza
  scheda. Può cercare un token e collegarlo a una scheda del party.
  Le liste si aggiornano quando cambia la scena. Il menu contestuale del token
  apre la scheda collegata; non assegna automaticamente la scheda attiva ai
  token scollegati. Collegando un token, il proprietario Owlbear del token viene
  assegnato al primo giocatore connesso che può modificare la scheda. Il GM può anche
  scegliere un proprietario diverso per un singolo token. Il controllo esclusivo
  richiede il permesso Owlbear "Owner Only" per lo strato Personaggi
  ([documentazione](https://docs.owlbear.rodeo/docs/permissions/)).
- Dal menu contestuale si possono aggiungere o rimuovere più token dal tracker.
  Per ogni token collegato a una scheda disponibile viene tirata l'iniziativa
  usando il suo bonus; per gli altri viene chiesto un valore. Cliccando un nome
  nel tracker, il token viene evidenziato da un cerchio locale che svanisce.
- Dalla scheda aperta dal token si applicano danni, cure e PF
  temporanei indicando una quantità. L'anteprima mostra i PF risultanti;
  i danni consumano prima i PF temporanei, le cure si fermano al massimo
  effettivo e azzerano i salvataggi morte quando restituiscono PF. I PF
  temporanei non si sommano. I casi speciali dei danni a 0 PF restano manuali.
- Sulla scena, etichette temporanee mostrano PF ridotti, PF temporanei e
  condizioni con durata dei token collegati. Le etichette sono generate in
  locale per ciascun partecipante tramite [scene.local](https://docs.owlbear.rodeo/extensions/apis/scene/local/):
  non occupano i metadata della stanza né diventano oggetti permanenti della
  scena. I token nascosti non producono etichette per i giocatori.
- Import bestiario: dopo aver caricato un manuale o un file JSON, si scelgono
  uno o piu' mostri. Solo quelli selezionati vengono salvati e caricati come
  token `CHARACTER` con nome `beasts/<nome>`. Quando il mirror non espone
  l'immagine viene generato un token di riserva con le iniziali del mostro.
- Nuovi messaggi e risultati: broadcast effimero Owlbear.

**Privacy:** bestiario e avventure restano nel browser che li ha importati; non
sono sincronizzati con gli altri partecipanti. I messaggi “Solo io” restano
locali. I nuovi messaggi “Solo GM” sono cifrati nel browser prima del broadcast
Owlbear. Il GM deve aver aperto l'estensione per pubblicare la sua chiave
pubblica. La chiave privata resta nel browser del GM; se quel browser viene
azzerato, i nuovi messaggi useranno una nuova chiave. Le vecchie copie locali
dei messaggi inviati con versioni precedenti non vengono cifrate retroattivamente.
I riepiloghi dei mostri e gli estratti delle avventure partono da “Privato”:
l'invio di una copia al party o al GM richiede una scelta per ogni elemento.

I contenuti 5e.tools vengono richiesti dal mirror sorgente pubblico del progetto
solo quando si sceglie una sorgente nella dialog ricercabile. L’accesso diretto
a `5e.tools/data` non viene usato perché la protezione Cloudflare blocca il fetch
cross-origin degli iframe. TavernExplorer non include i dataset nel bundle.
Le schede e gli NPC della libreria sono salvati sul server TavernExplorer
(Upstash). Chi conosce l'id della stanza può leggerli e modificarli tramite
l'API: i permessi della libreria sono applicati solo dall'estensione. È
consigliato esportare backup regolari con **Esporta tutto**.

## Profili di regole

Il modello salva `ruleset.id` e `ruleset.version`. I calcoli specifici sono in
`src/rulesets.ts`; nuovi profili possono essere aggiunti senza cambiare il
formato generale della scheda.

## Permessi

Il GM trova una sezione **Permessi** nell’estensione. Le impostazioni vengono
salvate nei metadata della stanza e controllano modifica dell’inventario comune
e ordine dei turni per i giocatori. Bestiario e Avventure sono visibili solo al GM.

## Backup TavernPack

Da **Libreria → Esporta tutto** si scarica un file versionato conforme a
`public/tavernpack.schema.json`: personaggi, mostri, avventure, inventario
comune, messaggi e stato dei turni. Le note del Journal restano nella libreria
cloud e non sono incluse nel file. Lo stesso pulsante d'importazione accetta
sia export Roll20 sia TavernPack.

## Tiri di dado

Ogni formula `d20` con modificatore apre una scelta Normale / Vantaggio /
Svantaggio prima del tiro; le altre formule (danni compresi) tirano subito con la
modalita' selezionata nella scheda. Il risultato viene scritto nel log dei
messaggi, trasmesso via Owlbear quando condiviso e, quando la visibilita' e' "Tutti" e il
personaggio ha un token collegato, mostrato per qualche secondo sulla mappa
accanto al token.

L'SDK Owlbear 3.1 non espone API per il dado 3D della piattaforma: i tiri usano
il generatore crittografico del browser e le API Owlbear disponibili
(`broadcast`, `notification`, `scene.items`).

## Boardown

La roadmap vive in `.boardown/` e si gestisce con la CLI inclusa tra le
dipendenze di sviluppo:

```bash
pnpm exec boardown release list
pnpm exec boardown backlog
pnpm exec boardown task get TE-9
```

La GitHub Action esegue build, lint e test su ogni push a `main` e sulle pull
request. Il progetto Vercel collegato a GitHub pubblica automaticamente i push
su `main`.

## Limiti della versione 0.8.0

- L'importatore richiede il blocco `normalized` di `roll20-sheet-export`.
- Le formule ricavate dalle descrizioni vengono segnalate nelle note d'import.
- I tiri non sono renderizzati come dadi 3D: l'SDK non espone il dado di Owlbear.
- L'SDK non permette di creare cartelle di asset: i token del bestiario usano il
  prefisso `beasts/` nel nome, non una cartella reale.
- I permessi della libreria valgono per il nome Owlbear: un giocatore che si
  rinomina perde l'accesso finché il GM non aggiorna la scheda, e il nuovo nome
  vale solo dopo aver riaperto l'estensione. Senza rete o fuori da Owlbear non
  ci sono schede modificabili.
- Il permesso «Può modificare» sugli NPC non ha ancora effetto: manca un
  editor degli statblock.
- I permessi delle note del Journal, come quelli delle schede, sono applicati
  dall'interfaccia: chi conosce la stanza può leggerle via API.
- I permessi di modifica sono applicati dall'interfaccia. I metadata della stanza
  sono scrivibili dai client che usano l'estensione; l'[API room documentata](https://docs.owlbear.rodeo/extensions/apis/room/)
  non descrive ACL per singola chiave. Questi controlli proteggono dalle
  modifiche accidentali, non da un client ostile.
- Inventario e turni restano nei metadata della stanza: l'API room
  documenta `getMetadata` e `setMetadata`, senza un'operazione di confronto e
  scrittura atomica. Schede e note usano invece la libreria cloud, che scrive solo
  se la revisione attesa coincide. ACL applicate dal server richiedono
  un'identità verificabile dei giocatori (TE-20).
- L'[API viewport](https://docs.owlbear.rodeo/extensions/apis/viewport/) consente
  il centraggio del token per il solo giocatore che preme il pulsante. La
  posizione dei token resta gestita dalla scena Owlbear.
- Lo storico non viene recuperato da chi entra nella stanza dopo l'invio.
- I riposi aggiornano PF, dadi vita, slot e contatori; esaurimento, riduzioni
  permanenti del massimo dei PF e ripristini speciali di classe richiedono
  ancora gestione manuale nella scheda.
