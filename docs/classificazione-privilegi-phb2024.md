# Classificazione dei privilegi PHB 2024

Fonte: 5e.tools XPHB, commit `c286d15`: 12 classi e 48 sottoclassi (`test-data/5etools/class`), 58 opzioni facoltative (`optionalfeatures.json`: 28 invocazioni, 20 manovre, 10 metamagie), 77 talenti (`feats.json`), 10 specie (`races.json`), 16 background (`backgrounds.json`), le tre bestie primordiali (`bestiary/bestiary-xphb.json`) e la Lama psichica (`items.json`).
Usi, dadi e numero di scelte sono confrontati con le colonne delle tabelle di classe e sottoclasse (`classTableGroups`, `subclassTableGroups`, `optionalfeatureProgression`).
Serve a ridisegnare il level up (TE-34): per ogni privilegio dice cosa diventa sulla scheda.

## Tipi

| Tipo | Cosa diventa sulla scheda |
|---|---|
| **Testo** | Tratto (`traits`) senza modificatori. Si manda in chat. |
| **Modificatore** | Tratto con `modifiers` compilati, sempre attivi. Notazione: `target ±n [+CAR] [+PB]` (`ability` e `proficient` di `StatModifier`). |
| **Effetto** | Buff attivabile (`effects`) con modificatori, per ciò che dura poco (Ira, Arma sacra…). |
| **Risorsa** | Contatore (`counters`): massimo, recupero `short`/`long`, collegato al tratto (`traitId`). |
| **Azione** | Voce in Azioni con tiro: attacco, danno, TS o cura. Se consuma una risorsa, `resourceId`. |
| **Competenza** | Abilità, TS, armi, armature, strumenti, linguaggi (`skills`, `abilities.save`, `proficiencies`, `tools`). |
| **Maestria** | `options.expertise`. |
| **Opzione** | Campo di `SheetOptions`: `jackOfAllTrades`, `reliableTalent`, `critRange`, `weaponMasteries`. |
| **Incantesimo** | Voce in Magia: sempre preparata, oppure gratis N volte (con una Risorsa). |
| **Scelta** | Il level up deve chiedere qualcosa (sottoclasse, talento, manovre, abilità…). |
| **Scala** | Cambia una voce già creata (dado, usi, danni) a quel livello. |
| **Manca** | Il modello non ha il campo. Va in Testo finché non si aggiunge (vedi in fondo). |

Abbreviazioni: PB = bonus di competenza, BR/LR = riposo breve/lungo, liv = livello nella classe, CD inc. = CD degli incantesimi.
Velocità in metri, come `speed` (10 ft = 3 m).
"Senza armatura" = **modificatore condizionale**. Oggi i modificatori dei tratti non hanno condizioni: vedi in fondo.

## Comuni a tutte le classi

| Privilegio | Tipo | Dettaglio |
|---|---|---|
| Competenze di classe (liv 1) | Competenza + Scelta | TS, armi, armature, strumenti e abilità a scelta. Tabella sotto. Con la multiclasse se ne prende solo una parte. |
| Dadi vita | Scala | `hitDice`/`hitDicePools`: +1 dado della classe per livello. |
| PF | Scala + Scelta | Fisso (media + 1) o tiro, + mod COS. `hp.max` e `hp.current`. |
| Ability Score Improvement (4, 8, 12, 16; Guerriero anche 6 e 14; Ladro anche 10) | Scelta + Modificatore | Talento ASI: `ability:<a> +2`, oppure `ability:<a> +1` e `ability:<b> +1` (massimo 20). Oppure un altro talento. |
| Epic Boon (19) | Scelta + Modificatore | `ability:<a> +1` (massimo 30) + l'effetto del dono (tabella sotto). |
| Subclass (3) | Scelta | Sceglie la sottoclasse. |
| Subclass Feature | — | Segnaposto: si usano i privilegi della sottoclasse. Nessuna voce. |
| Extra Attack / Two/Three Extra Attacks | Testo | Nessun calcolo. |
| Weapon Mastery | Opzione + Scelta + Scala | `weaponMasteries`. Numero: Barbaro 2/3 (4)/4 (10); Guerriero 3/4 (4)/5 (10)/6 (16); Paladino, Ranger e Ladro 2. |
| Spellcasting / Pact Magic | Scala + Scelta | Slot da `classes.ts`. Scelta di trucchetti e incantesimi preparati dalle colonne della tabella. |

### Competenze di classe

| Classe | DV | TS | Armature | Armi | Strumenti | Abilità |
|---|---|---|---|---|---|---|
| Barbaro | d12 | FOR, COS | leggere, medie, scudi | semplici, marziali | — | 2: Addestrare animali, Atletica, Intimidire, Natura, Percezione, Sopravvivenza |
| Bardo | d8 | DES, CAR | leggere | semplici | 3 strumenti musicali | 3 a scelta |
| Chierico | d8 | SAG, CAR | leggere, medie, scudi | semplici | — | 2: Storia, Intuizione, Medicina, Persuasione, Religione |
| Druido | d8 | INT, SAG | leggere, scudi | semplici | Kit da erborista | 2: Arcano, Addestrare animali, Intuizione, Medicina, Natura, Percezione, Religione, Sopravvivenza |
| Guerriero | d10 | FOR, COS | tutte, scudi | semplici, marziali | — | 2: Acrobazia, Addestrare animali, Atletica, Storia, Intuizione, Intimidire, Persuasione, Percezione, Sopravvivenza |
| Monaco | d8 | FOR, DES | — | semplici, marziali Leggere | 1 strumento da artigiano o musicale | 2: Acrobazia, Atletica, Storia, Intuizione, Religione, Furtività |
| Paladino | d10 | SAG, CAR | tutte, scudi | semplici, marziali | — | 2: Atletica, Intuizione, Intimidire, Medicina, Persuasione, Religione |
| Ranger | d10 | FOR, DES | leggere, medie, scudi | semplici, marziali | — | 3: Addestrare animali, Atletica, Intuizione, Indagare, Natura, Percezione, Furtività, Sopravvivenza |
| Ladro | d8 | DES, INT | leggere | semplici, marziali Finesse o Leggere | Arnesi da scasso | 4: Acrobazia, Atletica, Inganno, Intuizione, Intimidire, Indagare, Percezione, Persuasione, Rapidità di mano, Furtività |
| Stregone | d6 | COS, CAR | — | semplici | — | 2: Arcano, Inganno, Intuizione, Intimidire, Persuasione, Religione |
| Warlock | d8 | SAG, CAR | leggere | semplici | — | 2: Arcano, Inganno, Storia, Intimidire, Indagare, Natura, Religione |
| Mago | d6 | INT, SAG | — | semplici | — | 2: Arcano, Storia, Intuizione, Indagare, Medicina, Natura, Religione |

### Talenti Stile di combattimento (Guerriero 1, Paladino 2, Ranger 2, Campione 7)

| Talento | Tipo | Dettaglio |
|---|---|---|
| Archery | Modificatore condizionale | `attack +2`, solo armi a distanza. |
| Blind Fighting | Manca | Vista cieca 3 m. |
| Defense | Modificatore condizionale | `ac +1`, solo con armatura. |
| Dueling | Modificatore condizionale | `damage +2`, arma in mischia a una mano. |
| Great Weapon Fighting | Testo | 1 e 2 sui dadi valgono 3. |
| Interception | Azione | Reazione: riduce i danni di `1d10 + PB`. |
| Protection | Testo | Reazione con lo scudo: svantaggio. |
| Thrown Weapon Fighting | Modificatore condizionale | `damage +2`, armi da lancio. |
| Two-Weapon Fighting | Testo | Mod. caratteristica al danno dell'attacco extra. |
| Unarmed Fighting | Azione | Colpo senz'armi `1d6 + FOR` (1d8 senza armi né scudo); in lotta 1d4. |
| Blessed Warrior (Paladino) / Druidic Warrior (Ranger) | Scelta + Incantesimo | 2 trucchetti da chierico / druido, con CAR / SAG. |

### Doni epici (19)

| Dono | Tipo | Dettaglio |
|---|---|---|
| Combat Prowess | Testo | Un mancato diventa colpito, 1 volta per turno. |
| Dimensional Travel | Testo | Teletrasporto di 9 m dopo un'azione Attacco o Magia. |
| Energy Resistance | Manca + Scelta | 2 resistenze. |
| Fate | Risorsa + Azione | `2d4` su una prova d20; 1 per tiro d'iniziativa / BR. |
| Fortitude | Modificatore | `hpMax +40`. |
| Irresistible Offense | Testo | Ignora le resistenze; danni extra su un 20. Caratteristica solo FOR o DES. |
| Recovery | Risorsa + Testo | Ultimo baluardo 1/LR; riserva di 10d10. |
| Skill | Competenza + Maestria | Competenza in tutte le abilità; Maestria in 1. |
| Speed | Modificatore | `speed +9` (30 ft). |
| Spell Recall | Testo | Caratteristica solo INT, SAG o CAR. |
| Night Spirit | Testo + Manca | Invisibile in penombra; resistenze. |
| Truesight | Manca | Vista pura 18 m. |

---

## Barbaro

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 1 | Rage | Risorsa + Effetto | Usi 2/3 (3)/4 (6)/5 (12)/6 (17); 1 al BR, tutti al LR. Effetto "Ira": `damage +0 scale rage`, `adv:check:strength`, `adv:save:strength`. Resistenza a contundenti, perforanti e taglienti: Manca. Danni +2/+3 (9)/+4 (16): già in `rageDamage`. |
| 1 | Unarmored Defense | Modificatore condizionale | CA 10 + DES + COS senza armatura (scudo ammesso): `acBase 10` + `ac +0 +COS`. |
| 1 | Weapon Mastery | Opzione | 2 armi. |
| 2 | Danger Sense | Modificatore | `adv:save:dexterity`. |
| 2 | Reckless Attack | Effetto | `adv:attack` fino al turno dopo. |
| 3 | Primal Knowledge | Competenza + Scelta | 1 abilità dalla lista del Barbaro. Il resto è Testo. |
| 5 | Fast Movement | Modificatore condizionale | `speed +3`, senza armatura pesante. |
| 7 | Feral Instinct | Modificatore | `adv:initiative`. |
| 7 | Instinctive Pounce | Testo | |
| 9 | Brutal Strike | Azione | Danno extra `1d10`; effetti Spinta / Azzoppare. |
| 11 | Relentless Rage | Testo | TS COS CD 10, +5 a ogni uso; PF = 2 × liv. |
| 13 | Improved Brutal Strike | Scala | Nuovi effetti nel testo dell'azione. |
| 15 | Persistent Rage | Risorsa + Testo | Recupera tutte le Ire tirando l'iniziativa, 1/LR. |
| 17 | Improved Brutal Strike | Scala | Danno `2d10`, due effetti. |
| 18 | Indomitable Might | Testo | Il punteggio di FOR come minimo nelle prove e TS di FOR. |
| 20 | Primal Champion | Modificatore | `ability:strength +4`, `ability:constitution +4` (massimo 25). |

