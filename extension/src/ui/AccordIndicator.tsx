import type { SurfaceSnapshot } from "../state/surface-state";
import { WhyPopover } from "./WhyPopover";

type AccordIndicatorProps = {
  state: SurfaceSnapshot;
  markUrl: string;
  onWhy: () => void;
};

export function AccordIndicator({ state, markUrl, onWhy }: AccordIndicatorProps) {
  const summary = summaryText(state);
  const label = ariaLabel(state);

  return (
    <div className={`accord-guard-shell accord-guard-${state.phase}`} aria-live="polite">
      <button
        type="button"
        className="accord-guard-trigger"
        data-phase={state.phase}
        data-summary={summary ? "true" : "false"}
        aria-label={label}
        title="Accord active"
        onClick={onWhy}
      >
        <img className="accord-guard-mark" src={markUrl} alt="" />
        {summary ? <span className="accord-guard-summary">{summary}</span> : null}
        <span className="accord-guard-hover-label">Accord active</span>
      </button>

      {state.whyOpen ? <WhyPopover state={state} markUrl={markUrl} onClose={onWhy} /> : null}
    </div>
  );
}

function summaryText(state: SurfaceSnapshot) {
  if (state.phase === "blocked" && isAttachmentState(state)) return "Upload blocked";
  if (state.phase === "failed" && state.attachmentNotice) return "Upload failed";
  if (state.phase === "blocked") return "Sending blocked";
  if (state.phase === "failed") return "Check failed";

  const count = state.scan?.decorations.filter((decoration) => decoration.type !== "SECRET").length || 0;
  if (count > 0 && state.phase === "redact") return `${count} protected`;
  if (state.attachmentNotice && state.attachmentRedactionCount && state.attachmentRedactionCount > 0) {
    return `${state.attachmentRedactionCount} protected`;
  }
  if (state.attachmentNotice) return "File note";
  return "";
}

function ariaLabel(state: SurfaceSnapshot) {
  if (state.phase === "blocked" && isAttachmentState(state)) return "Accord Guard: upload blocked";
  if (state.phase === "blocked") return "Accord Guard: sending blocked";
  if (state.phase === "scanning") return "Accord Guard: scanning";
  if (state.phase === "redact") return `Accord Guard: ${summaryText(state)}`;
  return "Accord Guard active";
}

function isAttachmentState(state: SurfaceSnapshot) {
  return (
    state.attachmentNotice ||
    /\b(?:attachment|file|upload|pdf|docx|image|workspace)\b/i.test(state.message || "")
  );
}
