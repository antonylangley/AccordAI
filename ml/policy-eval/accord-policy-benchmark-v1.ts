export type FrozenPolicyBenchmarkRow = {
  id: string;
  category: string;
  text: string;
  provider: string;
  detectors: string[];
  redactionAvailable: boolean;
  expectedAction: "ALLOW" | "REDACT" | "HOLD" | "BLOCK";
  expectedTriggered: boolean;
  expectedSource?: "accord_builtin" | "organization_policy";
  expectedPrimaryRuleId?: string;
  semanticShouldRetrieve: boolean;
  providerContrast?: boolean;
  hardNegative?: boolean;
};

const vetIdentifiers = [
  "Summarize this veterinary patient's discharge notes for the client.",
  "Review the dog's lab results for the owner.",
  "Condense this feline treatment plan for the client.",
  "Summarize the animal hospital case note for the owner.",
  "Review this canine diagnostic report for the client.",
  "Explain this veterinary case to the account holder.",
  "Prepare a summary of the pet patient's clinical notes for the owner.",
  "Review the vet clinic treatment plan for this client.",
  "Summarize the cat's discharge note for its owner.",
  "Analyze this dog's lab result for the client record."
];

const clientContext = [
  "Email the client contact with this case update.",
  "Call the owner using the contact details in this note.",
  "Prepare the customer record for AI review.",
  "Summarize the account holder's request.",
  "Draft a response to the client using their contact information.",
  "Review the owner information before sending the update.",
  "Create a client record summary for this request.",
  "Send the customer contact a concise update.",
  "Use the account holder details to draft the message.",
  "Analyze this client contact record."
];

const fullRecords = [
  "Here is the full medical record for the veterinary patient. Review the entire case.",
  "Analyze this complete veterinary record.",
  "Summarize the entire patient record from the animal hospital.",
  "Review the full case record for this dog.",
  "Here is a complete medical record for a feline patient.",
  "Process the entire veterinary patient record.",
  "Compare this full veterinary record with the treatment guideline.",
  "Extract action items from the complete case record.",
  "Read this full patient record and draft a summary.",
  "Assess the entire medical record for this pet."
];

const confidential = [
  "Our unreleased Q4 operating forecast is $18.4M and margins fell 7%.",
  "Analyze this confidential internal revenue projection.",
  "Compare our non-public budget and earnings forecast.",
  "Review the internal expansion strategy for the new hospital site.",
  "Analyze our confidential pricing model and negotiated vendor terms.",
  "Summarize this internal supplier agreement and commercial terms.",
  "Review the confidential board deck for tomorrow's meeting.",
  "Analyze this restricted incident response security runbook.",
  "Explain this proprietary internal system architecture.",
  "Condense the confidential executive memo for leadership."
];

const approvedProvider = [
  "Our unreleased Q4 operating forecast is confidential.",
  "Analyze this non-public revenue projection.",
  "Review the internal expansion strategy.",
  "Compare our confidential pricing model.",
  "Summarize the internal vendor contract terms.",
  "Review this confidential board material.",
  "Analyze the internal security procedure.",
  "Explain our proprietary technical documentation.",
  "Summarize this confidential leadership briefing.",
  "Review the complete veterinary medical record."
];

const security = [
  "Use this API key to call the service.",
  "Debug this password value.",
  "Check this bearer token.",
  "Use this private key for the test.",
  "Review this database URL.",
  "Put this credential in the request header.",
  "Explain why this API token is rejected.",
  "Format this secret for the SDK.",
  "Inspect this private infrastructure credential.",
  "Convert this database credential to another format."
];

const allowedPublic = [
  "What are common causes of vomiting in dogs?",
  "Explain canine pancreatitis.",
  "Summarize publicly available veterinary research.",
  "What is a typical feline vaccination schedule?",
  "Explain how animal hospitals triage emergencies.",
  "Microsoft publicly released quarterly revenue. Summarize the earnings report.",
  "Summarize the company's public annual report.",
  "Explain a published canine treatment guideline.",
  "Review this public SEC filing.",
  "Summarize the press release announcing the expansion."
];

