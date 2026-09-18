import { describe, expect, test } from "vitest";
import { authSnapshotFromConnectResponse } from "./auth-state";

describe("side-panel auth connection state", () => {
  test("preserves an OAuth failure returned by the background worker", () => {
    const result = authSnapshotFromConnectResponse({
      ok: true,
      result: {
        status: "error",
        localProtection: true,
        updatedAt: "2026-09-18T20:00:00.000Z",
        code: "oauth_session_expired",
        message: "Sign-in session expired. Please try signing in again.",
        recoverable: true
      }
    });

    expect(result).toMatchObject({
      status: "error",
      code: "oauth_session_expired",
      message: "Sign-in session expired. Please try signing in again."
    });
  });

  test("reports a missing background response without forcing a signed-out refresh", () => {
    expect(
      authSnapshotFromConnectResponse(
        { ok: false, error: "Background worker unavailable." },
        "2026-09-18T20:00:00.000Z"
      )
    ).toEqual({
      status: "error",
      localProtection: true,
      updatedAt: "2026-09-18T20:00:00.000Z",
      code: "background_unavailable",
      message: "Background worker unavailable.",
      recoverable: true
    });
  });
});
