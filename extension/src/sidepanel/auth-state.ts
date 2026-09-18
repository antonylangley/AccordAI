import type { GuardAuthSnapshot } from "../auth/types";
import type { AccordGuardResponse } from "../messaging/types";

export function authSnapshotFromConnectResponse(
  response: AccordGuardResponse,
  updatedAt = new Date().toISOString()
): GuardAuthSnapshot {
  if (response.ok && response.result && "status" in response.result) {
    return response.result as GuardAuthSnapshot;
  }

  return {
    status: "error",
    localProtection: true,
    updatedAt,
    code: "background_unavailable",
    message: response.ok ? "Accord Guard did not receive an authentication result." : response.error,
    recoverable: true
  };
}
