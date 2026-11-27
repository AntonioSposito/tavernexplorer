import type { CharacterEffect, RollMode, StatModifier, TurnCondition } from "./types";

// Conta solo se acceso e non scaduto, come nel calcolo dei modificatori.
export const isEffectOn = (effect: TurnCondition) => effect.active !== false && (effect.remainingRounds === undefined || effect.remainingRounds > 0);

// Condizioni (regole 2024): nome italiano (quello che si salva), nome inglese, emoji e regola tradotta dall'SRD 5.2.1 (CC BY 4.0).
// Si riconoscono da entrambi i nomi: gli effetti salvati prima in inglese continuano a valere.
export const CONDITIONS: Array<{ name: string; en: string; emoji: string; rule: string }> = [
  { name: "Accecato", en: "Blinded", emoji: "🕶️", rule: "Non vedi. Non puoi vedere e fallisci automaticamente ogni prova di caratteristica che richiede la vista.\nAttacchi. I tiri per colpire contro di te hanno vantaggio e i tuoi hanno svantaggio." },
  { name: "Affascinato", en: "Charmed", emoji: "💘", rule: "Non puoi nuocere a chi ti affascina. Non puoi attaccarlo né sceglierlo come bersaglio di capacità o effetti magici che infliggono danni.\nVantaggio sociale. Chi ti affascina ha vantaggio alle prove di caratteristica per interagire socialmente con te." },
  { name: "Assordato", en: "Deafened", emoji: "🔇", rule: "Non senti. Non puoi sentire e fallisci automaticamente ogni prova di caratteristica che richiede l'udito." },
  { name: "Indebolimento", en: "Exhaustion", emoji: "🪫", rule: "Livelli. La condizione è cumulativa: ogni volta che la subisci guadagni 1 livello di Indebolimento. Muori se arrivi al livello 6.\nTiri d20. I tuoi tiri d20 diminuiscono del doppio del tuo livello di Indebolimento.\nVelocità ridotta. La tua velocità diminuisce di 1,5 m per livello di Indebolimento.\nRecupero. Un riposo lungo toglie 1 livello; a livello 0 la condizione finisce." },
  { name: "Spaventato", en: "Frightened", emoji: "⚠️", rule: "Prove e attacchi. Hai svantaggio alle prove di caratteristica e ai tiri per colpire finché la fonte della paura è nella tua linea di vista.\nNon ti avvicini. Non puoi avvicinarti di tua volontà alla fonte della paura." },
  { name: "Afferrato", en: "Grappled", emoji: "🤼", rule: "Velocità 0. La tua velocità è 0 e non può aumentare.\nAttacchi. Hai svantaggio ai tiri per colpire contro qualsiasi bersaglio diverso da chi ti afferra.\nTrascinabile. Chi ti afferra può trascinarti o portarti con sé, ma ogni metro gli costa 1 metro in più, a meno che tu non sia Minuscolo o di due o più taglie più piccolo." },
  { name: "Incapacitato", en: "Incapacitated", emoji: "💫", rule: "Inattivo. Non puoi effettuare azioni, azioni bonus né reazioni.\nNiente concentrazione. La tua concentrazione si interrompe.\nMuto. Non puoi parlare.\nSorpreso. Se sei Incapacitato quando tiri l'iniziativa, hai svantaggio al tiro." },
  { name: "Invisibile", en: "Invisible", emoji: "👻", rule: "Sorpresa. Se sei Invisibile quando tiri l'iniziativa, hai vantaggio al tiro.\nNascosto. Non subisci gli effetti che richiedono di vedere il bersaglio, a meno che chi li crea non riesca in qualche modo a vederti. Anche l'equipaggiamento che indossi o porti è nascosto.\nAttacchi. I tiri per colpire contro di te hanno svantaggio e i tuoi hanno vantaggio. Contro una creatura che riesce in qualche modo a vederti non hai questo beneficio." },
  { name: "Paralizzato", en: "Paralyzed", emoji: "🧊", rule: "Incapacitato. Hai la condizione Incapacitato.\nVelocità 0. La tua velocità è 0 e non può aumentare.\nTiri salvezza. Fallisci automaticamente i TS di Forza e Destrezza.\nAttacchi. I tiri per colpire contro di te hanno vantaggio.\nCritici automatici. Un attacco che ti colpisce è un colpo critico se l'attaccante è entro 1,5 m da te." },
  { name: "Pietrificato", en: "Petrified", emoji: "🗿", rule: "Materia inanimata. Tu e gli oggetti non magici che indossi o porti diventate una sostanza solida e inanimata (di solito pietra). Il tuo peso si moltiplica per dieci e smetti di invecchiare.\nIncapacitato. Hai la condizione Incapacitato.\nVelocità 0. La tua velocità è 0 e non può aumentare.\nAttacchi. I tiri per colpire contro di te hanno vantaggio.\nTiri salvezza. Fallisci automaticamente i TS di Forza e Destrezza.\nResistenza. Hai resistenza a tutti i danni.\nImmune al veleno. Sei immune alla condizione Avvelenato." },
  { name: "Avvelenato", en: "Poisoned", emoji: "🧪", rule: "Prove e attacchi. Hai svantaggio ai tiri per colpire e alle prove di caratteristica." },
  { name: "Prono", en: "Prone", emoji: "🛌", rule: "Movimento limitato. Puoi solo strisciare, oppure spendere metà della tua velocità (per difetto) per rialzarti e terminare la condizione. Se la tua velocità è 0 non puoi rialzarti.\nAttacchi. Hai svantaggio ai tiri per colpire. Un tiro per colpire contro di te ha vantaggio se l'attaccante è entro 1,5 m, altrimenti ha svantaggio." },
  { name: "Trattenuto", en: "Restrained", emoji: "⛓️", rule: "Velocità 0. La tua velocità è 0 e non può aumentare.\nAttacchi. I tiri per colpire contro di te hanno vantaggio e i tuoi hanno svantaggio.\nTiri salvezza. Hai svantaggio ai TS di Destrezza." },
  { name: "Stordito", en: "Stunned", emoji: "🌀", rule: "Incapacitato. Hai la condizione Incapacitato.\nTiri salvezza. Fallisci automaticamente i TS di Forza e Destrezza.\nAttacchi. I tiri per colpire contro di te hanno vantaggio." },
  { name: "Privo di sensi", en: "Unconscious", emoji: "💤", rule: "Inerte. Hai le condizioni Incapacitato e Prono e lasci cadere ciò che tieni. Quando la condizione finisce resti Prono.\nVelocità 0. La tua velocità è 0 e non può aumentare.\nAttacchi. I tiri per colpire contro di te hanno vantaggio.\nTiri salvezza. Fallisci automaticamente i TS di Forza e Destrezza.\nCritici automatici. Un attacco che ti colpisce è un colpo critico se l'attaccante è entro 1,5 m da te.\nIgnaro. Non sei consapevole di ciò che ti circonda." },
];

