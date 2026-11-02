---
{}
---

## Avoid party sheet write collisions

---
id: TE-5
type: tech
priority: high
status: done
order: 100
---

Replace whole-array room metadata writes or add conflict handling when multiple players publish sheets concurrently.

## Offer late-join message history

---
id: TE-6
type: feature
priority: medium
status: todo
order: 200
---

Design persistence that preserves privacy for GM-only and personal messages.

## Search local bestiary and adventures

---
id: TE-8
type: feature
priority: low
status: todo
order: 300
---

Filter imported content by name, source, and challenge rating without loading another manual.

## Valutare storage condiviso oltre i metadata

---
id: TE-15
type: tech
priority: high
status: todo
order: 700
---

Confrontare le API documentate di room, player, scene e assets con i requisiti: dati disponibili tra scene e sessioni, quota, permessi per elemento e modifiche simultanee. I 200 MB cloud del piano gratuito non aumentano il limite dei metadata room. Scegliere uno storage adatto basandosi sulla documentazione; valutare un servizio autenticato solo se le API Owlbear non coprono i requisiti. Pianificare una migrazione senza perdita.

Rilievi documentati: room metadata <16 kB complessivi e scrittura parziale senza CAS; scene/item metadata sono legati alla scena; l'API player espone i metadata del giocatore corrente; assets espone immagini e scene, senza CRUD JSON generico. Per schede e note grandi, permanenti e con permessi verificati, progettare uno store applicativo con autenticazione indipendente, migrazione idempotente e backup TavernPack. Conservare in room metadata solo stato breve e riferimenti. Non trasferire note private sul server prima di definire l'identità e l'ACL.

Fonti: https://docs.owlbear.rodeo/extensions/apis/room/ ; https://docs.owlbear.rodeo/extensions/apis/scene/ ; https://docs.owlbear.rodeo/extensions/apis/player/ ; https://docs.owlbear.rodeo/extensions/apis/assets/ ; https://docs.owlbear.rodeo/docs/migration/migrate-from-1-to-2/#cloud-storage

## Incontri pronti da avviare

---
id: TE-18
type: feature
priority: medium
status: todo
order: 1000
---

Salvare gruppi di mostri e iniziative come incontro riutilizzabile, collegarli ai token della scena e avviare o chiudere il combattimento con controllo prima di sovrascrivere il tracker.

## Ricerca rapida durante la sessione

---
id: TE-19
type: feature
priority: medium
status: todo
order: 1100
---

Cercare personaggi, mostri, avventure e note accessibili senza riaprire cataloghi; filtrare per nome, fonte e GS dove applicabile.

## Storage condiviso con ACL reali

---
id: TE-20
type: feature
priority: high
status: todo
order: 1200
---

Progettare autenticazione, permessi server per elemento, scritture atomiche e migrazione idempotente dalle room metadata. Conservare backup TavernPack e verificare la privacy prima di spostare schede e note.

## Cronologia azioni di combattimento

---
id: TE-21
type: feature
priority: high
status: todo
order: 1300
---

Registrare danni, cure, PF temporanei e condizioni con autore, bersaglio e visibilità; permettere annullamento sicuro quando la versione della scheda non è cambiata.

## Ripristinare deploy Vercel dopo rate limit

---
id: TE-22
type: tech
priority: high
status: todo
order: 1400
---

Il commit bb2e5a0 ha Action verde ma Vercel ha risposto Deployment rate limited, retry in 24 hours. Dopo il limite, rilanciare il deploy e verificare che manifest.json pubblico corrisponda al commit; valutare un controllo automatico della versione servita.

## Creare un personaggio da zero

---
id: TE-23
type: feature
priority: high
status: todo
order: 1500
---

**Contesto.** Le schede nascono solo da import Roll20 (`importer.ts`) o TavernPack (`tavernpack.ts`). Un giocatore senza Roll20 non può partecipare. In `App.tsx` la `Library` ha solo "Importa JSON / TavernPack"; l'editor esiste già (`CharacterEditor`/`DeepCharacterEditor`, tab `edit` di `SheetView`).

**Da fare.**
- Nuova funzione pura `createBlankSheet(name, rulesetId = DEFAULT_RULESET.id): CharacterSheet` (es. in `src/blankSheet.ts`): `schemaVersion: 1`, `sharing: "private"`, livello 1, caratteristiche a 10, tutte le abilità di `SKILL_LABELS` con la caratteristica corretta, slot vuoti, array vuoti, `importWarnings: []`.
- Pulsante "Nuovo personaggio" in `Library`: chiede il nome, salva in `storage.characters`, seleziona la scheda e apre la tab `edit`.
- Ricalcolo derivati: funzione pura `recomputeDerived(sheet)` che a partire da punteggi, competenze e livello aggiorna `mod`, `save`, `skills[].bonus`, `passivePerception`, `initiative`, `proficiencyBonus` (da `Ruleset.proficiencyBonus`), `spellcasting.saveDc/attackBonus` (da `Ruleset.spellSaveDc`). Chiamarla quando nell'editor cambiano punteggio, competenza, livello o caratteristica da incantatore. I valori importati restano invariati finché l'utente non modifica quei campi.

