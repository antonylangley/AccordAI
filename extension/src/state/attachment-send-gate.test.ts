import { describe, expect, test } from "vitest";
import { attachmentSendBlockReason } from "./attachment-send-gate";

describe("attachment send gate", () => {
  test("blocks final send while attachment governance is pending", () => {
    expect(
      attachmentSendBlockReason({
        gateStatus: "pending",
        hasHostAttachments: false,
        attachmentNotice: true,
        phase: "scanning"
      })
    ).toBe("Accord is still scanning this file. Wait for governance before sending.");
  });

  test("blocks final send for an attachment-specific blocked state", () => {
    expect(
      attachmentSendBlockReason({
        gateStatus: "blocked",
        hasHostAttachments: false,
        attachmentNotice: true,
        phase: "blocked",
        message: "Possible credential detected. config.ts was not uploaded."
      })
    ).toBe("Possible credential detected. config.ts was not uploaded.");
  });

  test("blocks raw host attachments that were never verified by Accord", () => {
    expect(
      attachmentSendBlockReason({
        gateStatus: "none",
        hasHostAttachments: true,
        attachmentNotice: false,
        phase: "clear"
      })
    ).toBe("Accord has not verified this attachment. Remove it and upload again through Accord.");
  });

  test("allows host attachments after governed handoff verification", () => {
    expect(
      attachmentSendBlockReason({
        gateStatus: "governed",
        hasHostAttachments: true,
        attachmentNotice: true,
        phase: "clear"
      })
    ).toBeNull();
  });
});
