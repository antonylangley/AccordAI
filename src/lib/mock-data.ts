import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BadgeCheck,
  Ban,
  Building2,
  Database,
  FileClock,
  KeyRound,
  MessageSquareWarning,
  ShieldAlert,
  Users
} from "lucide-react";

export type RiskLevel = "low" | "medium" | "high" | "critical";
export type ProviderName = "OpenAI" | "Anthropic" | "Gemini" | "Internal";

export type Stat = {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
};

export type GovernanceEvent = {
  id: string;
  time: string;
  department: string;
  user: string;
  provider: ProviderName;
  severity: RiskLevel;
  category: string;
  actionTaken: string;
  status: string;
  riskScore: number;
  redactedPromptPreview: string;
  flags: string[];
  policyTriggered: string;
  recommendedAction: string;
};

export type PolicyToggleItem = {
  label: string;
  description: string;
  enabled: boolean;
};

export type ProviderConnection = {
  name: string;
  status: "connected" | "not connected" | "pending authorization";
  detail: string;
  requests: string;
};

export const dashboardStats: Stat[] = [
  {
    label: "Total AI requests",
    value: "18,420",
    detail: "+14.2% from last month",
    icon: Activity
  },
  {
    label: "Active users",
    value: "284",
    detail: "Across 18 teams",
    icon: Users
  },
  {
    label: "High-risk events",
    value: "47",
    detail: "0.25% of requests",
    icon: ShieldAlert
  },
  {
    label: "Blocked requests",
    value: "12",
    detail: "Critical policy match",
    icon: Ban
  },
  {
    label: "Estimated spend",
    value: "$2,816",
    detail: "Projected $3.2k this month",
    icon: Database
  }
];

export const usageOverTime = [
  { day: "Mon", requests: 1920, flagged: 12 },
  { day: "Tue", requests: 2360, flagged: 16 },
  { day: "Wed", requests: 2480, flagged: 18 },
  { day: "Thu", requests: 3010, flagged: 23 },
  { day: "Fri", requests: 2840, flagged: 19 },
  { day: "Sat", requests: 840, flagged: 6 },
  { day: "Sun", requests: 620, flagged: 4 }
];

export const riskDistribution = [
  { name: "Low", value: 69, color: "#22c55e" },
  { name: "Medium", value: 22, color: "#f59e0b" },
  { name: "High", value: 7, color: "#f97316" },
  { name: "Critical", value: 2, color: "#ef4444" }
];

export const providerUsage = [
  { name: "OpenAI", requests: 7820 },
  { name: "Anthropic", requests: 5140 },
  { name: "Gemini", requests: 2860 },
  { name: "Internal", requests: 2600 }
];

export const riskCategories = [
  { name: "PII exposure", events: 31 },
  { name: "Confidential data", events: 24 },
  { name: "Regulated advice", events: 18 },
  { name: "Prompt injection", events: 11 },
  { name: "Brand risk", events: 8 }
];

export const governanceEvents: GovernanceEvent[] = [
  {
    id: "evt_1042",
    time: "10:42 AM",
    department: "Lending Ops",
    user: "A. Rivera",
    provider: "OpenAI",
    severity: "high",
    category: "PII exposure",
    actionTaken: "Warned, redaction offered",
    status: "Needs review",
    riskScore: 82,
    redactedPromptPreview:
      "Draft an email to [PERSON] at [EMAIL] about a denied loan application...",
    flags: ["Personal data", "Financial decision context", "External recipient"],
    policyTriggered: "Regulated communications require redaction",
    recommendedAction:
      "Use automatic redaction and require a business justification before sending."
  },
  {
    id: "evt_1041",
    time: "9:58 AM",
    department: "Legal",
    user: "M. Chen",
    provider: "Anthropic",
    severity: "medium",
    category: "Confidential data",
    actionTaken: "Allowed and logged",
    status: "Resolved",
    riskScore: 56,
    redactedPromptPreview:
      "Summarize negotiation notes for [CLIENT] based on the attached contract excerpt...",
    flags: ["Client matter", "Confidential preview"],
    policyTriggered: "Confidential legal work is logged with redacted preview",
    recommendedAction: "No action required. Confirm report tagging at month end."
  },
  {
    id: "evt_1040",
    time: "9:21 AM",
    department: "Engineering",
    user: "S. Patel",
    provider: "Internal",
    severity: "critical",
    category: "Secrets/API keys",
    actionTaken: "Blocked",
    status: "Incident created",
    riskScore: 96,
    redactedPromptPreview:
      "Debug this request using key [REDACTED_SECRET] and endpoint [INTERNAL_URL]...",
    flags: ["Potential API key", "Internal endpoint", "Production access"],
    policyTriggered: "Secrets may not be sent to any model",
    recommendedAction: "Rotate exposed credential and attach incident response notes."
  },
  {
    id: "evt_1039",
    time: "Yesterday",
    department: "HR",
    user: "K. Owens",
    provider: "Gemini",
    severity: "high",
    category: "Regulated advice",
    actionTaken: "Required confirmation",
    status: "Reviewed",
    riskScore: 78,
    redactedPromptPreview:
      "Compare candidate accommodations for [ROLE] and recommend how HR should respond...",
    flags: ["Employment context", "Sensitive HR decision"],
    policyTriggered: "HR decisions require human review",
    recommendedAction: "Keep AI output advisory and document human decision owner."
  },
  {
    id: "evt_1038",
    time: "Yesterday",
    department: "Support",
    user: "J. Brooks",
    provider: "OpenAI",
    severity: "medium",
    category: "Brand risk",
    actionTaken: "Allowed and logged",
    status: "Resolved",
    riskScore: 49,
    redactedPromptPreview:
      "Rewrite this customer response about a delayed refund for [CUSTOMER]...",
    flags: ["Customer communication", "Tone risk"],
    policyTriggered: "Customer-facing drafts are sampled for review",
    recommendedAction: "Use approved support tone and retain metadata only."
  }
];

