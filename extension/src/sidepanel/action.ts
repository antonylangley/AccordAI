type SidePanelBehaviorApi = Pick<typeof chrome.sidePanel, "setPanelBehavior">;

export async function configureSidePanelAction(
  sidePanel: SidePanelBehaviorApi = chrome.sidePanel
): Promise<void> {
  await sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
}
