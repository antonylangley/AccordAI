import type { AccordOrganizationMember } from "@/lib/auth/organization";

export type OrganizationDateRange = "7d" | "30d" | "90d";
export type OrganizationEventCategory =
  | "blocked"
  | "redacted"
  | "held"
  | "warning"
  | "flagged"
  | "allowed"
  | "error";

export type OrganizationCoverageStatus =
  | "reporting"
  | "no_recent_activity"
  | "not_reporting"
  | "invite_pending"
  | "suspended";

export type OrganizationPersonSummary = AccordOrganizationMember & {
  displayName: string;
  avatarUrl?: string;
  department?: string;
  surfaces: string[];
  coverageStatus: OrganizationCoverageStatus;
  averageRiskScore: number;
  highestRiskScore: number;
  latestRiskScore: number;
  lastAuditAt?: string;
  lastSeenAt?: string;
  auditCount: number;
  riskEventCount: number;
  enforcementCount: number;
  enforcementRate: number;
  topPolicyLabel?: string;
  riskLevel: "low" | "moderate" | "high" | "critical";
};

export type OrganizationOverview = {
  range: OrganizationDateRange;
  people: OrganizationPersonSummary[];
  metrics: {
    activeMembers: number;
    reportingMembers: number;
    highRiskUsers: number;
    coverageRate: number;
  };
  isTruncated: boolean;
};

export type OrganizationAuditEvent = {
  id: string;
  createdAt: string;
  category: OrganizationEventCategory;
  eventType: string;
  action: string;
  riskScore: number;
  riskLevel: "low" | "moderate" | "high" | "critical";
  surface: string;
  provider?: string;
  destinationType?: string;
  policyAction?: string;
  policySeverity?: string;
  policyRuleKey?: string;
  policyName?: string;
  policySource?: string;
  policyControlType?: string;
  policyEnforceability?: string;
  policyCondition?: string;
  policyReasoning?: string;
  policyConfidence?: number;
  performedLocally: boolean;
  redactionCount: number;
  attachmentCount: number;
  messageLengthBucket?: string;
  detectedCategories: string[];
  detectedEntities: Array<{ type: string; count: number }>;
  flags: string[];
  reason?: string;
  summary?: string;
};

export type OrganizationPersonDetail = {
  person: OrganizationPersonSummary;
  events: OrganizationAuditEvent[];
  policies: Array<{
    key: string;
    name: string;
    source?: string;
    action?: string;
    severity?: string;
    eventCount: number;
    blockCount: number;
    redactionCount: number;
    warningCount: number;
    lastTriggeredAt?: string;
  }>;
  hasMore: boolean;
};
