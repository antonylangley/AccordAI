import type { LucideIcon } from "lucide-react";
import type { ChatAttachmentMetadata } from "@/lib/chat/types";

export type MessageRole = "assistant" | "user" | "system";

export type ChatMessage = {
  id: number;
  role: MessageRole;
  content: string;
  meta?: string;
  status?: "thinking" | "typing";
};

export type Conversation = {
  id: string;
  title: string;
  group: "Pinned" | "Today" | "Previous 7 days" | "Older";
  risk: "clean" | "warn" | "high";
  pinned?: boolean;
};

export type Attachment = ChatAttachmentMetadata & {
  id: string | number;
};

export type ToolOption = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  enabled: boolean;
};

export type RiskTone = "clear" | "warning" | "critical";

export type RiskState = {
  categories: string[];
  decision: "Allow" | "Warn" | "Redact" | "Block";
  score: number;
  tone: RiskTone;
  detectedEntityCount: number;
};

export type VoiceState = "idle" | "listening" | "processing";
