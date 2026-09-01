import { describe, expect, test } from "vitest";
import { authErrorCodeForMessage, friendlyAuthError } from "./auth-errors";

describe("auth error messaging", () => {
  test("maps raw PKCE verifier failures to a stable retry code", () => {
    expect(authErrorCodeForMessage("PKCE code verifier not found in storage")).toBe("signin-session-expired");
    expect(friendlyAuthError("signin-session-expired")).toBe("Sign-in session expired. Please try signing in again.");
  });

  test("does not echo unknown implementation errors to the login page", () => {
    expect(authErrorCodeForMessage("some provider stack trace")).toBe("auth-callback-failed");
    expect(friendlyAuthError("some provider stack trace")).toBe("Login failed. Please try again.");
  });
});
