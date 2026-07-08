import { describe, expect, test, vi } from "vitest";
import { runGovernedAttachmentHandoff } from "./attachment-handoff";

describe("attachment handoff", () => {
  test("dispatches governed files after FileList and host preview verification", async () => {
    const dispatchTrustedSelection = vi.fn();
    const clearFileInput = vi.fn();
    const onState = vi.fn();
    const governedFile = new File(["safe"], "safe.txt", { type: "text/plain" });

    const verified = await runGovernedAttachmentHandoff({
      files: [governedFile],
      setGovernedFiles: vi.fn(),
      verifyGovernedFiles: () => true,
      verifyHostAccepted: async () => true,
      dispatchTrustedSelection,
      clearFileInput,
      onState
    });

    expect(verified).toBe(true);
    expect(dispatchTrustedSelection).toHaveBeenCalledTimes(1);
    expect(clearFileInput).not.toHaveBeenCalled();
  });

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

  test("fails closed when ChatGPT does not accept the protected copy", async () => {
    const dispatchTrustedSelection = vi.fn();
    const clearFileInput = vi.fn();
    const onState = vi.fn();
    const governedFile = new File(["safe"], "safe.txt", { type: "text/plain" });

    const verified = await runGovernedAttachmentHandoff({
      files: [governedFile],
      setGovernedFiles: vi.fn(),
      verifyGovernedFiles: () => true,
      verifyHostAccepted: async () => false,
      dispatchTrustedSelection,
      clearFileInput,
      onState
    });

    expect(verified).toBe(false);
    expect(dispatchTrustedSelection).toHaveBeenCalledTimes(1);
    expect(clearFileInput).toHaveBeenCalledTimes(1);
    expect(onState).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: "blocked",
        message: "Accord governed the file but ChatGPT did not accept the protected copy. File was not uploaded."
      })
    );
  });
});