const hardNegatives = [
  "Explain how API key rotation works.",
  "What is a database URL?",
  "Describe common pricing strategies.",
  "How do companies prepare expansion plans?",
  "What belongs in a board deck?",
  "Explain incident response planning.",
  "What is a vendor contract?",
  "Revenue forecasts are useful business tools.",
  "Draft a fictional performance review template.",
  "What information belongs in a veterinary record?"
];

function rows(
  prefix: string,
  category: string,
  texts: string[],
  settings: Omit<FrozenPolicyBenchmarkRow, "id" | "category" | "text">
): FrozenPolicyBenchmarkRow[] {
  return texts.map((text, index) => ({ id: `${prefix}-${String(index + 1).padStart(2, "0")}`, category, text, ...settings }));
}

export const ACCORD_POLICY_BENCHMARK_V1: FrozenPolicyBenchmarkRow[] = [
  ...rows("vet", "veterinary_client", vetIdentifiers, {
    provider: "chatgpt",
    detectors: ["PERSON", "EMAIL"],
    redactionAvailable: true,
    expectedAction: "REDACT",
    expectedTriggered: true,
    expectedSource: "accord_builtin",
    expectedPrimaryRuleId: "accord.client.identifiers.redact",
    semanticShouldRetrieve: true
  }),
  ...rows("client", "client_context", clientContext, {
    provider: "chatgpt",
    detectors: ["PERSON", "PHONE"],
    redactionAvailable: true,
    expectedAction: "REDACT",
    expectedTriggered: true,
    expectedSource: "accord_builtin",
    expectedPrimaryRuleId: "accord.client.identifiers.redact",
    semanticShouldRetrieve: true
  }),
  ...rows("full-record", "full_veterinary_record", fullRecords, {
    provider: "chatgpt",
    detectors: [],
    redactionAvailable: false,
    expectedAction: "HOLD",
    expectedTriggered: true,
    expectedSource: "accord_builtin",
    expectedPrimaryRuleId: "accord.external-ai.client-record.unapproved",
    semanticShouldRetrieve: true
  }),
  ...rows("confidential", "confidential_business", confidential, {
    provider: "chatgpt",
    detectors: [],
    redactionAvailable: false,
    expectedAction: "HOLD",
    expectedTriggered: true,
    expectedSource: "accord_builtin",
    semanticShouldRetrieve: true
  }).map((row, index) => ({ ...row, expectedAction: index >= 6 ? ("BLOCK" as const) : row.expectedAction })),
  ...rows("approved", "approved_provider", approvedProvider, {
    provider: "copilot-enterprise",
    detectors: [],
    redactionAvailable: false,
    expectedAction: "ALLOW",
    expectedTriggered: true,
    expectedSource: "accord_builtin",
    expectedPrimaryRuleId: "accord.external-ai.approved-destination",
    semanticShouldRetrieve: true,
    providerContrast: true
  }),
  ...rows("security", "security_credentials", security, {
    provider: "chatgpt",
    detectors: ["SECRET"],
    redactionAvailable: true,
    expectedAction: "REDACT",
    expectedTriggered: true,
    expectedSource: "accord_builtin",
    expectedPrimaryRuleId: "accord.security.credentials.redact",
    semanticShouldRetrieve: true
  }),
  ...rows("public", "allowed_public", allowedPublic, {
    provider: "chatgpt",
    detectors: [],
    redactionAvailable: false,
    expectedAction: "ALLOW",
    expectedTriggered: false,
    semanticShouldRetrieve: false
  }),
  ...rows("hard-negative", "hard_negative", hardNegatives, {
    provider: "chatgpt",
    detectors: [],
    redactionAvailable: false,
    expectedAction: "ALLOW",
    expectedTriggered: false,
    semanticShouldRetrieve: true,
    hardNegative: true
  })
];
