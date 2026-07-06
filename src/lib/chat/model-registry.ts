import type { ChatContentPartType, ChatProviderId, ModelRegistryEntry, ProviderCapabilities } from "./types";

const textOnlyCapabilities: ProviderCapabilities = {
  text: true,
  images: false,
  documents: true,
  audio: false,
  tools: true,
  thinking: false
};

const visionCapabilities: ProviderCapabilities = {
  text: true,
  images: true,
  documents: true,
  audio: false,
  tools: true,
  thinking: true
};

export const modelRegistry: ModelRegistryEntry[] = [
  {
    id: "gpt-4.1",
    label: "GPT-4.1",
    provider: "openai",
    apiModel: "gpt-4.1",
    capabilities: visionCapabilities,
    supportedInputTypes: ["text", "image", "document_text", "file_metadata"]
  },
  {
    id: "gpt-4.1-mini",
    label: "GPT-4.1 Mini",
    provider: "openai",
    apiModel: "gpt-4.1-mini",
    capabilities: textOnlyCapabilities,
    supportedInputTypes: ["text", "document_text", "file_metadata"]
  },
  {
    id: "claude-sonnet",
    label: "Claude Sonnet",
    provider: "anthropic",
    apiModel: "claude-sonnet-4-5",
    capabilities: visionCapabilities,
    supportedInputTypes: ["text", "image", "document_text", "file_metadata"]
  },
  {
    id: "gemini-pro",
    label: "Gemini Pro",
    provider: "gemini",
    apiModel: "gemini-2.5-pro",
    capabilities: visionCapabilities,
    supportedInputTypes: ["text", "image", "document_text", "file_metadata"]
  },
  {
    id: "internal-mock",
    label: "Internal Mock",
    provider: "mock",
    apiModel: "mock-governed-chat",
    capabilities: {
      text: true,
      images: true,
      documents: true,
      audio: false,
      tools: true,
      thinking: true
    },
    supportedInputTypes: ["text", "image", "document_text", "file_metadata"]
  }
];

export function getModelEntry(value?: string) {
  const normalized = normalizeModelValue(value || "GPT-4.1");

  return (
    modelRegistry.find(
      (entry) => normalizeModelValue(entry.id) === normalized || normalizeModelValue(entry.label) === normalized
    ) || modelRegistry[0]
  );
}

export function getModelOptions() {
  return modelRegistry.map(({ id, label, provider, capabilities, supportedInputTypes }) => ({
    id,
    label,
    provider,
    capabilities,
    supportedInputTypes
  }));
}

export function providerLabel(provider: ChatProviderId) {
  const labels: Record<ChatProviderId, string> = {
    openai: "OpenAI",
    anthropic: "Anthropic",
    gemini: "Gemini",
    mock: "Accord Mock"
  };

  return labels[provider];
}

export function unsupportedInputTypes(entry: Pick<ModelRegistryEntry, "supportedInputTypes">, inputTypes: ChatContentPartType[]) {
  return inputTypes.filter((type) => !entry.supportedInputTypes.includes(type));
}

function normalizeModelValue(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}