**Accettazione.**
- Una scheda nuova supera `parseCharacterSheet` e si esporta/reimporta come TavernPack senza perdite.
- Con DES 14, livello 5, competente in Furtività → iniziativa +2, competenza +3, Furtività +5.
- La scheda nuova resta privata finché non si sceglie "Tutto il party".

**Test.** `blankSheet.test.ts`: forma valida (round trip TavernPack) e ricalcolo dei derivati sull'esempio sopra.

## Tiri salvezza contro la morte

---
id: TE-25
type: feature
priority: high
status: done
order: 1700
---

**Contesto.** `combat.deathSaves` esiste e viene azzerato da cure (`hitPoints.ts`) e riposo lungo (`rest.ts`), ma non c'è modo di tirarli. `HitPointControl.tsx` mostra solo "controlla manualmente…".

**Da fare.**
- Funzione pura `applyDeathSave(combat, d20)` in `hitPoints.ts`: 10+ = 1 successo; 2-9 = 1 fallimento; 1 = 2 fallimenti; 20 = PF a 1 e tiri azzerati. 3 successi = stabile (flag `combat.stable?: boolean`, azzerato quando si torna sopra 0); 3 fallimenti = morto (`combat.dead?: boolean`).
- In `applyHitPointAction`, se il PG è già a 0 PF e subisce danno: +1 fallimento (+2 se `critical: true`, nuovo parametro opzionale). Danno massiccio: se il danno residuo dopo i temporanei è ≥ PF massimi → morto. Rimuovere l'avviso manuale.
- UI in `HitPointControl` visibile solo a 0 PF: 3+3 pallini, pulsante "Tiro salvezza contro la morte" che passa da `executeRoll` (così il tiro finisce nei messaggi con la visibilità scelta) e applica il risultato alla scheda.
- Il ruleset 2014 ha le stesse regole: niente differenze da gestire nel `Ruleset`.

**Accettazione.**
- 0 PF, tiro 1 → 2 fallimenti. Tiro 20 → 1 PF e contatori a zero.
- PF max 20, a 5 PF prende 25 danni → morto.
- Cura da 0 → contatori azzerati, `stable`/`dead` rimossi.

**Test.** `hitPoints.test.ts`: tutti i casi sopra, più danno critico a 0 PF.

## Indebolimento 2024

---
id: TE-27
type: feature
priority: high
status: todo
order: 1900
---

**Contesto.** Non esiste in nessun file. Regola 5.5: livelli da 1 a 6; ogni tiro d20 (prove, attacchi, TS) subisce −2 × livello; velocità −5 ft × livello; a 6 si muore; un riposo lungo toglie 1 livello. Nel 2014 le regole sono diverse (tabella di effetti): gestire solo 5.5 e, per il ruleset 2014, mostrare il livello senza applicare penalità.

**Da fare.**
- `combat.exhaustion?: number` (0-6), validato in `parseCharacterSheet`.
- `Ruleset.exhaustionD20Penalty(level): number` (5.5: `-2 * level`; 2014: `0`).
- `effectiveSheet` (`effects.ts`): applicare la penalità a `save`, `skills[].bonus`, `initiative` e al bonus di attacco degli incantesimi. Per gli attacchi delle azioni passa da `modifierTotal(sheet, "attack")`: aggiungere lì la penalità oppure introdurre un `d20Penalty(sheet)` usato in `EntryList`. Scegliere un solo punto e documentarlo.
- Velocità: `speed` è una stringa. Mostrare "30 ft (−10 indebolimento)" senza riscriverla.
- `takeLongRest` (`rest.ts`): −1 livello e riportarlo nel riepilogo del riposo.
- UI: selettore 0-6 vicino a ispirazione/PF in `MainSheet`. Al livello 6 la scheda segna "morto". Label sul token tramite `tokenStatusText` ("Indebolito 2").

**Accettazione.**
- Indebolimento 2 → Furtività +5 diventa +1, iniziativa −4.
- Riposo lungo → livello 1.
- Scheda 2014 → nessuna penalità numerica.

**Test.** `effects.test.ts` per le penalità, `rest.test.ts` per la riduzione al riposo lungo.

## Lanciare un incantesimo

---
id: TE-28
type: feature
priority: medium
status: todo
order: 2000
---

**Contesto.** `Spells` (`App.tsx:374`) mostra gli slot con +/− manuali e i pulsanti attacco/danno separati. `SpellEntry` ha `level`, `ritual`, `concentration`, `attackBonus`, `damage`, `saveDc`.

