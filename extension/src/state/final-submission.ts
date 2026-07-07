import type { SurfacePatch } from "./surface-state";
import type { SafeScanResult } from "../messaging/types";

export type FinalSubmissionOutcome = "submitted" | "blocked" | "failed";

export type FinalSubmissionOptions = {
  readDraft: () => string;
  scan: (text: string) => Promise<SafeScanResult>;
  setDraftText: (text: string) => Promise<void>;
  verifyDraftText: () => string;
  submitTrusted: () => Promise<void>;
  onState: (state: SurfacePatch) => void;
};

export class TrustedSubmissionGate {
  private nextTrusted = false;

  authorizeNext() {
    this.nextTrusted = true;
  }

  consumeIfAuthorized() {
    if (!this.nextTrusted) return false;
    this.nextTrusted = false;
    return true;
  }
}

export async function runFinalSubmissionDecision(options: FinalSubmissionOptions): Promise<FinalSubmissionOutcome> {
  const draft = options.readDraft();
  const scan = await options.scan(draft);

  if (scan.action === "block") {
    options.onState({ phase: "blocked", scan, message: scan.explanation });
    return "blocked";
  }

  if (scan.action === "redact") {
    const sanitizedText = scan.sanitizedText;

    if (!sanitizedText) {
      options.onState({
        phase: "failed",
        scan,
        message: "Accord could not produce a sanitized draft. Message not sent."
      });
      return "failed";
    }

    await options.setDraftText(sanitizedText);
    const verifiedText = options.verifyDraftText();

    if (verifiedText !== sanitizedText) {
      options.onState({
        phase: "failed",
        scan,
        message: "Accord could not verify the sanitized draft. Message not sent."
      });
      return "failed";
    }

    options.onState({ phase: "clear", scan, message: "Sensitive info redacted before sending." });
    await options.submitTrusted();
    return "submitted";
  }

  options.onState({ phase: "clear", scan, message: undefined });
  await options.submitTrusted();
  return "submitted";
}