**Path of the Berserker**

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 3 | Frenzy | Azione | Danno extra `Nd6`, N = danni dell'Ira (2/3/4). |
| 6 | Mindless Rage | Manca | Immune ad affascinato e spaventato durante l'Ira. |
| 10 | Retaliation | Testo | |
| 14 | Intimidating Presence | Risorsa + Azione | 1/LR (si ricarica con un'Ira). TS SAG CD `8 + FOR + PB`. |

**Path of the Wild Heart**

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 3 | Animal Speaker | Incantesimo | Beast Sense, Speak with Animals: solo rituali, SAG. |
| 3 | Rage of the Wilds | Scelta + Testo | Orso (resistenze: Manca), Aquila, Lupo, scelti a ogni Ira. |
| 6 | Aspect of the Wilds | Scelta + Manca | Gufo (scurovisione), Pantera (scalare), Salmone (nuotare). |
| 10 | Nature Speaker | Incantesimo | Commune with Nature, solo rituale, SAG. |
| 14 | Power of the Wilds | Scelta + Testo | Falco (volo: Manca), Leone, Ariete. |

**Path of the World Tree**

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 3 | Vitality of the Tree | Azione ×2 | PF temporanei = liv quando si attiva l'Ira; `Nd6` PF temporanei a un alleato (N = danni dell'Ira). |
| 6 | Branches of the Tree | Azione | Reazione: TS FOR CD `8 + FOR + PB`. |
| 10 | Battering Roots | Testo | Portata +3 m con armi Pesanti o Versatili. |
| 14 | Travel Along the Tree | Testo | |

