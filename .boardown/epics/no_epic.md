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
status: done
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
- UI: selettore 0-6 vicino a ispirazione/PF in `MainSheet`. Al livello 6 la scheda segna "morto". Sul token l'effetto "Exhaustion N" ha già l'icona 😫 (`tokenConditionIcons` in `src/tokenStatus.ts`), senza il livello: se il livello passa in `combat.exhaustion`, l'icona va presa da lì e il livello va mostrato sull'icona.

**Accettazione.**
- Indebolimento 2 → Furtività +5 diventa +1, iniziativa −4.
- Riposo lungo → livello 1.
- Scheda 2014 → nessuna penalità numerica.

**Test.** `effects.test.ts` per le penalità, `rest.test.ts` per la riduzione al riposo lungo.

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
- Token: fatto. L'effetto "Concentrazione: <incantesimo>" ha l'icona 🧠 in `tokenConditionIcons` (`src/tokenStatus.ts`), visibile a tutti come gli altri effetti del PG. Il nome dell'incantesimo non compare sul token.

**Accettazione.**
- 23 danni → CD 11; 70 danni → CD 30 (limite); 4 danni → CD 10.
- Lanciare un secondo incantesimo a concentrazione sostituisce il primo.

**Test.** Funzione pura `concentrationDc(damage)` più i passaggi di stato in `concentration.test.ts`.

## Weapon Mastery

---
id: TE-30
type: feature
priority: medium
status: done
order: 2200
---

**Contesto.** Regola 2024: alcune classi possono usare la proprietà di maestria delle armi. `ActionEntry` non ha il campo.

**Da fare.**
- `ActionEntry.mastery?: "cleave" | "graze" | "nick" | "push" | "sap" | "slow" | "topple" | "vex"`.
- Costante `WEAPON_MASTERIES` in `constants.ts` con nome italiano e descrizione breve (Fendere, Graffiare, Rapidità, Spingere, Fiaccare, Rallentare, Rovesciare, Irritare: verificare i nomi sul PHB 2024 italiano).
- Editor delle azioni: select della maestria.
- Messaggio di attacco: badge con la maestria e descrizione in tooltip. Graze: se l'attacco manca, proporre il pulsante "Danno Graze" (danno = modificatore della caratteristica; non è derivabile in modo affidabile, quindi far inserire il valore una volta nell'editor come `masteryValue?`). Topple: mostrare la CD (8 + mod + competenza) se presente.
- Import: Roll20 se espone il campo (verificare un export reale in `importer.test.ts`); 5e.tools, per gli oggetti, ha `mastery` sugli item, da usare solo se importiamo armi.

**Aggiunte (da TE-53…56).**
- Oggi la maestria è solo testo in proprietà e descrizione delle armi importate: applicarne l'effetto all'azione dell'arma.
- Scegliere quali maestrie ha il personaggio (privilegio Weapon Mastery) e usarle solo per quelle armi.
- Armi magiche senza campo `mastery` in 5e.tools: prendere la maestria dall'arma di base (`baseItem`).
- Testo della regola in italiano.

**Accettazione.** Un'arma con Rovesciare mostra il badge e la CD nel messaggio di attacco; la TavernPack conserva il campo.

**Test.** Round trip di `parseCharacterSheet` con `mastery`; uiSmoke facoltativo.

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
priority: critical
status: todo
order: 50
---

**Contesto.** Il livello si cambia a mano nella tab Modifica (classi in `ClassOptions`). Esiste già: con il calcolo automatico dei livelli (`options.autoLevel`) `applyClassChanges` in `src/classSync.ts` aggiorna livello, dadi vita (anche per classe), slot (`src/classes.ts`: completo, mezzo, terzo, patto, multiclasse), TS e caratteristica da incantatore; il bonus di competenza segue il livello (`options.proficiency: "level"` + `effectiveSheet`). Manca un flusso guidato: PF, privilegi, sottoclasse, aumenti di caratteristica e incantesimi nuovi. La creazione guidata (`CharacterWizard`, `buildCharacter`, dati 5e.tools XPHB in `fivetoolsCharacter.ts`) copre solo il livello 1.

**Da fare.**
- Pulsante "Sali di livello" sulla scheda (solo se modificabile) che apre un popup a passi:
  1. Classe che sale: una di quelle della scheda o una nuova (multiclasse).
  2. PF: "Valore fisso" (media del dado + 1 + mod COS, default) oppure "Tira" (`1d{die}` + COS, minimo 1). Aggiorna `hp.max` e `hp.current` dello stesso valore.
  3. Privilegi del nuovo livello dai dati 5e.tools (`classFeature`), aggiunti ai Tratti.
  4. Sottoclasse al livello in cui la classe la sceglie (3 nel PHB 2024), con i suoi privilegi.
  5. Aumento dei punteggi (+2 / +1 +1, massimo 20) oppure talento, ai livelli previsti.
  6. Trucchetti e incantesimi nuovi secondo `cantripProgression` / `preparedSpellsProgression`.
- Ricalcolo dei bonus legati al livello lasciati dalla creazione guidata (shortcut in `buildCharacter.ts`: Tough +2 PF per livello, Alert = bonus di competenza, Dwarven Toughness +1 PF per livello).
- Anteprima delle differenze (prima → dopo) e conferma. Messaggio in chat "X sale al livello N".
- Ogni privilegio di classi, sottoclassi, talenti, specie e background diventa quello che dice `docs/classificazione-privilegi-phb2024.md` (classificazione da 5e.tools XPHB). Le scelte secondarie (Stile di combattimento, Suppliche, manovre, metamagie) si fanno nel popup.

**Piano (2026-11-21).** Step verificabili, ognuno un ticket figlio: TE-91 (Tough/Alert col livello), TE-92 … TE-96 (campi che mancano nel modello), TE-97 (motore e popup), TE-98 … TE-109 (privilegi, una classe per ticket), TE-110 (talenti), TE-111 (specie e background), TE-112 (creazione guidata), TE-113 (annullare, facoltativo).

**Accettazione.** Mago 4 → 5 con COS +2, valore fisso: +6 PF, competenza +3, slot 4/3/2, trucchetto in più; Guerriero 3 sceglie la sottoclasse; con Tough i PF crescono di 2 per livello; riposo e TavernPack coerenti.

**Test.** Funzione pura `levelUp(sheet, choices, options)` (PF, privilegi, sottoclasse, aumenti, incantesimi, Tough/Alert) e test UI del popup.

## TE-34 · Step 1: Tough, Dwarven Toughness e Alert col livello

---
id: TE-91
type: bug
priority: high
status: done
order: 51
---

Figlio di TE-34. Sostituisce lo shortcut di `TRAIT_MODIFIERS` in `src/buildCharacter.ts`.
- `StatModifier.scale: "level"`: `amount` × livello totale del personaggio (vedi "Cosa manca nel modello", punto 9, in `docs/classificazione-privilegi-phb2024.md`).
- Tough: `hpMax 2 scale level`. Dwarven Toughness: `hpMax 1 scale level`. Alert: `initiative +0` con `proficient`.
- Le schede già create restano come sono (deciso il 2026-11-21: nessun PG della campagna è stato creato con la creazione guidata). I valori nuovi valgono per i personaggi creati da ora in poi.

**Verifica (utente).** Un PG di livello 5 con Tough ha 10 PF in più; con Alert l'iniziativa ha +3; un nano di livello 5 ha 5 PF in più.

**Test.** `effects.test.ts`: `scale: "level"` ai livelli 1, 5 e 20.

## TE-34 · Step 2a: modificatori condizionali sull'armatura (senza armatura, senza scudo…)

---
id: TE-92
type: feature
priority: high
status: done
order: 52
---

Figlio di TE-34. Punto 1 di "Cosa manca nel modello" in `docs/classificazione-privilegi-phb2024.md`.
- Condizione sul modificatore (`when?: "noArmor" | "noHeavyArmor" | "noArmorNoShield" | …`), letta dove si calcolano CA, velocità, attacco e danno.
- Casi: Unarmored Defense (Barbaro, Monaco), Draconic Resilience, Dance Bard, Fast Movement, Unarmored Movement, Roving, stile Defense.
- Condizioni sulle armi (Archery, Dueling, Thrown Weapon Fighting): spostate in TE-114, con il Guerriero (deciso il 2026-11-21).

