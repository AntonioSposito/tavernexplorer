import { expect, it } from "vitest";
import { messageTime } from "./messageVisibility";

it("i messaggi di oggi mostrano solo l'ora, gli altri anche la data GG/MM/AAAA", () => {
  const now = new Date(2026, 10, 9, 18, 0);
  expect(messageTime(new Date(2026, 10, 9, 9, 5).getTime(), now)).toBe("09:05");
  expect(messageTime(new Date(2026, 10, 8, 23, 59).getTime(), now)).toBe("08/11/2026 23:59");
  expect(messageTime(new Date(2025, 0, 3, 7, 30).getTime(), now)).toBe("03/01/2025 07:30");
});
