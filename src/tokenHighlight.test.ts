import { expect, it, vi } from "vitest";

const animateTo = vi.hoisted(() => vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined));
vi.mock("@owlbear-rodeo/sdk", () => {
  const shape = new Proxy({}, { get: (_target, key, self) => key === "build" ? () => ({ id: "ring" }) : () => self });
  return { buildShape: () => shape, default: {
    isAvailable: true,
    scene: {
      isReady: async () => true,
      items: { getItems: async () => [{ id: "t1" }], getItemBounds: async () => ({ center: { x: 500, y: 200 }, width: 100, height: 100 }) },
      local: { getItems: async () => [], addItems: async () => undefined, deleteItems: async () => undefined, updateItems: async () => undefined },
    },
    viewport: { getScale: async () => 2, getWidth: async () => 800, getHeight: async () => 600, animateTo },
  } };
});

it("centra il token nella vista mantenendo lo zoom", async () => {
  const { focusToken } = await import("./tokenHighlight");
  await focusToken("t1");
  expect(animateTo).toHaveBeenCalledWith({ scale: 2, position: { x: -600, y: -100 } });
});