**Path of the Zealot**

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 3 | Divine Fury | Azione | Danno extra `1d6 + liv/2`, necrotico o radioso. |
| 3 | Warrior of the Gods | Risorsa + Azione | Dadi d12: 4/5 (6)/6 (12)/7 (17), LR. Cura con i dadi spesi. |
| 6 | Fanatical Focus | Testo | |
| 10 | Zealous Presence | Risorsa | 1/LR (si ricarica con un'Ira). |
| 14 | Rage of the Gods | Risorsa + Effetto | 1/LR. Volo e resistenze: Manca. |

## Bardo

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 1 | Bardic Inspiration | Risorsa + Azione | Usi = mod CAR (min 1), LR. Dado d6/d8 (5)/d10 (10)/d12 (15). |
| 1 | Spellcasting | Scala + Scelta | Incantatore completo, CAR. |
| 2 | Expertise | Maestria + Scelta | 2 abilità. |
| 2 | Jack of All Trades | Opzione | `jackOfAllTrades`. |
| 5 | Font of Inspiration | Scala | Ispirazione recupera al BR (`recovery: short`). |
| 7 | Countercharm | Testo | |
| 9 | Expertise | Maestria + Scelta | 2 abilità in più. |
| 10 | Magical Secrets | Testo | Liste di chierico, druido e mago nella scelta degli incantesimi. |
| 18 | Superior Inspiration | Testo | |
| 20 | Words of Creation | Incantesimo | Power Word Heal e Power Word Kill sempre preparati. |

**College of Dance**

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 3 | Dazzling Footwork: Bardic Damage | Azione | Colpo senz'armi con DES, danno = dado d'ispirazione + DES. |
| 3 | Dazzling Footwork: Unarmored Defense | Modificatore condizionale | CA 10 + DES + CAR senza armatura né scudo. |
| 3 | Dance Virtuoso, Agile Strikes | Testo | |
| 6 | Inspiring Movement | Testo | |
| 6 | Tandem Footwork | Azione | Dado d'ispirazione all'iniziativa (consuma 1 Ispirazione). |
| 14 | Leading Evasion | Testo | |

**College of Glamour**

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 3 | Beguiling Magic | Incantesimo + Risorsa + Azione | Charm Person, Mirror Image sempre preparati. 1/LR: TS SAG con CD inc. |
| 3 | Mantle of Inspiration | Azione | PF temporanei = 2 × dado d'ispirazione (consuma 1 Ispirazione). |
| 6 | Mantle of Majesty | Incantesimo + Risorsa | Command sempre preparato; 1/LR. |
| 14 | Unbreakable Majesty | Risorsa + Azione | 1/BR. TS CAR con CD inc. |

**College of Lore**

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 3 | Bonus Proficiencies | Competenza + Scelta | 3 abilità. |
| 3 | Cutting Words | Azione | Reazione: dado d'ispirazione sottratto (consuma 1 Ispirazione). |
| 6 | Magical Discoveries | Incantesimo + Scelta | 2 incantesimi da chierico, druido o mago, sempre preparati. |
| 14 | Peerless Skill | Testo | |

**College of Valor**

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 3 | Combat Inspiration | Testo | |
| 3 | Martial Training | Competenza | Armi marziali, armature medie, scudi. |
| 6 | Extra Attack | Testo | |
| 14 | Battle Magic | Testo | |

## Chierico

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 1 | Divine Order: Protector | Scelta + Competenza | Armi marziali, armature pesanti. |
| 1 | Divine Order: Thaumaturge | Scelta + Modificatore + Incantesimo | `skill:arcana +0 +SAG`, `skill:religion +0 +SAG` (min +1); 1 trucchetto in più. |
| 1 | Spellcasting | Scala + Scelta | Incantatore completo, SAG. |
| 2 | Channel Divinity | Risorsa | Usi 2/3 (6)/4 (18); 1 al BR, tutti al LR. |
| 2 | Divine Spark | Azione | `1d8 + SAG` di cura oppure TS COS (danni dimezzati); 2d8 (7)/3d8 (13)/4d8 (18). Consuma Incanalare divinità. |
| 2 | Turn Undead | Azione | TS SAG con CD inc. Consuma Incanalare divinità. |
| 5 | Sear Undead | Scala | Danni radiosi `Nd8` (N = mod SAG, min 1) su Scacciare non morti. |
| 7 | Blessed Strikes: Divine Strike | Scelta + Azione | Danno extra `1d8`; 2d8 (14). |
| 7 | Blessed Strikes: Potent Spellcasting | Scelta + Scala | `addAbilityMod` sui trucchetti da chierico; al 14 PF temporanei = 2 × SAG (Testo). |
| 10 | Divine Intervention | Risorsa | 1/LR. |
| 14 | Improved Blessed Strikes | Scala | Vedi sopra. |
| 20 | Greater Divine Intervention | Testo | |

**Life Domain**

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 3 | Domain Spells | Incantesimo | 3: Aid, Bless, Cure Wounds, Lesser Restoration; 5: Mass Healing Word, Revivify; 7: Aura of Life, Death Ward; 9: Greater Restoration, Mass Cure Wounds. |
| 3 | Disciple of Life | Testo | +2 + livello dello slot. |
| 3 | Preserve Life | Azione | Cura 5 × liv, divisa. Consuma Incanalare divinità. |
| 6 | Blessed Healer | Testo | |
| 17 | Supreme Healing | Testo | |

**Light Domain**

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 3 | Domain Spells | Incantesimo | 3: Burning Hands, Faerie Fire, Scorching Ray, See Invisibility; 5: Daylight, Fireball; 7: Arcane Eye, Wall of Fire; 9: Flame Strike, Scrying. |
| 3 | Radiance of the Dawn | Azione | TS COS, `2d10 + liv` radiosi. Consuma Incanalare divinità. |
| 3 | Warding Flare | Risorsa | Usi = SAG (min 1), LR. |
| 6 | Improved Warding Flare | Scala + Azione | Recupero al BR; PF temporanei `2d6 + SAG`. |
| 17 | Corona of Light | Risorsa | Usi = SAG (min 1), LR. |

**Trickery Domain**

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 3 | Domain Spells | Incantesimo | 3: Charm Person, Disguise Self, Invisibility, Pass without Trace; 5: Hypnotic Pattern, Nondetection; 7: Confusion, Dimension Door; 9: Dominate Person, Modify Memory. |
| 3 | Blessing of the Trickster | Effetto | `adv:skill:stealth`, su di sé o su un alleato. |
| 3 | Invoke Duplicity | Testo | Consuma Incanalare divinità. |
| 6 | Trickster's Transposition | Testo | |
| 17 | Improved Duplicity | Testo | Cura = liv alla fine. |

**War Domain**

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 3 | Domain Spells | Incantesimo | 3: Guiding Bolt, Magic Weapon, Shield of Faith, Spiritual Weapon; 5: Crusader's Mantle, Spirit Guardians; 7: Fire Shield, Freedom of Movement; 9: Hold Monster, Steel Wind Strike. |
| 3 | Guided Strike | Testo | +10 al tiro. Consuma Incanalare divinità. |
| 3 | War Priest | Risorsa | Usi = SAG (min 1), BR. |
| 6 | War God's Blessing | Testo | |
| 17 | Avatar of Battle | Manca | Resistenza a contundenti, perforanti e taglienti. |

## Druido

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 1 | Druidic | Competenza + Incantesimo | Linguaggio Druidico; Speak with Animals sempre preparato. |
| 1 | Primal Order: Magician | Scelta + Modificatore + Incantesimo | `skill:arcana +0 +SAG`, `skill:nature +0 +SAG` (min +1); 1 trucchetto in più. |
| 1 | Primal Order: Warden | Scelta + Competenza | Armi marziali, armature medie. |
| 1 | Spellcasting | Scala + Scelta | Incantatore completo, SAG. |
| 2 | Wild Shape | Risorsa | Usi 2/3 (6)/4 (17); 1 al BR, tutti al LR. Forme note 4/6 (4)/8 (8): Testo. PF temporanei = liv: Testo. |
| 2 | Wild Companion | Testo | Find Familiar con slot o Forma selvatica. |
| 5 | Wild Resurgence | Risorsa + Testo | Forma selvatica → slot di 1° livello, 1/LR. |
| 7 | Elemental Fury: Potent Spellcasting | Scelta + Scala | `addAbilityMod` sui trucchetti da druido; al 15 gittata +90 m (Testo). |
| 7 | Elemental Fury: Primal Strike | Scelta + Azione | Danno extra `1d8`; 2d8 (15). |
| 15 | Improved Elemental Fury | Scala | Vedi sopra. |
| 18 | Beast Spells | Testo | |
| 20 | Archdruid | Risorsa + Testo | Mago della natura 1/LR. |

**Circle of the Land**

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 3 | Circle of the Land Spells | Scelta + Incantesimo | Terra scelta a ogni LR. Arida: Blur, Burning Hands, Fire Bolt / Fireball / Blight / Wall of Stone. Polare: Fog Cloud, Hold Person, Ray of Frost / Sleet Storm / Ice Storm / Cone of Cold. Temperata: Misty Step, Shocking Grasp, Sleep / Lightning Bolt / Freedom of Movement / Tree Stride. Tropicale: Acid Splash, Ray of Sickness, Web / Stinking Cloud / Polymorph / Insect Plague. |
| 3 | Land's Aid | Azione | TS COS, `2d6` necrotici + cura `2d6`; 3d6 (10)/4d6 (14). Consuma Forma selvatica. |
| 6 | Natural Recovery | Risorsa ×2 | Incantesimo gratis 1/LR; slot recuperati al BR 1/LR (livelli = metà liv, per eccesso). |
| 10 | Nature's Ward | Manca | Immune ad avvelenato; resistenza secondo la terra. |
| 14 | Nature's Sanctuary | Testo | Consuma Forma selvatica. |

**Circle of the Moon**

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 3 | Circle Spells | Incantesimo | 3: Cure Wounds, Moonbeam, Starry Wisp; 5: Conjure Animals; 7: Fount of Moonlight; 9: Mass Cure Wounds. |
| 3 | Circle Forms | Testo | GS = liv/3; CA 13 + SAG; PF temporanei 3 × liv. |
| 6 | Improved Circle Forms | Testo | +SAG ai TS COS in forma selvatica (solo in forma: niente modificatore fisso). |
| 10 | Moonlight Step | Risorsa | Usi = SAG (min 1), LR. |
| 14 | Lunar Form | Azione | Danno extra `2d10` radiosi in forma selvatica. |

**Circle of the Sea**

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 3 | Circle Spells | Incantesimo | 3: Fog Cloud, Gust of Wind, Ray of Frost, Shatter, Thunderwave; 5: Lightning Bolt, Water Breathing; 7: Control Water, Ice Storm; 9: Conjure Elemental, Hold Monster. |
| 3 | Wrath of the Sea | Effetto + Azione | Emanazione per 10 min; TS COS con CD inc., `Nd6` da freddo (N = SAG, min 1). Consuma Forma selvatica. |
| 6 | Aquatic Affinity | Scala + Manca | Emanazione 3 m; velocità di nuoto. |
| 10 | Stormborn | Manca | Volo e resistenze con l'Ira del mare attiva. |
| 14 | Oceanic Gift | Testo | |

**Circle of the Stars**

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 3 | Star Map | Incantesimo + Risorsa | Guidance, Guiding Bolt sempre preparati; Guiding Bolt gratis SAG volte (min 1), LR. |
| 3 | Starry Form | Effetto + Azione | Consuma Forma selvatica. Arciere: attacco con incantesimo `1d8 + SAG` radiosi. Calice: cura `1d8 + SAG`. Drago: minimo 10 sulle prove di INT e SAG e sui TS di concentrazione (Manca). |
| 6 | Cosmic Omen | Risorsa + Azione | Usi = SAG (min 1), LR; `1d6` aggiunto o sottratto. |
| 10 | Twinkling Constellations | Scala + Manca | 2d8; volo 6 m col Drago. |
| 14 | Full of Stars | Manca | Resistenza a contundenti, perforanti e taglienti in forma stellare. |

## Guerriero

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 1 | Fighting Style | Scelta | Talento Stile di combattimento (tabella sopra). |
| 1 | Second Wind | Risorsa + Azione | Usi 2/3 (4)/4 (10); 1 al BR, tutti al LR. Cura `1d10 + liv`. |
| 1 | Weapon Mastery | Opzione | 3 armi. |
| 2 | Action Surge | Risorsa | 1/BR; 2 (17). |
| 2 | Tactical Mind | Azione | `1d10` alla prova fallita; consuma Recuperare energie solo se riesce. |
| 5 | Tactical Shift | Testo | |
| 9 | Indomitable | Risorsa | 1/2 (13)/3 (17), LR. Bonus = liv: Testo. |
| 9 | Tactical Master | Testo | |
| 13 | Studied Attacks | Testo | |

**Battle Master**

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 3 | Combat Superiority | Risorsa + Scelta | Dadi di superiorità 4/5 (7)/6 (15), BR; d8/d10 (10)/d12 (18). Manovre 3/5 (7)/7 (10)/9 (15). CD `8 + FOR o DES + PB`. |
| 3 | Maneuver Options | Scelta | Tabella manovre sotto. Ognuna consuma 1 dado di superiorità (`resourceId`). |
| 3 | Student of War | Competenza + Scelta | 1 strumento da artigiano + 1 abilità dalla lista del Guerriero. |
| 7 | Know Your Enemy | Risorsa | 1/LR (si ricarica con un dado). |
| 10 / 18 | Improved / Ultimate Combat Superiority | Scala | d10 / d12. |
| 15 | Relentless | Testo | |

Manovre (20). "Dado" = dado di superiorità; CD = `8 + FOR o DES + PB`.

| Manovra | Tipo | Dettaglio |
|---|---|---|
| Ambush | Azione | Dado a Furtività o iniziativa. |
| Bait and Switch | Azione | Scambio di posto; dado alla CA (tua o dell'alleato). |
| Commander's Strike | Testo | Il dado va al danno dell'alleato. |
| Commanding Presence | Azione | Dado a Intimidire, Intrattenere o Persuasione. |
| Disarming Attack | Azione | Danno extra dado + TS FOR. |
| Distracting Strike | Azione | Danno extra dado. |
| Evasive Footwork | Azione | Disimpegno; dado alla CA. |
| Feinting Attack | Azione | Vantaggio + danno extra dado. |
| Goading Attack | Azione | Danno extra dado + TS SAG. |
| Lunging Attack | Azione | Scatto + danno extra dado. |
| Maneuvering Attack | Azione | Danno extra dado. |
| Menacing Attack | Azione | Danno extra dado + TS SAG (spaventato). |
| Parry | Azione | Riduce i danni di dado + FOR o DES. |
| Precision Attack | Azione | Dado al tiro per colpire. |
| Pushing Attack | Azione | Danno extra dado + TS FOR (spinta 4,5 m). |
| Rally | Azione | PF temporanei = dado + liv/2 a un alleato. |
| Riposte | Azione | Reazione: attacco + danno extra dado. |
| Sweeping Attack | Azione | Danni del dado a una seconda creatura. |
| Tactical Assessment | Azione | Dado a Storia, Indagare o Intuizione. |
| Trip Attack | Azione | Danno extra dado + TS FOR (prono). |

**Champion**

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 3 | Improved Critical | Opzione | `critRange 19`. |
| 3 | Remarkable Athlete | Modificatore | `adv:initiative`, `adv:skill:athletics`. |
| 7 | Additional Fighting Style | Scelta | Secondo talento Stile di combattimento. |
| 10 | Heroic Warrior | Testo | |
| 15 | Superior Critical | Opzione | `critRange 18`. |
| 18 | Survivor | Manca + Testo | Vantaggio sui TS contro la morte (nessun target). Cura `5 + COS` a inizio turno da sanguinante. |

**Eldritch Knight**

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 3 | Spellcasting | Scala + Scelta | Terzo incantatore, INT (`arcaneFighter`). Trucchetti 2/3 (10). |
| 3 | War Bond | Testo | |
| 7 | War Magic | Testo | |
| 10 | Eldritch Strike | Testo | |
| 15 | Arcane Charge | Testo | |
| 18 | Improved War Magic | Testo | |

**Psi Warrior**

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 3 | Psionic Power | Risorsa | Dadi psionici 4/6 (5)/8 (9)/10 (13)/12 (17); d6/d8 (5)/d10 (11)/d12 (17). 1 al BR, tutti al LR. |
| 3 | Protective Field | Azione | Riduce i danni di dado + INT. Consuma un dado. |
| 3 | Psionic Strike | Azione | Danno extra dado + INT, forza. Consuma un dado. |
| 3 | Telekinetic Movement | Risorsa | 1/BR (si ricarica con un dado). |
| 7 | Psi-Powered Leap | Risorsa | 1/BR (si ricarica con un dado). |
| 7 | Telekinetic Thrust | Azione | TS FOR CD `8 + INT + PB`. |
| 10 | Guarded Mind | Manca + Testo | Resistenza psichica. |
| 15 | Bulwark of Force | Risorsa | 1/LR (si ricarica con un dado). |
| 18 | Telekinetic Master | Incantesimo + Risorsa | Telekinesis sempre preparato, INT; 1/LR. |

## Monaco

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 1 | Martial Arts | Azione + Scala | Colpo senz'armi con DES, dado 1d6/1d8 (5)/1d10 (11)/1d12 (17). |
| 1 | Bonus Unarmed Strike, Dexterous Attacks | Testo | DES per armi da monaco: si sceglie nell'azione. |
| 1 | Unarmored Defense | Modificatore condizionale | CA 10 + DES + SAG senza armatura né scudo. |
| 2 | Monk's Focus | Risorsa | Punti focus = liv, BR. CD `8 + SAG + PB`. |
| 2 | Flurry of Blows | Azione | 2 colpi senz'armi. 1 punto focus. |
| 2 | Patient Defense, Step of the Wind | Testo | 1 punto focus (scalabile dal contatore). |
| 2 | Unarmored Movement | Modificatore condizionale + Scala | `speed +3` senza armatura né scudo; +4,5 (6)/+6 (10)/+7,5 (14)/+9 (18). |
| 2 | Uncanny Metabolism | Risorsa + Azione | 1/LR. Cura dado di arti marziali + liv. |
| 3 | Deflect Attacks | Azione | Riduce i danni di `1d10 + DES + liv`; rimando: TS DES, 2 dadi di arti marziali + DES. |
| 4 | Slow Fall | Testo | 5 × liv. |
| 5 | Stunning Strike | Azione | TS COS con CD focus. 1 punto focus. |
| 6 | Empowered Strikes | Testo | |
| 7 | Evasion | Testo | |
| 9 | Acrobatic Movement | Testo | |
| 10 | Heightened Focus | Scala | Raffica 3 colpi; PF temporanei 2 dadi di arti marziali; Passo del vento con un alleato. |
| 10 | Self-Restoration | Testo | |
| 13 | Deflect Energy | Scala | Deviare attacchi contro ogni tipo di danno. |
| 14 | Disciplined Survivor | Competenza | Tutti i TS. |
| 15 | Perfect Focus | Testo | |
| 18 | Superior Defense | Effetto + Manca | 3 punti focus; resistenza a tutto tranne forza. |
| 20 | Body and Mind | Modificatore | `ability:dexterity +4`, `ability:wisdom +4` (massimo 25). |

**Warrior of Mercy**

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 3 | Hand of Harm | Azione | Danno extra dado di arti marziali + SAG, necrotico. 1 punto focus. |
| 3 | Hand of Healing | Azione | Cura dado di arti marziali + SAG. 1 punto focus. |
| 3 | Implements of Mercy | Competenza | Intuizione, Medicina, Kit da erborista. |
| 6 | Physician's Touch | Scala | Avvelenato / fine delle condizioni nel testo delle due azioni. |
| 11 | Flurry of Healing and Harm | Risorsa | Usi = SAG (min 1), LR. |
| 17 | Hand of Ultimate Mercy | Risorsa + Azione | 1/LR, 5 punti focus. Cura `4d10 + SAG`. |

**Warrior of Shadow**

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 3 | Shadow Arts: Darkness | Incantesimo | Darkness con 1 punto focus. |
| 3 | Shadow Arts: Darkvision | Manca | Scurovisione 18 m. |
| 3 | Shadow Arts: Shadowy Figments | Incantesimo | Minor Illusion, SAG. |
| 6 | Shadow Step | Testo | |
| 11 | Improved Shadow Step | Testo | 1 punto focus. |
| 17 | Cloak of Shadows | Effetto | Invisibile; 3 punti focus. |

**Warrior of the Elements**

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 3 | Elemental Attunement | Effetto | 1 punto focus, 10 min; portata +3 m, tipo di danno a scelta, TS FOR. |
| 3 | Manipulate Elements | Incantesimo | Elementalism, SAG. |
| 6 | Elemental Burst | Azione | TS DES, 3 dadi di arti marziali. 2 punti focus. |
| 11 | Stride of the Elements | Manca | Volo e nuoto con la Sintonia attiva. |
| 17 | Elemental Epitome | Manca + Azione | Resistenza a scelta; danno extra 1 dado di arti marziali. |

**Warrior of the Open Hand**

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 3 | Open Hand Technique | Testo | Spinta: TS FOR; Atterrare: TS DES, CD focus. |
| 6 | Wholeness of Body | Risorsa + Azione | Usi = SAG (min 1), LR. Cura dado di arti marziali + SAG. |
| 11 | Fleet Step | Testo | |
| 17 | Quivering Palm | Azione | TS COS, `10d12` forza. 4 punti focus. |

## Paladino

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 1 | Lay on Hands | Risorsa | Riserva = 5 × liv PF, LR. |
| 1 | Spellcasting | Scala + Scelta | Mezzo incantatore, CAR. |
| 1 | Weapon Mastery | Opzione | 2 armi. |
| 2 | Fighting Style | Scelta | Talento Stile di combattimento oppure Blessed Warrior. |
| 2 | Paladin's Smite | Incantesimo + Risorsa | Divine Smite sempre preparato; 1 lancio gratis, LR. |
| 3 | Channel Divinity | Risorsa | Usi 2/3 (11); 1 al BR, tutti al LR. |
| 3 | Divine Sense | Testo | Consuma Incanalare divinità. |
| 5 | Faithful Steed | Incantesimo + Risorsa | Find Steed sempre preparato; 1 lancio gratis, LR. |
| 6 | Aura of Protection | Modificatore | `save:<tutte e sei> +0 +CAR` (min +1). Inattiva da incapacitato. |
| 9 | Abjure Foes | Azione | TS SAG con CD inc. Consuma Incanalare divinità. |
| 10 | Aura of Courage | Manca | Immune a spaventato. |
| 11 | Radiant Strikes | Azione | Danno extra `1d8` radiosi in mischia. |
| 14 | Restoring Touch | Testo | 5 PF della riserva per condizione. |
| 18 | Aura Expansion | Testo | Aura di 9 m. |

**Oath of Devotion**

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 3 | Oath Spells | Incantesimo | 3: Protection from Evil and Good, Shield of Faith; 5: Aid, Zone of Truth; 9: Beacon of Hope, Dispel Magic; 13: Freedom of Movement, Guardian of Faith; 17: Commune, Flame Strike. |
| 3 | Sacred Weapon | Effetto | `attack +0 +CAR` (min +1), 10 min. Consuma Incanalare divinità. |
| 7 | Aura of Devotion | Manca | Immune ad affascinato. |
| 15 | Smite of Protection | Testo | |
| 20 | Holy Nimbus | Risorsa + Effetto + Azione | 1/LR (o slot di 5°). Danni radiosi = CAR + PB. Vantaggio ai TS contro immondi e non morti: Testo. |

**Oath of Glory**

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 3 | Oath Spells | Incantesimo | 3: Guiding Bolt, Heroism; 5: Enhance Ability, Magic Weapon; 9: Haste, Protection from Energy; 13: Compulsion, Freedom of Movement; 17: Legend Lore, Yolande's Regal Presence. |
| 3 | Inspiring Smite | Azione | PF temporanei `2d8 + liv`. Consuma Incanalare divinità. |
| 3 | Peerless Athlete | Effetto | `adv:skill:athletics`, `adv:skill:acrobatics`, 1 ora. Consuma Incanalare divinità. |
| 7 | Aura of Alacrity | Modificatore | `speed +3`. |
| 15 | Glorious Defense | Risorsa | Usi = CAR (min 1), LR. Bonus alla CA = CAR: Testo. |
| 20 | Living Legend | Risorsa + Effetto | 1/LR (o slot di 5°). `adv:check:charisma`. |

**Oath of the Ancients**

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 3 | Oath Spells | Incantesimo | 3: Ensnaring Strike, Speak with Animals; 5: Misty Step, Moonbeam; 9: Plant Growth, Protection from Energy; 13: Ice Storm, Stoneskin; 17: Commune with Nature, Tree Stride. |
| 3 | Nature's Wrath | Azione | TS FOR con CD inc. Consuma Incanalare divinità. |
| 7 | Aura of Warding | Manca | Resistenza a necrotico, psichico e radioso. |
| 15 | Undying Sentinel | Risorsa | 1/LR. PF = 3 × liv. |
| 20 | Elder Champion | Risorsa + Effetto | 1/LR (o slot di 5°). Rigenera 10 PF: Testo. |

**Oath of Vengeance**

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 3 | Oath Spells | Incantesimo | 3: Bane, Hunter's Mark; 5: Hold Person, Misty Step; 9: Haste, Protection from Energy; 13: Banishment, Dimension Door; 17: Hold Monster, Scrying. |
| 3 | Vow of Enmity | Effetto | `adv:attack` (in realtà solo contro un bersaglio), 1 min. Consuma Incanalare divinità. |
| 7 | Relentless Avenger | Testo | |
| 15 | Soul of Vengeance | Testo | |
| 20 | Avenging Angel | Risorsa + Effetto + Azione | 1/LR (o slot di 5°). Volo 18 m: Manca. TS SAG con CD inc. |

## Ranger

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 1 | Favored Enemy | Incantesimo + Risorsa + Azione | Hunter's Mark sempre preparato; lanci gratis 2/3 (5)/4 (9)/5 (13)/6 (17), LR. Azione: danno extra `1d6`. |
| 1 | Spellcasting | Scala + Scelta | Mezzo incantatore, SAG. |
| 1 | Weapon Mastery | Opzione | 2 armi. |
| 2 | Deft Explorer | Maestria + Competenza + Scelta | Maestria in 1 abilità; 2 linguaggi. |
| 2 | Fighting Style | Scelta | Talento Stile di combattimento oppure Druidic Warrior. |
| 6 | Roving | Modificatore condizionale + Manca | `speed +3` senza armatura pesante; scalare e nuotare. |
| 9 | Expertise | Maestria + Scelta | 2 abilità. |
| 10 | Tireless | Risorsa + Azione | Usi = SAG (min 1), LR. PF temporanei `1d8 + SAG`. Indebolimento −1 al BR: Testo. |
| 13 | Relentless Hunter | Testo | |
| 14 | Nature's Veil | Risorsa | Usi = SAG (min 1), LR. |
| 17 | Precise Hunter | Testo | Vantaggio contro il bersaglio marchiato. |
| 18 | Feral Senses | Manca | Vista cieca 9 m. |
| 20 | Foe Slayer | Scala | Marchio del cacciatore `1d10`. |

**Beast Master**

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 3 | Primal Companion | Scelta + Azione + Testo | Bestia di terra, mare o cielo (`bestiary-xphb.json`). Azione "Colpo della bestia": attacco = attacco incantesimi del ranger. Terra: `1d8 + 2 + SAG`, carica +1d6 e prono. Mare: `1d6 + 2 + SAG`, afferrato (CD inc.). Cielo: `1d4 + 3 + SAG`. CA 13 + SAG; PF 5 + 5 × liv (cielo 4 + 4 × liv); PB alle prove e ai TS della bestia. Il resto delle statistiche: Testo, oppure una scheda NPC a parte. |
| 7 | Exceptional Training | Testo | |
| 11 | Bestial Fury | Testo | |
| 15 | Share Spells | Testo | |

**Fey Wanderer**

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 3 | Dreadful Strikes | Azione | Danno extra `1d4` psichico; 1d6 (11). |
| 3 | Fey Wanderer Spells | Incantesimo | 3: Charm Person; 5: Misty Step; 9: Summon Fey; 13: Dimension Door; 17: Mislead. Dono fatato: Testo. |
| 3 | Otherworldly Glamour | Modificatore + Competenza + Scelta | Prove di CAR +SAG (min +1): `skill:deception`, `skill:intimidation`, `skill:performance`, `skill:persuasion` `+0 +SAG`. 1 abilità tra Inganno, Intrattenere, Persuasione. |
| 7 | Beguiling Twist | Manca + Azione | Vantaggio ai TS contro affascinato e spaventato. TS SAG con CD inc. |
| 11 | Fey Reinforcements | Risorsa | Summon Fey gratis 1/LR. |
| 15 | Misty Wanderer | Risorsa | Misty Step gratis SAG volte (min 1), LR. |

**Gloom Stalker**

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 3 | Dread Ambusher | Modificatore + Risorsa + Azione | `initiative +0 +SAG`. Colpo terrificante: SAG volte (min 1), LR; danno extra `2d6` psichico. Velocità +3 m nel primo turno: Testo. |
| 3 | Gloom Stalker Spells | Incantesimo | 3: Disguise Self; 5: Rope Trick; 9: Fear; 13: Greater Invisibility; 17: Seeming. |
| 3 | Umbral Sight | Manca | Scurovisione 18 m. |
| 7 | Iron Mind | Competenza + Scelta | TS SAG (se già c'è: INT o CAR). |
| 11 | Stalker's Flurry | Scala + Azione | `2d8`; Paura di massa: TS SAG con CD inc. |
| 15 | Shadowy Dodge | Testo | |

**Hunter**

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 3 | Hunter's Lore | Testo | |
| 3 | Hunter's Prey | Scelta | Colossus Slayer (Azione: danno extra `1d8`) oppure Horde Breaker (Testo). Si cambia al riposo. |
| 7 | Defensive Tactics | Scelta + Testo | Escape the Horde / Multiattack Defense. |
| 11 | Superior Hunter's Prey | Testo | |
| 15 | Superior Hunter's Defense | Testo | |

## Ladro

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 1 | Expertise | Maestria + Scelta | 2 abilità; altre 2 al 6. |
| 1 | Sneak Attack | Azione + Scala | Danno extra `Nd6`, N = liv/2 per eccesso. |
| 1 | Thieves' Cant | Competenza + Scelta | Gergo dei ladri + 1 linguaggio. |
| 1 | Weapon Mastery | Opzione | 2 armi. |
| 2 | Cunning Action | Testo | |
| 3 | Steady Aim | Testo | |
| 5 | Cunning Strike | Testo | Veleno (TS COS), Sgambetto (TS DES), Ritirata. CD `8 + DES + PB`. |
| 5 | Uncanny Dodge | Testo | |
| 7 | Evasion | Testo | |
| 7 | Reliable Talent | Opzione | `reliableTalent`. |
| 11 | Improved Cunning Strike | Testo | |
| 14 | Devious Strikes | Testo | Stordire (TS COS), Tramortire (TS COS), Accecare (TS DES). |
| 15 | Slippery Mind | Competenza | TS SAG e CAR. |
| 18 | Elusive | Testo | |
| 20 | Stroke of Luck | Risorsa | 1/BR. |

**Arcane Trickster**

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 3 | Spellcasting | Scala + Scelta | Terzo incantatore, INT (`arcaneRogue`). Mage Hand obbligatorio + 2 trucchetti; 4 (10). |
| 3 | Mage Hand Legerdemain | Testo | |
| 9 | Magical Ambush | Testo | |
| 13 | Versatile Trickster | Testo | |
| 17 | Spell Thief | Risorsa + Azione | 1/LR. TS INT con CD inc. |

**Assassin**

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 3 | Assassin's Tools | Competenza | Kit per il travestimento, Kit da avvelenatore (+ i due oggetti nell'inventario). |
| 3 | Assassinate | Modificatore + Azione | `adv:initiative`. Danno extra = liv nel primo round. |
| 9 | Infiltration Expertise | Testo | |
| 13 | Envenom Weapons | Azione | `2d6` veleno su Colpo astuto Veleno. |
| 17 | Death Strike | Azione | TS COS CD `8 + DES + PB`: danni raddoppiati. |

**Soulknife**

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 3 | Psionic Power | Risorsa | Come il Guerriero psionico: 4/6 (5)/8 (9)/10 (13)/12 (17), d6 → d12. |
| 3 | Psi-Bolstered Knack | Testo | Dado aggiunto alla prova. |
| 3 | Psychic Whispers | Azione | Durata = dado in ore. Il primo uso dopo il LR è gratis. |
| 3 | Psychic Blades | Azione ×2 + Opzione | Lama psichica (`items.json`): arma semplice, attacco con DES o FOR, `1d6` psichico, Finesse e da lancio (gittata 18/36 m). Seconda lama, azione bonus: `1d4`. Maestria Vex in più, fuori dal conteggio di Weapon Mastery. |
| 9 | Soul Blades: Homing Strikes | Testo | |
| 9 | Soul Blades: Psychic Teleportation | Testo | Consuma un dado. |
| 13 | Psychic Veil | Risorsa | 1/LR (si ricarica con un dado). |
| 17 | Rend Mind | Risorsa + Azione | 1/LR (o 3 dadi). TS SAG CD `8 + DES + PB`. |

**Thief**

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 3 | Fast Hands | Testo | |
| 3 | Second-Story Work | Manca + Testo | Velocità di scalata; salto con DES. |
| 9 | Supreme Sneak | Testo | |
| 13 | Use Magic Device | Testo | 4 oggetti in sintonia (TE-35). |
| 17 | Thief's Reflexes | Testo | Secondo turno con iniziativa −10. |

## Stregone

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 1 | Innate Sorcery | Risorsa + Effetto | 2/LR. `spellSaveDc +1`; vantaggio agli attacchi degli incantesimi (non c'è un target solo per gli incantesimi: Testo). |
| 1 | Spellcasting | Scala + Scelta | Incantatore completo, CAR. |
| 2 | Font of Magic | Risorsa | Punti stregoneria = liv, LR. Tabella per creare slot: Testo. |
| 2 | Metamagic | Scelta | 2 opzioni; 4 (10); 6 (17). Tabella sotto. |
| 5 | Sorcerous Restoration | Risorsa | 1/LR (punti = metà liv al BR). |
| 7 | Sorcery Incarnate | Testo | |
| 20 | Arcane Apotheosis | Testo | |

Metamagia (10). Ognuna è un tratto che consuma punti stregoneria dal contatore.

| Opzione | Costo | Tipo | Dettaglio |
|---|---|---|---|
| Careful Spell | 1 | Testo | Fino a CAR creature (min 1) riescono il TS. |
| Distant Spell | 1 | Testo | Gittata doppia; contatto diventa 9 m. |
| Empowered Spell | 1 | Testo | Ritira fino a CAR dadi di danno (min 1). |
| Extended Spell | 1 | Testo | Durata doppia; vantaggio ai TS di concentrazione (Manca). |
| Heightened Spell | 2 | Testo | Un bersaglio ha svantaggio al TS. |
| Quickened Spell | 2 | Testo | Lancio come azione bonus. |
| Seeking Spell | 1 | Testo | Ritira il d20 dell'attacco mancato. |
| Subtle Spell | 1 | Testo | Senza componenti V, S, M. |
| Transmuted Spell | 1 | Testo | Cambia il tipo tra acido, freddo, fuoco, fulmine, veleno, tuono. |
| Twinned Spell | 1 | Testo | Livello effettivo +1. |

**Aberrant Sorcery**

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 3 | Psionic Spells | Incantesimo | 3: Arms of Hadar, Calm Emotions, Detect Thoughts, Dissonant Whispers, Mind Sliver; 5: Hunger of Hadar, Sending; 7: Evard's Black Tentacles, Summon Aberration; 9: Rary's Telepathic Bond, Telekinesis. |
| 3 | Telepathic Speech | Testo | |
| 6 | Psionic Sorcery | Testo | |
| 6 | Psychic Defenses | Manca | Resistenza psichica; vantaggio ai TS contro affascinato e spaventato. |
| 14 | Revelation in Flesh | Effetto + Manca | Nuoto, volo e altro: un punto stregoneria per beneficio. |
| 18 | Warping Implosion | Risorsa + Azione | 1/LR (o 5 punti). TS FOR con CD inc., `3d10` forza. |

**Clockwork Sorcery**

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 3 | Clockwork Spells | Incantesimo | 3: Aid, Alarm, Lesser Restoration, Protection from Evil and Good; 5: Dispel Magic, Protection from Energy; 7: Freedom of Movement, Summon Construct; 9: Greater Restoration, Wall of Force. Manifestazione: Testo. |
| 3 | Restore Balance | Risorsa | Usi = CAR (min 1), LR. |
| 6 | Bastion of Law | Testo | Da 1 a 5 punti stregoneria → d8 di protezione. |
| 14 | Trance of Order | Risorsa + Effetto | 1/LR (o 5 punti). Minimo 10 su ogni d20: Manca. |
| 18 | Clockwork Cavalcade | Risorsa | 1/LR (o 7 punti). |

**Draconic Sorcery**

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 3 | Draconic Spells | Incantesimo | 3: Alter Self, Chromatic Orb, Command, Dragon's Breath; 5: Fear, Fly; 7: Arcane Eye, Charm Monster; 9: Legend Lore, Summon Dragon. |
| 3 | Draconic Resilience | Modificatore + Scala + Modificatore condizionale | `hpMax +liv` (3 al 3°, +1 per livello). CA 10 + DES + CAR senza armatura. |
| 6 | Elemental Affinity | Scelta + Manca + Testo | Tipo: acido, freddo, fuoco, fulmine o veleno. Resistenza: Manca. +CAR a un danno: Testo. |
| 14 | Dragon Wings | Risorsa + Manca | 1/LR (o 3 punti). Volo 18 m. |
| 18 | Dragon Companion | Risorsa | Summon Dragon gratis 1/LR. |

**Wild Magic Sorcery**

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 3 | Tides of Chaos | Risorsa | 1/LR (torna dopo un'ondata). |
| 3 | Wild Magic Surge | Azione + Testo | Tiro d20; tabella d100 nel testo. |
| 6 | Bend Luck | Azione | `1d4`, 1 punto stregoneria. |
| 14 | Controlled Chaos | Testo | |
| 18 | Tamed Surge | Risorsa | 1/LR. |

## Warlock

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 1 | Eldritch Invocations | Scelta | Numero dalla tabella: 1/3 (2)/5 (5)/6 (7)/7 (9)/8 (12)/9 (15)/10 (18). Classificazione sotto. |
| 1 | Pact Magic | Scala + Scelta | Slot del patto, BR (`slotRecovery: short`), CAR. |
| 2 | Magical Cunning | Risorsa | 1/LR. |
| 9 | Contact Patron | Incantesimo + Risorsa | Contact Other Plane sempre preparato; 1/LR. |
| 11 / 13 / 15 / 17 | Mystic Arcanum | Scelta + Incantesimo + Risorsa | 1 incantesimo di 6°/7°/8°/9°, ognuno 1/LR. |
| 20 | Eldritch Master | Scala | Scaltrezza magica recupera tutti gli slot. |

Invocazioni (28). "A volontà" = incantesimo senza slot, senza limite di usi.

| Invocazione | Prerequisito | Tipo | Dettaglio |
|---|---|---|---|
| Agonizing Blast | liv 2, trucchetto che fa danni | Scelta + Scala | `addAbilityMod` sul trucchetto scelto. Si può prendere più volte. |
| Armor of Shadows | — | Incantesimo | Mage Armor a volontà su di sé. |
| Ascendant Step | liv 5 | Incantesimo | Levitate a volontà su di sé. |
| Devil's Sight | liv 2 | Manca | Vede nell'oscurità magica, 36 m. |
| Devouring Blade | liv 12, Thirsting Blade | Testo | 2 attacchi extra con l'arma del patto. |
| Eldritch Mind | — | Manca | Vantaggio ai TS di concentrazione. |
| Eldritch Smite | liv 5, Pact of the Blade | Azione | Danno extra `1d8` + 1d8 per livello dello slot, forza; prono. Consuma uno slot del patto. |
| Eldritch Spear | liv 2, trucchetto che fa danni | Scelta + Scala | Gittata del trucchetto + 9 m × liv. Si può prendere più volte. |
| Fiendish Vigor | liv 2 | Incantesimo | False Life a volontà su di sé, PF temporanei al massimo. |
| Gaze of Two Minds | liv 5 | Testo | |
| Gift of the Depths | liv 5 | Manca + Incantesimo + Risorsa | Respira sott'acqua, nuoto. Water Breathing gratis 1/LR. |
| Gift of the Protectors | liv 9, Pact of the Tome | Risorsa + Testo | 1/LR. Nomi sulla pagina = CAR (min 1). |
| Investment of the Chain Master | liv 5, Pact of the Chain | Testo | Potenzia il famiglio. |
| Lessons of the First Ones | liv 2 | Scelta | Un talento delle origini. Si può prendere più volte. |
| Lifedrinker | liv 9, Pact of the Blade | Azione | Danno extra `1d6` necrotico, psichico o radioso; spendi un dado vita per curarti dado + COS. |
| Mask of Many Faces | liv 2 | Incantesimo | Disguise Self a volontà. |
| Master of Myriad Forms | liv 5 | Incantesimo | Alter Self a volontà. |
| Misty Visions | liv 2 | Incantesimo | Silent Image a volontà. |
| One with Shadows | liv 5 | Incantesimo | Invisibility a volontà su di sé, in penombra o al buio. |
| Otherworldly Leap | liv 2 | Incantesimo | Jump a volontà su di sé. |
| Pact of the Blade | — | Azione + Competenza | Arma del patto: competenza, attacco e danno con CAR, danni necrotici, psichici o radiosi. |
| Pact of the Chain | — | Incantesimo | Find Familiar senza slot (CAR); forme speciali: Testo. |
| Pact of the Tome | — | Scelta + Incantesimo | 3 trucchetti e 2 rituali di 1° livello da qualsiasi lista, preparati finché si ha il libro (CAR). |
| Repelling Blast | liv 2, trucchetto con attacco | Scelta + Testo | Spinta di 3 m. Si può prendere più volte. |
| Thirsting Blade | liv 5, Pact of the Blade | Testo | Attacco extra con l'arma del patto. |
| Visions of Distant Realms | liv 9 | Incantesimo | Arcane Eye a volontà. |
| Whispers of the Grave | liv 7 | Incantesimo | Speak with Dead a volontà. |
| Witch Sight | liv 15 | Manca | Vista pura 9 m. |

I prerequisiti vanno controllati nel level up. Esempio: Eldritch Smite solo con Pact of the Blade e dal liv 5.

**Archfey Patron**

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 3 | Archfey Spells | Incantesimo | 3: Calm Emotions, Faerie Fire, Misty Step, Phantasmal Force, Sleep; 5: Blink, Plant Growth; 7: Dominate Beast, Greater Invisibility; 9: Dominate Person, Seeming. |
| 3 | Steps of the Fey | Risorsa + Azione | Misty Step gratis CAR volte (min 1), LR. PF temporanei `1d10`; TS SAG con CD inc. |
| 6 | Misty Escape | Scala + Azione | Invisibilità; TS SAG `2d10` psichici. |
| 10 | Beguiling Defenses | Manca + Risorsa + Azione | Immune ad affascinato. Reazione 1/LR (o slot): TS SAG. |
| 14 | Bewitching Magic | Testo | |

**Celestial Patron**

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 3 | Celestial Spells | Incantesimo | 3: Aid, Cure Wounds, Guiding Bolt, Lesser Restoration, Light, Sacred Flame; 5: Daylight, Revivify; 7: Guardian of Faith, Wall of Fire; 9: Greater Restoration, Summon Celestial. |
| 3 | Healing Light | Risorsa + Azione | Dadi d6 = 1 + liv, LR. Cura fino a CAR dadi alla volta. |
| 6 | Radiant Soul | Manca + Testo | Resistenza radiosa; +CAR ai danni radiosi e da fuoco. |
| 10 | Celestial Resilience | Azione | PF temporanei liv + CAR (alleati: liv/2 + CAR). |
| 14 | Searing Vengeance | Risorsa + Azione | 1/LR. `2d8 + CAR` radiosi. |

**Fiend Patron**

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 3 | Fiend Spells | Incantesimo | 3: Burning Hands, Command, Scorching Ray, Suggestion; 5: Fireball, Stinking Cloud; 7: Fire Shield, Wall of Fire; 9: Geas, Insect Plague. |
| 3 | Dark One's Blessing | Azione | PF temporanei CAR + liv. |
| 6 | Dark One's Own Luck | Risorsa + Azione | Usi = CAR (min 1), LR. `1d10`. |
| 10 | Fiendish Resilience | Scelta + Manca | Resistenza a scelta, si cambia al riposo. |
| 14 | Hurl Through Hell | Risorsa + Azione | 1/LR (o slot). TS CAR con CD inc., `8d10` psichici. |

**Great Old One Patron**

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 3 | Great Old One Spells | Incantesimo | 3: Detect Thoughts, Dissonant Whispers, Phantasmal Force, Tasha's Hideous Laughter; 5: Clairvoyance, Hunger of Hadar; 7: Confusion, Summon Aberration; 9: Modify Memory, Telekinesis. |
| 3 | Awakened Mind | Testo | |
| 3 | Psychic Spells | Testo | |
| 6 | Clairvoyant Combatant | Risorsa + Azione | 1/BR (o slot). TS SAG con CD inc. |
| 10 | Eldritch Hex | Incantesimo + Testo | Hex sempre preparato. |
| 10 | Thought Shield | Manca + Testo | Resistenza psichica. |
| 14 | Create Thrall | Testo | |

## Mago

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 1 | Arcane Recovery | Risorsa | 1/LR; livelli di slot = liv/2 per eccesso (Testo). |
| 1 | Ritual Adept | Testo | |
| 1 | Spellcasting | Scala + Scelta | Incantatore completo, INT. Libro: 6 incantesimi al 1°, +2 per livello. |
| 2 | Scholar | Maestria + Scelta | 1 abilità tra Arcano, Storia, Indagare, Medicina, Natura, Religione. |
| 5 | Memorize Spell | Testo | |
| 18 | Spell Mastery | Scelta + Incantesimo | 1 incantesimo di 1° e 1 di 2°, sempre preparati, a volontà. |
| 20 | Signature Spells | Scelta + Incantesimo + Risorsa | 2 incantesimi di 3° sempre preparati; ognuno 1/BR. |

**Abjurer**

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 3 | Abjuration Savant | Scelta + Incantesimo | 2 abiurazioni di livello ≤ 2 nel libro; +1 a ogni nuovo livello di slot. |
| 3 | Arcane Ward | Risorsa | PF della protezione = 2 × liv + INT, LR. |
| 6 | Projected Ward | Testo | |
| 10 | Spell Breaker | Incantesimo + Testo | Counterspell, Dispel Magic sempre preparati. |
| 14 | Spell Resistance | Manca | Vantaggio ai TS contro gli incantesimi; resistenza ai loro danni. |

**Diviner**

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 3 | Divination Savant | Scelta + Incantesimo | Come l'abiuratore, scuola di Divinazione. |
| 3 | Portent | Risorsa + Azione | 2 presagi, LR. Azione: tira `2d20` (3d20 al 14). |
| 6 | Expert Divination | Testo | |
| 10 | The Third Eye | Risorsa + Scelta | 1/BR. Scurovisione 36 m (Manca) / leggere ogni lingua / See Invisibility. |
| 14 | Greater Portent | Scala | 3 presagi. |

**Evoker**

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 3 | Evocation Savant | Scelta + Incantesimo | Scuola di Evocazione. |
| 3 | Potent Cantrip | Testo | |
| 6 | Sculpt Spells | Testo | |
| 10 | Empowered Evocation | Scala | `addAbilityMod` sulle evocazioni da mago (un solo tiro di danno). |
| 14 | Overchannel | Testo | `2d12` necrotici per livello dal secondo uso. |

**Illusionist**

| Liv | Privilegio | Tipo | Dettaglio |
|---|---|---|---|
| 3 | Illusion Savant | Scelta + Incantesimo | Scuola di Illusione. |
| 3 | Improved Illusions | Incantesimo + Testo | Minor Illusion (o un altro trucchetto se già noto), fuori dal conteggio. |
| 6 | Phantasmal Creatures | Incantesimo + Risorsa | Summon Beast, Summon Fey sempre preparati; ognuno gratis 1/LR. |
| 10 | Illusory Self | Risorsa | 1/BR (o slot di 2°+). |
| 14 | Illusory Reality | Testo | |

---

## Talenti

77 talenti XPHB: 10 delle origini, 43 generali (compreso Ability Score Improvement), 10 Stile di combattimento più Blessed Warrior e Druidic Warrior (tabella sopra), 12 Doni epici (tabella sopra).
Un talento diventa un tratto (`traits`, `sourceKind: "Feat"`) con i modificatori e le voci collegate qui sotto.

**Regola comune ai talenti generali:** prerequisito livello 4 e Scelta + Modificatore `ability:<a> +1` (massimo 20) fra le caratteristiche della colonna "+1". La colonna "Prerequisito" indica solo i requisiti oltre al livello 4.

**Incantesimi dei talenti:** sempre preparati (Incantesimo). Se si possono lanciare "senza slot 1 volta", è una Risorsa 1/LR per incantesimo, collegata all'incantesimo. La caratteristica è quella aumentata dal talento (`additionalSpells.ability: "inherit"`), oppure scelta (Magic Initiate).

### Talenti delle origini (10)

Vengono dal background (vedi sotto) o da Human: Versatile.

| Talento | Tipo | Dettaglio |
|---|---|---|
| Alert | Modificatore + Testo | `initiative +0 +PB` (`proficient`). Scambio d'iniziativa: Testo. Oggi `TRAIT_MODIFIERS` usa `initiative +2`, che è sbagliato dal liv 5. |
| Crafter | Competenza + Scelta + Testo | 3 strumenti da artigiano (falegname, conciatore, muratore, vasaio, fabbro, inventore, tessitore, intagliatore). Sconto 20% e Fabbricazione rapida: Testo. |
| Healer | Azione + Testo | Medico da campo: cura = 1 DV del bersaglio + PB (consuma un uso del kit). Ritiro degli 1 sulle cure: Testo. |
| Lucky | Risorsa + Scala | Punti fortuna = PB, LR. Vantaggio a una prova d20 o svantaggio a un attacco contro di sé: Testo. |
| Magic Initiate | Scelta + Incantesimo + Risorsa | Lista (Chierico / Druido / Mago) e caratteristica (INT / SAG / CAR). 2 trucchetti + 1 incantesimo di 1° sempre preparato, gratis 1/LR. A ogni livello si può cambiare un incantesimo. Ripetibile con un'altra lista. Dal background la lista è fissa: Acolyte → Chierico, Guide → Druido, Sage → Mago. |
| Musician | Competenza + Scelta + Testo | 3 strumenti musicali. Canzone incoraggiante (Ispirazione eroica a PB alleati dopo un riposo): Testo. |
| Savage Attacker | Testo | Tira due volte i dadi del danno dell'arma, 1 volta per turno. |
| Skilled | Competenza + Scelta | 3 fra abilità e strumenti, in qualunque combinazione. Ripetibile. |
| Tavern Brawler | Competenza + Azione + Testo | Armi improvvisate. Colpo senz'armi `1d4 + FOR` contundente. Ritiro degli 1 e spinta: Testo. |
| Tough | Modificatore + Scala | `hpMax` = 2 × livello del personaggio, +2 a ogni livello. Oggi `TRAIT_MODIFIERS` usa `hpMax +2` fisso. Serve un modificatore che scala col livello (vedi in fondo). |

### Talenti generali (43)

| Talento | Prerequisito | +1 | Tipo | Dettaglio |
|---|---|---|---|---|
| Ability Score Improvement | — | — | Scelta + Modificatore | `ability:<a> +2`, oppure `+1` e `+1` (massimo 20). Ripetibile. Non ha il +1 della regola comune. |
| Actor | CAR 13 | CAR | Testo | Vantaggio a Inganno e Intrattenere da travestito; Mimica con CD `8 + CAR + PB`. |
| Athlete | FOR o DES 13 | FOR, DES | Manca + Testo | Velocità di scalata = velocità. Rialzarsi e salti: Testo. |
| Charger | FOR o DES 13 | FOR, DES | Testo | Scatto +3 m; carica: `1d8` danni o spinta, 1 volta per turno. |
| Chef | — | COS, SAG | Competenza + Risorsa + Azione | Utensili da cuoco. Bocconcini = PB per LR: Azione bonus, PF temporanei = PB. Pasto (+1d8 PF con i DV al BR): Testo. |
| Crossbow Expert | DES 13 | DES | Testo | Ignora Ricarica; niente svantaggio in mischia; mod. al danno dell'attacco extra. |
| Crusher | — | FOR, COS | Testo | Spinta di 1,5 m; critico contundente: vantaggio agli attacchi contro il bersaglio. |
| Defensive Duelist | DES 13 | DES | Effetto | Parata (reazione, con un'arma Accurata): `ac +0 +PB` contro gli attacchi in mischia fino al turno dopo. |
| Dual Wielder | FOR o DES 13 | FOR, DES | Testo | Attacco extra con un'arma senza Leggera; estrarre due armi. |
| Durable | — | COS | Manca + Azione | Vantaggio ai TS contro la morte: Manca. Azione bonus: spende 1 DV e recupera i PF tirati. |
| Elemental Adept | Incantatore | INT, SAG, CAR | Scelta + Testo | Tipo di danno (acido, freddo, fuoco, fulmine, tuono): ignora la resistenza, gli 1 valgono 2. Ripetibile con un altro tipo. |
| Fey-Touched | — | INT, SAG, CAR | Incantesimo + Scelta + Risorsa ×2 | Misty Step + 1 incantesimo di 1° di Divinazione o Ammaliamento, sempre preparati; ciascuno gratis 1/LR. |
| Grappler | FOR o DES 13 | FOR, DES | Testo | Danno + lotta; vantaggio contro chi si ha in lotta. |
| Great Weapon Master | FOR 13 | FOR | Testo | Danni extra = PB con armi Pesanti nell'azione Attacco; attacco bonus dopo un critico o un nemico a 0 PF. |
| Heavily Armored | Armature medie | COS, FOR | Competenza | Armature pesanti. |
| Heavy Armor Master | Armature pesanti | COS, FOR | Testo | Danni contundenti, perforanti e taglienti ridotti di PB con l'armatura pesante. |
| Inspiring Leader | SAG o CAR 13 | SAG, CAR | Azione | Dopo un riposo: fino a 6 alleati ottengono PF temporanei = livello del personaggio + mod. della caratteristica aumentata. |
| Keen Mind | INT 13 | INT | Competenza o Maestria + Scelta + Testo | 1 fra Arcano, Storia, Indagare, Natura, Religione: competenza, oppure Maestria se già competente. Studiare come azione bonus: Testo. |
| Lightly Armored | — | FOR, DES | Competenza | Armature leggere e scudi. |
| Mage Slayer | — | FOR, DES | Risorsa + Testo | Mente protetta: un TS fallito di INT, SAG o CAR diventa un successo, 1/BR. Svantaggio alla concentrazione: Testo. |
| Martial Weapon Training | — | FOR, DES | Competenza | Armi marziali. |
| Medium Armor Master | Armature medie | FOR, DES | Manca | Con DES 16+ l'armatura media somma fino a +3 di DES invece di +2. Oggi il limite +2 è fisso nel calcolo della CA. |
| Moderately Armored | Armature leggere | FOR, DES | Competenza | Armature medie. |
| Mounted Combatant | — | FOR, DES, SAG | Testo | |
| Observant | INT o SAG 13 | INT, SAG | Competenza o Maestria + Scelta + Testo | 1 fra Intuizione, Indagare, Percezione: competenza, oppure Maestria se già competente. Cercare come azione bonus: Testo. |
| Piercer | — | FOR, DES | Testo | Ritira un dado perforante; un dado in più sul critico. |
| Poisoner | — | DES, INT | Competenza + Azione + Testo | Kit da avvelenatore. Dose: TS COS CD `8 + mod. aumentata + PB`, `2d8` veleno e avvelenato. Ignora la resistenza al veleno: Testo. |
| Polearm Master | FOR o DES 13 | DES, FOR | Azione + Testo | Attacco bonus con l'altra estremità `1d4` contundente. Attacco di reazione: Testo. |
| Resilient | — | Scelta | Scelta + Modificatore + Competenza | Una caratteristica senza competenza nel TS: `ability:<a> +1` e competenza nel TS della stessa. |
| Ritual Caster | INT, SAG o CAR 13 | INT, SAG, CAR | Scelta + Incantesimo + Scala + Risorsa | Incantesimi rituali di 1° = PB, sempre preparati; +1 quando sale il PB (liv 5, 9, 13, 17). Rituale rapido 1/LR. |
| Sentinel | FOR o DES 13 | FOR, DES | Testo | |
| Shadow-Touched | — | INT, SAG, CAR | Incantesimo + Scelta + Risorsa ×2 | Invisibility + 1 incantesimo di 1° di Illusione o Necromanzia, sempre preparati; ciascuno gratis 1/LR. |
| Sharpshooter | DES 13 | DES | Testo | Ignora copertura, mischia e gittata lunga. |
| Shield Master | Scudi | FOR | Azione + Testo | Colpo di scudo: TS FOR CD `8 + FOR + PB`, spinta o prono. Interporre lo scudo: Testo. |
| Skill Expert | — | Qualsiasi | Competenza + Maestria + Scelta | 1 abilità a scelta; Maestria in 1 abilità in cui si è competenti. |
| Skulker | DES 13 | DES | Manca + Testo | Vista cieca 3 m. Vantaggio a Furtività per nascondersi in combattimento: Testo. |
| Slasher | — | FOR, DES | Testo | Velocità −3 m al bersaglio; critico: svantaggio agli attacchi del bersaglio. |
| Speedy | DES o COS 13 | DES, COS | Modificatore + Testo | `speed +3` (10 ft). Scatto su terreno difficile e svantaggio agli attacchi di opportunità: Testo. |
| Spell Sniper | Incantatore | INT, SAG, CAR | Testo | Ignora copertura e mischia; gittata +18 m. |
| Telekinetic | — | INT, SAG, CAR | Incantesimo + Azione | Mage Hand (senza componenti, invisibile, +9 m). Spinta telecinetica: azione bonus, TS FOR CD `8 + mod. aumentata + PB`. |
| Telepathic | — | INT, SAG, CAR | Incantesimo + Risorsa + Testo | Detect Thoughts sempre preparato, gratis 1/LR. Telepatia 18 m: Testo. |
| War Caster | Incantatore | INT, SAG, CAR | Manca + Testo | Vantaggio ai TS di COS per la concentrazione: Manca. Incantesimo come reazione e componenti somatiche: Testo. |
| Weapon Master | — | FOR, DES | Opzione + Scelta | `weaponMasteries` +1 arma; si cambia a ogni LR. |

## Specie

10 specie XPHB. Nel 2024 le specie non danno aumenti di caratteristica: vengono dal background.
Comuni a tutte: tipo umanoide, Taglia (Scelta fra Piccola e Media per Aasimar, Human e Tiefling) e velocità base 9 m (Goliath 10,5 m).
"Liv personaggio" = livello totale, non quello della classe: specie e talenti scalano con quello.

| Specie | Tratto | Tipo | Dettaglio |
|---|---|---|---|
| Aasimar | Celestial Resistance | Manca | Resistenza a necrotico e radiante. |
| | Darkvision | Manca | 18 m. |
| | Healing Hands | Risorsa + Azione + Scala | 1/LR. Cura `PBd4` (il numero di dadi cresce col PB). |
| | Light Bearer | Incantesimo | Light, CAR. |
| | Celestial Revelation (liv personaggio 3) | Risorsa + Scelta + Effetto + Azione | 1/LR, forma scelta a ogni uso, 1 minuto. Danni extra = PB 1 volta per turno (necrotici o radiosi): Effetto `damage +0 +PB`. Ali celesti: volo = velocità (Manca). Radiosità interiore: `PB` radiosi entro 3 m a fine turno. Sudario necrotico: TS CAR CD `8 + CAR + PB`, spaventato. |
| Dragonborn | Draconic Ancestry | Scelta | Drago: nero/rame acido, blu/bronzo fulmine, ottone/oro/rosso fuoco, verde veleno, argento/bianco freddo. |
| | Breath Weapon | Risorsa + Azione + Scala | Usi = PB, LR. Sostituisce un attacco: cono 4,5 m o linea 9 m, TS DES CD `8 + COS + PB`, `1d10` del tipo scelto; 2d10 (liv personaggio 5), 3d10 (11), 4d10 (17). |
| | Damage Resistance | Manca | Resistenza al tipo scelto. |
| | Darkvision | Manca | 18 m. |
| | Draconic Flight (liv personaggio 5) | Risorsa + Manca | 1/LR, 10 minuti, volo = velocità. |
| Dwarf | Darkvision | Manca | 36 m. |
| | Dwarven Resilience | Manca | Resistenza al veleno; vantaggio ai TS contro avvelenato. |
| | Dwarven Toughness | Modificatore + Scala | `hpMax` = livello del personaggio. Oggi `TRAIT_MODIFIERS` usa `hpMax +1` fisso. |
| | Stonecunning | Risorsa + Manca | Usi = PB, LR. Senso tellurico 18 m per 10 minuti su pietra. |
| Elf | Darkvision | Manca | 18 m (Drow 36 m). |
| | Elven Lineage | Scelta + Incantesimo + Risorsa | Lignaggio e caratteristica (INT / SAG / CAR). Incantesimi di liv personaggio 3 e 5 sempre preparati, ciascuno gratis 1/LR. Drow: Dancing Lights; Faerie Fire (3), Darkness (5). Alto elfo: Prestidigitation (si cambia a ogni LR con un trucchetto da mago); Detect Magic (3), Misty Step (5). Elfo dei boschi: `speed +1,5` (35 ft), Druidcraft; Longstrider (3), Pass without Trace (5). |
| | Fey Ancestry | Manca | Vantaggio ai TS contro affascinato. |
| | Keen Senses | Competenza + Scelta | 1 fra Intuizione, Percezione, Sopravvivenza. |
| | Trance | Testo | Riposo lungo in 4 ore. |
| Gnome | Darkvision | Manca | 18 m. |
| | Gnomish Cunning | Modificatore | `adv:save:intelligence`, `adv:save:wisdom`, `adv:save:charisma`. |
| | Gnomish Lineage | Scelta + Incantesimo + Risorsa | Lignaggio e caratteristica (INT / SAG / CAR). Gnomo dei boschi: Minor Illusion; Speak with Animals sempre preparato, gratis PB volte per LR. Gnomo delle rocce: Mending, Prestidigitation; congegni meccanici: Testo. |
| Goliath | Giant Ancestry | Scelta + Risorsa + Azione | Usi = PB, LR. Nube: teletrasporto 9 m (Testo). Fuoco: `1d10` fuoco. Gelo: `1d6` freddo, velocità −3 m. Collina: prono (Testo). Pietra: reazione, riduce i danni di `1d12 + COS`. Tempesta: reazione, `1d8` tuono. |
| | Large Form (liv personaggio 5) | Risorsa + Effetto | 1/LR, 10 minuti: `adv:check:strength`, `speed +3`. Taglia Grande: Testo. |
| | Powerful Build | Testo | Vantaggio per liberarsi dalla lotta; capacità di carico. |
| Halfling | Brave | Manca | Vantaggio ai TS contro spaventato. |
| | Luck | Testo | Ritira gli 1 nelle prove d20. |
| | Halfling Nimbleness, Naturally Stealthy | Testo | |
| Human | Resourceful | Testo | Ispirazione eroica dopo ogni LR. Il campo `inspiration` esiste già: il riposo lungo potrebbe accenderlo. |
| | Skillful | Competenza + Scelta | 1 abilità a scelta. |
| | Versatile | Scelta | 1 talento delle origini (Skilled consigliato). |
| Orc | Adrenaline Rush | Risorsa + Azione | Usi = PB, BR. Scatto come azione bonus, PF temporanei = PB. |
| | Darkvision | Manca | 36 m. |
| | Relentless Endurance | Risorsa + Testo | 1/LR: a 0 PF si resta a 1. |
| Tiefling | Darkvision | Manca | 18 m. |
| | Fiendish Legacy | Scelta + Manca + Incantesimo + Risorsa | Retaggio e caratteristica (INT / SAG / CAR). Incantesimi di liv personaggio 3 e 5 sempre preparati, gratis 1/LR. Abissale: resistenza al veleno, Poison Spray; Ray of Sickness (3), Hold Person (5). Ctonio: resistenza al necrotico, Chill Touch; False Life (3), Ray of Enfeeblement (5). Infernale: resistenza al fuoco, Fire Bolt; Hellish Rebuke (3), Darkness (5). |
| | Otherworldly Presence | Incantesimo | Thaumaturgy, con la caratteristica del retaggio. |

## Background

16 background XPHB. Tutti hanno la stessa forma:

| Voce | Tipo | Dettaglio |
|---|---|---|
| Caratteristiche | Scelta + Modificatore | Fra le tre indicate: `+2` e `+1`, oppure `+1` a tutte e tre (massimo 20). |
| Talento | Scelta (solo se il talento ne ha) | Il talento delle origini indicato (tabella sopra). |
| Abilità | Competenza | Le due indicate. |
| Strumento | Competenza (+ Scelta) | Quello indicato, o uno a scelta del tipo indicato. |
| Equipaggiamento | Scelta | Pacchetto A, oppure 50 mo. Va in `inventory`. |

| Background | Caratteristiche | Talento | Abilità | Strumento |
|---|---|---|---|---|
| Acolyte | INT, SAG, CAR | Magic Initiate (Chierico) | Intuizione, Religione | Strumenti da calligrafo |
| Artisan | FOR, DES, INT | Crafter | Indagare, Persuasione | 1 strumento da artigiano a scelta |
| Charlatan | DES, COS, CAR | Skilled | Inganno, Rapidità di mano | Kit da falsario |
| Criminal | DES, COS, INT | Alert | Rapidità di mano, Furtività | Arnesi da scasso |
| Entertainer | FOR, DES, CAR | Musician | Acrobazia, Intrattenere | 1 strumento musicale a scelta |
| Farmer | FOR, COS, SAG | Tough | Addestrare animali, Natura | Strumenti da falegname |
| Guard | FOR, INT, SAG | Alert | Atletica, Percezione | 1 set da gioco a scelta |
| Guide | DES, COS, SAG | Magic Initiate (Druido) | Furtività, Sopravvivenza | Strumenti da cartografo |
| Hermit | COS, SAG, CAR | Healer | Medicina, Religione | Kit da erborista |
| Merchant | COS, INT, CAR | Lucky | Addestrare animali, Persuasione | Strumenti da navigatore |
| Noble | FOR, INT, CAR | Skilled | Storia, Persuasione | 1 set da gioco a scelta |
| Sage | COS, INT, SAG | Magic Initiate (Mago) | Arcano, Storia | Strumenti da calligrafo |
| Sailor | FOR, DES, SAG | Tavern Brawler | Acrobazia, Percezione | Strumenti da navigatore |
| Scribe | DES, INT, SAG | Skilled | Indagare, Percezione | Strumenti da calligrafo |
| Soldier | FOR, DES, COS | Savage Attacker | Atletica, Intimidire | 1 set da gioco a scelta |
| Wayfarer | DES, SAG, CAR | Lucky | Intuizione, Furtività | Arnesi da scasso |

## Cosa cambia al level up oltre alla classe

Questi valori dipendono dal livello del personaggio o dal PB, non dalla classe. Il level up li deve ricalcolare a ogni livello, anche quando il livello si prende in un'altra classe.

| Quando | Cosa |
|---|---|
| Ogni livello | Tough (+2 `hpMax`), Dwarven Toughness (+1 `hpMax`). Magic Initiate: si può cambiare un incantesimo. Blessed / Druidic Warrior: si può cambiare un trucchetto (solo nella propria classe). |
| Aumento del PB (liv personaggio 5, 9, 13, 17) | Risorse con usi = PB: Lucky, Chef, Breath Weapon, Stonecunning, Giant Ancestry, Adrenaline Rush, Speak with Animals dello gnomo. Dadi di Healing Hands. Ritual Caster: +1 rituale (Scelta). Alert: si aggiorna da solo con `proficient`. |
| Liv personaggio 3 | Aasimar: Celestial Revelation. Elf, Tiefling: incantesimo del lignaggio di 1°. |
| Liv personaggio 5 | Dragonborn: Draconic Flight e Breath Weapon 2d10. Goliath: Large Form. Elf, Tiefling: incantesimo del lignaggio di 2°. |
| Liv personaggio 11, 17 | Dragonborn: Breath Weapon 3d10, 4d10. |
| Livello di classe con ASI | Scelta fra Ability Score Improvement e un talento generale di cui si soddisfa il prerequisito (caratteristica 13, competenza nelle armature, incantatore). |
| Livello di classe 19 | Dono epico. |

## Cosa manca nel modello

Elenco per numero di privilegi colpiti. Senza queste cose il privilegio resta Testo.

1. **Modificatori condizionali** ("senza armatura", "senza armatura pesante", "solo a distanza"). Difesa senza armatura (Barbaro, Monaco, Bardo della danza, Stregone draconico), Movimento rapido, Movimento senza armatura, Roving, 4 stili di combattimento. Proposta minima: una condizione sul modificatore (`when?: "noArmor" | "noHeavyArmor" | "noArmorNoShield"`), letta dove si calcola la CA e la velocità.
2. **Resistenze e immunità del PG** (circa 25 privilegi di classe, più Aasimar, Dragonborn, Dwarf, Tiefling e il dono Energy Resistance: Ira, Avatar della battaglia, auree del Paladino, Mente protetta…). Proposta: `combat.resistances` / `immunities` come testo, come per i mostri (`resistances?: string`).
3. **Sensi e velocità speciali** (scurovisione, vista cieca, scalare, nuotare, volare: circa 15 privilegi di classe, più 8 specie su 10 e i talenti Athlete e Skulker). Proposta: un campo testo `combat.senses` e velocità aggiuntive.
4. **Recupero parziale** (1 uso al BR, tutti al LR: Ira, Incanalare divinità, Forma selvatica, Recuperare energie, dadi psionici). `CounterRecovery` ha solo `short`/`long`.
5. **Vantaggio ai TS contro la morte / concentrazione / condizioni** (Sopravvissuto, Mente arcana, Torsione ammaliante…): non ci sono target `adv:` per questi tiri.
6. **Minimo +1** sul modificatore della caratteristica (Aura di protezione, Taumaturgo, Mago della natura…). `StatModifier` non ha un minimo.
7. **Massimo del punteggio** (20 per l'ASI, 25 per Campione primordiale e Corpo e mente, 30 per i doni epici). `ability:` somma senza limite (vedi TE-71).
8. **Vantaggio solo per gli incantesimi** (Stregoneria innata) e per un solo bersaglio (Voto di inimicizia): oggi `adv:attack` vale per tutto.
9. **Modificatori che scalano col livello del personaggio** (Tough: 2 × livello; Dwarven Toughness: 1 × livello). `scale` ha solo `"rage"`. Proposta: `scale: "level"`, con `amount` moltiplicato per il livello totale.
10. **Limite di DES dell'armatura media** (Medium Armor Master: +3 con DES 16+). Oggi il +2 è fisso nel calcolo della CA.
11. **Vantaggio ai TS contro una condizione** (Dwarf, Elf, Halfling): stesso problema del punto 5.
