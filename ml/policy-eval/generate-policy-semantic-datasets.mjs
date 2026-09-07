import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const devPath = join(here, "accord-policy-semantic-dev-v1.jsonl");
const holdoutPath = join(here, "accord-policy-semantic-holdout-v1.jsonl");
const shaPath = join(here, "accord-policy-semantic-holdout-v1.sha256");

const categories = [
  category("finance", "accord.confidential.unpublished-financials", "HOLD", [
    "Rewrite the preliminary revenue outlook our finance team circulated before the investor update.",
    "Organize our latest margin assumptions and budget variance into a leadership memo.",
    "Compare the operating projection in this internal workbook with last quarter's plan.",
    "Shorten the numbers our CFO sent this morning into five investor talking points.",
    "Analyze our current cash forecast before management releases it.",
    "Prepare slides from the earnings estimate shared only with the executive team.",
    "Summarize our not-yet-announced cost targets and sales forecast.",
    "Format the forecast our team is still revising for tomorrow's finance review.",
    "Extract action items from this internal budget and margin discussion."
  ], [
    "Explain what responsibilities a chief financial officer usually has.",
    "Summarize Microsoft's publicly released quarterly revenue from its earnings report.",
    "Describe common methods for building a company budget.",
    "Analyze a fictional retailer's sample income statement.",
    "What figures normally appear in a public annual report?"
  ]),
  category("strategy", "accord.confidential.strategy-pricing-contracts", "HOLD", [
    "Organize the locations and costs in our unannounced expansion plan.",
    "Turn our market-entry notes into a memo for the strategy team.",
    "Compare the regions our company is considering for next year's rollout.",
    "Shorten this internal growth plan before the leadership meeting.",
    "Analyze the site plan our team has not shared outside the company.",
    "Prepare slides from our future clinic expansion decisions.",
    "Rewrite the strategic options we are evaluating for the next fiscal year.",
    "Extract action items from this company-internal market plan.",
    "Summarize the locations our team plans to enter after the deal closes."
  ], [
    "Explain common business expansion strategies.",
    "Create a fictional expansion plan for a made-up veterinary company.",
    "Summarize a public press release announcing a new office.",
    "What factors should a company consider when entering a market?",
    "Describe strategic planning in general."
  ]),
  category("merger", "accord.confidential.strategy-pricing-contracts", "HOLD", [
    "Turn our acquisition target list and proposed offer ranges into a concise memo.",
    "Organize the clinics we plan to acquire and the diligence concerns for each.",
    "Compare our internal deal candidates before the investment committee meets.",
    "Summarize the transaction notes our team circulated after diligence.",
    "Prepare slides from our proposed purchase terms before announcement.",
    "Extract risks from the companies we are privately evaluating for acquisition.",
    "Rewrite our merger planning notes for the executive review.",
    "Analyze the offer economics in this internal deal workbook.",
    "Format our not-yet-announced acquisition schedule by target and price."
  ], [
    "What factors should a business consider before acquiring another company?",
    "Explain merger due diligence in general.",
    "Summarize a publicly announced acquisition.",
    "Create a fictional merger case study for a class.",
    "Describe how investment committees usually review deals."
  ]),
  category("commercial", "accord.confidential.strategy-pricing-contracts", "HOLD", [
    "Compare our customer-specific discount schedule with negotiated supplier rates.",
    "Summarize the private commercial terms in this vendor agreement.",
    "Rewrite our internal pricing model for the sales leadership review.",
    "Organize the rates our company negotiated with this supplier.",
    "Analyze our current margin model and proposed client discounts.",
    "Extract obligations from this confidential customer contract.",
    "Prepare a memo about the vendor terms our procurement team negotiated.",
    "Shorten this company-internal rate card and exception schedule.",
    "Format the proposed contract economics for tomorrow's deal review."
  ], [
    "Explain common pricing strategies.",
    "Describe vendor contract negotiation in general.",
    "Summarize a publicly filed customer contract.",
    "Create a fictional discount schedule for a sample store.",
    "What clauses commonly appear in supplier agreements?"
  ]),
  category("technical", "accord.confidential.board-security-technical", "BLOCK", [
    "Review how our production services communicate and where each trust boundary sits.",
    "Turn our private service topology into a concise architecture overview.",
    "Analyze the implementation details in this internal system design.",
    "Simplify the deployment architecture our engineers use in production.",
    "Summarize our proprietary data pipeline and service dependencies.",
    "Prepare slides from this company-internal technical design.",
    "Extract risks from the architecture diagram our platform team shared.",
    "Rewrite the private documentation for our production control plane.",
    "Compare the internal designs our engineers proposed for the new platform."
  ], [
    "Explain trust boundaries in zero-trust architecture.",
    "Summarize a public software architecture case study.",
    "Describe common microservice communication patterns.",
    "Create a fictional system design for a coding exercise.",
    "What is a control plane in distributed systems?"
  ]),
  category("security", "accord.confidential.board-security-technical", "BLOCK", [
    "Shorten the instructions our engineers follow after unauthorized production access.",
    "Organize our internal incident-response procedure into six steps.",
    "Analyze the recovery runbook our security team uses during a breach.",
    "Rewrite this restricted access-control procedure for the operations team.",
    "Extract action items from our production security escalation playbook.",
    "Summarize the internal containment steps for a compromised account.",
    "Prepare a memo from the incident process our staff uses in production.",
    "Compare our private breach-response procedure with the new team workflow.",
    "Format the security runbook our engineers circulated internally."
  ], [
    "Explain what a security runbook is.",
    "Describe common incident-response procedures used by companies.",
    "Summarize a publicly released security framework.",
    "Create a fictional breach-response exercise.",
    "What are common access-control best practices?"
  ]),
  category("product", "accord.confidential.strategy-pricing-contracts", "HOLD", [
    "Organize our unannounced product launch plan by market and date.",
    "Rewrite the roadmap our product team is still evaluating.",
    "Summarize our internal launch dependencies before the executive review.",
    "Compare the features planned for our private beta releases.",
    "Prepare slides from our not-yet-announced product strategy.",
    "Extract risks from the roadmap our team shared internally.",
    "Format our future release plan for the leadership meeting.",
    "Analyze the market rollout our company has not disclosed.",
    "Shorten the product expansion notes we are keeping inside the company."
  ], [
    "Explain how product roadmaps are commonly organized.",
    "Summarize a publicly announced product launch.",
    "Create a fictional roadmap for a classroom project.",
    "What are common private-beta practices?",
    "Describe product strategy in general."
  ]),
  category("client", "accord.client.identifiers.redact", "REDACT", [
    "Summarize this client's veterinary case using the owner's contact details.",
    "Draft a follow-up for our customer from the attached animal-care note.",
    "Review this pet owner's case and prepare an email update.",
    "Organize the client record our clinic uses for this patient.",
    "Rewrite the account holder's treatment summary for the care team.",
    "Prepare a message to our customer about this veterinary result.",
    "Summarize the owner information in this animal hospital case.",
    "Extract action items from this client contact record.",
    "Format the identifying details in this pet patient's case note."
  ], [
    "Summarize publicly released research about treating vomiting in dogs.",
    "Explain common sections in an anonymous veterinary case summary.",
    "Create a fictional pet-owner case for a training exercise.",
    "What are common causes of vomiting in dogs?",
    "Describe how animal hospitals triage emergencies."
  ], ["PERSON", "EMAIL"]),
  category("hr", "accord.hr.records.unapproved", "HOLD", [
    "Summarize our employee's performance review and compensation history.",
    "Draft a manager memo from this internal disciplinary record.",
    "Organize the candidate interview notes and proposed salary decision.",
    "Rewrite our staff member's termination documentation.",
    "Analyze the performance concerns in this employee record.",
    "Prepare talking points from our named employee's evaluation.",
    "Extract action items from this internal harassment investigation.",
    "Format the compensation changes in our personnel review.",
    "Summarize the sensitive staff record our HR team circulated."
  ], [
    "Explain common employee performance-review practices.",
    "Describe compensation planning in general.",
    "Create a fictional performance review for manager training.",
    "Summarize publicly released research about workplace feedback.",
    "What belongs in an anonymous candidate scorecard?"
  ], ["PERSON"]),
  category("board", "accord.confidential.board-security-technical", "BLOCK", [
    "Summarize the leadership materials our board will discuss tomorrow.",
    "Rewrite this internal board deck into executive talking points.",
    "Organize the confidential memo our directors received.",
    "Extract decisions from the private board-meeting materials.",
    "Prepare a summary of our unreleased executive briefing.",
    "Analyze the risks in the board packet circulated inside our company.",
    "Shorten this confidential leadership deck.",
    "Format the material our directors will review before announcement.",
    "Compare the internal proposals in tomorrow's board briefing."
  ], [
    "Explain what normally belongs in a board deck.",
    "Summarize a publicly released corporate-governance report.",
    "Create a fictional board agenda for a sample company.",
    "Describe common executive briefing formats.",
    "What are typical responsibilities of corporate directors?"
  ])
];

