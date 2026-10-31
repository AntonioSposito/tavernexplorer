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

- Schede, bestiario, avventure e ultimi 200 messaggi: storage locale del browser.
- Owlbear documenta **200 MB di spazio cloud nel piano gratuito** per i dati
  dell'account ([piani e cloud storage](https://docs.owlbear.rodeo/docs/migration/migrate-from-1-to-2/#cloud-storage)).
  È distinto dai metadata della stanza usati qui per sincronizzare note,
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
- Note: private per impostazione predefinita nel browser, oppure pubblicate nella
  stanza per la lettura del party. Per ogni nota condivisa l'autore sceglie se
  consentire la scrittura solo a sé, anche al GM, o a tutto il party. Può
  riportare la nota in privato. Una copia riservata al GM si invia come messaggio
  cifrato; non è una nota collaborativa persistente. Le cartelle organizzano
  note private e condivise per ciascun browser: si possono creare, rinominare,
  eliminare e assegnare alle note senza cambiare i permessi condivisi.
- Party: le schede nuove sono private nel browser. In **Libreria** si puo' scegliere
  per ogni scheda **Solo questo browser** oppure **Tutto il party**. Solo le schede
  condivise pubblicano un riepilogo (CA, PF, caratteristiche) nei metadata del
  giocatore. Le schede gia' salvate senza una scelta esplicita vengono trattate
  come private. Le schede complete restano solo nel browser del proprietario
  finché non arriva il salvataggio cloud (TE-40).
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
- Collegamento token/scheda: metadata del token. Nel Party il GM vede ogni
  personaggio con il suo proprietario e tutti i token dello strato Personaggi
  della scena, inclusi quelli senza scheda. Può cercare un token e collegarlo
  dal relativo menu.
  Le liste si aggiornano quando cambia la scena. Il menu contestuale del token
  apre la scheda collegata; non assegna automaticamente la scheda attiva ai
  token scollegati. Collegando un token, il proprietario Owlbear del token viene
  allineato al proprietario della scheda. Il GM può anche
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
- Note dei giocatori: ogni nota viene salvata localmente, inclusa nel TavernPack
  e puo' essere inviata individualmente al party o al GM. L'invio crea una copia
  nel registro messaggi; la nota originale resta modificabile solo nel browser.

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
cross-origin degli iframe. TavernExplorer non include i dataset nel bundle. Le
schede non vengono inviate a un server TavernExplorer. Perciò ogni giocatore deve
importare le proprie schede nel browser che userà; è consigliato esportare
backup regolari.

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
comune, note private e cartelle personali, messaggi e stato dei turni. Le note condivise restano nei
metadata della stanza e non sono incluse nel file. Lo stesso pulsante d'importazione accetta
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
- Le schede complete restano nel browser del proprietario: il GM non può aprire
  né modificare quelle dei giocatori e le etichette PF sui token mostrano solo
  le schede presenti nel proprio browser.
- Le note condivise sono leggibili da tutti i partecipanti della stanza. Per
  dati riservati al GM usare l'invio cifrato della copia. I permessi di scrittura
  sono controllati dall'interfaccia, secondo i limiti dei metadata Owlbear.
- I permessi di modifica sono applicati dall'interfaccia. I metadata della stanza
  sono scrivibili dai client che usano l'estensione; l'[API room documentata](https://docs.owlbear.rodeo/extensions/apis/room/)
  non descrive ACL per singola chiave. Questi controlli proteggono dalle
  modifiche accidentali, non da un client ostile.
- Il controllo versione delle schede rileva modifiche remote già visibili, ma
  l'API room documenta `getMetadata` e `setMetadata`, senza un'operazione di
  confronto e scrittura atomica. Le [API assets](https://docs.owlbear.rodeo/extensions/apis/assets/)
  documentano upload e selezione di immagini e scene, non uno store generico
  di documenti JSON. La scelta di uno storage più capiente e di ACL applicate
  dal server richiede una valutazione dedicata delle API e del ciclo di vita dei dati.
- L'[API viewport](https://docs.owlbear.rodeo/extensions/apis/viewport/) consente
  il centraggio del token per il solo giocatore che preme il pulsante. La
  posizione dei token resta gestita dalla scena Owlbear.
- Lo storico non viene recuperato da chi entra nella stanza dopo l'invio.
- I riposi aggiornano PF, dadi vita, slot e contatori; esaurimento, riduzioni
  permanenti del massimo dei PF e ripristini speciali di classe richiedono
  ancora gestione manuale nella scheda.
