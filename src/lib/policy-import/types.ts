export type ImportedPolicyRuleAction = "allow" | "transform" | "warn" | "require_approval" | "block";
export type ImportedPolicyDestinationType = "any" | "approved" | "enterprise" | "personal" | "unapproved";
export type ImportedPolicyRiskLevel = "low" | "medium" | "high" | "critical";

export type ImportedPolicyRule = {
  id: string;
  name: string;
  ruleKey: string;
  sourcePolicyName: string;
  sourceSection: string;
  supportingExcerpt: string;
  dataCategories: string[];
  userScope: string;
  departmentScope: string;
  aiProvider: string;
  destinationType: ImportedPolicyDestinationType;
  action: ImportedPolicyRuleAction;
  fallbackAction: ImportedPolicyRuleAction;
  severity: ImportedPolicyRiskLevel;
  employeeExplanation: string;
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
