import { expect, it, vi } from "vitest";
import { TOKEN_META_KEY } from "./constants";
import { importRoll20 } from "./importer";
import { createTokenTurn } from "./tokenTurns";

it("usa la scheda collegata a ciascun token e chiede l'iniziativa solo per quelli senza scheda condivisa", () => {
  const sheet = importRoll20({ character: { name: "Ada" }, normalized: { identity: { character_name: "Ada" } } });
  sheet.combat.initiative = 4;
  const roll = vi.fn((bonus: number) => 12 + bonus);
  const ask = vi.fn(() => 7);
  const linked = createTokenTurn({ id: "token-a", name: "Token Ada", metadata: { [TOKEN_META_KEY]: { characterId: sheet.id } } }, [sheet], roll, ask);
  const unlinked = createTokenTurn({ id: "token-b", name: "Goblin", metadata: {} }, [sheet], roll, ask);

  expect(linked).toMatchObject({ tokenId: "token-a", characterId: sheet.id, name: "Ada", initiative: 16, initiativeBonus: 4 });
  expect(unlinked).toMatchObject({ tokenId: "token-b", name: "Goblin", initiative: 7 });
  expect(unlinked?.characterId).toBeUndefined();
  expect(roll).toHaveBeenCalledExactlyOnceWith(4, sheet);
  expect(ask).toHaveBeenCalledExactlyOnceWith("Goblin");
});
