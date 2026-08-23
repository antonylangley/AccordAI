import { useCallback, useEffect, useMemo, useState } from "react";
import type { GuardAuthProvider, GuardAuthSnapshot } from "../../src/auth/types";
import { sendGuardMessage } from "../../src/messaging/client";
import { popupViewForState } from "../../src/popup/view-model";

const dashboardUrl = "https://www.accordgovernance.com/dashboard";
const accountUrl = "https://www.accordgovernance.com/account";

export function GuardPopup() {
  const [state, setState] = useState<GuardAuthSnapshot>({
    status: "loading",
    localProtection: true,
    updatedAt: new Date().toISOString()
  });

  const refresh = useCallback(async (force = false) => {
    const response = await sendGuardMessage({ type: "accord.auth.getState", payload: { force } });
    if (response.ok && response.result && "status" in response.result) setState(response.result as GuardAuthSnapshot);
    else if (!response.ok) {
      setState({
        status: "error",
        localProtection: true,
        updatedAt: new Date().toISOString(),
        code: "background_unavailable",
        message: response.error,
        recoverable: true
      });
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
  };

  const signOut = async () => {
    await sendGuardMessage({ type: "accord.auth.signOut" });
    setState({ status: "signed_out", localProtection: true, updatedAt: new Date().toISOString() });
  };

  const sync = async () => {
    await sendGuardMessage({ type: "accord.policy.sync" });
    await refresh();
  };

  const view = useMemo(() => popupViewForState(state), [state]);
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
            <div><dt>Guard</dt><dd>Active</dd></div>
            <div><dt>Policy</dt><dd>{policyLabel(state)}</dd></div>
          </dl>
          <button className="primary-button" onClick={() => openPage(dashboardUrl)}>Open Accord Dashboard</button>
          <div className="footer-actions"><button onClick={() => openPage(accountUrl)}>Account settings</button><button onClick={() => void sync()}>Sync now</button><button onClick={() => void signOut()}>Sign out</button></div>
        </section>
      ) : null}

      {state.status === "authenticated" && view.kind === "no_organization" ? (
        <section className="state-card">
          <div className="eyebrow">ACCOUNT CONNECTED</div><h1>{view.title}</h1><p>{view.detail}</p>
          <div className="identity-card compact"><Avatar name={state.user.displayName} src={state.user.avatarUrl} /><div className="identity-copy"><strong>{state.user.displayName}</strong><span>{state.user.email}</span></div></div>
          <button className="primary-button" onClick={() => openPage("https://www.accordgovernance.com/settings")}>Create or join organization</button>
          <button className="text-button" onClick={() => void signOut()}>Sign out</button>
        </section>
      ) : null}

      {view.kind === "error" ? (
        <section className="state-card">
          <div className="eyebrow error">SYNC UNAVAILABLE</div><h1>{view.title}</h1><p>{view.detail}</p>
          <div className="local-safe"><span className="live-dot" /> Local protection remains active</div>
          <button className="primary-button" onClick={() => void connect("google")}>Log in again</button>
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
  if (state.policy.state === "offline") return "Cached · Offline";
  if (state.policy.state === "none") return "No published rules";
  if (state.policy.state === "syncing") return "Syncing…";
  return typeof state.policy.activeRuleCount === "number" ? `${state.policy.activeRuleCount} active rules` : "Synced";
}
function openPage(url: string) { void chrome.tabs.create({ url }); }
