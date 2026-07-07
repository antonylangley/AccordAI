export type AISurface = "chatgpt";

export type ComposerDecorationState = "idle" | "clear" | "scanning" | "redact" | "blocked" | "failed";

export type SurfaceAssistantResponse = {
  id: string;
  element: HTMLElement;
  text: string;
};

export type SubmissionController = {
  source: "keyboard" | "button";
  prevent: () => void;
};

export interface AISurfaceAdapter {
  readonly surface: AISurface;
  isCurrentSurface(): boolean;
  findComposer(): HTMLElement | null;
  getDraftText(): string;
  setDraftText(text: string): Promise<void>;
  findSendButton(): HTMLElement | null;
  subscribeToDraft(callback: (text: string) => void): () => void;
  subscribeToSubmit(callback: (submission: SubmissionController) => void): () => void;
  subscribeToAssistantResponses(callback: (response: SurfaceAssistantResponse) => void): () => void;
  subscribeToRouteChanges(callback: () => void): () => void;
  getConversationKey(): string;
  submit(): Promise<void>;
  setComposerDecoratedState(state: ComposerDecorationState): void;
  hasAttachments(): boolean;
}
