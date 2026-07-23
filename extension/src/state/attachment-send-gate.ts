import type { SurfacePhase } from "./surface-state";

export type AttachmentGateStatus = "none" | "pending" | "governed" | "blocked";

export type AttachmentSendGateInput = {
  gateStatus: AttachmentGateStatus;
  hasHostAttachments: boolean;
  attachmentNotice: boolean;
  phase: SurfacePhase;
  message?: string;
};

export function attachmentSendBlockReason(input: AttachmentSendGateInput) {
  if (input.gateStatus === "pending") {
    return "Accord is still scanning this file. Wait for governance before sending.";
  }

  if (input.attachmentNotice && (input.phase === "blocked" || input.phase === "failed")) {
    return input.message || "Attachment upload is blocked by Accord. File was not uploaded.";
  }

  if (input.hasHostAttachments && input.gateStatus !== "governed") {
    return "Accord has not verified this attachment. Remove it and upload again through Accord.";
  }

  return null;
}
