# Copertura dei privilegi PHB 2024

Generata da `src/classCoverage.test.ts` con i dati di `npm run data:5etools`. Rigenerare: `npx vitest run src/classCoverage.test.ts -u`.
I tipi con `?` sono indovinati dal testo ("choose", "expended uses"…): da controllare a mano.

| Tipo | Privilegi |
| --- | --- |
| solo testo | 237 |
| risorsa | 78 |
| scelta mancante? | 74 |
| aumento caratteristiche | 63 |
| incantesimi sempre preparati mancanti? | 38 |
| sottoclasse | 12 |
| incantesimi | 10 |
| attacchi | 9 |
| Maestria | 6 |
| opzione scheda | 4 |
| modificatore | 3 |

| Classe | Sottoclasse | Liv. | Privilegio | Tipo |
| --- | --- | --- | --- | --- |
| Barbarian |  | 1 | Rage | risorsa |
| Barbarian |  | 1 | Unarmored Defense | modificatore |
| Barbarian |  | 1 | Weapon Mastery | scelta mancante? |
| Barbarian |  | 2 | Danger Sense | solo testo |
| Barbarian |  | 2 | Reckless Attack | solo testo |
| Barbarian |  | 3 | Barbarian Subclass | sottoclasse |
| Barbarian |  | 3 | Primal Knowledge | scelta mancante? |
| Barbarian | Path of the Berserker | 3 | Path of the Berserker | solo testo |
| Barbarian | Path of the Berserker | 3 | Frenzy | solo testo |
| Barbarian | Path of the Wild Heart | 3 | Path of the Wild Heart | solo testo |
| Barbarian | Path of the Wild Heart | 3 | Animal Speaker | solo testo |
| Barbarian | Path of the Wild Heart | 3 | Rage of the Wilds | scelta mancante? |
| Barbarian | Path of the World Tree | 3 | Path of the World Tree | solo testo |
| Barbarian | Path of the World Tree | 3 | Vitality of the Tree | scelta mancante? |
| Barbarian | Path of the Zealot | 3 | Path of the Zealot | solo testo |
| Barbarian | Path of the Zealot | 3 | Divine Fury | scelta mancante? |
| Barbarian | Path of the Zealot | 3 | Warrior of the Gods | risorsa |
| Barbarian |  | 4 | Ability Score Improvement | aumento caratteristiche |
| Barbarian |  | 5 | Extra Attack | attacchi |
| Barbarian |  | 5 | Fast Movement | modificatore |
| Barbarian | Path of the Berserker | 6 | Mindless Rage | solo testo |
| Barbarian | Path of the Wild Heart | 6 | Aspect of the Wilds | scelta mancante? |
| Barbarian | Path of the World Tree | 6 | Branches of the Tree | solo testo |
| Barbarian | Path of the Zealot | 6 | Fanatical Focus | solo testo |
| Barbarian |  | 7 | Feral Instinct | solo testo |
| Barbarian |  | 7 | Instinctive Pounce | solo testo |
| Barbarian |  | 8 | Ability Score Improvement | aumento caratteristiche |
| Barbarian |  | 9 | Brutal Strike | scelta mancante? |
| Barbarian | Path of the Berserker | 10 | Retaliation | solo testo |
| Barbarian | Path of the Wild Heart | 10 | Nature Speaker | solo testo |
| Barbarian | Path of the World Tree | 10 | Battering Roots | solo testo |
| Barbarian | Path of the Zealot | 10 | Zealous Presence | risorsa |
| Barbarian |  | 11 | Relentless Rage | solo testo |
| Barbarian |  | 12 | Ability Score Improvement | aumento caratteristiche |
| Barbarian |  | 13 | Improved Brutal Strike | solo testo |
| Barbarian | Path of the Berserker | 14 | Intimidating Presence | risorsa |
| Barbarian | Path of the Wild Heart | 14 | Power of the Wilds | scelta mancante? |
| Barbarian | Path of the World Tree | 14 | Travel Along the Tree | scelta mancante? |
| Barbarian | Path of the Zealot | 14 | Rage of the Gods | risorsa |
| Barbarian |  | 15 | Persistent Rage | solo testo |
| Barbarian |  | 16 | Ability Score Improvement | aumento caratteristiche |
| Barbarian |  | 17 | Improved Brutal Strike | solo testo |
| Barbarian |  | 18 | Indomitable Might | solo testo |
| Barbarian |  | 19 | Epic Boon | aumento caratteristiche |
| Barbarian |  | 20 | Primal Champion | solo testo |
| Bard |  | 1 | Bardic Inspiration | risorsa |
| Bard |  | 1 | Spellcasting | incantesimi |
| Bard |  | 2 | Expertise | Maestria |
| Bard |  | 2 | Jack of All Trades | opzione scheda |
| Bard |  | 3 | Bard Subclass | sottoclasse |
| Bard | College of Dance | 3 | College of Dance | solo testo |
| Bard | College of Dance | 3 | Agile Strikes | solo testo |
| Bard | College of Dance | 3 | Bardic Damage | solo testo |
| Bard | College of Dance | 3 | Dance Virtuoso | solo testo |
| Bard | College of Dance | 3 | Dazzling Footwork | solo testo |
| Bard | College of Dance | 3 | Unarmored Defense | solo testo |
| Bard | College of Glamour | 3 | College of Glamour | solo testo |
| Bard | College of Glamour | 3 | Beguiling Magic | incantesimi sempre preparati mancanti? |
| Bard | College of Glamour | 3 | Mantle of Inspiration | scelta mancante? |
| Bard | College of Lore | 3 | College of Lore | solo testo |
| Bard | College of Lore | 3 | Bonus Proficiencies | scelta mancante? |
| Bard | College of Lore | 3 | Cutting Words | solo testo |
| Bard | College of Valor | 3 | College of Valor | solo testo |
| Bard | College of Valor | 3 | Combat Inspiration | solo testo |
| Bard | College of Valor | 3 | Martial Training | solo testo |
| Bard |  | 4 | Ability Score Improvement | aumento caratteristiche |
| Bard |  | 5 | Font of Inspiration | risorsa |
| Bard | College of Dance | 6 | Inspiring Movement | scelta mancante? |
| Bard | College of Dance | 6 | Tandem Footwork | solo testo |
| Bard | College of Glamour | 6 | Mantle of Majesty | incantesimi sempre preparati mancanti? |
| Bard | College of Lore | 6 | Magical Discoveries | incantesimi sempre preparati mancanti? |
| Bard | College of Valor | 6 | Extra Attack | attacchi |
| Bard |  | 7 | Countercharm | solo testo |
| Bard |  | 8 | Ability Score Improvement | aumento caratteristiche |
| Bard |  | 9 | Expertise | Maestria |
| Bard |  | 10 | Magical Secrets | scelta mancante? |
| Bard |  | 12 | Ability Score Improvement | aumento caratteristiche |
| Bard | College of Dance | 14 | Leading Evasion | solo testo |
| Bard | College of Glamour | 14 | Unbreakable Majesty | risorsa |
| Bard | College of Lore | 14 | Peerless Skill | solo testo |
| Bard | College of Valor | 14 | Battle Magic | solo testo |
| Bard |  | 16 | Ability Score Improvement | aumento caratteristiche |
| Bard |  | 18 | Superior Inspiration | solo testo |
| Bard |  | 19 | Epic Boon | aumento caratteristiche |
| Bard |  | 20 | Words of Creation | incantesimi sempre preparati mancanti? |
| Cleric |  | 1 | Spellcasting | incantesimi |
| Cleric |  | 1 | Divine Order | scelta mancante? |
| Cleric |  | 2 | Channel Divinity | risorsa |
| Cleric |  | 3 | Cleric Subclass | sottoclasse |
| Cleric | Life Domain | 3 | Life Domain | scelta mancante? |
| Cleric | Life Domain | 3 | Disciple of Life | solo testo |
| Cleric | Life Domain | 3 | Life Domain Spells | incantesimi sempre preparati mancanti? |
| Cleric | Life Domain | 3 | Preserve Life | scelta mancante? |
| Cleric | Light Domain | 3 | Light Domain | solo testo |
| Cleric | Light Domain | 3 | Light Domain Spells | incantesimi sempre preparati mancanti? |
| Cleric | Light Domain | 3 | Radiance of the Dawn | scelta mancante? |
| Cleric | Light Domain | 3 | Warding Flare | risorsa |
| Cleric | Trickery Domain | 3 | Trickery Domain | solo testo |
| Cleric | Trickery Domain | 3 | Blessing of the Trickster | scelta mancante? |
| Cleric | Trickery Domain | 3 | Invoke Duplicity | solo testo |
| Cleric | Trickery Domain | 3 | Trickery Domain Spells | incantesimi sempre preparati mancanti? |
| Cleric | War Domain | 3 | War Domain | solo testo |
| Cleric | War Domain | 3 | Guided Strike | solo testo |
| Cleric | War Domain | 3 | War Domain Spells | incantesimi sempre preparati mancanti? |
| Cleric | War Domain | 3 | War Priest | risorsa |
| Cleric |  | 4 | Ability Score Improvement | aumento caratteristiche |
| Cleric |  | 5 | Sear Undead | solo testo |
| Cleric | Life Domain | 6 | Blessed Healer | solo testo |
| Cleric | Light Domain | 6 | Improved Warding Flare | risorsa |
| Cleric | Trickery Domain | 6 | Trickster's Transposition | solo testo |
| Cleric | War Domain | 6 | War God's Blessing | solo testo |
| Cleric |  | 7 | Blessed Strikes | scelta mancante? |
| Cleric |  | 8 | Ability Score Improvement | aumento caratteristiche |
| Cleric |  | 10 | Divine Intervention | risorsa |
| Cleric |  | 12 | Ability Score Improvement | aumento caratteristiche |
| Cleric |  | 14 | Improved Blessed Strikes | solo testo |
| Cleric |  | 16 | Ability Score Improvement | aumento caratteristiche |
| Cleric | Life Domain | 17 | Supreme Healing | solo testo |
| Cleric | Light Domain | 17 | Corona of Light | risorsa |
| Cleric | Trickery Domain | 17 | Improved Duplicity | scelta mancante? |
| Cleric | War Domain | 17 | Avatar of Battle | solo testo |
| Cleric |  | 19 | Epic Boon | aumento caratteristiche |
| Cleric |  | 20 | Greater Divine Intervention | scelta mancante? |
| Druid |  | 1 | Druidic | incantesimi sempre preparati mancanti? |
| Druid |  | 1 | Primal Order | scelta mancante? |
| Druid |  | 1 | Spellcasting | incantesimi |
| Druid |  | 2 | Wild Companion | solo testo |
| Druid |  | 2 | Wild Shape | risorsa |
| Druid |  | 3 | Druid Subclass | sottoclasse |
| Druid | Circle of the Land | 3 | Circle of the Land | solo testo |
| Druid | Circle of the Land | 3 | Circle of the Land Spells | incantesimi sempre preparati mancanti? |
| Druid | Circle of the Land | 3 | Land's Aid | scelta mancante? |
| Druid | Circle of the Moon | 3 | Circle Forms | solo testo |
| Druid | Circle of the Moon | 3 | Circle of the Moon | solo testo |
| Druid | Circle of the Moon | 3 | Circle of the Moon Spells | incantesimi sempre preparati mancanti? |
| Druid | Circle of the Sea | 3 | Circle of the Sea | solo testo |
| Druid | Circle of the Sea | 3 | Circle of the Sea Spells | incantesimi sempre preparati mancanti? |
| Druid | Circle of the Sea | 3 | Wrath of the Sea | scelta mancante? |
| Druid | Circle of the Stars | 3 | Circle of the Stars | solo testo |
| Druid | Circle of the Stars | 3 | Star Map | risorsa |
| Druid | Circle of the Stars | 3 | Starry Form | scelta mancante? |
| Druid | Circle of the Stars | 3 | Archer | solo testo |
| Druid | Circle of the Stars | 3 | Chalice | solo testo |
| Druid | Circle of the Stars | 3 | Dragon | solo testo |
| Druid |  | 4 | Ability Score Improvement | aumento caratteristiche |
| Druid |  | 5 | Wild Resurgence | risorsa |
| Druid | Circle of the Land | 6 | Natural Recovery | risorsa |
| Druid | Circle of the Moon | 6 | Improved Circle Forms | solo testo |
| Druid | Circle of the Sea | 6 | Aquatic Affinity | solo testo |
| Druid | Circle of the Stars | 6 | Cosmic Omen | solo testo |
| Druid |  | 7 | Elemental Fury | scelta mancante? |
| Druid |  | 8 | Ability Score Improvement | aumento caratteristiche |
| Druid | Circle of the Land | 10 | Nature's Ward | solo testo |
| Druid | Circle of the Moon | 10 | Moonlight Step | risorsa |
| Druid | Circle of the Sea | 10 | Stormborn | solo testo |
| Druid | Circle of the Stars | 10 | Twinkling Constellations | solo testo |
| Druid |  | 12 | Ability Score Improvement | aumento caratteristiche |
| Druid | Circle of the Land | 14 | Nature's Sanctuary | solo testo |
| Druid | Circle of the Moon | 14 | Lunar Form | solo testo |
| Druid | Circle of the Sea | 14 | Oceanic Gift | solo testo |
| Druid | Circle of the Stars | 14 | Full of Stars | solo testo |
| Druid |  | 15 | Improved Elemental Fury | solo testo |
| Druid |  | 16 | Ability Score Improvement | aumento caratteristiche |
| Druid |  | 18 | Beast Spells | incantesimi sempre preparati mancanti? |
| Druid |  | 19 | Epic Boon | aumento caratteristiche |
| Druid |  | 20 | Archdruid | scelta mancante? |
| Fighter |  | 1 | Fighting Style | scelta mancante? |
| Fighter |  | 1 | Second Wind | risorsa |
| Fighter |  | 1 | Weapon Mastery | scelta mancante? |
| Fighter |  | 2 | Action Surge | risorsa |
| Fighter |  | 2 | Tactical Mind | solo testo |
| Fighter |  | 3 | Fighter Subclass | sottoclasse |
| Fighter | Battle Master | 3 | Battle Master | solo testo |
| Fighter | Battle Master | 3 | Combat Superiority | risorsa |
| Fighter | Battle Master | 3 | Maneuver Options | solo testo |
| Fighter | Battle Master | 3 | Student of War | scelta mancante? |
| Fighter | Champion | 3 | Champion | solo testo |
| Fighter | Champion | 3 | Improved Critical | opzione scheda |
| Fighter | Champion | 3 | Remarkable Athlete | solo testo |
| Fighter | Eldritch Knight | 3 | Eldritch Knight | solo testo |
| Fighter | Eldritch Knight | 3 | Spellcasting | incantesimi |
| Fighter | Eldritch Knight | 3 | War Bond | solo testo |
| Fighter | Psi Warrior | 3 | Psi Warrior | solo testo |
| Fighter | Psi Warrior | 3 | Psionic Power | risorsa |
| Fighter | Psi Warrior | 3 | Protective Field | solo testo |
| Fighter | Psi Warrior | 3 | Psionic Strike | solo testo |
| Fighter | Psi Warrior | 3 | Telekinetic Movement | risorsa |
| Fighter |  | 4 | Ability Score Improvement | aumento caratteristiche |
| Fighter |  | 5 | Extra Attack | attacchi |
| Fighter |  | 5 | Tactical Shift | solo testo |
| Fighter |  | 6 | Ability Score Improvement | aumento caratteristiche |
| Fighter | Battle Master | 7 | Know Your Enemy | risorsa |
| Fighter | Champion | 7 | Additional Fighting Style | scelta mancante? |
| Fighter | Eldritch Knight | 7 | War Magic | solo testo |
| Fighter | Psi Warrior | 7 | Psi-Powered Leap | risorsa |
| Fighter | Psi Warrior | 7 | Telekinetic Adept | solo testo |
| Fighter | Psi Warrior | 7 | Telekinetic Thrust | solo testo |
| Fighter |  | 8 | Ability Score Improvement | aumento caratteristiche |
| Fighter |  | 9 | Indomitable | risorsa |
| Fighter |  | 9 | Tactical Master | solo testo |
| Fighter | Battle Master | 10 | Improved Combat Superiority | solo testo |
| Fighter | Champion | 10 | Heroic Warrior | solo testo |
| Fighter | Eldritch Knight | 10 | Eldritch Strike | solo testo |
| Fighter | Psi Warrior | 10 | Guarded Mind | solo testo |
| Fighter |  | 11 | Two Extra Attacks | attacchi |
| Fighter |  | 12 | Ability Score Improvement | aumento caratteristiche |
| Fighter |  | 13 | Indomitable | risorsa |
| Fighter |  | 13 | Studied Attacks | solo testo |
| Fighter |  | 14 | Ability Score Improvement | aumento caratteristiche |
| Fighter | Battle Master | 15 | Relentless | solo testo |
| Fighter | Champion | 15 | Superior Critical | opzione scheda |
| Fighter | Eldritch Knight | 15 | Arcane Charge | solo testo |
| Fighter | Psi Warrior | 15 | Bulwark of Force | risorsa |
| Fighter |  | 16 | Ability Score Improvement | aumento caratteristiche |
| Fighter |  | 17 | Action Surge | risorsa |
| Fighter |  | 17 | Indomitable | risorsa |
| Fighter | Battle Master | 18 | Ultimate Combat Superiority | solo testo |
| Fighter | Champion | 18 | Survivor | solo testo |
| Fighter | Eldritch Knight | 18 | Improved War Magic | solo testo |
| Fighter | Psi Warrior | 18 | Telekinetic Master | incantesimi sempre preparati mancanti? |
| Fighter |  | 19 | Epic Boon | aumento caratteristiche |
| Fighter |  | 20 | Three Extra Attacks | attacchi |
| Monk |  | 1 | Martial Arts | risorsa |
| Monk |  | 1 | Unarmored Defense | modificatore |
| Monk |  | 2 | Monk's Focus | risorsa |
| Monk |  | 2 | Unarmored Movement | risorsa |
| Monk |  | 2 | Uncanny Metabolism | risorsa |
| Monk |  | 3 | Deflect Attacks | scelta mancante? |
| Monk |  | 3 | Monk Subclass | sottoclasse |
| Monk | Warrior of Mercy | 3 | Warrior of Mercy | solo testo |
| Monk | Warrior of Mercy | 3 | Hand of Harm | solo testo |
| Monk | Warrior of Mercy | 3 | Hand of Healing | solo testo |
| Monk | Warrior of Mercy | 3 | Implements of Mercy | solo testo |
| Monk | Warrior of Shadow | 3 | Shadow Arts | solo testo |
| Monk | Warrior of Shadow | 3 | Warrior of Shadow | solo testo |
| Monk | Warrior of Shadow | 3 | Darkness | solo testo |
| Monk | Warrior of Shadow | 3 | Darkvision | solo testo |
| Monk | Warrior of Shadow | 3 | Shadowy Figments | solo testo |
| Monk | Warrior of the Elements | 3 | Elemental Attunement | solo testo |
| Monk | Warrior of the Elements | 3 | Manipulate Elements | solo testo |
| Monk | Warrior of the Elements | 3 | Warrior of the Elements | solo testo |
| Monk | Warrior of the Open Hand | 3 | Open Hand Technique | solo testo |
| Monk | Warrior of the Open Hand | 3 | Warrior of the Open Hand | solo testo |
| Monk |  | 4 | Ability Score Improvement | aumento caratteristiche |
| Monk |  | 4 | Slow Fall | solo testo |
| Monk |  | 5 | Extra Attack | attacchi |
| Monk |  | 5 | Stunning Strike | solo testo |
| Monk |  | 6 | Empowered Strikes | solo testo |
| Monk | Warrior of Mercy | 6 | Physician's Touch | solo testo |
| Monk | Warrior of Shadow | 6 | Shadow Step | solo testo |
| Monk | Warrior of the Elements | 6 | Elemental Burst | scelta mancante? |
| Monk | Warrior of the Open Hand | 6 | Wholeness of Body | risorsa |
| Monk |  | 7 | Evasion | solo testo |
| Monk |  | 8 | Ability Score Improvement | aumento caratteristiche |
| Monk |  | 9 | Acrobatic Movement | solo testo |
| Monk |  | 10 | Heightened Focus | scelta mancante? |
| Monk |  | 10 | Self-Restoration | solo testo |
| Monk | Warrior of Mercy | 11 | Flurry of Healing and Harm | risorsa |
| Monk | Warrior of Shadow | 11 | Improved Shadow Step | solo testo |
| Monk | Warrior of the Elements | 11 | Stride of the Elements | solo testo |
| Monk | Warrior of the Open Hand | 11 | Fleet Step | solo testo |
| Monk |  | 12 | Ability Score Improvement | aumento caratteristiche |
| Monk |  | 13 | Deflect Energy | solo testo |
| Monk |  | 14 | Disciplined Survivor | solo testo |
| Monk |  | 15 | Perfect Focus | solo testo |
| Monk |  | 16 | Ability Score Improvement | aumento caratteristiche |
| Monk | Warrior of Mercy | 17 | Hand of Ultimate Mercy | risorsa |
| Monk | Warrior of Shadow | 17 | Cloak of Shadows | solo testo |
| Monk | Warrior of the Elements | 17 | Elemental Epitome | scelta mancante? |
| Monk | Warrior of the Open Hand | 17 | Quivering Palm | solo testo |
| Monk |  | 18 | Superior Defense | solo testo |
| Monk |  | 19 | Epic Boon | aumento caratteristiche |
| Monk |  | 20 | Body and Mind | solo testo |
| Paladin |  | 1 | Lay on Hands | risorsa |
| Paladin |  | 1 | Spellcasting | incantesimi |
| Paladin |  | 1 | Weapon Mastery | scelta mancante? |
| Paladin |  | 2 | Fighting Style | scelta mancante? |
| Paladin |  | 2 | Paladin's Smite | incantesimi sempre preparati mancanti? |
| Paladin |  | 3 | Channel Divinity | risorsa |
| Paladin |  | 3 | Paladin Subclass | sottoclasse |
| Paladin | Oath of Devotion | 3 | Oath of Devotion | solo testo |
| Paladin | Oath of Devotion | 3 | Oath of Devotion Spells | incantesimi sempre preparati mancanti? |
| Paladin | Oath of Devotion | 3 | Sacred Weapon | solo testo |
| Paladin | Oath of Glory | 3 | Inspiring Smite | scelta mancante? |
| Paladin | Oath of Glory | 3 | Oath of Glory | solo testo |
| Paladin | Oath of Glory | 3 | Oath of Glory Spells | incantesimi sempre preparati mancanti? |
| Paladin | Oath of Glory | 3 | Peerless Athlete | solo testo |
| Paladin | Oath of the Ancients | 3 | Nature's Wrath | scelta mancante? |
| Paladin | Oath of the Ancients | 3 | Oath of the Ancients | solo testo |
| Paladin | Oath of the Ancients | 3 | Oath of the Ancients Spells | incantesimi sempre preparati mancanti? |
| Paladin | Oath of Vengeance | 3 | Oath of Vengeance | solo testo |
| Paladin | Oath of Vengeance | 3 | Oath of Vengeance Spells | incantesimi sempre preparati mancanti? |
| Paladin | Oath of Vengeance | 3 | Vow of Enmity | solo testo |
| Paladin |  | 4 | Ability Score Improvement | aumento caratteristiche |
| Paladin |  | 5 | Extra Attack | attacchi |
| Paladin |  | 5 | Faithful Steed | incantesimi sempre preparati mancanti? |
| Paladin |  | 6 | Aura of Protection | solo testo |
| Paladin | Oath of Devotion | 7 | Aura of Devotion | solo testo |
| Paladin | Oath of Glory | 7 | Aura of Alacrity | solo testo |
| Paladin | Oath of the Ancients | 7 | Aura of Warding | solo testo |
| Paladin | Oath of Vengeance | 7 | Relentless Avenger | solo testo |
| Paladin |  | 8 | Ability Score Improvement | aumento caratteristiche |
| Paladin |  | 9 | Abjure Foes | solo testo |
| Paladin |  | 10 | Aura of Courage | solo testo |
| Paladin |  | 11 | Radiant Strikes | solo testo |
| Paladin |  | 12 | Ability Score Improvement | aumento caratteristiche |
| Paladin |  | 14 | Restoring Touch | solo testo |
| Paladin | Oath of Devotion | 15 | Smite of Protection | solo testo |
| Paladin | Oath of Glory | 15 | Glorious Defense | risorsa |
| Paladin | Oath of the Ancients | 15 | Undying Sentinel | risorsa |
| Paladin | Oath of Vengeance | 15 | Soul of Vengeance | solo testo |
| Paladin |  | 16 | Ability Score Improvement | aumento caratteristiche |
| Paladin |  | 18 | Aura Expansion | solo testo |
| Paladin |  | 19 | Epic Boon | aumento caratteristiche |
| Paladin | Oath of Devotion | 20 | Holy Nimbus | risorsa |
| Paladin | Oath of Glory | 20 | Living Legend | risorsa |
| Paladin | Oath of the Ancients | 20 | Elder Champion | risorsa |
| Paladin | Oath of Vengeance | 20 | Avenging Angel | risorsa |
| Ranger |  | 1 | Spellcasting | incantesimi |
| Ranger |  | 1 | Favored Enemy | risorsa |
| Ranger |  | 1 | Weapon Mastery | scelta mancante? |
| Ranger |  | 2 | Deft Explorer | Maestria |
| Ranger |  | 2 | Fighting Style | scelta mancante? |
| Ranger |  | 3 | Ranger Subclass | sottoclasse |
| Ranger | Beast Master | 3 | Beast Master | solo testo |
| Ranger | Beast Master | 3 | Primal Companion | scelta mancante? |
| Ranger | Fey Wanderer | 3 | Fey Wanderer | solo testo |
| Ranger | Fey Wanderer | 3 | Dreadful Strikes | solo testo |
| Ranger | Fey Wanderer | 3 | Fey Wanderer Spells | incantesimi sempre preparati mancanti? |
| Ranger | Fey Wanderer | 3 | Otherworldly Glamour | scelta mancante? |
| Ranger | Gloom Stalker | 3 | Dread Ambusher | risorsa |
| Ranger | Gloom Stalker | 3 | Gloom Stalker | solo testo |
| Ranger | Gloom Stalker | 3 | Gloom Stalker Spells | incantesimi sempre preparati mancanti? |
| Ranger | Gloom Stalker | 3 | Umbral Sight | solo testo |
| Ranger | Hunter | 3 | Hunter | solo testo |
| Ranger | Hunter | 3 | Hunter's Lore | solo testo |
| Ranger | Hunter | 3 | Hunter's Prey | scelta mancante? |
| Ranger |  | 4 | Ability Score Improvement | aumento caratteristiche |
| Ranger |  | 5 | Extra Attack | attacchi |
| Ranger |  | 6 | Roving | solo testo |
| Ranger | Beast Master | 7 | Exceptional Training | solo testo |
| Ranger | Fey Wanderer | 7 | Beguiling Twist | solo testo |
| Ranger | Gloom Stalker | 7 | Iron Mind | solo testo |
| Ranger | Hunter | 7 | Defensive Tactics | scelta mancante? |
| Ranger |  | 8 | Ability Score Improvement | aumento caratteristiche |
| Ranger |  | 9 | Expertise | Maestria |
| Ranger |  | 10 | Tireless | risorsa |
| Ranger | Beast Master | 11 | Bestial Fury | solo testo |
| Ranger | Fey Wanderer | 11 | Fey Reinforcements | risorsa |
| Ranger | Gloom Stalker | 11 | Stalker's Flurry | solo testo |
| Ranger | Hunter | 11 | Superior Hunter's Prey | solo testo |
| Ranger |  | 12 | Ability Score Improvement | aumento caratteristiche |
| Ranger |  | 13 | Relentless Hunter | solo testo |
| Ranger |  | 14 | Nature's Veil | risorsa |
| Ranger | Beast Master | 15 | Share Spells | incantesimi sempre preparati mancanti? |
| Ranger | Fey Wanderer | 15 | Misty Wanderer | risorsa |
| Ranger | Gloom Stalker | 15 | Shadowy Dodge | solo testo |
| Ranger | Hunter | 15 | Superior Hunter's Defense | solo testo |
| Ranger |  | 16 | Ability Score Improvement | aumento caratteristiche |
| Ranger |  | 17 | Precise Hunter | solo testo |
| Ranger |  | 18 | Feral Senses | solo testo |
| Ranger |  | 19 | Epic Boon | aumento caratteristiche |
| Ranger |  | 20 | Foe Slayer | solo testo |
| Rogue |  | 1 | Expertise | Maestria |
| Rogue |  | 1 | Sneak Attack | attacchi |
| Rogue |  | 1 | Thieves' Cant | scelta mancante? |
| Rogue |  | 1 | Weapon Mastery | scelta mancante? |
| Rogue |  | 2 | Cunning Action | solo testo |
| Rogue |  | 3 | Rogue Subclass | sottoclasse |
| Rogue |  | 3 | Steady Aim | solo testo |
| Rogue | Arcane Trickster | 3 | Arcane Trickster | solo testo |
| Rogue | Arcane Trickster | 3 | Mage Hand Legerdemain | solo testo |
| Rogue | Arcane Trickster | 3 | Spellcasting | incantesimi |
| Rogue | Assassin | 3 | Assassin | solo testo |
| Rogue | Assassin | 3 | Assassin's Tools | solo testo |
| Rogue | Assassin | 3 | Assassinate | solo testo |
| Rogue | Soulknife | 3 | Soulknife | solo testo |
| Rogue | Soulknife | 3 | Psionic Power | risorsa |
| Rogue | Soulknife | 3 | Psychic Blades | solo testo |
| Rogue | Soulknife | 3 | Psi-Bolstered Knack | solo testo |
| Rogue | Soulknife | 3 | Psychic Whispers | scelta mancante? |
| Rogue | Thief | 3 | Fast Hands | solo testo |
| Rogue | Thief | 3 | Second-Story Work | solo testo |
| Rogue | Thief | 3 | Thief | solo testo |
| Rogue |  | 4 | Ability Score Improvement | aumento caratteristiche |
| Rogue |  | 5 | Cunning Strike | solo testo |
| Rogue |  | 5 | Uncanny Dodge | solo testo |
| Rogue |  | 6 | Expertise | Maestria |
| Rogue |  | 7 | Evasion | solo testo |
| Rogue |  | 7 | Reliable Talent | opzione scheda |
| Rogue |  | 8 | Ability Score Improvement | aumento caratteristiche |
| Rogue | Arcane Trickster | 9 | Magical Ambush | solo testo |
| Rogue | Assassin | 9 | Infiltration Expertise | solo testo |
| Rogue | Soulknife | 9 | Homing Strikes | solo testo |
| Rogue | Soulknife | 9 | Psychic Teleportation | solo testo |
| Rogue | Soulknife | 9 | Soul Blades | solo testo |
| Rogue | Thief | 9 | Supreme Sneak | solo testo |
| Rogue |  | 10 | Ability Score Improvement | aumento caratteristiche |
| Rogue |  | 11 | Improved Cunning Strike | solo testo |
| Rogue |  | 12 | Ability Score Improvement | aumento caratteristiche |
| Rogue | Arcane Trickster | 13 | Versatile Trickster | solo testo |
| Rogue | Assassin | 13 | Envenom Weapons | solo testo |
| Rogue | Soulknife | 13 | Psychic Veil | risorsa |
| Rogue | Thief | 13 | Use Magic Device | solo testo |
| Rogue |  | 14 | Devious Strikes | solo testo |
| Rogue |  | 15 | Slippery Mind | solo testo |
| Rogue |  | 16 | Ability Score Improvement | aumento caratteristiche |
| Rogue | Arcane Trickster | 17 | Spell Thief | risorsa |
| Rogue | Assassin | 17 | Death Strike | solo testo |
| Rogue | Soulknife | 17 | Rend Mind | risorsa |
| Rogue | Thief | 17 | Thief's Reflexes | solo testo |
| Rogue |  | 18 | Elusive | solo testo |
| Rogue |  | 19 | Epic Boon | aumento caratteristiche |
| Rogue |  | 20 | Stroke of Luck | risorsa |
| Sorcerer |  | 1 | Spellcasting | incantesimi |
| Sorcerer |  | 1 | Innate Sorcery | risorsa |
| Sorcerer |  | 2 | Font of Magic | risorsa |
| Sorcerer |  | 2 | Metamagic | scelta mancante? |
| Sorcerer |  | 2 | Metamagic Options | solo testo |
| Sorcerer |  | 3 | Sorcerer Subclass | sottoclasse |
| Sorcerer | Aberrant Sorcery | 3 | Aberrant Sorcery | solo testo |
| Sorcerer | Aberrant Sorcery | 3 | Psionic Spells | incantesimi sempre preparati mancanti? |
| Sorcerer | Aberrant Sorcery | 3 | Telepathic Speech | scelta mancante? |
| Sorcerer | Clockwork Sorcery | 3 | Clockwork Sorcery | solo testo |
| Sorcerer | Clockwork Sorcery | 3 | Clockwork Spells | incantesimi sempre preparati mancanti? |
| Sorcerer | Clockwork Sorcery | 3 | Restore Balance | risorsa |
| Sorcerer | Draconic Sorcery | 3 | Draconic Sorcery | solo testo |
| Sorcerer | Draconic Sorcery | 3 | Draconic Spells | incantesimi sempre preparati mancanti? |
| Sorcerer | Draconic Sorcery | 3 | Draconic Resilience | solo testo |
| Sorcerer | Wild Magic Sorcery | 3 | Wild Magic Sorcery | solo testo |
| Sorcerer | Wild Magic Sorcery | 3 | Tides of Chaos | risorsa |
| Sorcerer | Wild Magic Sorcery | 3 | Wild Magic Surge | scelta mancante? |
| Sorcerer |  | 4 | Ability Score Improvement | aumento caratteristiche |
| Sorcerer |  | 5 | Sorcerous Restoration | risorsa |
| Sorcerer | Aberrant Sorcery | 6 | Psionic Sorcery | solo testo |
| Sorcerer | Aberrant Sorcery | 6 | Psychic Defenses | solo testo |
| Sorcerer | Clockwork Sorcery | 6 | Bastion of Law | solo testo |
| Sorcerer | Draconic Sorcery | 6 | Elemental Affinity | scelta mancante? |
| Sorcerer | Wild Magic Sorcery | 6 | Bend Luck | solo testo |
| Sorcerer |  | 7 | Sorcery Incarnate | solo testo |
| Sorcerer |  | 8 | Ability Score Improvement | aumento caratteristiche |
| Sorcerer |  | 10 | Metamagic | scelta mancante? |
| Sorcerer |  | 12 | Ability Score Improvement | aumento caratteristiche |
| Sorcerer | Aberrant Sorcery | 14 | Revelation in Flesh | scelta mancante? |
| Sorcerer | Clockwork Sorcery | 14 | Trance of Order | risorsa |
| Sorcerer | Draconic Sorcery | 14 | Dragon Wings | risorsa |
| Sorcerer | Wild Magic Sorcery | 14 | Controlled Chaos | solo testo |
| Sorcerer |  | 16 | Ability Score Improvement | aumento caratteristiche |
| Sorcerer |  | 17 | Metamagic | scelta mancante? |
| Sorcerer | Aberrant Sorcery | 18 | Warping Implosion | risorsa |
| Sorcerer | Clockwork Sorcery | 18 | Clockwork Cavalcade | risorsa |
| Sorcerer | Draconic Sorcery | 18 | Dragon Companion | risorsa |
| Sorcerer | Wild Magic Sorcery | 18 | Tamed Surge | risorsa |
| Sorcerer |  | 19 | Epic Boon | aumento caratteristiche |
| Sorcerer |  | 20 | Arcane Apotheosis | solo testo |
| Warlock |  | 1 | Eldritch Invocations | scelta mancante? |
| Warlock |  | 1 | Pact Magic | incantesimi |
| Warlock |  | 1 | Eldritch Invocation Options | solo testo |
| Warlock |  | 2 | Magical Cunning | risorsa |
| Warlock |  | 3 | Warlock Subclass | sottoclasse |
| Warlock | Archfey Patron | 3 | Archfey Patron | scelta mancante? |
| Warlock | Archfey Patron | 3 | Archfey Spells | incantesimi sempre preparati mancanti? |
| Warlock | Archfey Patron | 3 | Steps of the Fey | risorsa |
| Warlock | Celestial Patron | 3 | Celestial Patron | solo testo |
| Warlock | Celestial Patron | 3 | Celestial Spells | incantesimi sempre preparati mancanti? |
| Warlock | Celestial Patron | 3 | Healing Light | risorsa |
| Warlock | Fiend Patron | 3 | Fiend Patron | solo testo |
| Warlock | Fiend Patron | 3 | Dark One's Blessing | solo testo |
| Warlock | Fiend Patron | 3 | Fiend Spells | incantesimi sempre preparati mancanti? |
| Warlock | Great Old One Patron | 3 | Great Old One Patron | scelta mancante? |
| Warlock | Great Old One Patron | 3 | Awakened Mind | scelta mancante? |
| Warlock | Great Old One Patron | 3 | Great Old One Spells | incantesimi sempre preparati mancanti? |
| Warlock | Great Old One Patron | 3 | Psychic Spells | incantesimi sempre preparati mancanti? |
| Warlock |  | 4 | Ability Score Improvement | aumento caratteristiche |
| Warlock | Archfey Patron | 6 | Misty Escape | solo testo |
| Warlock | Celestial Patron | 6 | Radiant Soul | solo testo |
| Warlock | Fiend Patron | 6 | Dark One's Own Luck | risorsa |
| Warlock | Great Old One Patron | 6 | Clairvoyant Combatant | risorsa |
| Warlock |  | 8 | Ability Score Improvement | aumento caratteristiche |
| Warlock |  | 9 | Contact Patron | incantesimi sempre preparati mancanti? |
| Warlock | Archfey Patron | 10 | Beguiling Defenses | risorsa |
| Warlock | Celestial Patron | 10 | Celestial Resilience | scelta mancante? |
| Warlock | Fiend Patron | 10 | Fiendish Resilience | scelta mancante? |
| Warlock | Great Old One Patron | 10 | Eldritch Hex | incantesimi sempre preparati mancanti? |
| Warlock | Great Old One Patron | 10 | Thought Shield | solo testo |
| Warlock |  | 11 | Mystic Arcanum | scelta mancante? |
| Warlock |  | 12 | Ability Score Improvement | aumento caratteristiche |
| Warlock |  | 13 | Mystic Arcanum | scelta mancante? |
| Warlock | Archfey Patron | 14 | Bewitching Magic | solo testo |
| Warlock | Celestial Patron | 14 | Searing Vengeance | risorsa |
| Warlock | Fiend Patron | 14 | Hurl Through Hell | risorsa |
| Warlock | Great Old One Patron | 14 | Create Thrall | solo testo |
| Warlock |  | 15 | Mystic Arcanum | scelta mancante? |
| Warlock |  | 16 | Ability Score Improvement | aumento caratteristiche |
| Warlock |  | 17 | Mystic Arcanum | scelta mancante? |
| Warlock |  | 19 | Epic Boon | aumento caratteristiche |
| Warlock |  | 20 | Eldritch Master | solo testo |
| Wizard |  | 1 | Spellcasting | incantesimi |
| Wizard |  | 1 | Ritual Adept | solo testo |
| Wizard |  | 1 | Arcane Recovery | risorsa |
| Wizard |  | 2 | Scholar | scelta mancante? |
| Wizard |  | 3 | Wizard Subclass | sottoclasse |
| Wizard | Abjurer | 3 | Abjurer | solo testo |
| Wizard | Abjurer | 3 | Abjuration Savant | scelta mancante? |
| Wizard | Abjurer | 3 | Arcane Ward | solo testo |
| Wizard | Diviner | 3 | Diviner | solo testo |
| Wizard | Diviner | 3 | Divination Savant | scelta mancante? |
| Wizard | Diviner | 3 | Portent | scelta mancante? |
| Wizard | Evoker | 3 | Evoker | solo testo |
| Wizard | Evoker | 3 | Evocation Savant | scelta mancante? |
| Wizard | Evoker | 3 | Potent Cantrip | solo testo |
| Wizard | Illusionist | 3 | Illusionist | solo testo |
| Wizard | Illusionist | 3 | Illusion Savant | scelta mancante? |
| Wizard | Illusionist | 3 | Improved Illusions | scelta mancante? |
| Wizard |  | 4 | Ability Score Improvement | aumento caratteristiche |
| Wizard |  | 5 | Memorize Spell | solo testo |
| Wizard | Abjurer | 6 | Projected Ward | solo testo |
| Wizard | Diviner | 6 | Expert Divination | solo testo |
| Wizard | Evoker | 6 | Sculpt Spells | incantesimi sempre preparati mancanti? |
| Wizard | Illusionist | 6 | Phantasmal Creatures | incantesimi sempre preparati mancanti? |
| Wizard |  | 8 | Ability Score Improvement | aumento caratteristiche |
| Wizard | Abjurer | 10 | Spell Breaker | incantesimi sempre preparati mancanti? |
| Wizard | Diviner | 10 | The Third Eye | scelta mancante? |
| Wizard | Evoker | 10 | Empowered Evocation | solo testo |
| Wizard | Illusionist | 10 | Illusory Self | risorsa |
| Wizard |  | 12 | Ability Score Improvement | aumento caratteristiche |
| Wizard | Abjurer | 14 | Spell Resistance | solo testo |
| Wizard | Diviner | 14 | Greater Portent | solo testo |
| Wizard | Evoker | 14 | Overchannel | solo testo |
| Wizard | Illusionist | 14 | Illusory Reality | scelta mancante? |
| Wizard |  | 16 | Ability Score Improvement | aumento caratteristiche |
| Wizard |  | 18 | Spell Mastery | incantesimi sempre preparati mancanti? |
| Wizard |  | 19 | Epic Boon | aumento caratteristiche |
| Wizard |  | 20 | Signature Spells | incantesimi sempre preparati mancanti? |
