import type { SurfaceSnapshot } from "../state/surface-state";
import { BlockedState } from "./BlockedState";
import { InlineRiskHelper } from "./InlineRiskHelper";
import { WhyPopover } from "./WhyPopover";

type AccordIndicatorProps = {
  state: SurfaceSnapshot;
  onWhy: () => void;
};

export function AccordIndicator({ state, onWhy }: AccordIndicatorProps) {
  const visible = state.phase !== "idle" || state.attachmentNotice;

  return (
    <div className={`accord-guard-shell accord-guard-${state.phase}`} aria-live="polite">
      <div className="accord-guard-pill" data-visible={visible}>
        <span className="accord-guard-mark">A</span>
        <span className="accord-guard-status">{statusText(state)}</span>
        {state.phase === "scanning" ? <span className="accord-guard-pulse" aria-hidden="true" /> : null}
        {(state.phase === "redact" || state.phase === "blocked" || state.phase === "failed") && (
          <button type="button" className="accord-guard-link" onClick={onWhy}>
            {state.phase === "blocked" ? "Why blocked?" : "Why?"}
          </button>
        )}
      </div>

      {state.phase === "redact" ? <InlineRiskHelper state={state} onWhy={onWhy} /> : null}
      {state.phase === "blocked" || state.phase === "failed" ? <BlockedState state={state} onWhy={onWhy} /> : null}
      {state.whyOpen ? <WhyPopover state={state} onClose={onWhy} /> : null}
      {state.attachmentNotice ? (
        <div className="accord-guard-note">
          Attachment governance is not active in browser mode yet. Use Accord Workspace for governed file analysis.
        </div>
      ) : null}
    </div>
  );
}

function statusText(state: SurfaceSnapshot) {
  if (state.phase === "scanning") return "Accord scanning";
  if (state.phase === "redact") return "Sensitive info detected";
  if (state.phase === "blocked") return "Possible credential detected";
  if (state.phase === "failed") return "Message not sent";
  return "Accord active";
}
