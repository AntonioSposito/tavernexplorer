import { expect, it } from "vitest";
import { createBlankSheet } from "./blankSheet";
import { bardicDie, rageUses, spendRage, syncClassResources } from "./classResources";
import { restoreCounters } from "./rest";

const withClass = (name: string, level: number, charisma = 0) => {
  const sheet = createBlankSheet("Eroe");
  sheet.classes = [{ name, level }];
  sheet.identity.level = level;
  sheet.abilities.charisma.mod = charisma;
  return sheet;
};

it("usi dell'Ira e dado dell'Ispirazione bardica per livello", () => {
  expect([1, 3, 6, 12, 17].map(rageUses)).toEqual([2, 3, 4, 5, 6]);
  expect([1, 5, 10, 15].map(bardicDie)).toEqual([6, 8, 10, 12]);
});

it("crea le risorse di classe e le aggiorna senza duplicarle: un massimo più alto dà gli usi in più", () => {
  const barbarian = withClass("Barbarian", 2);
  syncClassResources(barbarian);
  expect(barbarian.counters).toMatchObject([{ name: "Ira", current: 2, max: 2, recovery: "long", shortRestGain: 1, classResource: "rage" }]);
  barbarian.counters![0].current = 1;
  barbarian.classes = [{ name: "Barbarian", level: 3 }];
  syncClassResources(barbarian);
  expect(barbarian.counters).toHaveLength(1);
  expect(barbarian.counters![0]).toMatchObject({ current: 2, max: 3 });
  const bard = withClass("Bard", 5, 3);
  syncClassResources(bard);
  expect(bard.counters).toMatchObject([{ name: "Ispirazione bardica (d8)", current: 3, max: 3, recovery: "short" }]);
  const shy = withClass("Bard", 1, -1);
  syncClassResources(shy);
  expect(shy.counters![0]).toMatchObject({ name: "Ispirazione bardica (d6)", max: 1, recovery: "long" });
});

it("il riposo breve ridà un uso dell'Ira, quello lungo tutti; attivarla ne consuma uno", () => {
  const barbarian = withClass("Barbarian", 6);
  syncClassResources(barbarian);
  expect(spendRage(barbarian)).toBe(true);
  expect(spendRage(barbarian)).toBe(true);
  expect(barbarian.counters![0].current).toBe(2);
  expect(restoreCounters(barbarian.counters!, "short").counters[0].current).toBe(3);
  expect(restoreCounters(barbarian.counters!, "long").counters[0].current).toBe(4);
  barbarian.counters![0].current = 0;
  expect(spendRage(barbarian)).toBe(false);
});

it("il monaco ha il colpo senz'armi con il dado delle Arti marziali; uno già scritto a mano si adotta cambiando solo il dado", () => {
  const monk = withClass("Monk", 1);
  monk.abilities.dexterity.mod = 3; monk.abilities.strength.mod = 1;
  syncClassResources(monk);
  const strike = () => monk.actions.filter((action) => action.classAction === "martialArts");
  expect(strike()).toHaveLength(1);
  expect(strike()[0]).toMatchObject({ attack: { ability: "dexterity", proficient: true }, damages: [{ dice: "1d6", ability: "dexterity" }] });
  monk.classes = [{ name: "Monk", level: 5 }];
  syncClassResources(monk);
  expect(strike()).toHaveLength(1);
  expect(strike()[0].damages?.[0].dice).toBe("1d8");
  const brus = withClass("Monk", 5);
  brus.actions = [{ id: "u", name: "Unarmed Strike", attack: { ability: "none", bonus: 6, proficient: false }, damages: [{ dice: "1d6", ability: "dexterity", bonus: 0, type: "Contundente", critDice: "1d6" }] }];
  syncClassResources(brus);
  expect(brus.actions).toHaveLength(1);
  expect(brus.actions[0]).toMatchObject({ classAction: "martialArts", attack: { ability: "none", bonus: 6, proficient: false }, damages: [{ dice: "1d8", ability: "dexterity" }] });
});

it("Movimento senza armatura: modificatore visibile del tratto, aggiornato col livello e spento dall'armatura", async () => {
  const { effectiveSheet } = await import("./effects");
  const { trait } = await import("./buildCharacter");
  const monk = withClass("Monk", 6);
  monk.combat.speed = "9 m";
  monk.traits = [trait({ name: "Unarmored Movement", description: "" }, "Class", "Monk")];
  expect(monk.traits[0].modifiers).toMatchObject([{ target: "speed", amount: 3, unarmored: true }]);
  syncClassResources(monk);
  expect(monk.traits[0].modifiers?.[0].amount).toBe(4.5);
  expect(effectiveSheet(monk).combat.speed).toBe("13.5 m");
  monk.inventory = [{ id: "a", name: "Leather", count: 1, equipped: true, modifiers: [{ id: "m", target: "armor:light", amount: 11 }] }];
  expect(effectiveSheet(monk).combat.speed).toBe("9 m");
  // Un modificatore messo a mano (senza "solo senza armatura") non si tocca e non si raddoppia.
  const brus = withClass("Monk", 6);
  brus.combat.speed = "9 m";
  brus.traits = [{ id: "t", name: "Unarmored Movement", description: "", modifiers: [{ id: "s", target: "speed", amount: 3 }] }];
  syncClassResources(brus);
  expect(effectiveSheet(brus).combat.speed).toBe("12 m");
});