function category(name, ruleId, expectedAction, positives, negatives, detectors = []) {
  return { name, ruleId, expectedAction, positives, negatives, detectors };
}

function build(split, positiveCount, negativeCount) {
  return categories.flatMap((entry, categoryIndex) => {
    const positiveOffset = split === "dev" ? 0 : 4;
    const negativeOffset = split === "dev" ? 0 : 2;
    const positives = Array.from({ length: positiveCount }, (_, index) =>
      makeRow(
        entry,
        split,
        index + 1,
        split === "holdout"
          ? holdoutParaphrase(entry.positives[(index + positiveOffset) % entry.positives.length], index, true)
          : entry.positives[(index + positiveOffset) % entry.positives.length],
        true,
        categoryIndex
      )
    );
    const negatives = Array.from({ length: negativeCount }, (_, index) =>
      makeRow(
        entry,
        split,
        positiveCount + index + 1,
        split === "holdout"
          ? holdoutParaphrase(entry.negatives[(index + negativeOffset) % entry.negatives.length], index, false)
          : entry.negatives[(index + negativeOffset) % entry.negatives.length],
        false,
        categoryIndex
      )
    );
    return [...positives, ...negatives];
  });
}

function holdoutParaphrase(text, index, positive) {
  const positiveFrames = [
    "For a concise review, work from the following private material: ",
    "Help prepare an internal briefing using this organization-specific content: ",
    "For tomorrow's closed meeting, process the following company material: ",
    "Produce a leadership-ready version of this non-public content: ",
    "Use the following internal source material to prepare the requested output: "
  ];
  const negativeFrames = [
    "For a general educational overview, ",
    "Using only public or hypothetical information, ",
    "Without relying on any private company material, "
  ];
  const frame = (positive ? positiveFrames : negativeFrames)[index % (positive ? positiveFrames.length : negativeFrames.length)];
  return `${frame}${text.charAt(0).toLocaleLowerCase()}${text.slice(1)}`;
}