**Verifica (utente).** Monaco con Unarmored Defense: equipaggiando un'armatura la CA passa al calcolo dell'armatura; togliendola torna 10 + DES + SAG.

**Test.** Un caso per ogni condizione.

## TE-34 · Step 2b: resistenze, immunità, sensi e velocità speciali del PG

---
id: TE-93
type: feature
priority: high
status: done
order: 53
---

Figlio di TE-34. Punti 2 e 3 di "Cosa manca nel modello" in `docs/classificazione-privilegi-phb2024.md`.
- Campi testo nella scheda (come `resistances` / `senses` dei mostri) e velocità aggiuntive (scalare, nuotare, volare). Popup di modifica e tasto chat come le altre sezioni (`docs/ui-rules.md`).
- Usati da classi (Ira, auree, Mente protetta…), specie (Aasimar, Dragonborn, Dwarf, Tiefling, scurovisione) e talenti (Athlete, Skulker, Energy Resistance).

**Verifica (utente).** I campi si vedono nella scheda, si modificano in un popup e si mandano in chat.

**Test.** Test UI del popup.

## TE-34 · Step 2c: risorse con recupero parziale al riposo breve

---
id: TE-94
type: feature
priority: high
status: done
order: 54
---

Figlio di TE-34. Punto 4 di "Cosa manca nel modello" in `docs/classificazione-privilegi-phb2024.md`.
- `CounterRecovery`: modo "1 al riposo breve, tutti al lungo" (Ira, Incanalare divinità, Forma selvatica, Recuperare energie, dadi psionici).
- `src/rest.ts` lo applica.

**Verifica (utente).** Ira a 0/3, riposo breve → 1/3; riposo lungo → 3/3.

**Test.** `rest`: breve e lungo con il nuovo modo.

## TE-34 · Step 2d: vantaggio ai TS contro morte, concentrazione e condizioni

---
id: TE-95
type: feature
priority: medium
status: done
order: 55
---

Figlio di TE-34. Punti 5 e 11 di "Cosa manca nel modello" in `docs/classificazione-privilegi-phb2024.md`.
- Nuovi target `adv:`: TS contro la morte (Durable, Diamond Soul…), concentrazione (War Caster, Mente arcana…), contro una condizione (Dwarf, Elf, Halfling, Mindless Rage…). Il vantaggio contro una condizione è un suggerimento al tiro, non automatico.
- Vantaggio solo agli attacchi con incantesimi (punto 8), se serve.

**Verifica (utente).** Con Durable il TS contro la morte si tira con vantaggio; con War Caster il TS di concentrazione propone il vantaggio.

**Test.** Un caso per target.

## TE-34 · Step 2e: minimo +1 e massimo dei punteggi

---
id: TE-96
type: feature
priority: medium
status: done
order: 56
---

Figlio di TE-34. Punti 6 e 7 di "Cosa manca nel modello" in `docs/classificazione-privilegi-phb2024.md`. Copre anche TE-71.
- `StatModifier` con minimo (Aura of Protection, Thaumaturge…: mod. caratteristica, minimo +1).
- Massimo del punteggio: 20 per ASI, talenti e background; 25 per Primal Champion e Body and Mind; 30 per i Doni epici.

**Verifica (utente).** FOR 19 + ASI +2 → 20, e il riepilogo dice +1; Aura of Protection con CAR 8 dà +1 ai TS.

**Test.** Limiti 20 / 25 / 30 e minimo +1.

## TE-34 · Step 3: motore del level up e popup con le regole comuni

---
id: TE-97
type: feature
priority: critical
status: done
order: 57
---

Figlio di TE-34. Sezione "Comuni a tutte le classi" di `docs/classificazione-privilegi-phb2024.md`.
- Funzione pura `applyLevel(sheet, classe, livello, scelte)`: ogni voce creata porta l'id del privilegio d'origine, così il livello dopo la aggiorna invece di duplicarla e non tocca ciò che l'utente ha modificato.
- Popup "Sali di livello" (solo chi può modificare la scheda): classe (anche nuova, con i requisiti di TE-84), PF (media o tiro + COS), dado vita, PB, slot, sottoclasse al 3, ASI o talento, riepilogo, conferma. Messaggio in chat "X sale al livello N".
- Sostituisce TE-72, TE-77, TE-83 (popup vecchio, tolto con il revert).
- `DefenseEntry.traitId`, come le risorse: le difese create da un privilegio si aggiornano senza duplicarsi e spariscono col tratto; quelle scritte a mano non si toccano (deciso il 2026-11-21, da TE-93).

**Verifica (utente).** Guerriero 1 → 4: PF, dadi vita, PB, sottoclasse al 3 e ASI al 4 corretti; il riepilogo mostra cosa cambia prima di confermare.

**Test.** `applyLevel` sulle regole comuni; test UI del popup.