// Condizione dal nome italiano o inglese, senza badare a maiuscole (anche "poisoned" delle immunità di 5e.tools) e col livello di Indebolimento.
const findCondition = (name: string) => {
  const key = exhaustionLevel(name) ? "exhaustion" : name.trim().toLowerCase();
  return CONDITIONS.find((condition) => condition.en.toLowerCase() === key || condition.name.toLowerCase() === key);
};
// Chiave inglese in minuscolo ("poisoned"), usata dalle tabelle qui sotto.
const conditionKey = (name: string) => findCondition(name)?.en.toLowerCase();

// "Indebolimento 3" ha in testa le penalità del suo livello.
export const conditionRule = (name: string) => {
  const level = exhaustionLevel(name);
  const rule = findCondition(name)?.rule;
  if (!level || !/\d/.test(name)) return rule;
  return `${level >= 6 ? "Indebolimento livello 6. Muori." : `Indebolimento livello ${level}. I tuoi tiri d20 diminuiscono di ${2 * level} e la velocità di ${String(1.5 * level).replace(".", ",")} m.`}\n${rule}`;
};

// Indebolimento si sceglie col livello, da 1 a 6.
export const EXHAUSTION_LEVELS = [1, 2, 3, 4, 5, 6].map((level) => `Indebolimento ${level}`);