it("una risorsa già creata a mano si adotta col suo nome invece di crearne un'altra", () => {
  const barbarian = withClass("Barbarian", 4);
  barbarian.counters = [{ id: "r", name: "Ira (scala)", current: 1, max: 3, recovery: "long" }];
  syncClassResources(barbarian);
  expect(barbarian.counters).toEqual([{ id: "r", name: "Ira (scala)", current: 1, max: 3, recovery: "long", shortRestGain: 1, classResource: "rage" }]);
  barbarian.classes = [{ name: "Barbarian", level: 6 }];
  syncClassResources(barbarian);
  expect(barbarian.counters![0]).toMatchObject({ name: "Ira (scala)", current: 2, max: 4 });
});

it("risorse PHB 2024 delle altre classi: nome, usi, recupero e adozione di un contatore scritto a mano (TE-85)", () => {
  const sync = (name: string, level: number, subclass?: string) => { const sheet = withClass(name, level); if (subclass) sheet.classes![0].subclass = subclass; syncClassResources(sheet); return sheet.counters ?? []; };
  expect(sync("Cleric", 6)).toMatchObject([{ name: "Incanalare Divinità", max: 3, recovery: "long", shortRestGain: 1, classResource: "channel" }]);
  expect(sync("Cleric", 1)).toEqual([]);
  expect(sync("Druid", 2)).toMatchObject([{ name: "Forma selvatica", max: 2, shortRestGain: 1 }]);
  expect(sync("Fighter", 4)).toMatchObject([{ name: "Recuperare energie", max: 3 }]);
  expect(sync("Monk", 5).find((counter) => counter.classResource === "focus")).toMatchObject({ name: "Punti focus", max: 5, recovery: "short" });
  expect(sync("Sorcerer", 2)).toMatchObject([{ name: "Punti stregoneria", max: 2, recovery: "long" }]);
  expect(sync("Ranger", 5)).toMatchObject([{ name: "Nemico prescelto (Marchio del cacciatore)", max: 3 }]);
  expect(sync("Rogue", 5, "Soulknife")).toMatchObject([{ name: "Energia psionica (d8)", max: 6, shortRestGain: 1 }]);
  expect(sync("Rogue", 5)).toEqual([]);
  // Un contatore "Channel Divinity" creato a mano si adotta: niente doppione, nome tenuto.
  const cleric = withClass("Cleric", 2);
  cleric.counters = [{ id: "cd", name: "Channel Divinity", current: 1, max: 1, recovery: "long" }];
  syncClassResources(cleric);
  expect(cleric.counters).toMatchObject([{ id: "cd", name: "Channel Divinity", current: 2, max: 2, classResource: "channel" }]);
  // Riposo breve: un uso; lungo: tutti. Punti focus tutti anche col breve.
  const used = cleric.counters!.map((counter) => ({ ...counter, current: 0 }));
  expect(restoreCounters(used, "short").counters[0].current).toBe(1);
  expect(restoreCounters(used, "long").counters[0].current).toBe(2);
  const monk = withClass("Monk", 3); syncClassResources(monk);
  const focus = monk.counters!.filter((counter) => counter.classResource === "focus").map((counter) => ({ ...counter, current: 0 }));
  expect(restoreCounters(focus, "short").counters[0].current).toBe(3);
});

it("privilegi con usi contati: il contatore nasce col tratto e segue livello, caratteristica e dado (TE-85 fase 2)", () => {
  const withTraits = (name: string, level: number, traits: string[], subclass?: string) => {
    const sheet = withClass(name, level);
    if (subclass) sheet.classes![0].subclass = subclass;
    sheet.abilities.wisdom.mod = 3;
    sheet.traits = traits.map((trait) => ({ id: trait, name: trait, description: "" }));
    syncClassResources(sheet);
    return sheet;
  };
  const use = (sheet: ReturnType<typeof withClass>, feature: string) => sheet.counters?.find((counter) => counter.featureUse === feature);
  const fighter = withTraits("Fighter", 17, ["Action Surge", "Indomitable", "Combat Superiority"]);
  expect(use(fighter, "Action Surge")).toMatchObject({ name: "Action Surge", max: 2, recovery: "short" });
  expect(use(fighter, "Indomitable")).toMatchObject({ max: 3, recovery: "long" });
  expect(use(fighter, "Combat Superiority")).toMatchObject({ name: "Combat Superiority (d10)", max: 6, recovery: "short" });
  // Sale di livello: dado e usi crescono, il contatore resta uno.
  fighter.classes = [{ name: "Fighter", level: 18 }];
  syncClassResources(fighter);
  expect(fighter.counters!.filter((counter) => counter.featureUse === "Combat Superiority")).toMatchObject([{ name: "Combat Superiority (d12)" }]);
  expect(use(withTraits("Paladin", 3, ["Lay on Hands"]), "Lay on Hands")).toMatchObject({ max: 15, recovery: "long" });
  // Warding Flare: modificatore di Saggezza, col riposo breve da Improved Warding Flare.
  expect(use(withTraits("Cleric", 3, ["Warding Flare"]), "Warding Flare")).toMatchObject({ max: 3, recovery: "long" });
  expect(use(withTraits("Cleric", 6, ["Warding Flare", "Improved Warding Flare"]), "Warding Flare")).toMatchObject({ recovery: "short" });
  // Senza il tratto niente contatore; uno creato a mano dal tratto si adotta.
  expect(withTraits("Fighter", 2, []).counters?.some((counter) => counter.featureUse)).toBe(false);
  const wizard = withClass("Wizard", 1);
  wizard.traits = [{ id: "ar", name: "Arcane Recovery", description: "" }];
  wizard.counters = [{ id: "mine", name: "Recupero arcano", current: 0, max: 1, recovery: "long", traitId: "ar" }];
  syncClassResources(wizard);
  expect(wizard.counters).toMatchObject([{ id: "mine", name: "Recupero arcano", current: 0, featureUse: "Arcane Recovery" }]);
});
