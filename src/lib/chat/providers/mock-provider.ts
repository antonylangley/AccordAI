import "server-only";

import type { ChatProvider } from "../types";

export const mockProvider: ChatProvider = {
  id: "mock",
  label: "Accord Mock Provider",
  mode: "mock",
  available: () => true,
  async complete(request) {
    const prefix = request.thinkingMode ? "After a deeper policy-aware pass: " : "";
    const prompt = request.redactedPromptPreview;
    const flagSet = new Set(request.governanceContext.flags);
    const personPlaceholder = request.governanceContext.redactions.find((redaction) => redaction.entityType === "PERSON")?.placeholder;
    const addressee = personPlaceholder || "there";

    if (/\b(?:hello|hi|hey)\b/i.test(prompt) && prompt.length < 40) {
      return {
        model: "mock-governed-chat",
        text: `${prefix}Hello from Accord. I can help with drafting, summarizing, policy checks, and safer rewrites through the governed chat gateway.`
      };
    }

    if (/\b(?:draft|write|email|message|letter)\b/i.test(prompt) && /denied loan|loan application|adverse action/i.test(prompt)) {
      return {
        model: "mock-governed-chat",
        text: `${prefix}Subject: Update Regarding Your Loan Application

Hi ${addressee},

Thank you for your recent application. After reviewing the information provided, we are unable to move forward with approval at this time.

Please refer to the formal notice for the specific reason codes and any next steps available to you. If you have questions, contact the approved support channel listed in that notice.

Best,
[COMPANY]`
      };
    }

    if (/\b(?:draft|write|email|message|letter)\b/i.test(prompt)) {
      return {
        model: "mock-governed-chat",
        text: `${prefix}Subject: Follow-up

Hi ${addressee},

Thank you for reaching out. I wanted to follow up with a clear update based on the information currently available. Please review the details and let us know through the approved support channel if anything needs correction.

Best,
[COMPANY]`
      };
    }

    if (/summarize|summary/i.test(prompt)) {
      return {
        model: "mock-governed-chat",
        text:
          `${prefix}Summary draft for ${request.useCase}: key facts, unresolved questions, policy-sensitive terms, and recommended human review points. ` +
          "The retained evidence is limited to metadata and redacted previews."
      };
    }

    if (flagSet.has("regulated_financial") || flagSet.has("regulated_legal") || flagSet.has("regulated_medical") || flagSet.has("regulated_hr")) {
      return {
        model: "mock-governed-chat",
        text:
          `${prefix}I can help with this regulated request using neutral, placeholder-safe language. I will avoid making final eligibility, legal, medical, hiring, lending, insurance, or financial decisions and keep identifiers redacted.`
      };
    }

    return {
      model: "mock-governed-chat",
      text:
        `${prefix}Draft response for ${request.useCase}: I can structure the answer, identify risk-sensitive claims, and keep the output within the selected policy profile. ` +
        "No raw-content retention is required for this exchange."
    };
  }
};
