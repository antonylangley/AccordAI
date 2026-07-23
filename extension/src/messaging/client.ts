import type { AccordGuardMessage, AccordGuardResponse } from "./types";

export async function sendGuardMessage(message: AccordGuardMessage): Promise<AccordGuardResponse> {
  const runtime = globalThis.chrome?.runtime;

  if (!runtime?.id || typeof runtime.sendMessage !== "function") {
    return extensionUnavailableResponse();
  }

  try {
    const response = (await runtime.sendMessage(message)) as AccordGuardResponse | undefined;
    return response || { ok: false, error: "Accord Guard did not receive a background response." };
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "Accord Guard request failed.";
    if (/extension context invalidated|context invalidated|sendMessage/i.test(messageText)) {
      return extensionUnavailableResponse();
    }

    return { ok: false, error: messageText };
  }
}

function extensionUnavailableResponse(): AccordGuardResponse {
  return {
    ok: false,
    error: "Accord Guard was reloaded. Refresh ChatGPT to reconnect governance."
  };
}