export const policyToggles: PolicyToggleItem[] = [
  {
    label: "Detect PII",
    description: "Names, emails, phone numbers, account identifiers, and similar personal data.",
    enabled: true
  },
  {
    label: "Detect secrets/API keys",
    description: "Credentials, tokens, internal endpoints, and production access clues.",
    enabled: true
  },
  {
    label: "Detect regulated advice",
    description: "Financial, legal, employment, and healthcare guidance that needs review.",
    enabled: true
  },
  {
    label: "Detect prompt injection",
    description: "Attempts to override instructions, leak system prompts, or bypass policies.",
    enabled: true
  },
  {
    label: "Detect confidential company data",
    description: "Board materials, customer contracts, product plans, and internal strategy.",
    enabled: true
  },
  {
    label: "Detect brand risk",
    description: "Customer-facing tone, public claims, and reputation-sensitive drafts.",
    enabled: false
  }
];

export const providers: ProviderConnection[] = [
  {
    name: "OpenAI",
    status: "connected",
    detail: "Policy-routed through Accord gateway",
    requests: "7,820 requests"
  },
  {
    name: "Anthropic",
    status: "connected",
    detail: "Workspace key active",
    requests: "5,140 requests"
  },
  {
    name: "Gemini",
    status: "pending authorization",
    detail: "Ready for admin authorization",
    requests: "0 requests"
  },
  {
    name: "Internal model",
    status: "connected",
    detail: "Private endpoint with metadata logging",
    requests: "2,600 requests"
  }
];

export const reportCards = [
  {
    title: "Monthly governance report",
    description: "Aggregate usage, risk posture, and review outcomes for leadership.",
    icon: FileClock
  },
  {
    title: "AI usage summary",
    description: "Provider, department, and use case trends with spend estimates.",
    icon: Activity
  },
  {
    title: "High-risk incident report",
    description: "Blocked events, critical policy triggers, and response notes.",
    icon: MessageSquareWarning
  },
  {
    title: "Policy change log",
    description: "Versioned governance updates with approver history.",
    icon: BadgeCheck
  },
  {
    title: "Framework alignment report",
    description: "Controls mapped to internal policy and external compliance frameworks.",
    icon: Building2
  }
];

export const settingsSections = [
  "Organization",
  "Providers",
  "Privacy and retention",
  "Review access",
  "Integrations"
];

export const privacyControls = [
  "Store metadata by default",
  "Redact prompts and responses",
  "Require reason for raw-content access",
  "Audit all admin review actions"
];

export const policyVersionHistory = [
  { version: "v1.8", date: "Jun 28", note: "Raised HR regulated-advice threshold to high." },
  { version: "v1.7", date: "Jun 12", note: "Added support for internal model gateway routing." },
  { version: "v1.6", date: "May 30", note: "Enabled redacted previews for legal review queue." }
];

export const thresholdRows = [
  { level: "Low", behavior: "Allow", description: "Metadata only, sampled for aggregate reporting." },
  { level: "Medium", behavior: "Allow and log", description: "Redacted preview retained for review." },
  { level: "High", behavior: "Warn and require confirmation", description: "User sees policy context before continuing." },
  { level: "Critical", behavior: "Block and create incident", description: "Reviewer workflow starts automatically." }
];

export const chatRiskCategories = [
  "Personal data",
  "Regulated financial context",
  "Customer communication"
];

export const retentionSettings = [
  { label: "Raw content storage", value: "Disabled" },
  { label: "Redacted previews", value: "30 days" },
  { label: "Metadata logs", value: "180 days" }
];

export const keyIcons = {
  KeyRound
};
