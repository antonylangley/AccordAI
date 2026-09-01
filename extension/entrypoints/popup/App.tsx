import { useCallback, useEffect, useMemo, useState } from "react";
import type { GuardAuthProvider, GuardAuthSnapshot, GuardEnforcementState, GuardPolicySync } from "../../src/auth/types";
import { sendGuardMessage } from "../../src/messaging/client";
import { pauseControlViewForState, popupViewForState } from "../../src/popup/view-model";

const dashboardUrl = "https://www.accordgovernance.com/dashboard";
const accountUrl = "https://www.accordgovernance.com/account";

export function GuardPopup() {
  const [state, setState] = useState<GuardAuthSnapshot>({
    status: "loading",
    localProtection: true,
    updatedAt: new Date().toISOString()
  });
  const [enforcement, setEnforcement] = useState<GuardEnforcementState | null>(null);

  const refresh = useCallback(async (force = false) => {
    const [authResponse, enforcementResponse] = await Promise.all([
      sendGuardMessage({ type: "accord.auth.getState", payload: { force } }),
      sendGuardMessage({ type: "accord.enforcement.getState", payload: { force } })
    ]);
    if (authResponse.ok && authResponse.result && "status" in authResponse.result) setState(authResponse.result as GuardAuthSnapshot);
    else if (!authResponse.ok) {
      setState({
        status: "error",
        localProtection: true,
        updatedAt: new Date().toISOString(),
        code: "background_unavailable",
        message: authResponse.error,
        recoverable: true
      });
    }
    if (enforcementResponse.ok && enforcementResponse.result && "enabled" in enforcementResponse.result) {
      setEnforcement(enforcementResponse.result as GuardEnforcementState);
    } else {
      setEnforcement(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connect = async (provider: GuardAuthProvider) => {
    setState({ status: "connecting", localProtection: true, updatedAt: new Date().toISOString() });
    const response = await sendGuardMessage({ type: "accord.auth.connect", payload: { provider } });
    if (response.ok && response.result && "status" in response.result) setState(response.result as GuardAuthSnapshot);
    else void refresh(true);
    await refresh(true);
  };

  const signOut = async () => {
    await sendGuardMessage({ type: "accord.auth.signOut" });
    const enforcementResponse = await sendGuardMessage({ type: "accord.enforcement.getState", payload: { force: true } });
    setState({ status: "signed_out", localProtection: true, updatedAt: new Date().toISOString() });
    setEnforcement(enforcementResponse.ok && enforcementResponse.result && "enabled" in enforcementResponse.result ? enforcementResponse.result as GuardEnforcementState : null);
  };

  const sync = async () => {
    setState((current) =>
      current.status === "authenticated"
        ? {
            ...current,
            policy: {
              ...current.policy,
              state: "syncing",
              fallbackActive: current.policy.fallbackActive ?? true
            }
          }
        : current
    );
    const response = await sendGuardMessage({ type: "accord.policy.sync" });
    if (response.ok && response.result && "status" in response.result) setState(response.result as GuardAuthSnapshot);
    else await refresh(true);
  };

  const setPaused = async (paused: boolean) => {
    const response = await sendGuardMessage({ type: "accord.enforcement.setPaused", payload: { paused } });
    if (response.ok && response.result && "enabled" in response.result) {
      setEnforcement(response.result as GuardEnforcementState);
    } else {
      await refresh(true);
    }
  };

  const view = useMemo(() => popupViewForState(state), [state]);
  const pauseControl = useMemo(() => pauseControlViewForState(state, enforcement), [state, enforcement]);
  return (
    <main className="popup-shell">
      <header className="brand-row">
        <img src="/icons/accord-icon-48.png" alt="" className="brand-icon" />
        <div>
          <div className="brand-name">Accord Guard</div>
          <div className="privacy-line">Sensitive content is analyzed locally.</div>
        </div>
      </header>

      {view.kind === "loading" || view.kind === "connecting" ? (
        <section className="state-card centered" aria-live="polite">
          <span className="spinner" />
          <h1>{view.title}</h1>
          <p>{view.detail}</p>
        </section>
      ) : null}

      {view.kind === "signed_out" ? (
        <section className="state-card">
          <div className="eyebrow">ACCORD ACCOUNT</div>
          <h1>{view.title}</h1>
          <p>{view.detail}</p>
          <div className="auth-actions">
            <button className="primary-button" onClick={() => void connect("google")}>Continue with Google</button>
            <button className="secondary-button" onClick={() => void connect("github")}>Continue with GitHub</button>
          </div>
          <button className="text-button" onClick={() => void refresh(true)}>Already connected? Refresh</button>
        </section>
      ) : null}

      {state.status === "authenticated" && view.kind === "connected" ? (
        <section className="connected-stack">
          <div className="identity-card">
            <Avatar name={state.user.displayName} src={state.user.avatarUrl} />
            <div className="identity-copy"><strong>{state.user.displayName}</strong><span>{state.user.email}</span></div>
          </div>
          <dl className="details-card">
            <div><dt>Organization</dt><dd>{state.organization?.name}</dd></div>
            <div><dt>Role</dt><dd className="role-badge">{formatRole(state.membership?.role)}</dd></div>
            <div><dt>Guard</dt><dd>{pauseControl.visible && pauseControl.paused ? "Paused" : "Active"}</dd></div>
            <div><dt>Policy</dt><dd>{policyLabel(state)}</dd></div>
          </dl>
          {pauseControl.visible ? (
            <section className={`guard-toggle-card ${pauseControl.paused ? "paused" : "active"}`} aria-live="polite">
              <div>
                <div className="guard-toggle-heading">
                  <strong>{pauseControl.title}</strong>
                  <span>{pauseControl.stateLabel}</span>
                </div>
                <p>{pauseControl.detail}</p>
              </div>
              <button className="secondary-button compact-button" onClick={() => void setPaused(!pauseControl.paused)}>
                {pauseControl.actionLabel}
              </button>
            </section>
          ) : null}
          <section className={`policy-state-card ${view.policy.tone}`} aria-live="polite">
            <div className="policy-state-heading">
              <span className={`policy-dot ${view.policy.tone}`} />
              <div>
                <strong>{view.policy.title}</strong>
                <p>{view.policy.detail}</p>
              </div>
            </div>
            <dl className="policy-facts">
              <div><dt>Source</dt><dd>{policySourceLabel(state.policy)}</dd></div>
              <div><dt>Bundle</dt><dd>{policyBundleLabel(state.policy)}</dd></div>
              <div><dt>Rules</dt><dd>{policyRuleCount(state.policy)}</dd></div>
              <div><dt>Last synced</dt><dd>{formatRelativeTime(state.policy.lastSuccessfulSyncAt || state.policy.lastSyncedAt)}</dd></div>
            </dl>
            {view.policy.canRetry ? <button className="secondary-button compact-button" onClick={() => void sync()}>Retry sync</button> : null}
          </section>
          <button className="primary-button" onClick={() => openPage(dashboardUrl)}>Open Accord Dashboard</button>
          <div className="footer-actions"><button onClick={() => openPage(accountUrl)}>Account settings</button><button onClick={() => void sync()}>Sync now</button><button onClick={() => void signOut()}>Sign out</button></div>
        </section>
      ) : null}

      {state.status === "authenticated" && view.kind === "no_organization" ? (
        <section className="state-card">
          <div className="eyebrow">ACCOUNT CONNECTED</div><h1>{view.title}</h1><p>{view.detail}</p>
          <div className="identity-card compact"><Avatar name={state.user.displayName} src={state.user.avatarUrl} /><div className="identity-copy"><strong>{state.user.displayName}</strong><span>{state.user.email}</span></div></div>
          <div className="local-safe"><span className="live-dot" /> Local protection remains active</div>
          <button className="primary-button" onClick={() => openPage("https://www.accordgovernance.com/settings")}>Create or join organization</button>
          <button className="text-button" onClick={() => void signOut()}>Sign out</button>
        </section>
      ) : null}

      {state.status === "error" && view.kind === "error" ? (
        <section className="state-card">
          <div className="eyebrow error">SYNC UNAVAILABLE</div><h1>{view.title}</h1><p>{view.detail}</p>
          <div className="local-safe"><span className="live-dot" /> Local protection remains active</div>
          <button className="primary-button" onClick={() => state.code === "session_expired" ? void connect("google") : void refresh(true)}>{state.code === "session_expired" ? "Log in again" : "Retry sync"}</button>
        </section>
      ) : null}
    </main>
  );
}

function Avatar({ name, src }: { name: string; src?: string }) {
  return src ? <img className="avatar" src={src} alt="" referrerPolicy="no-referrer" /> : <div className="avatar fallback">{initials(name)}</div>;
}

function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "A"; }
function formatRole(role?: string) { return role ? role[0].toUpperCase() + role.slice(1) : "Member"; }
function policyLabel(state: Extract<GuardAuthSnapshot, { status: "authenticated" }>) {
  if (state.policy.state === "organization_synced" || state.policy.state === "synced") return policyRuleCount(state.policy);
  if (state.policy.state === "organization_cached" || state.policy.state === "offline") return `Cached, ${policyRuleCount(state.policy)}`;
  if (state.policy.state === "local_fallback") return "Local fallback";
  if (state.policy.state === "none") return "Local fallback";
  if (state.policy.state === "syncing") return "Syncing…";
  return "Local fallback";
}
function policySourceLabel(policy: GuardPolicySync) {
  if (policy.state === "organization_synced" || policy.state === "synced") return "Organization";
  if (policy.state === "organization_cached" || policy.state === "offline") return "Organization cache";
  if (policy.state === "syncing") return "Checking";
  return "Local fallback";
}
function policyBundleLabel(policy: GuardPolicySync) {
  if (!policy.bundleId) return "Unavailable";
  const version = typeof policy.version === "number" ? `v${policy.version}` : policy.bundleId;
  return policy.bundleId === "accord.local-builtins" ? `${policy.bundleId} ${version}` : version;
}
function policyRuleCount(policy: GuardPolicySync) {
  return typeof policy.activeRuleCount === "number" ? `${policy.activeRuleCount} active rules` : "Unknown";
}
function formatRelativeTime(value?: string) {
  if (!value) return "Not yet";
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "Unknown";
  const diffMs = Date.now() - timestamp;
  if (diffMs < 60_000) return "Just now";
  if (diffMs < 60 * 60_000) {
    const minutes = Math.max(1, Math.round(diffMs / 60_000));
    return `${minutes} min ago`;
  }
  if (diffMs < 24 * 60 * 60_000) {
    const hours = Math.max(1, Math.round(diffMs / (60 * 60_000)));
    return `${hours} hr ago`;
  }
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function openPage(url: string) { void chrome.tabs.create({ url }); }
