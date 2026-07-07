import type { AccordGuardMessage, AccordGuardResponse } from "./types";

export function sendGuardMessage(message: AccordGuardMessage): Promise<AccordGuardResponse> {
  return chrome.runtime.sendMessage(message) as Promise<AccordGuardResponse>;
}