// Tiri d20 toccati dalle condizioni: attacchi, prove (anche abilità e strumenti) e TS per caratteristica, e l'iniziativa,
// che è una prova di Destrezza ma ha regole sue (Incapacitated, Invisible).
export type D20Roll = "attack" | "initiative" | `check:${string}` | `save:${string}`;

// Voci dei modificatori adv:/dis: che valgono per un tiro. Le prove di abilità sono "check:<caratteristica>:<abilità>";
// l'iniziativa è una prova di Destrezza.
function rollTargets(roll: D20Roll): string[] {
  if (roll === "attack") return ["attack"];
  if (roll === "initiative") return ["initiative", "check", "check:dexterity"];
  // La concentrazione è un TS di Costituzione con regole sue (War Caster); il TS contro la morte non ha caratteristica.
  if (roll === "save:concentration") return ["save", "save:constitution", "save:concentration"];
  const [kind, ability, skill] = roll.split(":");
  return [kind, `${kind}:${ability}`, ...skill ? [`skill:${skill}`] : []];
}

// Vantaggio e svantaggio delle condizioni come modificatori adv:/dis:, messi nell'effetto quando lo si sceglie.
// Solo i tiri di chi ha la condizione: quelli "contro di te" li fa un altro e restano manuali.
// shortcut: Blinded, Frightened e Invisible valgono sempre (vista e linea di vista non si conoscono); Grappled resta
// manuale perché lo svantaggio non vale contro chi ti afferra. Charmed e Deafened non toccano i tuoi tiri.
const modes = (prefix: "adv" | "dis", ...targets: string[]) => targets.map((target) => ({ target: `${prefix}:${target}`, amount: 0 }));
const helpless = modes("dis", "initiative");
const CONDITION_MODIFIERS: Record<string, Array<Omit<StatModifier, "id">>> = {
  blinded: modes("dis", "attack"),
  frightened: modes("dis", "attack", "check"),
  incapacitated: helpless,
  invisible: modes("adv", "attack", "initiative"),
  paralyzed: helpless,
  petrified: helpless,
  poisoned: modes("dis", "attack", "check"),
  prone: modes("dis", "attack"),
  restrained: modes("dis", "attack", "save:dexterity"),
  stunned: helpless,
  unconscious: helpless,
};
export const conditionModifiers = (name: string) => CONDITION_MODIFIERS[conditionKey(name) ?? ""] ?? [];
// Fallire i TS di Forza e Destrezza non è un modificatore: vale dal nome.
const FAILS_STR_DEX = ["paralyzed", "petrified", "stunned", "unconscious"];

// Indebolimento (o Exhaustion) col livello nel nome ("Indebolimento 3"); senza numero è il livello 1.
export function exhaustionLevel(name: string) { const match = /^(?:exhaustion|indebolimento)(?:\s+(\d+))?$/i.exec(name.trim()); return match ? Math.max(1, Number(match[1] ?? 1)) : 0; }

