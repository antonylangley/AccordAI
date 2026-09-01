export function authErrorCodeForMessage(message: string | null | undefined) {
  const value = message || "";
  if (/pkce|code verifier|auth session|flow state|oauth_session_expired|oauth_state_mismatch/i.test(value)) {
    return "signin-session-expired";
  }
  if (/access_denied|denied|cancelled|canceled/i.test(value)) return "signin-cancelled";
  if (value === "supabase-not-configured") return value;
  if (value === "oauth-start-failed") return value;
  return "auth-callback-failed";
}

export function friendlyAuthError(error: string) {
  if (error === "supabase-not-configured") {
    return "Supabase Auth is not configured for this deployment yet.";
  }

  if (error === "signin-session-expired") {
    return "Sign-in session expired. Please try signing in again.";
  }

  if (error === "signin-cancelled") {
    return "Sign-in was cancelled. Please try again when you are ready.";
  }

  if (error === "oauth-start-failed") {
    return "Login could not start. Please try again.";
  }

  return "Login failed. Please try again.";
}
