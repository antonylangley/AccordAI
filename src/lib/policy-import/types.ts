export type ImportedPolicyRuleAction = "allow" | "transform" | "warn" | "require_approval" | "block";
export type ImportedPolicyDestinationType = "any" | "approved" | "enterprise" | "personal" | "unapproved";
export type ImportedPolicyRiskLevel = "low" | "medium" | "high" | "critical";
export type ImportedPolicyControlType =
  | "data_submission"
  | "destination_restriction"
  | "data_redaction"
  | "security_secret"
  | "intellectual_property"
  | "tool_usage"
  | "human_review"
  | "output_usage"
  | "procedural"
  | "monitoring"
  | "other";
export type ImportedPolicyEnforceability = "fully_enforceable" | "partially_enforceable" | "not_enforceable";
export type ImportedPolicyRecommendedAction = "block" | "warn" | "redact" | "require_approval";
export type ImportedPolicyRequirementDirection =
  | "prompt_input"
  | "ai_provider_usage"
  | "ai_output_usage"
  | "human_process"
  | "organization_policy"
  | "unknown";
export type ImportedPolicyMetadataExtractionMethod =
  | "docx_title_style"
  | "docx_heading"
  | "docx_labeled_field"
  | "docx_table"
  | "document_property"
  | "pdf_layout"
  | "pdf_heading"
  | "explicit_purpose_section"
  | "opening_text"
  | "filename_fallback"
  | "ocr"
  | "derived"
  | "admin_override";

export type ImportedPolicyMetadataField<T = string> = {
  value: T;
  confidence: number;
  sourceText?: string;
  sourceSection?: string;
  sourcePage?: number;
  extractionMethod: ImportedPolicyMetadataExtractionMethod;
  derived?: boolean;
};

export type ImportedPolicySection = {
  id: string;
  heading: string;
  level: number;
  text: string;
  sourcePage?: number;
  sourceText?: string;
};

export type ImportedPolicyIdentity = {
  id: string;
  title: ImportedPolicyMetadataField;
  description: ImportedPolicyMetadataField;
  organizationName?: ImportedPolicyMetadataField;
  owner?: ImportedPolicyMetadataField;
  effectiveDate?: ImportedPolicyMetadataField;
  version?: ImportedPolicyMetadataField;
  scope?: ImportedPolicyMetadataField;
  sourceFileName: string;
  sourceFileType: "pdf" | "docx" | "doc" | "text";
  metadataExtractionConfidence: number;
  metadataWarnings: string[];
  sections: ImportedPolicySection[];
  ocrFallbackRequired?: boolean;
};

export type ImportedPolicyDestinationAuthorization = {
  provider: string;
  destinationType: ImportedPolicyDestinationType;
  dataCategories: string[];
  condition: string;
};

export type ImportedPolicyRule = {
  id: string;
  policyId?: string;
  requirementId?: string;
  name: string;
  ruleKey: string;
  sourceText: string;
  sourcePolicyName: string;
  sourceSection: string;
  sourcePage?: number;
  supportingExcerpt: string;
  requirementSummary: string;
  controlType: ImportedPolicyControlType;
  requirementDirection: ImportedPolicyRequirementDirection;
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
  recommendedSeverity: ImportedPolicyRiskLevel;
  severity: ImportedPolicyRiskLevel;
  conditionDescription: string;
  employeeExplanation: string;
  reasoning: string;
  destinationAuthorizations: ImportedPolicyDestinationAuthorization[];
  effectiveDate: string;
  confidence: number;
  semanticConfidence?: number;
  enforceabilityConfidence?: number;
  recommendationConfidence?: number;
};

export type PolicyImportResult = {
  fileName: string;
  fileType: "pdf" | "docx" | "doc" | "text";
  extractedCharacters: number;
  policy: ImportedPolicyIdentity;
  rules: ImportedPolicyRule[];
  warnings: string[];
};
