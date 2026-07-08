export type AttachmentHandoffState = {
  phase: "scanning" | "clear" | "redact" | "blocked" | "failed";
  message: string;
};

export type AttachmentHandoffOptions = {
  files: File[];
  setGovernedFiles: (files: File[]) => Promise<void>;
  verifyGovernedFiles: (files: File[]) => boolean;
  dispatchTrustedSelection: () => void;
  clearFileInput: () => void;
  onState: (state: AttachmentHandoffState) => void;
};

export async function runGovernedAttachmentHandoff(options: AttachmentHandoffOptions) {
  await options.setGovernedFiles(options.files);

  if (!options.verifyGovernedFiles(options.files)) {
    options.clearFileInput();
    options.onState({
      phase: "blocked",
      message: "Accord could not verify the governed attachment. File was not uploaded."
    });
    return false;
  }

  options.dispatchTrustedSelection();
  return true;
}
