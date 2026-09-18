import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { GuardAuthProvider, GuardAuthSnapshot, GuardEnforcementState, GuardPolicySync } from "../../src/auth/types";
import { sendGuardMessage } from "../../src/messaging/client";
import { pauseControlViewForState, popupViewForState } from "../../src/popup/view-model";
import { authSnapshotFromConnectResponse } from "../../src/sidepanel/auth-state";
import { canAccessDashboard } from "../../src/sidepanel/permissions";

const dashboardUrl = "https://www.accordgovernance.com/dashboard";
const accountUrl = "https://www.accordgovernance.com/account";

export function GuardSidePanel() {
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
    void refresh(true);
  }, [refresh]);

  const connect = async (provider: GuardAuthProvider) => {
    setState({ status: "connecting", localProtection: true, updatedAt: new Date().toISOString() });
    const response = await sendGuardMessage({ type: "accord.auth.connect", payload: { provider } });
    const snapshot = authSnapshotFromConnectResponse(response);
    setState(snapshot);
    if (snapshot.status === "authenticated") {
      const enforcementResponse = await sendGuardMessage({ type: "accord.enforcement.getState", payload: { force: true } });
      setEnforcement(
        enforcementResponse.ok && enforcementResponse.result && "enabled" in enforcementResponse.result
          ? enforcementResponse.result as GuardEnforcementState
          : null
      );
    }
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
  const canOpenDashboard = state.status === "authenticated" && canAccessDashboard(state.membership?.role);
  return (
    <main className="side-panel-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <span className="brand-mark"><img src="/icons/accord-icon-48.png" alt="" className="brand-icon" /></span>
          <div className="brand-name">Accord Guard</div>
        </div>
      </header>

      {view.kind === "loading" || view.kind === "connecting" ? (
        <section className="state-card centered state-hero" aria-live="polite">
          <span className="loading-orbit"><span className="spinner" /></span>
          <h1>{view.title}</h1>
          <p>{view.detail}</p>
        </section>
      ) : null}

      {view.kind === "signed_out" ? (
        <section className="state-card auth-card">
          <h1>{view.title}</h1>
          <p>{view.detail}</p>
          <div className="auth-actions">
            <button className="primary-button button-with-icon" onClick={() => void connect("google")}><Icon name="google" /> Continue with Google</button>
            <button className="secondary-button button-with-icon" onClick={() => void connect("github")}><Icon name="github" /> Continue with GitHub</button>
          </div>
          <button className="text-button" onClick={() => void refresh(true)}>Already connected? Refresh</button>
          <div className="privacy-note"><Icon name="lock" /> Prompt content stays on this device.</div>
        </section>
      ) : null}

      {state.status === "authenticated" && view.kind === "connected" ? (
        <section className="connected-stack">
          <section className="workspace-card">
            <div className="identity-card">
              <Avatar name={state.user.displayName} src={state.user.avatarUrl} />
              <div className="identity-copy"><strong>{state.user.displayName}</strong><span>{state.user.email}</span></div>
              <span className="role-chip">{formatRole(state.membership?.role)}</span>
            </div>
            <div className="workspace-row"><span><Icon name="building" /> Organization</span><strong>{state.organization?.name}</strong></div>
          </section>

          <section className={`guard-control ${pauseControl.visible && pauseControl.paused ? "paused" : "active"}`} aria-live="polite">
            {pauseControl.visible ? (
              <button
                className={`guard-radio ${pauseControl.paused ? "paused" : "active"}`}
                type="button"
                role="switch"
                aria-checked={!pauseControl.paused}
                aria-label={pauseControl.actionLabel}
                title={pauseControl.actionLabel}
                disabled={pauseControl.locked}
                onClick={() => void setPaused(!pauseControl.paused)}
              >
                <img src="/icons/accord-icon-48.png" alt="" aria-hidden="true" />
                {pauseControl.locked ? <span className="guard-radio-lock" aria-hidden="true"><Icon name="lock" /></span> : null}
              </button>
            ) : null}
            <div className="guard-control-copy">
              <h2>{pauseControl.visible && pauseControl.paused ? "Guard paused" : "Guard active"}</h2>
              <p>{pauseControl.visible ? pauseControl.detail : "Accord is enforcing your organization’s AI policy."}</p>
            </div>
          </section>

          <footer className="panel-footer">
            <div className="policy-bundle-line" aria-live="polite">
              <div className="policy-bundle-copy">
                <span className="policy-bundle-dot" aria-hidden="true" />
                <div>
                  <strong>Active policy bundle</strong>
                  <span>{state.policy.activeRuleCount ?? "—"} rules · {policyVersionLabel(state.policy)} · {formatRelativeTime(state.policy.lastSuccessfulSyncAt || state.policy.lastSyncedAt)}</span>
                </div>
              </div>
              <button className="policy-resync" onClick={() => void sync()} disabled={state.policy.state === "syncing"}>
                <Icon name="sync" /> {state.policy.state === "syncing" ? "Syncing…" : "Resync"}
              </button>
            </div>

            {canOpenDashboard ? (
              <button className="primary-button dashboard-button" onClick={() => openPage(dashboardUrl)}>
                <span><Icon name="dashboard" /> Open Accord Dashboard</span><Icon name="arrow" />
              </button>
            ) : null}

            <nav className="quick-actions" aria-label="Account actions">
              <button onClick={() => openPage(accountUrl)}><Icon name="settings" /><span>Settings</span></button>
              <button onClick={() => void sync()}><Icon name="sync" /><span>Sync policy</span></button>
              <button onClick={() => void signOut()}><Icon name="logout" /><span>Sign out</span></button>
            </nav>
            <div className="privacy-note connected"><Icon name="lock" /><span>Sensitive text is analyzed locally and is not stored by the dashboard.</span></div>
          </footer>
        </section>
      ) : null}

      {state.status === "authenticated" && view.kind === "no_organization" ? (
        <section className="state-card auth-card">
          <span className="state-icon"><Icon name="building" /></span>
          <div className="eyebrow">ACCOUNT CONNECTED</div><h1>{view.title}</h1><p>{view.detail}</p>
          <div className="identity-card compact"><Avatar name={state.user.displayName} src={state.user.avatarUrl} /><div className="identity-copy"><strong>{state.user.displayName}</strong><span>{state.user.email}</span></div></div>
          <div className="local-safe"><span className="live-dot" /> Local protection remains active</div>
          <button className="primary-button" onClick={() => openPage("https://www.accordgovernance.com/settings")}>Create or join organization</button>
          <button className="text-button" onClick={() => void signOut()}>Sign out</button>
        </section>
      ) : null}

      {state.status === "error" && view.kind === "error" ? (
        <section className="state-card auth-card error-card">
          <span className="state-icon warning"><Icon name="warning" /></span>
          <div className="eyebrow error">{isAuthConnectionError(state.code) ? "ACCOUNT CONNECTION" : "SYNC UNAVAILABLE"}</div><h1>{view.title}</h1><p>{view.detail}</p>
          <div className="local-safe"><span className="live-dot" /> Local protection remains active</div>
          <button className="primary-button" onClick={() => state.code === "session_expired" ? void connect("google") : void refresh(true)}>{state.code === "session_expired" ? "Log in again" : isAuthConnectionError(state.code) ? "Back to sign in" : "Retry sync"}</button>
        </section>
      ) : null}
    </main>
  );
}

