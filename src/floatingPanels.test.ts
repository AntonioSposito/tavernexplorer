// @vitest-environment jsdom
import { expect, it, vi } from "vitest";

const popover = vi.hoisted(() => ({ open: vi.fn(async () => undefined) }));
vi.mock("@owlbear-rodeo/sdk", () => ({ default: { isAvailable: true, popover, viewport: { getWidth: async () => 1000, getHeight: async () => 800 } } }));
const { getFloatingPanelPosition, openFloatingPanel } = await import("./floatingPanels");

it("tiene la finestra dentro lo schermo e salva la posizione visibile", async () => {
  // Chat 400×620 su schermo 1000×800: oltre il bordo in basso a destra si ferma a 600, 180.
  await openFloatingPanel("messages", { left: 900, top: 500 });
  expect(popover.open).toHaveBeenLastCalledWith(expect.objectContaining({ anchorPosition: { left: 600, top: 180 } }));
  expect(getFloatingPanelPosition("messages")).toEqual({ left: 600, top: 180 });

  await openFloatingPanel("messages", { left: 50, top: 70 });
  expect(getFloatingPanelPosition("messages")).toEqual({ left: 50, top: 70 });
});
