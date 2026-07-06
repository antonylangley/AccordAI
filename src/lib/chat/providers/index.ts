import "server-only";

import type { ChatProvider, ChatProviderId, ModelRegistryEntry } from "../types";
import { anthropicProvider } from "./anthropic-provider";
import { geminiProvider } from "./gemini-provider";
import { mockProvider } from "./mock-provider";
import { openAIProvider } from "./openai-provider";

const providers: Record<ChatProviderId, ChatProvider> = {
  openai: openAIProvider,
  anthropic: anthropicProvider,
  gemini: geminiProvider,
  mock: mockProvider
};

export class ProviderUnavailableError extends Error {}

export function getChatProvider(modelEntry?: ModelRegistryEntry) {
  if (!modelEntry) {
    return openAIProvider.available() ? openAIProvider : mockProvider;
  }

  const provider = providers[modelEntry.provider];

  if (provider.available()) {
    return provider;
  }

  if (modelEntry.provider === "openai") {
    return mockProvider;
  }

  throw new ProviderUnavailableError(
    `${provider.label} is not configured. Add the server-side API key for ${modelEntry.label}, or choose an available model.`
  );
}

export function getProviderConfiguration() {
  return {
    openai: openAIProvider.available(),
    anthropic: anthropicProvider.available(),
    gemini: geminiProvider.available(),
    mock: mockProvider.available()
  };
}
