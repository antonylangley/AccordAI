import { describe, expect, test, vi } from "vitest";
import { configureSidePanelAction } from "./action";

describe("Accord Guard side-panel action", () => {
  test("opens the native side panel when the toolbar action is clicked", async () => {
    const setPanelBehavior = vi.fn().mockResolvedValue(undefined);

    await configureSidePanelAction({ setPanelBehavior });

    expect(setPanelBehavior).toHaveBeenCalledOnce();
    expect(setPanelBehavior).toHaveBeenCalledWith({ openPanelOnActionClick: true });
  });
});
