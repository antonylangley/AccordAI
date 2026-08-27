export type ImportedPolicyRuleAction = "allow" | "transform" | "warn" | "require_approval" | "block";
export type ImportedPolicyDestinationType = "any" | "approved" | "enterprise" | "personal" | "unapproved";
export type ImportedPolicyRiskLevel = "low" | "medium" | "high" | "critical";
export type ImportedPolicyControlType =
  | "data_submission"
  | "destination_restriction"
  | "data_redaction"
  | "security_secret"
  | "tool_usage"
  | "human_review"
  | "output_usage"
  | "procedural"
  | "monitoring"
  | "other";
export type ImportedPolicyEnforceability = "fully_enforceable" | "partially_enforceable" | "not_enforceable";
export type ImportedPolicyRecommendedAction = "block" | "warn" | "redact" | "require_approval";

export type ImportedPolicyDestinationAuthorization = {
  provider: string;
  destinationType: ImportedPolicyDestinationType;
  dataCategories: string[];
  condition: string;
};

export type ImportedPolicyRule = {
  id: string;
  name: string;
  ruleKey: string;
  sourceText: string;
  sourcePolicyName: string;
  sourceSection: string;
  supportingExcerpt: string;
  requirementSummary: string;
  controlType: ImportedPolicyControlType;
  enforceability: ImportedPolicyEnforceability;
  dataCategories: string[];
  destinationTypes: ImportedPolicyDestinationType[];
  userScope: string;
  departmentScope: string;
  aiProvider: string;
  destinationType: ImportedPolicyDestinationType;
  recommendedAction: ImportedPolicyRecommendedAction | null;
  action: ImportedPolicyRuleAction;
  fallbackAction: ImportedPolicyRuleAction;
  severity: ImportedPolicyRiskLevel;
  conditionDescription: string;
  employeeExplanation: string;
  reasoning: string;
  destinationAuthorizations: ImportedPolicyDestinationAuthorization[];
  effectiveDate: string;
  confidence: number;
};

export type PolicyImportResult = {
  fileName: string;
  fileType: "pdf" | "docx" | "doc" | "text";
  extractedCharacters: number;
  rules: ImportedPolicyRule[];
  warnings: string[];
};