function Avatar({ name, src }: { name: string; src?: string }) {
  return src ? <img className="avatar" src={src} alt="" referrerPolicy="no-referrer" /> : <div className="avatar fallback">{initials(name)}</div>;
}

type IconName = "arrow" | "building" | "dashboard" | "document" | "github" | "google" | "lock" | "logout" | "pause" | "settings" | "shield" | "shield-check" | "sync" | "warning";

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
    building: <><path d="M4 21h16"/><path d="M6 21V7l6-4 6 4v14"/><path d="M9 9h.01M15 9h.01M9 13h.01M15 13h.01M9 17h.01M15 17h.01"/></>,
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    document: <><path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h6M9 17h6"/></>,
    github: <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.69c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.35 1.09 2.92.83.09-.65.35-1.09.64-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.6 9.6 0 0 1 12 6.69a9.6 9.6 0 0 1 2.5.34c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/>,
    google: <><path d="M21.35 12.2c0-.7-.06-1.2-.2-1.72H12v3.31h5.37a4.7 4.7 0 0 1-2 3.02l2.78 2.13c2.04-1.88 3.2-4.65 3.2-6.74Z"/><path d="M12 21.7c2.91 0 5.35-.96 7.13-2.61l-2.78-2.13c-.76.51-1.75.82-4.35.82-2.8 0-5.18-1.89-6.03-4.44L3.1 15.55A10.77 10.77 0 0 0 12 21.7Z"/><path d="M5.97 13.34A6.47 6.47 0 0 1 5.63 11c0-.81.12-1.6.34-2.34L3.1 6.45A10.7 10.7 0 0 0 2 11c0 1.63.39 3.17 1.1 4.55l2.87-2.21Z"/><path d="M12 4.22c1.59 0 3.01.55 4.13 1.62l3.08-3.08A10.4 10.4 0 0 0 12 .3a10.77 10.77 0 0 0-8.9 6.15l2.87 2.21C6.82 6.11 9.2 4.22 12 4.22Z"/></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/></>,
    pause: <><rect x="4" y="4" width="16" height="16" rx="8"/><path d="M10 9v6M14 9v6"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.1A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.38.25.7.6.9 1 .16.3.25.65.25 1v2c0 .35-.09.7-.25 1-.2.4-.52.75-.9 1Z"/></>,
    shield: <path d="M12 2 20 5v6c0 5-3.4 9.2-8 11-4.6-1.8-8-6-8-11V5z"/>,
    "shield-check": <><path d="M12 2 20 5v6c0 5-3.4 9.2-8 11-4.6-1.8-8-6-8-11V5z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></>,
    sync: <><path d="M20 7h-5V2"/><path d="M4 17h5v5"/><path d="M5.1 9a8 8 0 0 1 13.2-3L20 7M4 17l1.7 1A8 8 0 0 0 19 15"/></>,
    warning: <><path d="M10.3 3.6 2.4 18a2 2 0 0 0 1.75 3h15.7a2 2 0 0 0 1.75-3L13.7 3.6a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></>
  };
  return <svg className={`icon icon-${name}`} viewBox="0 0 24 24" aria-hidden="true" fill={name === "github" || name === "google" ? "currentColor" : "none"} stroke={name === "github" || name === "google" ? "none" : "currentColor"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "A"; }
function formatRole(role?: string) { return role ? role[0].toUpperCase() + role.slice(1) : "Member"; }
function policyVersionLabel(policy: GuardPolicySync) { return typeof policy.version === "number" ? `v${policy.version}` : "Local"; }
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
function isAuthConnectionError(code: string) { return code.startsWith("oauth_") || code === "background_unavailable"; }