// Titolo, formula e modalità di un tiro d20 con le condizioni attive: "TS Forza · fallisce (Stunned) · svantaggio (Poisoned)".
// mode resta una lista: la combina chi tira, insieme al menu Normale/Vantaggio/Svantaggio.
export function conditionRoll(effects: TurnCondition[] | undefined, roll: D20Roll, title: string, formula: string, mode?: RollMode): { title: string; formula: string; mode: RollMode[] } {
  const active = (effects ?? []).filter(isEffectOn);
  const targets = rollTargets(roll);
  // Condizioni salvate prima dei modificatori (o aggiunte dal menu del token): valgono quelli predefiniti.
  const modifiersOf = (effect: TurnCondition) => effect.edited || effect.modifiers?.length ? effect.modifiers ?? [] : conditionModifiers(effect.name);
  const by = (prefix: string) => active.filter((effect) => modifiersOf(effect).some((mod) => mod.target.startsWith(prefix) && targets.includes(mod.target.slice(prefix.length)))).map((effect) => effect.name);
  const fail = roll === "save:strength" || roll === "save:dexterity" ? active.filter((effect) => FAILS_STR_DEX.includes(conditionKey(effect.name) ?? "")).map((effect) => effect.name) : [];
  const [advantage, disadvantage] = [by("adv:"), by("dis:")];
  const exhaustion = active.reduce((level, effect) => level + exhaustionLevel(effect.name), 0);
  // Vantaggio contro una condizione (Dwarf, Elf, Halfling…): il tiro non sa contro cosa è, quindi è solo un promemoria nel titolo,
  // e solo sui TS di caratteristica: TS contro la morte e concentrazione non sono contro una condizione.
  const against = (prefix: string) => roll.startsWith("save:") && roll !== "save:death" && roll !== "save:concentration" ? active.flatMap((effect) => modifiersOf(effect).filter((mod) => mod.target.startsWith(`${prefix}against:`)).map((mod) => `${findCondition(mod.target.slice(prefix.length + 8))?.name ?? mod.target.slice(prefix.length + 8)} (${effect.name})`)) : [];
  const [advantageIf, disadvantageIf] = [against("adv:"), against("dis:")];
  const notes = [fail.length > 0 && `fallisce (${fail.join(", ")})`, advantage.length > 0 && `vantaggio (${advantage.join(", ")})`, disadvantage.length > 0 && `svantaggio (${disadvantage.join(", ")})`,
    advantageIf.length > 0 && `vantaggio se contro ${advantageIf.join(", ")}`, disadvantageIf.length > 0 && `svantaggio se contro ${disadvantageIf.join(", ")}`, exhaustion > 0 && `Indebolimento ${exhaustion} (−${2 * exhaustion})`].filter(Boolean);
  return {
    title: [title, ...notes].join(" · "),
    formula: exhaustion > 0 ? `${formula}-${2 * exhaustion}[EXH]` : formula,
    mode: [...mode ? [mode] : [], ...advantage.length ? ["advantage" as const] : [], ...disadvantage.length ? ["disadvantage" as const] : []],
  };
}

// Fonti di vantaggio e svantaggio di un PG: gli effetti accesi e i tratti, che sono sempre attivi (Gnomish Cunning, Durable…).
export function rollSources(sheet: { effects?: CharacterEffect[]; traits?: Array<{ id: string; name: string; modifiers?: StatModifier[] }> } | undefined): TurnCondition[] {
  const traits = (sheet?.traits ?? []).filter((trait) => trait.modifiers?.some((mod) => mod.target.startsWith("adv:") || mod.target.startsWith("dis:")));
  return [...sheet?.effects ?? [], ...traits.map((trait): CharacterEffect => ({ id: trait.id, name: trait.name, active: true, edited: true, modifiers: trait.modifiers ?? [] }))];
}

// Concentrazione: un effetto come gli altri, col nome dell'incantesimo ("Concentrazione: Bless"); se ne ha una sola alla volta.
export const CONCENTRATION = "Concentrazione";
export const CONCENTRATION_RULE = "Un'altra concentrazione. Perdi la concentrazione appena lanci un altro incantesimo o attivi un altro effetto che la richiede.\nIncapacitato o morto. La concentrazione finisce se hai la condizione Incapacitato o muori.\nDanni. Se subisci danni devi superare un TS di Costituzione per mantenere la concentrazione. La CD è 10 o metà dei danni subiti (per difetto), se più alta, fino a un massimo di 30.";
export const isConcentration = (name: string) => /^(concentrazione|concentration)/i.test(name.trim());

