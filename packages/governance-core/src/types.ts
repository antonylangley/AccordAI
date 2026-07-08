export type ChatPolicyAction = "allow" | "warn" | "redact" | "block";

export type ChatFlagType =
  | "email"
  | "phone"
  | "address"
  | "account"
  | "possible_name"
  | "secret"
  | "regulated_financial"
  | "regulated_legal"
  | "regulated_medical"
  | "regulated_hr"
  | "prompt_injection";

export type ChatFlagSeverity = "low" | "medium" | "high" | "critical";
export type ChatScanStage = "preflight" | "attachment" | "post_response";
export type ChatProviderId = "openai" | "anthropic" | "gemini" | "mock";
export type ChatProviderMode = ChatProviderId | "none";
export type ChatProviderRole = "system" | "user" | "assistant";
export type ChatHistoryRole = "user" | "assistant";
export type ChatRedactionType = "person" | "email" | "phone" | "secret" | "address" | "account" | "other";
export type ChatContentPartType = "text" | "image" | "document_text" | "file_metadata";
export type ChatAttachmentKind = "text" | "image" | "document" | "metadata";

export type EntityType = "PERSON" | "EMAIL" | "PHONE" | "ADDRESS" | "ACCOUNT" | "SECRET" | "OTHER";

export type DetectedEntity = {
  id: string;
  type: EntityType;
  originalText: string;
  start: number;
  end: number;
  confidence: number;
  detector: string;
  contextSignals: string[];
};

export type ExternalEntityCandidate = Omit<DetectedEntity, "id">;

export type RedactionMap = Record<
  string,
  {
    type: EntityType;
    originalText: string;
  }
>;

export type EntityCountSummary = Partial<Record<EntityType, number>>;

export type ChatRiskFlag = {
  type: ChatFlagType;
  label: string;
  severity: ChatFlagSeverity;
  stage: ChatScanStage;
  evidence: string;
};

export type ChatPolicyDecision = {
  action: ChatPolicyAction;
  reason: string;
  requiresReview: boolean;
  providerCalled: boolean;
  redacted: boolean;
};

export type ChatLoggingBehavior = {
  rawPromptStored: false;
  rawResponseStored: false;
  retained: string[];
  note: string;
};

export type GovernanceLoggingBehavior = {
  rawContentStored: false;
  redactedPreviewStored: true;
  metadataStored: true;
};

export type ChatAuditTrailEvent = {
  id: string;
  timestamp: string;
  type: string;
  message: string;
  metadata?: Record<string, string | number | boolean>;
};

export type ChatGatewayRequest = {
  prompt: string;
  model?: string;
  useCase?: string;
  sensitivity?: string;
  thinkingMode?: boolean;
  tools?: string[];
  conversationId?: string;
  messages?: ChatHistoryMessage[];
  attachments?: ChatAttachmentMetadata[];
};

export type ChatHistoryMessage = {
  role: ChatHistoryRole;
  content: string;
};

export type ChatAttachmentMetadata = {
  id?: string | number;
  name: string;
  type: string;
  kind?: ChatAttachmentKind;
  mimeType?: string;
  size?: number;
  redactedText?: string;
  data?: string;
  riskScore?: number;
  flags?: ChatRiskFlag[];
  redactions?: ChatRedaction[];
  visualScanLimited?: boolean;
  extractionStatus?: "extracted" | "metadata_only_todo" | "unsupported" | "blocked";
  policyDecision?: ChatPolicyDecision;
};

export type ChatTextContentPart = {
  type: "text";
  text: string;
};

export type ChatImageContentPart = {
  type: "image";
  mimeType: string;
  data: string;
  name?: string;
};

export type ChatDocumentTextContentPart = {
  type: "document_text";
  text: string;
  name?: string;
  mimeType?: string;
};

export type ChatFileMetadataContentPart = {
  type: "file_metadata";
  name: string;
  mimeType: string;
  size: number;
  kind: ChatAttachmentKind;
  riskScore?: number;
  flags?: string[];
  visualScanLimited?: boolean;
  extractionStatus?: string;
};

export type ChatContentPart =
  | ChatTextContentPart
  | ChatImageContentPart
  | ChatDocumentTextContentPart
  | ChatFileMetadataContentPart;

export type ChatProviderMessage = {
  role: ChatProviderRole;
  content: ChatContentPart[];
};

export type ChatRedaction = {
  type: ChatRedactionType;
  placeholder: string;
  entityType?: EntityType;
  confidence?: number;
  detector?: string;
  contextSignals?: string[];
};

export type GovernanceContext = {
  useCase: string;
  sensitivity: string;
  thinkingMode: boolean;
  policyAction: string;
  riskScore: number;
  riskLevel: string;
  flags: string[];
  redactedPromptPreview: string;
  redactions: ChatRedaction[];
  redactionCount: number;
  redactionEntityCounts: EntityCountSummary;
  loggingBehavior: GovernanceLoggingBehavior;
  instruction: string;
};

export type ChatRedactionSummary = {
  total: number;
  byType: EntityCountSummary;
  placeholders: string[];
  providerSawPlaceholderContent: boolean;
  responseRehydrated: boolean;
  rehydratedPlaceholderCount: number;
  unresolvedPlaceholderCount: number;
};

export type ChatGatewayResponse = {
  assistantResponse: string;
  riskScore: number;
  flags: ChatRiskFlag[];
  policyDecision: ChatPolicyDecision;
  redactedPromptPreview: string;
  loggingBehavior: ChatLoggingBehavior;
  auditTrailEvents: ChatAuditTrailEvent[];
  provider: {
    id: string;
    label: string;
    mode: ChatProviderMode;
    model: string;
    selectedModel: string;
  };
  modelCapabilities: ProviderCapabilities;
  attachmentResults: ChatAttachmentMetadata[];
  contentSupport: {
    supported: boolean;
    warnings: string[];
  };
  governanceContext: GovernanceContext;
  redactionSummary: ChatRedactionSummary;
  postResponse: {
    riskScore: number;
    flags: ChatRiskFlag[];
    redactedResponsePreview: string;
  };
};

export type ChatScanResult = {
  stage: ChatScanStage;
  flags: ChatRiskFlag[];
  riskScore: number;
  redactedText: string;
  redactions: ChatRedaction[];
  entities: DetectedEntity[];
  redactionMap: RedactionMap;
  entityCounts: EntityCountSummary;
};

export type ChatProviderRequest = {
  messages: ChatProviderMessage[];
  modelEntry: ModelRegistryEntry;
  governanceContext: GovernanceContext;
  redactedPromptPreview: string;
  sanitizedHistory: ChatHistoryMessage[];
  attachments: ChatAttachmentMetadata[];
  model: string;
  useCase: string;
  sensitivity: string;
  thinkingMode: boolean;
  tools: string[];
  policyDecision: ChatPolicyDecision;
};

export type ChatProviderResult = {
  text: string;
  model: string;
};

export type ProviderCapabilities = {
  text: boolean;
  images: boolean;
  documents: boolean;
  audio: boolean;
  tools: boolean;
  thinking: boolean;
};

export type ModelRegistryEntry = {
  id: string;
  label: string;
  provider: ChatProviderId;
  apiModel: string;
  capabilities: ProviderCapabilities;
  supportedInputTypes: ChatContentPartType[];
};

export type ChatProvider = {
  id: ChatProviderId;
  label: string;
  mode: ChatProviderMode;
  available: () => boolean;
  complete: (request: ChatProviderRequest) => Promise<ChatProviderResult>;
};