**Da fare.**
- Pulsante "Lancia" su ogni incantesimo di livello ≥ 1. Il dialog permette di scegliere uno slot di livello ≥ `spell.level` con slot liberi (default: il più basso disponibile) e, se `ritual`, l'opzione "Come rituale (nessuno slot)".
- Funzione pura `castSpell(sheet, spellId, slotLevel | "ritual")` in `src/spellcasting.ts`: incrementa `slots[level_N].used` ed errore se non ci sono slot. Ritorna la nuova scheda e un riepilogo.
- I trucchetti (livello 0) non consumano slot.
- Messaggio di lancio: nome, livello dello slot, CD o tiro per colpire. Se c'è `attackBonus` propone il tiro di attacco; se c'è `damage` propone il danno. Cast potenziato: solo testo "slot di livello N" (non c'è un dato strutturato per i dadi extra, non inventarlo).
- Se `concentration`: richiama TE-29 (impostare l'incantesimo attivo). Se TE-29 non è ancora fatta, lasciare solo il flag nel messaggio.
- Magia del Patto: gli slot hanno la stessa chiave `level_N`, nessun caso speciale.

**Accettazione.**
- Palla di fuoco (livello 3) con slot 3 esauriti e slot 5 liberi → il dialog propone il 5 e il lancio scala lo slot 5.
- Nessuno slot ≥ livello e incantesimo non rituale → pulsante disabilitato con tooltip.

**Test.** `spellcasting.test.ts`: slot consumato, rituale, errore senza slot, trucchetto.

## Concentrazione

---
id: TE-29
type: feature
priority: medium
status: todo
order: 2100
---

**Contesto.** `SpellEntry.concentration` è solo un flag. Regole: un solo incantesimo a concentrazione alla volta (un nuovo lancio sostituisce il precedente). Quando si subisce danno: TS Costituzione con CD = max(10, metà del danno arrotondata per difetto), massimo 30. Incapacitato o 0 PF → la concentrazione termina.

**Da fare.**
- `combat.concentration?: { spellId: string; name: string; startedRound?: number }`.
- Inizio: da "Lancia" (TE-28) o con un toggle manuale sull'incantesimo. Fine: pulsante "Termina" in `MainSheet`.
- `HitPointControl`: dopo un danno > 0 su un PG concentrato mostrare il banner "TS Costituzione CD X" con un pulsante che tira `1d20 + save.constitution` (passando da `performRoll`, quindi con vantaggio/svantaggio). Se il TS fallisce, rimuovere la concentrazione. Se i PF arrivano a 0, rimuoverla subito.
- Se il tracker assegna "Incapacitato" (o Paralizzato, Pietrificato, Stordito, che includono Incapacitato) alla voce collegata alla scheda → avviso al proprietario. La scheda è separata dal turn state, quindi non rimuovere la concentrazione in automatico: mostrare un pulsante "Termina concentrazione".
- Token: aggiungere "◎ Nome incantesimo" in `tokenStatusText` (visibile a tutti, è informazione pubblica al tavolo).

**Accettazione.**
- 23 danni → CD 11; 70 danni → CD 30 (limite); 4 danni → CD 10.
- Lanciare un secondo incantesimo a concentrazione sostituisce il primo.

**Test.** Funzione pura `concentrationDc(damage)` più i passaggi di stato in `concentration.test.ts`.

## Weapon Mastery

---
id: TE-30
type: feature
priority: medium
status: todo
order: 2200
---

**Contesto.** Regola 2024: alcune classi possono usare la proprietà di maestria delle armi. `ActionEntry` non ha il campo.

**Da fare.**
- `ActionEntry.mastery?: "cleave" | "graze" | "nick" | "push" | "sap" | "slow" | "topple" | "vex"`.
- Costante `WEAPON_MASTERIES` in `constants.ts` con nome italiano e descrizione breve (Fendere, Graffiare, Rapidità, Spingere, Fiaccare, Rallentare, Rovesciare, Irritare: verificare i nomi sul PHB 2024 italiano).
- Editor delle azioni: select della maestria.
- Messaggio di attacco: badge con la maestria e descrizione in tooltip. Graze: se l'attacco manca, proporre il pulsante "Danno Graze" (danno = modificatore della caratteristica; non è derivabile in modo affidabile, quindi far inserire il valore una volta nell'editor come `masteryValue?`). Topple: mostrare la CD (8 + mod + competenza) se presente.
- Import: Roll20 se espone il campo (verificare un export reale in `importer.test.ts`); 5e.tools, per gli oggetti, ha `mastery` sugli item, da usare solo se importiamo armi.

**Accettazione.** Un'arma con Rovesciare mostra il badge e la CD nel messaggio di attacco; la TavernPack conserva il campo.

**Test.** Round trip di `parseCharacterSheet` con `mastery`; uiSmoke facoltativo.

## Ispirazione eroica

---
id: TE-31
type: feature
priority: medium
status: todo
order: 2300
---

**Contesto.** `combat.inspiration: boolean` è importato ma non ha effetti. Regola 5.5: si spende per ritirare un d20 appena tirato, tenendo il nuovo risultato; gli umani la recuperano a ogni riposo lungo.

**Da fare.**
- Nei messaggi di tipo `roll` con d20 dell'autore corrente: pulsante "Usa ispirazione" se la scheda (`characterId`) ha `inspiration: true`. Ritira solo il d20, mantiene il modificatore e pubblica un nuovo messaggio "Ritirato con ispirazione: X → Y" che riferisce l'originale (`rerollOf?: string`). Mette `inspiration = false`.
- Party (GM): toggle "Dai ispirazione" per ogni scheda condivisa, via `updateSharedSheet`.
- Riposo lungo: contatore opzionale. Si copre già con `counters`, non serve logica speciale per gli umani.

**Accettazione.**
- Il pulsante sparisce dopo l'uso e non compare sui tiri di altri giocatori.
- Il GM la assegna e il giocatore la vede accesa senza ricaricare.

**Test.** Funzione pura `rerollD20(message, newDie)` (modificatore conservato, vantaggio: ritira solo il dado tenuto).

## Resistenze, vulnerabilità e immunità

---
id: TE-32
type: feature
priority: medium
status: todo
order: 2400
---

**Contesto.** Non sono modellate. 5e.tools espone sui mostri `resist`, `vulnerable`, `immune`, `conditionImmune`, oggi ignorati in `import5etools.ts:99`.

**Da fare.**
- Tipo condiviso `DamageDefenses = { resistances: string[]; vulnerabilities: string[]; immunities: string[]; conditionImmunities: string[] }` con chiavi inglesi stabili (`fire`, `slashing`…) e label italiane in `constants.ts`.
- `CharacterSheet.defenses?` e `MonsterSheet.defenses?`. Per i mostri vanno copiate anche nella `TurnEntry` di TE-24 (oppure lette dal bestiario del GM tramite `characterId`, che per i mostri è `monster.id`: preferibile, niente duplicazione nei metadata).
- Import 5e.tools: parse di stringhe e oggetti condizionali (`{resist:[...], note:"from nonmagical attacks"}`): salvare il tipo e mettere la nota in `importWarnings` se non è rappresentabile.
- `applyHitPointAction` / `applyTurnHitPoints`: parametro `damageType?`. Immunità → 0; resistenza → metà per difetto; vulnerabilità → doppio; resistenza + vulnerabilità si annullano. Anteprima: "15 fuoco → 7 (resistenza)".
- Condizioni: al momento di aggiungere una condizione a cui la voce è immune, mostrare un avviso.
- Editor scheda: tre multi-select.

**Accettazione.** Scheletro (vulnerabile contundente, immune veleno): 9 contundenti → 18; 9 veleno → 0.

**Test.** `hitPoints.test.ts` con tutte le combinazioni; `importer`/`import5etools` con un mostro reale (es. Skeleton XMM).

## Effetti meccanici delle condizioni

---
id: TE-33
type: feature
priority: low
status: todo
order: 2500
---

**Contesto.** Le condizioni sono stringhe libere sulla `TurnEntry`, con suggerimenti in `TurnOrder.tsx` (`CONDITION_SUGGESTIONS`). I tiri passano dal dialog vantaggio/svantaggio di `App.tsx:300`.

**Da fare.**
- Mappa `CONDITION_ROLL_HINTS` (chiave = nome italiano normalizzato) → `{ attack?: "advantage" | "disadvantage"; check?: …; saves?: { [ability]: "auto-fail" | … } }` secondo il PHB 2024. Esempi: Avvelenato → svantaggio su attacchi e prove; Prono → svantaggio sugli attacchi; Trattenuto → svantaggio su attacchi e TS Destrezza; Accecato → svantaggio sugli attacchi; Paralizzato/Stordito → TS Forza e Destrezza falliti automaticamente; Invisibile → vantaggio sugli attacchi. Includere Indebolimento solo come rimando a TE-27.
- Quando il proprietario della scheda tira, cercare la voce del tracker collegata (`characterId`) e preselezionare nel dialog la modalità suggerita, con la nota "Suggerito da: Avvelenato". Non forzare mai la modalità; vantaggio + svantaggio → normale.
- Condizioni scritte a mano e non riconosciute: nessun effetto.

**Accettazione.** PG Avvelenato tira Atletica → dialog con "Svantaggio" preselezionato e motivo visibile; tiro iniziativa (prova di Destrezza) → idem.

**Test.** Funzione pura `suggestRollMode(conditions, rollKind, ability?)`, una tabella di casi.

## Salire di livello

---
id: TE-34
type: feature
priority: medium
status: todo
order: 2600
---

**Contesto.** Il livello si cambia a mano nell'editor; `normalizeAfterImport` segnala solo un bonus di competenza incoerente. Gli slot non hanno una progressione.

**Da fare.**
- Dialog "Sali di livello" da `MainSheet` (solo se la scheda è modificabile):
  1. Classe che sale (precompilata da `identity.className`; campo libero per il multiclasse).
  2. PF: "Valore fisso" (media del dado + 1 + mod COS, default) oppure "Tira" (`1d{die}` + COS, minimo 1). Aggiorna `hp.max` e `hp.current` dello stesso valore.
  3. Dadi vita: `max + 1` e `current + 1`. Con dadi diversi nel multiclasse oggi c'è un solo `die`: segnalarlo come limite e non gestirlo in questa task.
  4. Bonus di competenza da `Ruleset.proficiencyBonus` e ricalcolo dei derivati (riusare `recomputeDerived` di TE-23).
  5. Slot: tabelle per incantatore completo, mezzo incantatore e Magia del Patto (2024) in `src/spellProgression.ts`; scelta del tipo di incantatore nel dialog; multiclasse con la regola del livello combinato.
- Anteprima delle differenze (prima → dopo) e conferma. Messaggio di sistema "X sale al livello N".
- Nessuna scelta di talenti o privilegi: restano manuali tramite `traits`.

**Accettazione.** Mago 4 → 5 con COS +2, valore fisso: +6 PF, competenza +3, slot 4/3/2; riposo e TavernPack coerenti.

**Test.** `spellProgression.test.ts` (completo, mezzo, patto, multiclasse) e la funzione pura `levelUp(sheet, options)`.

## Sintonia e munizioni

---
id: TE-35
type: feature
priority: low
status: todo
order: 2700
---

**Contesto.** `InventoryEntry` ha `equipped` e `modifiers`, applicati in `effects.ts:activeModifiers` se l'oggetto è equipaggiato. Nessuna sintonia, nessun legame azione → munizione.

**Da fare.**
- `InventoryEntry.requiresAttunement?: boolean`, `attuned?: boolean`. `activeModifiers`: un oggetto che richiede sintonia applica i modificatori solo se `equipped && attuned`.
- UI `Inventory`: toggle sintonia; blocco oltre i 3 oggetti sintonizzati con un messaggio chiaro.
- `ActionEntry.ammoItemId?: string`: select nell'editor delle azioni tra gli oggetti con `count !== null`. Tiro di attacco → `count - 1`; a 0 il pulsante è disabilitato ("Munizioni esaurite"). Il recupero di metà munizioni dopo il combattimento resta manuale.

**Accettazione.**
- Un quarto oggetto non si sintonizza; un anello +1 CA non sintonizzato non cambia la CA.
- Arco con 20 frecce → dopo 3 attacchi restano 17.

**Test.** `effects.test.ts` per la sintonia; funzione pura `consumeAmmo(sheet, actionId)`.

## Azioni leggendarie e tiri dei mostri

---
id: TE-36
type: feature
priority: medium
status: todo
order: 2800
---

**Contesto.** `MonsterSheet.legendaryActions` è importato e visualizzato, ma non ci sono contatori. 5e.tools ha `legendaryActions` (numero, default 3), il tratto "Legendary Resistance (3/Day)" e `save`/`skill` già importati ma senza pulsanti di tiro.

**Da fare.**
- Import: `MonsterSheet.legendaryActionCount?: number` (default 3 se ci sono azioni leggendarie), `legendaryResistance?: number` estratto con regex dal nome del tratto `/Legendary Resistance \((\d+)\/Day/`.
- Contatori per istanza nel tracker (`TurnEntry.legendary?: { actions: number; resistances: number }`), inizializzati all'aggiunta. `stepTurn`: quando il mostro diventa attivo, ripristinare `actions` al massimo. Le resistenze non si ripristinano (si azzerano con "Svuota ordine").
- In `TurnOrder`, solo per il GM: pallini cliccabili per spenderle.
- `Bestiary`: pulsanti di tiro per i 6 TS (bonus da `saves`, altrimenti modificatore) e per le abilità in `skills`, con visibilità predefinita "solo GM".

**Accettazione.** Drago con 3 azioni leggendarie: speso 2 → al suo turno torna a 3. Resistenze 3 → 2 e restano 2 al round successivo.

**Test.** `turns.test.ts` per il ripristino in `stepTurn`; import di un drago adulto 5e.tools.

## Budget PE degli incontri

---
id: TE-37
type: feature
priority: low
status: todo
order: 2900
---

**Contesto.** Nessun calcolo di difficoltà. Dipende da TE-18 (incontri salvati), ma il calcolo puro si può fare prima. Regola DMG 2024: budget PE per personaggio in base al livello e alla difficoltà (Bassa / Moderata / Alta); somma dei PE dei mostri senza moltiplicatori (a differenza del 2014).

**Da fare.**
- `src/encounter.ts`: tabella `XP_BUDGET_2024[level] = { low, moderate, high }` (livelli 1-20, dal DMG 2024) e `CR_XP` (GS → PE).
- `encounterDifficulty(partyLevels: number[], monsterCrs: string[])` → `{ totalXp, budgets, rating }`.
- UI: nel bestiario del GM, una selezione multipla "Calcola incontro" che usa i livelli delle schede condivise (`PartyCharacterSummary.level`). Quando TE-18 sarà pronta, mostrarlo anche sull'incontro salvato.
- Ruleset 2014: tabella e moltiplicatori diversi. Fuori scope; mostrare "solo regole 2024".

**Accettazione.** Party di 4 PG di livello 3 contro 2 Bugbear Warrior (GS 1) → valore e fascia coerenti con la tabella del DMG 2024 (riportare nel test i numeri della tabella).

**Test.** `encounter.test.ts` con 3-4 casi presi dalla tabella.

## Layout per finestre molto larghe

---
id: TE-38
type: feature
priority: low
status: todo
order: 3000
---

**Contesto.** Il limite `max-width:760px` su `.app` è stato tolto: la barra laterale delle tab resta ancorata a sinistra e l'header occupa tutta la larghezza, ma `main` non ha più un tetto. Su finestre molto larghe (popover allargato o finestra flottante a schermo intero) schede, liste e form si stirano fino al bordo destro.

**Da fare.**
- Controllare tutte le tab (Scheda, Turni, Messaggi, Note, Bestiario, Avventure, Inventario comune, Party, Libreria, Permessi) a 1280px e 1920px e annotare cosa si legge male.
- Valutare un tetto di larghezza sul contenuto di `main` dove serve (es. form e testi lunghi).
- Valutare una vista affiancata quando c'è spazio: due pannelli insieme (es. Scheda + Turni, Scheda + Messaggi) invece di una sola tab alla volta.

**Accettazione.** A 1920px nessuna tab ha righe di testo o input stirati su tutta la larghezza; sotto i 760px il layout resta com'è oggi.

## API cloud delle schede con revisione

---
id: TE-39
type: tech
priority: high
status: done
order: 3100
---

**Contesto.** Le schede passano dai metadata della stanza (limite ~14 KB) a Upstash Redis tramite `api/sheets.ts` (bozza nel commit `36dd4c0`, branch `feat/cloud-sheets`). Il GM gestisce tutte le schede; i permessi sono solo lato client (TE-42). Decisione consapevole: chi conosce l'id della stanza può leggere e scrivere tutto via API.

**Da fare.**
- Nuovo `CloudSheet` in `src/types.ts`: `{ sheet: CharacterSheet; rev: number; updatedAt: number; updatedBy: string; deletedAt?: number; acl: { view: string[]; edit: string[] } }`. `updatedBy` e le liste `acl` contengono nomi Owlbear. Rimuovere `ownerId`/`ownerName`.
- Chiave invariata: hash `te:room:<roomId>:sheets`, campo = `sheet.id`.
- `PUT` di una scheda: `{ room, id, rev, entry }`. Script Lua via `redis.eval` che scrive solo se il `rev` salvato coincide (scheda nuova: `rev` 0) e incrementa `rev`; altrimenti `409` con la versione del server.
- `DELETE` diventa soft delete (`deletedAt`) passando dallo stesso controllo di `rev`.
- `GET`: tutte le schede della stanza, comprese quelle cancellate (servono ai client offline per non ricrearle).
- `vercel.json`: `"regions": ["fra1"]` (stessa regione del DB).
- Sviluppo locale: `pnpm dev` non serve `api/`. Documentare `vercel dev` con le env Upstash nel README.

**Accettazione.** Due PUT con lo stesso `rev` di partenza: il primo passa, il secondo riceve `409` con la versione aggiornata. Una scheda oltre 200 KB viene rifiutata.

**Test.** Test della validazione e del flusso `rev`/409 con Redis finto.

## Sincronizzazione client con il cloud

---
id: TE-40
type: feature
priority: high
status: done
order: 3200
---

**Contesto.** Dipende da TE-39. Oggi le schede vivono in `storage.characters` (locale) e quelle "party" vengono pubblicate nei metadata della stanza.

**Da fare.**
- All'apertura dell'estensione: `GET` della stanza, merge con la cache locale per `rev` (vince il `rev` più alto; le schede con `deletedAt` vengono rimosse dalla cache).
- Ogni modifica della scheda: upload con debounce (~1-2 s) e `rev` atteso. Su `409`: avviso con scelta "Usa la versione del server" / "Esporta la mia copia" (riusare l'export TavernPack).
- Offline o errore di rete: la modifica resta in coda locale e riparte alla riconnessione.
- Aggiornamenti degli altri: polling leggero (es. ogni 15-30 s, solo con il pannello aperto) oppure un segnale nei metadata della stanza con il `rev` cambiato. Scegliere uno dei due e documentarlo.
- Tenere d'occhio i comandi Upstash del piano free.

**Accettazione.** Il GM modifica i PF, il giocatore con permesso di vista li vede aggiornati senza ricaricare. Due modifiche concorrenti producono un avviso, mai una perdita silenziosa. Chiude TE-5.

## Import Roll20 delle schede da parte del GM

---
id: TE-41
type: feature
priority: high
status: done
order: 3300
---

**Contesto.** I personaggi oggi sono su Roll20. Li importa tutti il GM (export `roll20-sheet-export` con blocco `normalized`, `importRoll20`), i giocatori non fanno nulla. Dipende da TE-39.

**Da fare.**
- In `Library` (solo GM): import multiplo di file Roll20/TavernPack direttamente nel cloud.
- Una scheda nuova nasce con `acl: { view: [], edit: [] }`: la vede solo il GM.
- Deduplica: se esiste già una scheda con lo stesso `sheet.sourceId`, aggiornarla (stesso `id`, `rev` corretto) invece di crearne una nuova. Mantenere `acl`, `effects`, `counters` e lo stato di gioco (PF correnti, slot usati) e chiedere conferma prima di sovrascriverli.
- Riepilogo finale: importate, aggiornate, scartate con il motivo (`importWarnings`).

**Accettazione.** Reimportare lo stesso PG non crea duplicati. Un JSON non valido non blocca gli altri file.

## Permessi per scheda in base al nome Owlbear

---
id: TE-42
type: feature
priority: high
status: done
order: 3400
---

**Contesto.** Il GM decide per ogni scheda chi la vede e chi la modifica. I permessi sono applicati solo dall'estensione: non sono una protezione reale (API aperta a chi conosce la stanza, nomi Owlbear modificabili). Va bene solo per un gruppo di fiducia; il vero controllo lato server resta in TE-20. Dipende da TE-39.

**Da fare.**
- Editor ACL nella scheda (solo GM): due liste "Può vedere" e "Può modificare" con i giocatori connessi (`getPartyMembers`) e un campo per un nome libero (giocatore non ancora entrato). `edit` include `view`.
- Funzioni pure `canViewCloudSheet(entry, playerName, role)` e `canEditCloudSheet(...)`: GM sempre sì. Confronto dei nomi senza distinzione tra maiuscole e minuscole e senza spazi ai bordi.
- Il selettore del personaggio, `Party` e i tiri usano solo le schede visibili; la scheda in sola lettura disattiva l'editor.
- Avviso nell'editor ACL: se un giocatore cambia nome in Owlbear perde l'accesso finché il GM non aggiorna la lista.

**Accettazione.** Un giocatore senza permessi non vede la scheda nell'app. Con solo `view` la apre ma non la modifica. Il GM vede tutto.

**Test.** Test unitari di `canViewCloudSheet`/`canEditCloudSheet`.

## Rimuovere la condivisione delle schede nei metadata

---
id: TE-43
type: tech
priority: medium
status: done
order: 3500
---

**Contesto.** Con TE-39…TE-42 il cloud sostituisce la condivisione delle schede nei metadata della stanza. Tenerle entrambe crea due fonti di verità.

**Da fare.**
- Migrazione una tantum: le schede `sharing: "party"` nei metadata e quelle locali del GM vanno nel cloud. Le schede dei giocatori vengono caricate dal GM con ACL `edit` = nome del proprietario.
- Rimuovere `publishSharedSheets`, `updateSharedSheet`, `SharedSheetConflictError`, `acceptSharedSheetVersion`, `assignSheetToPlayer`, `publishPartyCharacters` e relativi listener in `src/obr.ts`, il campo `sheet.sharing` (con la gestione nel parser) e l'`AssignmentPanel` se non serve più. Adeguare `tokenAssignment.integration.test.ts`.
- Aggiornare il README (sezione schede condivise e limiti).

**Accettazione.** Nessuna scheda vive più nei metadata della stanza. Le schede esistenti in una stanza di prova sopravvivono alla migrazione.

## Editor degli statblock NPC

---
id: TE-44
type: feature
priority: medium
status: todo
order: 3600
---

**Contesto.** Gli NPC della Libreria sono copie di statblock del Bestiario (`kind: "npc"`, `MonsterSheet`) con permessi "Può vedere / Può modificare". Oggi lo statblock è in sola lettura e il permesso di modifica non ha effetto.

**Da fare.**
- Editor per chi può modificare l'NPC: nome, CA, PF (anche PF attuali, oggi assenti nel `MonsterSheet`), velocità, caratteristiche, tratti, azioni, reazioni, azioni leggendarie.
- Le modifiche passano da `createCloudLibrary().update` come per i PG (debounce, `rev`, conflitti).
- Valutare se aggiungere `hp.current` al `MonsterSheet` degli NPC senza cambiare il Bestiario.

**Accettazione.** Un giocatore con "Può modificare" cambia i PF di un NPC e il GM li vede aggiornati; chi ha solo "Può vedere" non vede l'editor.

## Numero in basso a sinistra nei messaggi di attacco

---
id: TE-45
type: bug
priority: medium
status: done
order: 3700
---

**Contesto.** Nei messaggi di tipo `roll` il riquadro `.roll-result` mostra a sinistra `message.dice.join(" + ")` e a destra `total` (`Messages` in `App.tsx`). Per gli attacchi con danno automatico `dice` contiene solo il d20 (o i due d20 con vantaggio/svantaggio), quindi in basso a sinistra compare un numero isolato senza spiegazione, mentre il danno è solo nel testo.

**Da fare.**
- Decidere cosa mostrare: etichettare i dadi ("d20: 19" / "d20: 4, 17 → 17") oppure toglierli per gli attacchi.
- Valutare di salvare nel `ChatMessage` anche il risultato del danno in forma strutturata, così il riquadro mostra attacco e danno separati invece del solo totale dell'attacco.

**Accettazione.** In un messaggio di attacco ogni numero visibile ha un'etichetta chiara.

## Attacchi e magie in chat in stile Roll20

---
id: TE-46
type: feature
priority: medium
status: done
order: 3800
---

**Contesto.** Oggi un attacco è un messaggio di testo (`1d20+5 → 17 · Danno 1d8+3 → 7 Tagliente`) e gli incantesimi hanno ancora pulsanti attacco e danno separati nella tab Magia. Roll20 mostra un riquadro con nome, tiro per colpire, danno con tipo, critico evidenziato, tiro salvezza con CD ed effetto, descrizione richiudibile.

**Da fare.**
- Messaggio strutturato per attacchi/magie (nuovo `kind` o campi opzionali di `ChatMessage`): nome azione, gittata, attacco (con i due d20 per vantaggio/svantaggio), danno e danno critico con tipo, TS con caratteristica, CD ed effetto, descrizione.
- Card in chat con il layout ispirato a Roll20; critico e 1 naturale evidenziati.
- Incantesimi: stesso flusso delle azioni (un solo pulsante che tira attacco + danno, o mostra la CD per gli incantesimi a TS), riusando `resolveAction`.
- Compatibilità con i messaggi già salvati (testo semplice).

**Accettazione.** Un attacco, un critico e un incantesimo a tiro salvezza producono card leggibili senza aprire il dettaglio; i vecchi messaggi restano visibili.

## Icone di attacco e modifica su azioni e magie

---
id: TE-47
type: feature
priority: low
status: done
order: 3900
---

**Contesto.** In tab Azioni i comandi sono pulsanti di testo dentro il dettaglio richiudibile (Attacco, Mostra, Modifica); nella tab Magia non c'è modifica. Serve un accesso più rapido.

**Da fare.**
- Icona "attacca/lancia" (es. dado o spade) sulla riga di ogni azione e incantesimo, cliccabile senza aprire il dettaglio.
- Icona "modifica" (matita) sulla stessa riga, solo per chi può modificare la scheda; per gli incantesimi serve un form di modifica (estendere `ActionForm` con livello, scuola, concentrazione, rituale).
- Etichette accessibili (`aria-label`) e tooltip.

**Accettazione.** Da riga chiusa si attacca/lancia e si apre il form di modifica con un clic; chi ha sola lettura non vede la matita.

## Creare risorse da zaino e tratti

---
id: TE-48
type: feature
priority: medium
status: done
order: 4000
---

**Contesto.** Le Risorse (`ResourcePanel`, `sheet.counters`) sono separate dallo Zaino (`InventoryEntry.count`) e dai Tratti (`TraitEntry`): frecce, pozioni o usi di un tratto (es. "Recupero energie") vanno creati e tenuti a mano.

**Da fare.**
- Pulsante "Crea risorsa" accanto a "Crea azione", nel dettaglio espanso della voce: oggetto dello zaino (`InventoryPanel.tsx`, `library-actions`) e tratto (`App.tsx`, `entry-actions`), visibile solo a chi può modificare (come "Use as a resource" di Roll20). Apre il popup risorsa precompilato con il nome della voce.
- Zaino: collegare il contatore della risorsa all'oggetto: −/+ della risorsa cambia la quantità dell'oggetto e viceversa; il massimo resta della risorsa.
- Tratti: il tratto non ha quantità; la risorsa resta collegata al tratto (nome, eliminazione) con massimo e recupero (breve/lungo/nessuno) scelti nel popup.
- Se la voce ha già una risorsa collegata, al posto di "Crea risorsa" si mostra il collegamento invece di crearne un'altra.
- Collegare le azioni alla risorsa (1 per uso, come "Ammo tracking" di Roll20): dal popup azione, dal popup risorsa e quindi dallo zaino ("Modifica risorsa" quando la risorsa esiste). Usare l'azione scala la risorsa; ogni uso compare in chat.

**Accettazione.**
- Una risorsa "Frecce" creata da un oggetto scala la quantità nello zaino e la quantità modificata nello zaino si vede nella risorsa.
- Da un tratto "Recupero energie" si crea una risorsa con massimo 1 e recupero breve, che compare in Risorse.

## Segnalare all'import da Roll20 ciò che non viene importato

---
id: TE-49
type: feature
priority: medium
status: todo
order: 4100
---

**Contesto.** L'import Roll20 (`importRoll20`) legge solo alcuni campi di `normalized` e `raw`; quello che non riconosce si perde senza avviso (es. risorse di classe, campi di opzioni non gestiti, testo non riconosciuto nei modificatori degli oggetti). Le note d'importazione oggi coprono solo pochi casi.

**Da fare.**
- Confrontare l'export con ciò che è stato importato e raccogliere le parti mancanti o non riconosciute (sezioni di `normalized` ignorate, attributi `raw` con valori non predefiniti, modificatori e proprietà non interpretati).
- Mostrarle nel popup "Note d'importazione" al momento dell'import, raggruppate per sezione, e salvarle nelle note della scheda (tab Modifica).
- Distinguere "non importato" da "importato con approssimazione".

**Accettazione.** Importando un personaggio con dati non gestiti, il popup elenca cosa manca; un personaggio senza dati extra non mostra avvisi nuovi.