// Effetti pronti (privilegi e incantesimi comuni): scelti dal nome, riempiono descrizione, modificatori e round.
// Descrizioni riassunte a parole nostre. I dadi bonus (1d4, 1d6) non sono modificatori: restano nella descrizione.
type EffectPreset = { emoji: string; name: string; en: string; description: string; modifiers: Array<Omit<StatModifier, "id">>; rounds?: number };
const adv = (target: string) => ({ target: `adv:${target}`, amount: 0 });
export const EFFECT_PRESETS: EffectPreset[] = [
  { emoji: "💢", name: "Ira", en: "Rage", description: "Vantaggio alle prove e ai TS di Forza. Bonus ai danni degli attacchi con Forza: +2, +3 dal 9° livello da barbaro, +4 dal 16°. Resistenza ai danni contundenti, perforanti e taglienti. Niente incantesimi né concentrazione. Dura fino alla fine del tuo prossimo turno; si prolunga attaccando, imponendo un TS o con un'azione bonus, fino a 10 minuti.",
    modifiers: [adv("check:strength"), adv("save:strength"), { target: "damage", amount: 2 }] },
  { emoji: "🗡️", name: "Melodia della lama", en: "Bladesong", description: "Bonus alla CA pari al modificatore di Intelligenza (minimo +1), velocità +3 m, vantaggio alle prove di Acrobazia. Aggiungi il modificatore di Intelligenza ai TS di Costituzione per mantenere la concentrazione. Finisce se sei Incapacitato, se indossi un'armatura media o pesante o uno scudo, o se attacchi con un'arma a due mani. Dura 1 minuto.",
    modifiers: [{ target: "ac", amount: 0, ability: "intelligence" }, { target: "speed", amount: 3 }, adv("skill:acrobatics")], rounds: 10 },
  { emoji: "✨", name: "Benedizione", en: "Bless", description: "Aggiungi 1d4 ai tiri per colpire e ai tiri salvezza. Concentrazione, fino a 1 minuto.", modifiers: [], rounds: 10 },
  { emoji: "💀", name: "Anatema", en: "Bane", description: "Sottrai 1d4 ai tiri per colpire e ai tiri salvezza. Concentrazione, fino a 1 minuto.", modifiers: [], rounds: 10 },
  { emoji: "⚡", name: "Velocità", en: "Haste", description: "+2 alla CA, velocità raddoppiata, vantaggio ai TS di Destrezza e un'azione in più a ogni turno (solo attacco con un'arma, Scatto, Disimpegno, Nascondersi o Usare un oggetto). Quando finisce, non puoi muoverti né agire fino alla fine del tuo prossimo turno. Concentrazione, fino a 1 minuto.",
    modifiers: [{ target: "ac", amount: 2 }, adv("save:dexterity")], rounds: 10 },
  { emoji: "🛡️", name: "Scudo della fede", en: "Shield of Faith", description: "+2 alla CA. Concentrazione, fino a 10 minuti.", modifiers: [{ target: "ac", amount: 2 }], rounds: 100 },
  { emoji: "🎯", name: "Marchio del cacciatore", en: "Hunter's Mark", description: "+1d6 ai danni degli attacchi contro il bersaglio marchiato e vantaggio alle prove di Percezione e Sopravvivenza per trovarlo. Concentrazione, fino a 1 ora.", modifiers: [] },
  { emoji: "🧭", name: "Guida", en: "Guidance", description: "Aggiungi 1d4 a una prova di caratteristica con l'abilità scelta. Concentrazione, fino a 1 minuto.", modifiers: [], rounds: 10 },
  { emoji: "💨", name: "Schivata", en: "Dodge", description: "Gli attacchi contro di te hanno svantaggio se vedi chi attacca, e hai vantaggio ai TS di Destrezza. Fino all'inizio del tuo prossimo turno; finisce se sei Incapacitato o la tua velocità è 0.",
    modifiers: [adv("save:dexterity")], rounds: 1 },
];
export const effectPreset = (name: string) => EFFECT_PRESETS.find((preset) => [preset.name, preset.en].some((item) => item.toLowerCase() === name.trim().toLowerCase()));

// Emoji accanto al nome (menu, lista degli effetti, token); il nome salvato resta senza, così le regole lo riconoscono.
export const effectEmoji = (name: string) => effectPreset(name)?.emoji ?? findCondition(name)?.emoji ?? (isConcentration(name) ? "🧠" : undefined);
export const withEmoji = (name: string) => [effectEmoji(name), name].filter(Boolean).join(" ");