function makeRow(entry, split, ordinal, text, positive, categoryIndex) {
  return {
    id: `${split}-${entry.name}-${String(ordinal).padStart(2, "0")}`,
    split,
    category: entry.name,
    text,
    relevantRuleIds: [entry.ruleId],
    expectedAction: positive ? entry.expectedAction : "ALLOW",
    expectedTriggered: positive,
    expectedSource: positive ? "accord_builtin" : null,
    provider: "chatgpt",
    detectors: positive ? entry.detectors : [],
    redactionAvailable: positive && entry.expectedAction === "REDACT",
    hardNegative: !positive,
    generationGroup: categoryIndex
  };
}

function serialize(rows) {
  return `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

mkdirSync(here, { recursive: true });
const dev = serialize(build("dev", 9, 5));
const holdout = serialize(build("holdout", 5, 3));
const holdoutSha = sha256(holdout);

const devTexts = new Set(dev.trim().split("\n").map((line) => JSON.parse(line).text));
const holdoutOverlap = holdout
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line).text)
  .filter((text) => devTexts.has(text));
if (holdoutOverlap.length) {
  throw new Error(`Dev and holdout must be disjoint; found ${holdoutOverlap.length} duplicate prompts.`);
}

if (existsSync(holdoutPath) && readFileSync(holdoutPath, "utf8") !== holdout) {
  throw new Error("Frozen holdout already exists with different contents; refusing to overwrite it.");
}

writeFileSync(devPath, dev);
if (!existsSync(holdoutPath)) writeFileSync(holdoutPath, holdout);
if (existsSync(shaPath) && readFileSync(shaPath, "utf8").trim() !== holdoutSha) {
  throw new Error("Frozen holdout checksum does not match the existing checksum file.");
}
writeFileSync(shaPath, `${holdoutSha}  ${holdoutPath.split("/").pop()}\n`);

console.info(JSON.stringify({ devRows: 140, holdoutRows: 80, totalRows: 220, holdoutSha256: holdoutSha }, null, 2));