**Fatto (2026-11-22).** `src/levelUp.ts` e `src/LevelUpDialog.tsx`.
- Il pulsante "Sali di livello" c'è sempre per chi può modificare la scheda, ed è evidenziato quando bastano i PE (deciso con l'utente).
- L'ASI diventa un tratto con `ability:<a>` e massimo 20. Al 19 c'è anche il Dono epico (+1, massimo 30).
- Il talento per ora è solo un nome scritto a mano. La lista arriva con TE-110 (deciso con l'utente).
- Se l'ASI alza la COS, i PF crescono anche per i livelli passati.
- Senza calcolo automatico dei livelli cambiano solo livello, classi e dadi vita. Slot e TS restano a mano.
- `DefenseEntry.traitId`: eliminando un tratto si eliminano anche le sue difese. Il level up non crea ancora difese: arriveranno con lo step 4.
- Requisiti della multiclasse fatti qui (TE-84).

## TE-34 · Step 4: privilegi del Barbaro

---
id: TE-98
type: feature
priority: high
status: todo
order: 58
---

Figlio di TE-34. Difese temporanee negli effetti (resistenze dell'Ira, Mindless Rage): compaiono in "Difese e sensi" solo con l'effetto acceso (da TE-93). Sezione "Barbaro" di `docs/classificazione-privilegi-phb2024.md`, con le sottoclassi Path of the Berserker, Wild Heart, World Tree, Zealot: ogni privilegio come è classificato (Testo, Modificatore, Effetto, Risorsa, Azione, Competenza, Maestria, Opzione, Incantesimo, Scelta, Scala). I privilegi segnati "Manca" diventano Testo finché non c'è lo step 2 che li copre.
- Personaggio di prova del Barbaro in `src/devSheets.ts` (vedi TE-82).
- Sostituisce, per questa classe, TE-74, TE-81 e TE-85 … TE-90.

**Verifica (utente).** Dal personaggio di prova, livello 1 → 20 per ogni sottoclasse, confrontando la scheda con la tabella del documento. Punti principali: Ira 2→6 usi e danni +2/+3/+4; Danger Sense e Feral Instinct come vantaggi; Primal Champion FOR e COS +4 al 20.

**Test.** Copertura: ogni `classFeature` e `subclassFeature` XPHB del Barbaro ha una voce nel catalogo; usi e dadi uguali alle colonne di `classTableGroups` / `subclassTableGroups` per ogni livello.

**Fase 1 fatta (2026-11-22).** Catalogo `src/classFeatures.ts`, applicato da `applyLevel` con il testo da 5e.tools (`loadFeatureTexts`).
- Il Barbaro base ha già: Ira (risorsa ed effetto), Unarmored Defense, Danger Sense, Reckless Attack, Fast Movement, Feral Instinct, Persistent Rage e Primal Champion. Gli altri privilegi sono di solo testo.
- Un tratto con lo stesso nome senza `featureId` (creazione guidata, import) viene adottato invece di duplicarsi.
- Fix in `effects.ts`: i modificatori "+ caratteristica" ora usano il punteggio con i bonus (ASI, Primal Champion).

**Fase 2a fatta (2026-11-22).**
- Le 4 sottoclassi sono nel catalogo, con un test di copertura sui dati veri.
- Azioni dei privilegi (`ActionEntry.featureId`): Brutal Strike 1d10 → 2d10, Frenzy, Divine Fury, Life-Giving Force, Branches of the Tree, Intimidating Presence e Warrior of the Gods, con CD e risorse. Un'azione modificata a mano non viene sovrascritta.
- `CharacterEffect.defenses`: le resistenze dell'Ira, Mindless Rage e Rage of the Gods compaiono in "Difese e sensi" solo con l'effetto acceso.

**Fase 2b (da fare).**
- Scelte nel popup: Primal Knowledge, Weapon Mastery, Rage of the Wilds, Aspect of the Wilds e Power of the Wilds.
- Incantesimi rituali di Animal Speaker e Nature Speaker.
- Personaggio di prova in `src/devSheets.ts`.

## TE-34 · Step 4: modificatori condizionali sulle armi (Archery, Dueling, Thrown Weapon Fighting)

---
id: TE-114
type: feature
priority: high
status: todo
order: 59
---

Figlio di TE-34, da fare insieme a TE-99 (Guerriero). Seguito di TE-92, che copre solo le condizioni sull'armatura.
- Oggi il bonus ad attacco e danno è un unico numero per tutte le azioni (`attackModifier` / `damageModifier` di `EntryList`), e l'azione non sa se l'arma è a distanza, da lancio, a una o due mani.
- Proprietà dell'arma nell'azione (dal tipo d'arma `weapon` o dai dati 5e.tools), nuove condizioni (`ranged`, `thrown`, `meleeOneHanded`) e bonus calcolato azione per azione.
- Archery: `attack +2` solo a distanza. Dueling: `damage +2` in mischia a una mano, senza altre armi. Thrown Weapon Fighting: `damage +2` con le armi da lancio.

**Verifica (utente).** Guerriero con Archery: l'arco lungo ha +2 al tiro per colpire, la spada lunga no. Con Dueling la spada lunga ha +2 ai danni, lo spadone no.

**Test.** Un caso per condizione; azioni importate senza tipo d'arma: nessun bonus condizionale.

## TE-34 · Step 4: privilegi del Guerriero

---
id: TE-99
type: feature
priority: high
status: todo
order: 59
---

Figlio di TE-34. Sezione "Guerriero" di `docs/classificazione-privilegi-phb2024.md`, con le sottoclassi Battle Master, Champion, Eldritch Knight, Psi Warrior: ogni privilegio come è classificato (Testo, Modificatore, Effetto, Risorsa, Azione, Competenza, Maestria, Opzione, Incantesimo, Scelta, Scala). I privilegi segnati "Manca" diventano Testo finché non c'è lo step 2 che li copre.
- Personaggio di prova del Guerriero in `src/devSheets.ts` (vedi TE-82).
- Sostituisce, per questa classe, TE-74, TE-81 e TE-85 … TE-90.

**Verifica (utente).** Dal personaggio di prova, livello 1 → 20 per ogni sottoclasse, confrontando la scheda con la tabella del documento. Punti principali: Second Wind 2→4, Action Surge, Indomitable; Battle Master: manovre 3/5/7/9 e dadi di superiorità; Champion: critico 19 e poi 18.

**Test.** Copertura: ogni `classFeature` e `subclassFeature` XPHB del Guerriero ha una voce nel catalogo; usi e dadi uguali alle colonne di `classTableGroups` / `subclassTableGroups` per ogni livello.

## TE-34 · Step 4: privilegi del Ladro

---
id: TE-100
type: feature
priority: high
status: todo
order: 60
---

Figlio di TE-34. Sezione "Ladro" di `docs/classificazione-privilegi-phb2024.md`, con le sottoclassi Arcane Trickster, Assassin, Soulknife, Thief: ogni privilegio come è classificato (Testo, Modificatore, Effetto, Risorsa, Azione, Competenza, Maestria, Opzione, Incantesimo, Scelta, Scala). I privilegi segnati "Manca" diventano Testo finché non c'è lo step 2 che li copre.
- Personaggio di prova del Ladro in `src/devSheets.ts` (vedi TE-82).
- Sostituisce, per questa classe, TE-74, TE-81 e TE-85 … TE-90.

**Verifica (utente).** Dal personaggio di prova, livello 1 → 20 per ogni sottoclasse, confrontando la scheda con la tabella del documento. Punti principali: Sneak Attack 1d6→10d6, Expertise al 1 e al 6, Reliable Talent al 7; Arcane Trickster: slot da terzo incantatore.

**Test.** Copertura: ogni `classFeature` e `subclassFeature` XPHB del Ladro ha una voce nel catalogo; usi e dadi uguali alle colonne di `classTableGroups` / `subclassTableGroups` per ogni livello.

## TE-34 · Step 4: privilegi del Monaco

---
id: TE-101
type: feature
priority: high
status: todo
order: 61
---

Figlio di TE-34. Sezione "Monaco" di `docs/classificazione-privilegi-phb2024.md`, con le sottoclassi Warrior of Mercy, Shadow, Elements, Open Hand: ogni privilegio come è classificato (Testo, Modificatore, Effetto, Risorsa, Azione, Competenza, Maestria, Opzione, Incantesimo, Scelta, Scala). I privilegi segnati "Manca" diventano Testo finché non c'è lo step 2 che li copre.
- Personaggio di prova del Monaco in `src/devSheets.ts` (vedi TE-82).
- Sostituisce, per questa classe, TE-74, TE-81 e TE-85 … TE-90.

**Verifica (utente).** Dal personaggio di prova, livello 1 → 20 per ogni sottoclasse, confrontando la scheda con la tabella del documento. Punti principali: Focus = livello, Martial Arts 1d6→1d12, Unarmored Movement +3→+9 m, Diamond Soul.

**Test.** Copertura: ogni `classFeature` e `subclassFeature` XPHB del Monaco ha una voce nel catalogo; usi e dadi uguali alle colonne di `classTableGroups` / `subclassTableGroups` per ogni livello.

## TE-34 · Step 4: privilegi del Paladino

---
id: TE-102
type: feature
priority: high
status: todo
order: 62
---

Figlio di TE-34. Sezione "Paladino" di `docs/classificazione-privilegi-phb2024.md`, con le sottoclassi Devotion, Glory, Ancients, Vengeance: ogni privilegio come è classificato (Testo, Modificatore, Effetto, Risorsa, Azione, Competenza, Maestria, Opzione, Incantesimo, Scelta, Scala). I privilegi segnati "Manca" diventano Testo finché non c'è lo step 2 che li copre.
- Personaggio di prova del Paladino in `src/devSheets.ts` (vedi TE-82).
- Sostituisce, per questa classe, TE-74, TE-81 e TE-85 … TE-90.

**Verifica (utente).** Dal personaggio di prova, livello 1 → 20 per ogni sottoclasse, confrontando la scheda con la tabella del documento. Punti principali: Lay on Hands = 5 × livello, Channel Divinity, Aura of Protection (minimo +1), incantesimi del giuramento.

**Test.** Copertura: ogni `classFeature` e `subclassFeature` XPHB del Paladino ha una voce nel catalogo; usi e dadi uguali alle colonne di `classTableGroups` / `subclassTableGroups` per ogni livello.

## TE-34 · Step 4: privilegi del Ranger

---
id: TE-103
type: feature
priority: high
status: todo
order: 63
---

Figlio di TE-34. Sezione "Ranger" di `docs/classificazione-privilegi-phb2024.md`, con le sottoclassi Beast Master, Fey Wanderer, Gloom Stalker, Hunter: ogni privilegio come è classificato (Testo, Modificatore, Effetto, Risorsa, Azione, Competenza, Maestria, Opzione, Incantesimo, Scelta, Scala). I privilegi segnati "Manca" diventano Testo finché non c'è lo step 2 che li copre.
- Personaggio di prova del Ranger in `src/devSheets.ts` (vedi TE-82).
- Sostituisce, per questa classe, TE-74, TE-81 e TE-85 … TE-90.

**Verifica (utente).** Dal personaggio di prova, livello 1 → 20 per ogni sottoclasse, confrontando la scheda con la tabella del documento. Punti principali: Favored Enemy (Hunter's Mark gratis) 2→6, Expertise, Primal Companion con le statistiche.

**Test.** Copertura: ogni `classFeature` e `subclassFeature` XPHB del Ranger ha una voce nel catalogo; usi e dadi uguali alle colonne di `classTableGroups` / `subclassTableGroups` per ogni livello.

## TE-34 · Step 4: privilegi del Bardo

---
id: TE-104
type: feature
priority: high
status: todo
order: 64
---

Figlio di TE-34. Sezione "Bardo" di `docs/classificazione-privilegi-phb2024.md`, con le sottoclassi Dance, Glamour, Lore, Valor: ogni privilegio come è classificato (Testo, Modificatore, Effetto, Risorsa, Azione, Competenza, Maestria, Opzione, Incantesimo, Scelta, Scala). I privilegi segnati "Manca" diventano Testo finché non c'è lo step 2 che li copre.
- Personaggio di prova del Bardo in `src/devSheets.ts` (vedi TE-82).
- Sostituisce, per questa classe, TE-74, TE-81 e TE-85 … TE-90.

**Verifica (utente).** Dal personaggio di prova, livello 1 → 20 per ogni sottoclasse, confrontando la scheda con la tabella del documento. Punti principali: Bardic Inspiration = CAR, d6→d12, Jack of All Trades, Expertise, Magical Secrets.

**Test.** Copertura: ogni `classFeature` e `subclassFeature` XPHB del Bardo ha una voce nel catalogo; usi e dadi uguali alle colonne di `classTableGroups` / `subclassTableGroups` per ogni livello.

## TE-34 · Step 4: privilegi del Chierico

---
id: TE-105
type: feature
priority: high
status: todo
order: 65
---

Figlio di TE-34. Sezione "Chierico" di `docs/classificazione-privilegi-phb2024.md`, con le sottoclassi Life, Light, Trickery, War: ogni privilegio come è classificato (Testo, Modificatore, Effetto, Risorsa, Azione, Competenza, Maestria, Opzione, Incantesimo, Scelta, Scala). I privilegi segnati "Manca" diventano Testo finché non c'è lo step 2 che li copre.
- Personaggio di prova del Chierico in `src/devSheets.ts` (vedi TE-82).
- Sostituisce, per questa classe, TE-74, TE-81 e TE-85 … TE-90.

**Verifica (utente).** Dal personaggio di prova, livello 1 → 20 per ogni sottoclasse, confrontando la scheda con la tabella del documento. Punti principali: Channel Divinity 2→4, Divine Order, Blessed Strikes, incantesimi di dominio sempre preparati.

**Test.** Copertura: ogni `classFeature` e `subclassFeature` XPHB del Chierico ha una voce nel catalogo; usi e dadi uguali alle colonne di `classTableGroups` / `subclassTableGroups` per ogni livello.

## TE-34 · Step 4: privilegi del Druido

---
id: TE-106
type: feature
priority: high
status: todo
order: 66
---

Figlio di TE-34. Sezione "Druido" di `docs/classificazione-privilegi-phb2024.md`, con le sottoclassi Land, Moon, Sea, Stars: ogni privilegio come è classificato (Testo, Modificatore, Effetto, Risorsa, Azione, Competenza, Maestria, Opzione, Incantesimo, Scelta, Scala). I privilegi segnati "Manca" diventano Testo finché non c'è lo step 2 che li copre.
- Personaggio di prova del Druido in `src/devSheets.ts` (vedi TE-82).
- Sostituisce, per questa classe, TE-74, TE-81 e TE-85 … TE-90.

**Verifica (utente).** Dal personaggio di prova, livello 1 → 20 per ogni sottoclasse, confrontando la scheda con la tabella del documento. Punti principali: Wild Shape 2→4, Primal Order, Elemental Fury, incantesimi del circolo.

**Test.** Copertura: ogni `classFeature` e `subclassFeature` XPHB del Druido ha una voce nel catalogo; usi e dadi uguali alle colonne di `classTableGroups` / `subclassTableGroups` per ogni livello.

## TE-34 · Step 4: privilegi del Stregone

---
id: TE-107
type: feature
priority: high
status: todo
order: 67
---

Figlio di TE-34. Sezione "Stregone" di `docs/classificazione-privilegi-phb2024.md`, con le sottoclassi Aberrant, Clockwork, Draconic, Wild Magic: ogni privilegio come è classificato (Testo, Modificatore, Effetto, Risorsa, Azione, Competenza, Maestria, Opzione, Incantesimo, Scelta, Scala). I privilegi segnati "Manca" diventano Testo finché non c'è lo step 2 che li copre.
- Personaggio di prova del Stregone in `src/devSheets.ts` (vedi TE-82).
- Sostituisce, per questa classe, TE-74, TE-81 e TE-85 … TE-90.

**Verifica (utente).** Dal personaggio di prova, livello 1 → 20 per ogni sottoclasse, confrontando la scheda con la tabella del documento. Punti principali: Sorcery Points = livello, metamagie 2/4/6, Innate Sorcery, incantesimi di sottoclasse.

**Test.** Copertura: ogni `classFeature` e `subclassFeature` XPHB del Stregone ha una voce nel catalogo; usi e dadi uguali alle colonne di `classTableGroups` / `subclassTableGroups` per ogni livello.

## TE-34 · Step 4: privilegi del Warlock

---
id: TE-108
type: feature
priority: high
status: todo
order: 68
---

Figlio di TE-34. Sezione "Warlock" di `docs/classificazione-privilegi-phb2024.md`, con le sottoclassi Archfey, Celestial, Fiend, Great Old One: ogni privilegio come è classificato (Testo, Modificatore, Effetto, Risorsa, Azione, Competenza, Maestria, Opzione, Incantesimo, Scelta, Scala). I privilegi segnati "Manca" diventano Testo finché non c'è lo step 2 che li copre.
- Personaggio di prova del Warlock in `src/devSheets.ts` (vedi TE-82).
- Sostituisce, per questa classe, TE-74, TE-81 e TE-85 … TE-90.

**Verifica (utente).** Dal personaggio di prova, livello 1 → 20 per ogni sottoclasse, confrontando la scheda con la tabella del documento. Punti principali: Pact Magic, invocazioni 1→10 con prerequisiti, Mystic Arcanum 11/13/15/17, Magical Cunning.

**Test.** Copertura: ogni `classFeature` e `subclassFeature` XPHB del Warlock ha una voce nel catalogo; usi e dadi uguali alle colonne di `classTableGroups` / `subclassTableGroups` per ogni livello.

## TE-34 · Step 4: privilegi del Mago

---
id: TE-109
type: feature
priority: high
status: todo
order: 69
---

Figlio di TE-34. Sezione "Mago" di `docs/classificazione-privilegi-phb2024.md`, con le sottoclassi Abjurer, Diviner, Evoker, Illusionist: ogni privilegio come è classificato (Testo, Modificatore, Effetto, Risorsa, Azione, Competenza, Maestria, Opzione, Incantesimo, Scelta, Scala). I privilegi segnati "Manca" diventano Testo finché non c'è lo step 2 che li copre.
- Personaggio di prova del Mago in `src/devSheets.ts` (vedi TE-82).
- Sostituisce, per questa classe, TE-74, TE-81 e TE-85 … TE-90.

**Verifica (utente).** Dal personaggio di prova, livello 1 → 20 per ogni sottoclasse, confrontando la scheda con la tabella del documento. Punti principali: Arcane Recovery, libro degli incantesimi, Scholar, Spell Mastery, Signature Spells.

**Test.** Copertura: ogni `classFeature` e `subclassFeature` XPHB del Mago ha una voce nel catalogo; usi e dadi uguali alle colonne di `classTableGroups` / `subclassTableGroups` per ogni livello.

## TE-34 · Step 5: talenti nel level up

---
id: TE-110
type: feature
priority: high
status: todo
order: 70
---

Figlio di TE-34. Sezione "Talenti" di `docs/classificazione-privilegi-phb2024.md`: 10 delle origini, 43 generali, Doni epici al 19.
- Lista dei talenti con prerequisiti controllati (livello 4, caratteristica 13, competenza nelle armature, incantatore); +1 alla caratteristica scelta (massimo 20).
- Incantesimi dei talenti sempre preparati, con le risorse "gratis 1/LR" (Fey-Touched, Shadow-Touched, Magic Initiate, Telepathic, Ritual Caster, Telekinetic).

**Verifica (utente).** Fey-Touched: Misty Step e l'incantesimo scelto sono preparati, con due risorse 1/LR; senza FOR 13 Great Weapon Master non è proposto; Skill Expert dà competenza e Maestria.

**Test.** Un caso per tipo di talento (modificatore, competenza, incantesimo, risorsa, scelta).

## TE-34 · Step 6: specie e background al level up

---
id: TE-111
type: feature
priority: high
status: todo
order: 71
---

Figlio di TE-34. Sezioni "Specie", "Background" e "Cosa cambia al level up oltre alla classe" di `docs/classificazione-privilegi-phb2024.md`.
- Al livello totale 3 e 5: incantesimi di Elf, Tiefling, Celestial Revelation, Draconic Flight, Large Form. Al 5, 11, 17: Breath Weapon. All'aumento del PB: risorse con usi = PB (Lucky, Breath Weapon, Stonecunning, Giant Ancestry, Adrenaline Rush…).
- Vale anche quando il livello si prende in un'altra classe.

**Verifica (utente).** Tiefling infernale 2 → 3: Hellish Rebuke preparato con 1 uso per LR; Dragonborn 4 → 5: Breath Weapon 2d10, usi 3, Draconic Flight.

**Test.** Livelli 3, 5, 9, 11, 17 per le specie con scale.

## TE-34 · Step 7: la creazione guidata usa il motore del level up

---
id: TE-112
type: feature
priority: medium
status: todo
order: 72
---

Figlio di TE-34. La creazione guidata a livello N = creazione del livello 1 + N−1 volte `applyLevel` con le scelte del wizard. Sostituisce TE-80.

**Verifica (utente).** Un Mago creato al livello 5 è uguale a un Mago creato al livello 1 e portato al 5 con le stesse scelte.

**Test.** Confronto delle due schede.

## TE-34 · Step 8: annullare l'ultimo level up

---
id: TE-113
type: feature
priority: low
status: todo
order: 73
---

Figlio di TE-34. Facoltativo: da fare solo se l'utente lo chiede. Copia della scheda salvata prima della conferma; "Annulla level up" la ripristina.

**Verifica (utente).** Guerriero 4 → 5 e poi annulla: la scheda torna identica al livello 4.

## TE-34 · Step 9: privilegi delle sottoclassi di Xanathar e Tasha

---
id: TE-115
type: feature
priority: low
status: todo
order: 74
---

Figlio di TE-34, da fare dopo tutte le sottoclassi del PHB 2024 (TE-98 … TE-109). Il popup "Sali di livello" propone già le sottoclassi di Xanathar e Tasha (`SUBCLASSES_XANATHAR`, `SUBCLASSES_TASHA`), ma i loro privilegi vanno aggiunti a mano: il popup lo dice quando se ne sceglie una (deciso con l'utente il 2026-11-22).
- Classificare i loro privilegi come quelli del PHB 2024 in `docs/classificazione-privilegi-phb2024.md`, con le regole 2024 (sottoclasse al 3).
- Il level up li aggiunge come per le sottoclassi del PHB 2024; poi si toglie l'avviso nel popup.

**Verifica (utente).** Una sottoclasse per manuale, dal livello 3 al 20, confrontando la scheda con il manuale.

**Test.** Copertura come negli step 4: ogni `subclassFeature` XGE e TCE delle sottoclassi in elenco ha una voce nel catalogo.

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
status: done
order: 4100
---

**Contesto.** L'import Roll20 (`importRoll20`) legge solo alcuni campi di `normalized` e `raw`; quello che non riconosce si perde senza avviso (es. risorse di classe, campi di opzioni non gestiti, testo non riconosciuto nei modificatori degli oggetti). Le note d'importazione oggi coprono solo pochi casi.

**Da fare.**
- Confrontare l'export con ciò che è stato importato e raccogliere le parti mancanti o non riconosciute (sezioni di `normalized` ignorate, attributi `raw` con valori non predefiniti, modificatori e proprietà non interpretati).
- Mostrarle nel popup "Note d'importazione" al momento dell'import, raggruppate per sezione, e salvarle nelle note della scheda (tab Modifica).
- Distinguere "non importato" da "importato con approssimazione".

**Accettazione.** Importando un personaggio con dati non gestiti, il popup elenca cosa manca; un personaggio senza dati extra non mostra avvisi nuovi.

## Aggiungere le icone mancanti

---
id: TE-50
type: feature
priority: medium
status: done
order: 4200
---

Aggiungere le icone mancanti in `public/icons` (e in `public/icons/icons.json`): elenco in `docs/icon-gaps.md`. Aggiunte tutte le 446 dell'elenco.

## Crediti delle icone visibili nell'app

---
id: TE-52
type: feature
priority: medium
status: done
order: 4400
---

Crediti delle icone (CC BY 3.0, `public/icons/CREDITS.md`) visibili nell'app: in fondo alla tab Libreria.

## Spendere e guadagnare monete

---
id: TE-57
type: feature
priority: medium
status: done
order: 4900
---

Funzione per spendere e guadagnare le monete, con messaggio in chat (Zaino → "Spendi monete" / "Guadagna monete").

## Iniziativa del PG nel turn order

---
id: TE-58
type: bug
priority: medium
status: done
order: 5000
---

Quando un PG clicca Iniziativa deve comparire nel turn order: oggi non compare.

## Tiri salvezza contro morte impostabili a mano

---
id: TE-59
type: feature
priority: medium
status: done
order: 5100
---

Pallini verdi/rossi (tiri salvezza contro morte) impostabili a mano; al tiro, in chat anche il resoconto dei pallini attuali.

## Parla come

---
id: TE-60
type: feature
priority: medium
status: done
order: 5200
---

Scegliere per chi si sta parlando (come "Parla come" di Roll20): menu "Parla come" nella chat.

## Oggetti mancanti nel catalogo

---
id: TE-61
type: bug
priority: medium
status: done
order: 5300
---

Alcuni oggetti non compaiono, es. Arcane Focus.

## Armi in mano principale e seconda mano

---
id: TE-63
type: feature
priority: medium
status: done
order: 5500
---

Armi: "mano principale" / "seconda mano", per calcolare il bonus in modo diverso.

## Incantesimi di altri manuali nel catalogo 5e.tools

---
id: TE-64
type: feature
priority: medium
status: done
order: 5600
---

**Contesto.** Il catalogo incantesimi (`loadSpells` in `src/fivetoolsApi.ts`, usato da "Importa da 5e.tools" nella tab Magia e dagli incantesimi dei mostri in `importMonsters`) carica solo `spells/spells-xphb.json`, e `parseSpells` tiene solo `source === "XPHB"`. Mancano quindi gli incantesimi degli altri manuali, es. Booming Blade (TCE). Mind Sliver e Thunderclap invece ci sono: non comparivano perché la scheda li aveva già (ora restano in elenco con "già nella scheda" e un avviso).

**Da fare.**
- Scegliere i manuali da aggiungere: elenco in `spells/index.json` (XGE, TCE, FTD, SatO, …; PHB 2014 escluso o in coda, perché il 2024 lo ristampa).
- `loadSpells`: scaricare anche quei file; per gli incantesimi presenti in più manuali tenere la versione 2024 (come gli oggetti: "edizione 2024, poi 2014").
- Classi da `gendata-spell-source-lookup.json` anche per le altre sorgenti (`class` e `classVariant` di ogni manuale), così il filtro `classes.length` non li scarta.
- Nel dettaglio della riga del catalogo mostrare la sorgente (es. "TCE").
- La creazione guidata (`loadCharacterOptions`) resta solo PHB 2024.

**Accettazione.** Booming Blade si importa dal catalogo della tab Magia con la sorgente TCE; Fireball compare una volta sola, nella versione 2024; un mostro con Booming Blade non dà più l'avviso "Incantesimi non trovati".

## Nome dei token che inizia con "Beast"

---
id: TE-65
type: bug
priority: medium
status: done
order: 5700
---

Caricando i token il nome inizia con "Beast": capire perché e toglierlo.


## [ponytail] Extra Attack: frecce rimaste sbagliate nella card

---
id: TE-67
type: bug
priority: high
status: done
order: 5800
---

**Chiuso (2026-11-21).** Il codice (`attackAll`, tasto ×2/×N) è stato tolto con il revert 32d7575: non esiste più.

Da audit ponytail (2026-11-20), punto 1. Il tasto ×2/×N (`attackAll` in `EntryList`, `src/App.tsx`) chiama `run` più volte, ma `left` (risorsa collegata, es. frecce) è letto una volta prima dei tiri: con 40 frecce entrambe le card dicono "Frecce −1 (39/40)" mentre il contatore scende a 38; con 1 freccia il secondo attacco non mostra "esaurite".

**Fix.** Passare a `run` quante unità hanno già usato gli attacchi precedenti e usare `left - già usate` per sottotitolo, spesa e avviso.

**Accettazione.** Shortbow ×2 con 40 frecce: card "39/40" e "38/40"; con 1 freccia la seconda card ha l'avviso "esaurite" e il contatore resta a 0.

## [ponytail] L'Ira accesa dai Turni non consuma l'uso

---
id: TE-68
type: bug
priority: high
status: done
order: 5900
---

**Chiuso (2026-11-21).** Il codice (`spendRage` in `EffectsEditor`) è stato tolto con il revert 32d7575: non esiste più. L'Ira come risorsa torna con TE-98 (Barbaro).

Da audit ponytail (2026-11-20), punto 2. L'uso dell'Ira si scala solo in `EffectsEditor` (`change`, `src/EffectsEditor.tsx`); accendendo l'Ira di un PG dalla sua riga nella tab Turni (`src/TurnOrder.tsx`) l'effetto si attiva ma il contatore (es. "Ira (scala)") non scende.

**Fix.** Spostare il controllo "Ira appena accesa → `spendRage`" nel punto unico in cui si salvano gli effetti di un PG (usato sia dalla scheda sia dai Turni) e toglierlo da `EffectsEditor`; l'avviso "Nessun uso dell'Ira rimasto" deve comparire in entrambi i casi.

**Accettazione.** Accendere l'Ira dalla scheda o dai Turni scala un uso; a 0 usi compare l'avviso.

## [ponytail] Import Roll20 senza base_level: classe a livello 0

---
id: TE-69
type: bug
priority: high
status: todo
order: 6000
---

**Rimandato (2026-11-21).** Per scelta dell'utente gli import da Roll20 non si correggono per ora; il level up (TE-97) non ne dipende.

Da audit ponytail (2026-11-20), punto 3. In `src/importer.ts` (~riga 73) `num(attr("base_level"), level)` restituisce 0 quando l'attributo manca, perché `Number("")` è 0: la classe principale diventa "Fighter 0" e il level up mostra "Fighter 0 → 1" con dadi vita e slot calcolati da 0.

**Fix.** `num(attr("base_level") || level, level)`, solo lì.

**Accettazione.** Import di una scheda senza `base_level`: la classe ha il livello del personaggio; il level up mostra "Fighter N → N+1".

## [ponytail] Un solo modo per leggere il livello di una classe

---
id: TE-70
type: tech
priority: medium
status: done
order: 6100
---

**Chiuso (2026-11-21).** Riguardava il level up tolto con il revert 32d7575. Sostituito da TE-97.

Da audit ponytail (2026-11-20), punto 4. Tre versioni dello stesso calcolo: `classLevel` in `src/classResources.ts`, il livello da ladro in `sneakAttackDice` (`src/classAttacks.ts`) e `rageDamage` in `src/effects.ts` (che usa `/barbar/i` invece del nome esatto). Una classe salvata come "Barbaro" avrebbe danni dell'Ira scalati ma nessun contatore degli usi.

**Fix.** Esportare `classLevel` da `classResources.ts` e usarlo negli altri due punti (−2 funzioni).

**Accettazione.** I test di Ira, Attacco furtivo e risorse passano con un solo helper.

## [ponytail] Riepilogo level up: +2 oltre il 20

---
id: TE-71
type: bug
priority: medium
status: done
order: 6200
---

**Chiuso (2026-11-21).** Riguardava il level up tolto con il revert 32d7575. Sostituito da TE-96.

Da audit ponytail (2026-11-20), punto 5. Con Forza 19 e "+2 a una caratteristica" il riepilogo di `src/LevelUpDialog.tsx` dice "Forza +2" ma `applyLevelUp` applica +1 (massimo 20).

**Fix.** Nel riepilogo calcolare l'aumento con lo stesso limite a 20.

**Accettazione.** Forza 19 con +2: il riepilogo dice "Forza +1" (19 → 20).

## [ponytail] Level up: niente simulazione completa a ogni render

---
id: TE-72
type: tech
priority: low
status: done
order: 6300
---

**Chiuso (2026-11-21).** Riguardava il level up tolto con il revert 32d7575. Sostituito da TE-97.

Da audit ponytail (2026-11-20), punto 6. `maxSpellLevel` in `src/LevelUpDialog.tsx` chiama `applyLevelUp` (copia della scheda, classi, risorse) a ogni render, anche a ogni lettera della ricerca incantesimi.

**Fix.** Calcolare gli slot solo dalle classi dopo il level up (`classSlotTotals`) senza copiare la scheda, oppure `useMemo` sulle scelte che lo cambiano.

**Accettazione.** Stesso limite di livello degli incantesimi; nessuna copia della scheda mentre si scrive nella ricerca.

## Classi PHB 2024, fase 1: dati 5e.tools in locale

---
id: TE-73
type: tech
priority: high
status: done
order: 6400
---

Piano di test delle classi (2026-11-21): si parte dalle 12 classi e 48 sottoclassi del PHB 2024 (XPHB). Le altre sottoclassi restano "solo testo".

Script (es. `npm run data:5etools`) che scarica da 5etools-src, a un commit fissato nello script, i file che usa l'app: `class/class-*.json`, `feats.json`, gli incantesimi, `backgrounds.json`, `races.json`. Cartella locale ignorata da git (es. `test-data/5etools/`), non nel repo. I test che li usano si saltano con un messaggio chiaro se la cartella manca.

**Accettazione.** Dopo lo script i test di parsing girano sui file veri senza rete; senza la cartella `vitest` passa e segnala i test saltati.

## Classi PHB 2024, fase 2: tabella di copertura dei privilegi

---
id: TE-74
type: tech
priority: high
status: done
order: 6500
---

**Chiuso (2026-11-21).** Riguardava il level up tolto con il revert 32d7575. Sostituito da TE-98 … TE-109.

Dipende da TE-73. Script che, per ogni classe e sottoclasse XPHB e per ogni livello 1-20, elenca i privilegi e assegna un tipo: solo testo, opzione della scheda (`featureOptions` in `src/levelUp.ts`), risorsa (`src/classResources.ts`), modificatore (`TRAIT_MODIFIERS`), scelta gestita (Maestria, sottoclasse, aumento caratteristiche, incantesimi). Un privilegio non gestito con "choose" / "of your choice" nel testo è "scelta mancante". Risultato in `docs/copertura-classi.md`, rigenerabile.

**Accettazione.** La tabella copre le 48 sottoclassi e riporta il numero di scelte mancanti raggruppate per tipo (abilità, incantesimi extra, stile di combattimento, invocazioni, metamagia, manovre…).

**Annullato (2026-11-21).** Il lavoro è stato tolto con il revert della salita di livello (f4ddef6, 43c0cd0) per ripensarla da capo: da rifare sul nuovo level up. Il codice vecchio resta leggibile in 43c0cd0.

## Classi PHB 2024, fase 3: test 1→20 per ogni classe e sottoclasse

---
id: TE-75
type: tech
priority: high
status: done
order: 6600
---

**Chiuso (2026-11-21).** Riguardava il level up tolto con il revert 32d7575. Sostituito da TE-98 … TE-109.

Dipende da TE-73. Un file di test generato (`it.each`) che porta ogni classe+sottoclasse XPHB dal 1° al 20° con `applyLevelUp` e scelte di default, e a ogni livello controlla: PF, dadi vita, bonus di competenza; slot, trucchetti e incantesimi preparati contro la tabella della classe in 5e.tools; risorse attese con i numeri giusti; tratti con source type `Classe N` e senza doppioni; privilegi della sottoclasse dalla versione XPHB; incantesimi solo da manuali ammessi. Si salta senza dati (TE-73).

**Accettazione.** Il test gira su tutte le 48 sottoclassi; ogni fallimento diventa un bug collegato (TE-76…TE-80 o nuovi).

**Fatto (2026-11-21).** `src/classProgression.test.ts`. Ha trovato: sottoclassi 2014 al posto delle 2024 in 23 sottoclassi su 48 (TE-76), slot di Eldritch Knight e Arcane Trickster arrotondati per difetto (`casterLevel` in `src/classes.ts`, ora per eccesso come nel PHB 2024).

**Annullato (2026-11-21).** Il lavoro è stato tolto con il revert della salita di livello (f4ddef6, 43c0cd0) per ripensarla da capo: da rifare sul nuovo level up. Il codice vecchio resta leggibile in 43c0cd0.

## Level up: sottoclasse presa dalla versione 2014

---
id: TE-76
type: bug
priority: high
status: done
order: 6700
---

**Chiuso (2026-11-21).** Riguardava il level up tolto con il revert 32d7575. Sostituito da TE-97.

Trovato nel test a mano (2026-11-21): Bardo con College of Lore riceve i privilegi 2014 ("Additional Magical Secrets" al 6°, testi "at 3rd level") invece dei 2024 ("Magical Discoveries"). In `parseLevelOptions` (`src/fivetoolsCharacter.ts`) la sottoclasse si cerca solo per nome e il file ha sia la versione PHB sia XPHB.

**Fix.** Preferire la sottoclasse con `source === "XPHB"` quando ci sono più versioni con lo stesso nome.

**Accettazione.** Test: College of Lore al 6° dà "Magical Discoveries".

**Annullato (2026-11-21).** Il lavoro è stato tolto con il revert della salita di livello (f4ddef6, 43c0cd0) per ripensarla da capo: da rifare sul nuovo level up. Il codice vecchio resta leggibile in 43c0cd0.

## Level up: incantesimi di altri manuali nel popup

---
id: TE-77
type: bug
priority: medium
status: done
order: 6800
---

**Chiuso (2026-11-21).** Riguardava il level up tolto con il revert 32d7575. Sostituito da TE-97.

Trovato nel test a mano (2026-11-21): il popup "Sali di livello" propone Silvery Barbs, Distort Value, Antagonize, Wardaway…; la creazione guidata mostra solo il PHB 2024.

**Fix.** Stesso filtro di manuale della creazione guidata nella lista di `src/LevelUpDialog.tsx`.

**Accettazione.** Test: il Bardo che sale al 2° non vede incantesimi non XPHB.

**Annullato (2026-11-21).** Il lavoro è stato tolto con il revert della salita di livello (f4ddef6, 43c0cd0) per ripensarla da capo: da rifare sul nuovo level up. Il codice vecchio resta leggibile in 43c0cd0.

## Level up: incantesimi da scegliere non obbligatori

---
id: TE-78
type: bug
priority: medium
status: done
order: 6900
---

**Chiuso (2026-11-21).** Riguardava il level up tolto con il revert 32d7575. Sostituito da TE-97.

Trovato nel test a mano (2026-11-21): al 5° il Bardo doveva scegliere 2 incantesimi, ne ha scelto 1 e "Conferma" era attivo.

**Fix.** "Conferma" disattivato finché mancano trucchetti o incantesimi, con avviso come per la Maestria (se non ce ne sono abbastanza disponibili, basta sceglierli tutti).

**Accettazione.** Test: con 1 incantesimo su 2 "Conferma" è disattivato e compare l'avviso.

**Annullato (2026-11-21).** Il lavoro è stato tolto con il revert della salita di livello (f4ddef6, 43c0cd0) per ripensarla da capo: da rifare sul nuovo level up. Il codice vecchio resta leggibile in 43c0cd0.

## Jack of All Trades si somma ad Alert sull'iniziativa

---
id: TE-79
type: bug
priority: medium
status: done
order: 7000
---

**Chiuso (2026-11-21).** Riguardava il level up tolto con il revert 32d7575. Sostituito da TE-91.

Trovato nel test a mano (2026-11-21): Bardo 6 con Alert ha iniziativa +7 (DES 3 + competenza 3 + 1). `src/effects.ts:64` aggiunge metà competenza all'iniziativa anche quando c'è già la competenza piena.

**Fix.** Niente metà competenza sull'iniziativa se un modificatore dà la competenza all'iniziativa.

**Accettazione.** Test: Bardo 6 con Alert e DES 16 ha iniziativa +6.

**Annullato (2026-11-21).** Il lavoro è stato tolto con il revert della salita di livello (f4ddef6, 43c0cd0) per ripensarla da capo: da rifare sul nuovo level up. Il codice vecchio resta leggibile in 43c0cd0.

## Creazione guidata: livello nel source type e scelte nei tratti

---
id: TE-80
type: bug
priority: medium
status: done
order: 7100
---

**Chiuso (2026-11-21).** Riguardava il level up tolto con il revert 32d7575. Sostituito da TE-112.

Trovato nel test a mano (2026-11-21): i tratti di classe della creazione guidata hanno source type `Bard`, quelli del level up `Bard 2`. Le scelte fatte nella creazione (es. Skillful → Percezione, Versatile → Alert) non sono nella descrizione del tratto.

**Fix.** Source type `Classe 1` per i privilegi di classe; riga `Scelta: …` in cima alla descrizione come nel level up (`featureChoice` in `src/levelUp.ts`).

**Accettazione.** Test: Umano con Skillful su Percezione → tratto "Skillful" con `Scelta: Percezione`; Bardo creato → "Bardic Inspiration" con source type `Bard 1`.

**Annullato (2026-11-21).** Il lavoro è stato tolto con il revert della salita di livello (f4ddef6, 43c0cd0) per ripensarla da capo: da rifare sul nuovo level up. Il codice vecchio resta leggibile in 43c0cd0.

## Classi PHB 2024, fase 5: scelte mancanti per tipo

---
id: TE-81
type: feature
priority: high
status: done
order: 7200
---

**Chiuso (2026-11-21).** Riguardava il level up tolto con il revert 32d7575. Sostituito da TE-98 … TE-109.

Dipende da TE-74. Per ogni tipo di scelta della tabella di copertura (es. abilità come Bonus Proficiencies, incantesimi da altre liste come Magical Secrets, stile di combattimento, invocazioni, metamagia, manovre, strumenti del talento Musician) un solo componente nel box del privilegio del popup "Sali di livello" (e della creazione guidata se serve), con la scelta scritta nella descrizione del tratto. Un ticket figlio per tipo, partendo da quelli che coprono più privilegi.

**Accettazione.** Ogni tipo ha un test; le "scelte mancanti" in `docs/copertura-classi.md` arrivano a zero per il PHB 2024.

## Classi PHB 2024, fase 6: personaggio di prova in dev e prova a mano per tipo

---
id: TE-82
type: feature
priority: medium
status: todo
order: 7300
---

In sviluppo (`import.meta.env.DEV`, libreria in `src/devSheets.ts`) un tasto "Personaggio di prova" nella Libreria che crea direttamente classe, sottoclasse e livello scelti (applicando i level up con scelte di default), senza la creazione guidata. Poi prova nel browser di un personaggio per ogni tipo di scelta (circa 8-10), con un report breve.

**Accettazione.** Dal tasto si ottiene, per esempio, un Mago 5 pronto in pochi secondi; c'è un report per tipo di scelta.

## Level up e creazione guidata: testi e default

---
id: TE-83
type: bug
priority: low
status: done
order: 7400
---

**Chiuso (2026-11-21).** Riguardava il level up tolto con il revert 32d7575. Sostituito da TE-97.

Trovato nel test a mano (2026-11-21):
- "1 incantesimi" → "1 incantesimo" nel popup "Sali di livello".
- Aumento caratteristiche: default "+2 Forza"; meglio nessuna scelta o la caratteristica principale della classe.
- Creazione guidata: "light", "simple", "30 ft." non tradotti/convertiti in metri; voce generica "Musical Instrument" tra gli strumenti.
- Al livello della sottoclasse "Bard Subclass" e "College of Lore" diventano due tratti di solo testo introduttivo: basta uno con `Scelta: …`.
- Multiclasse: compare "Artificer", che non è nel PHB 2024.

**Accettazione.** I punti sopra non si vedono più nel popup e nella creazione guidata.

## Multiclasse: requisiti di caratteristica

---
id: TE-84
type: feature
priority: low
status: done
order: 7500
---

Il popup "Sali di livello" permette qualsiasi nuova classe. Le regole PHB 2024 chiedono 13 nella caratteristica principale della classe attuale e di quella nuova.

**Fix.** Nel menu della classe, le classi non ammesse sono disattivate con il motivo (es. "serve FOR 13").

**Accettazione.** Test: Bardo con FOR 8 non può prendere Barbarian.

## TE-81 · Risorse di classe mancanti

---
id: TE-85
type: feature
priority: high
status: done
order: 7210
---

**Chiuso (2026-11-21).** Riguardava il level up tolto con il revert 32d7575. Sostituito da TE-98 … TE-109.

Figlio di TE-81. Righe "risorsa mancante?" di `docs/copertura-classi.md` (99, da rivedere: il tipo è indovinato dal testo). Le principali: Channel Divinity, Wild Shape, Second Wind, Action Surge, Indomitable, Monk's Focus, Lay on Hands, Font of Magic (punti stregoneria), Combat Superiority (dadi superiorità), Arcane Recovery, Magical Cunning, Innate Sorcery. Contatori creati e aggiornati col livello come Ira e Ispirazione bardica (`src/classResources.ts`), con usi e recupero dalla tabella della classe.

**Accettazione.** Nel test 1→20 (`src/classProgression.test.ts`) i contatori seguono le colonne della tabella 5e.tools (es. "Channel Divinity", "Wild Shape", "Focus Points", "Sorcery Points"); le righe passano a "risorsa" nella tabella di copertura.

**Fase 1 fatta (2026-11-21).** Risorse con una colonna nella tabella di classe, in `src/classResources.ts`: Incanalare Divinità (Chierico, Paladino), Forma selvatica, Recuperare energie, Punti focus, Punti stregoneria, Nemico prescelto, Energia psionica (Psi Warrior, Soulknife). Il test 1→20 le confronta con le colonne.

**Fase 2 fatta (2026-11-21).** Privilegi con usi scritti nel testo (`FEATURE_USES` in `src/classResources.ts`, 60 privilegi): il contatore nasce quando la scheda ha il tratto con quel nome e segue livello, modificatore e dado (es. Action Surge, Indomitable, Lay on Hands 5 × livello, Combat Superiority con d8/d10/d12, Warding Flare con riposo breve da Improved Warding Flare). I falsi positivi del testo sono in `NOT_RESOURCES` di `src/classCoverage.test.ts`. In `docs/copertura-classi.md` "risorsa mancante?" è a zero.

**Annullato (2026-11-21).** Il lavoro è stato tolto con il revert della salita di livello (f4ddef6, 43c0cd0) per ripensarla da capo: da rifare sul nuovo level up. Il codice vecchio resta leggibile in 43c0cd0.

## TE-81 · Incantesimi di sottoclasse sempre preparati

---
id: TE-86
type: feature
priority: high
status: done
order: 7220
---

**Chiuso (2026-11-21).** Riguardava il level up tolto con il revert 32d7575. Sostituito da TE-98 … TE-109.

Figlio di TE-81. Righe "incantesimi sempre preparati mancanti?" (39): Domain Spells, Oath Spells, Circle of the Land Spells, Psionic/Draconic/Clockwork Spells, Fey Wanderer Spells, incantesimi del patrono… Al livello giusto il level up aggiunge gli incantesimi alla tab Magia, preparati e segnati come sempre preparati (Circle of the Land: con la scelta del terreno nel box del privilegio).

**Accettazione.** Test: Chierico del Dominio della Vita al 3° ha Bless e Cure Wounds sempre preparati.

## TE-81 · Maestria nelle armi e stile di combattimento

---
id: TE-87
type: feature
priority: high
status: done
order: 7230
---

**Chiuso (2026-11-21).** Riguardava il level up tolto con il revert 32d7575. Sostituito da TE-98 … TE-109.

Figlio di TE-81. Weapon Mastery (Barbaro, Guerriero, Paladino, Ranger, Ladro; più armi con il livello) e Fighting Style / Additional Fighting Style (Guerriero, Paladino, Ranger, Campione). Scelta nel box del privilegio, nella creazione guidata e nel level up, con la scelta nella descrizione del tratto; lo stile scelto diventa un tratto talento (sono talenti nel PHB 2024).

**Accettazione.** Test: Guerriero 1 creato con stile Archery ha il tratto Archery e le armi di Weapon Mastery scritte nel tratto.

## TE-81 · Opzioni da una lista (metamagia, invocazioni, manovre, ordini…)

---
id: TE-88
type: feature
priority: medium
status: done
order: 7240
---

**Chiuso (2026-11-21).** Riguardava il level up tolto con il revert 32d7575. Sostituito da TE-98 … TE-109.

Figlio di TE-81. Privilegi che fanno scegliere una o più opzioni da un elenco 5e.tools (`optionalfeatures` o voci del privilegio): Metamagic, Eldritch Invocations, manovre di Combat Superiority, Divine Order, Primal Order, Blessed Strikes, Elemental Fury, Hunter's Prey, Defensive Tactics, Rage of the Wilds / Aspect of the Wilds / Power of the Wilds, Elemental Affinity. Un componente generico "scegli N da questa lista" nel box del privilegio; ogni opzione scelta diventa un tratto (o la scelta nella descrizione).

**Accettazione.** Test: Stregone al 2° sceglie 2 metamagie e trova i due tratti; Warlock al 1° sceglie un'invocazione.

## TE-81 · Competenze aggiuntive dai privilegi

---
id: TE-89
type: feature
priority: medium
status: done
order: 7250
---

**Chiuso (2026-11-21).** Riguardava il level up tolto con il revert 32d7575. Sostituito da TE-98 … TE-109.

Figlio di TE-81. Bonus Proficiencies (College of Lore: 3 abilità), Primal Knowledge, Student of War, Scholar (Maestria del Mago), Thieves' Cant (lingua). Scelta di abilità/strumenti/lingue nel box del privilegio, applicata alla scheda come la Maestria.

**Accettazione.** Test: Bardo College of Lore al 3° sceglie 3 abilità e diventano competenti.

## TE-81 · Incantesimi a scelta da altre liste

---
id: TE-90
type: feature
priority: medium
status: done
order: 7260
---

**Chiuso (2026-11-21).** Riguardava il level up tolto con il revert 32d7575. Sostituito da TE-98 … TE-109.

Figlio di TE-81. Magical Secrets, Magical Discoveries, Mystic Arcanum (11°, 13°, 15°, 17°), Spell Mastery, Signature Spells. Nel box del privilegio la lista degli incantesimi del livello giusto anche di altre classi (Magical Secrets: Bardo, Chierico, Druido, Mago; Mystic Arcanum: un incantesimo del livello del privilegio).

**Accettazione.** Test: Warlock all'11° sceglie un incantesimo di 6° livello per Mystic Arcanum e lo trova nella tab Magia.