// Voci del menu "Effetto pronto": valore il nome italiano, etichetta "💢 Ira/Rage".
const choice = (name: string, en: string): [string, string] => [name, `${withEmoji(name)}/${en}`];
export const EFFECT_CHOICES: Array<[group: string, choices: Array<[value: string, label: string]>]> = [
  ["Condizioni", CONDITIONS.flatMap(({ name, en }) => name === "Indebolimento" ? EXHAUSTION_LEVELS.map((level, index) => choice(level, `${en} ${index + 1}`)) : [choice(name, en)])],
  ["Effetti pronti", EFFECT_PRESETS.map(({ name, en }) => choice(name, en))],
  ["Concentrazione", [choice(CONCENTRATION, "Concentration")]],
];

// Regola da mettere nella descrizione: quella della condizione, della concentrazione o dell'effetto pronto.
export const effectRule = (name: string) => conditionRule(name) ?? (isConcentration(name) ? CONCENTRATION_RULE : effectPreset(name)?.description);

export function startConcentration(effects: CharacterEffect[], spell: string): CharacterEffect[] {
  return [...effects.filter((effect) => !isConcentration(effect.name)), { id: crypto.randomUUID(), name: `${CONCENTRATION}: ${spell}`, active: true, modifiers: [], description: CONCENTRATION_RULE }];
}

// Scegliendo una condizione (o la concentrazione) la descrizione diventa la sua regola; un testo scritto a mano non si tocca.
const describe = (effect: CharacterEffect, name: string) => effectRule(name) ?? (effect.description === effectRule(effect.name) ? undefined : effect.description);
// Come la descrizione: cambiando nome, modificatori e round diventano quelli del nuovo effetto pronto o condizione,
// ma solo se sono ancora quelli del nome precedente (o vuoti); se li hai cambiati a mano restano.
// fromMenu: scelto da "Effetto pronto", si sostituiscono sempre.
const defaultModifiers = (name: string) => effectPreset(name)?.modifiers ?? conditionModifiers(name);
const withoutIds = (modifiers: CharacterEffect["modifiers"]) => JSON.stringify(modifiers.map((mod) => ({ ...mod, id: "" })));
// Condizione mai salvata dal popup (versioni vecchie, menu del token): si apre con i modificatori che già valgono nei tiri.
export const opened = (effect: CharacterEffect): CharacterEffect => effect.edited || effect.modifiers.length ? structuredClone(effect) : { ...structuredClone(effect), modifiers: conditionModifiers(effect.name).map((mod) => ({ ...mod, id: crypto.randomUUID() })) };
export function named(effect: CharacterEffect, name: string, fromMenu = false): CharacterEffect {
  const sameModifiers = fromMenu || withoutIds(effect.modifiers) === withoutIds(defaultModifiers(effect.name).map((mod) => ({ ...mod, id: "" })));
  const sameRounds = fromMenu || effect.remainingRounds === effectPreset(effect.name)?.rounds;
  return {
    ...effect, name, description: describe(effect, name),
    ...sameModifiers ? { modifiers: defaultModifiers(name).map((mod) => ({ ...mod, id: crypto.randomUUID() })) } : {},
    ...sameRounds ? { remainingRounds: effectPreset(name)?.rounds } : {},
  };
}

// Livello di Indebolimento scelto dai pallini: un solo effetto "Indebolimento N" acceso (tiene l'id se c'era già); a 0 si toglie.
export function withExhaustion(effects: CharacterEffect[], level: number): CharacterEffect[] {
  const current = effects.find((effect) => exhaustionLevel(effect.name));
  const rest = effects.filter((effect) => !exhaustionLevel(effect.name));
  if (!level) return rest;
  const name = `Indebolimento ${level}`;
  return [...rest, { ...current ?? { id: crypto.randomUUID(), modifiers: [] }, name, active: true, description: conditionRule(name) }];
}
