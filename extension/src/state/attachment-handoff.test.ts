import { describe, expect, test, vi } from "vitest";
import { runGovernedAttachmentHandoff } from "./attachment-handoff";

describe("attachment handoff", () => {
  test("I: fails closed when governed FileList verification fails", async () => {
    const dispatchTrustedSelection = vi.fn();
    const clearFileInput = vi.fn();
    const onState = vi.fn();
    const governedFile = new File(["safe"], "safe.txt", { type: "text/plain" });

    const verified = await runGovernedAttachmentHandoff({
      files: [governedFile],
      setGovernedFiles: vi.fn(),
      verifyGovernedFiles: () => false,
      dispatchTrustedSelection,
      clearFileInput,
      onState
    });

    expect(verified).toBe(false);
    expect(dispatchTrustedSelection).not.toHaveBeenCalled();
    expect(clearFileInput).toHaveBeenCalledTimes(1);
    expect(onState).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: "blocked",
        message: "Accord could not verify the governed attachment. File was not uploaded."
      })
    );
  });
});
