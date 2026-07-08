import type { EntityDecoration } from "../messaging/types";
import type { SurfaceSnapshot } from "../state/surface-state";

type WhyPopoverProps = {
  state: SurfaceSnapshot;
  markUrl: string;
  onClose: () => void;
};

export function WhyPopover({ state, markUrl, onClose }: WhyPopoverProps) {
  const decorations = state.scan?.decorations || [];
  const counts = countDecorations(decorations);
  const attachmentCounts = state.attachmentEntityCounts || {};
  const visibleCounts = Object.keys(counts).length ? counts : attachmentCounts;
  const blocked = state.phase === "blocked";

  return (
    <div className="accord-guard-popover">
      <div className="accord-guard-popover-header">
        <div className="accord-guard-popover-brand">
          <img src={markUrl} alt="" />
          <p>Accord Guard</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close Accord explanation">
          x
        </button>
      </div>

      <p className="accord-guard-popover-copy">{summaryCopy(state, decorations.length)}</p>

      {Object.keys(visibleCounts).length ? (
        <div className="accord-guard-counts">
          {Object.entries(visibleCounts).map(([type, count]) => (
            <span key={type}>
              {shortEntityLabel(type as EntityDecoration["type"])} - {count}
            </span>
          ))}
        </div>
      ) : null}

      {decorations.length ? (
        <div className="accord-guard-entities">
          {decorations.slice(0, 6).map((decoration, index) => (
            <div className="accord-guard-entity-row" key={`${decoration.placeholder}-${decoration.start}-${index}`}>
              <div>
                <p className="accord-guard-entity-label">{entityLabel(decoration.type)}</p>
                <p className="accord-guard-entity-action">{entityAction(decoration, blocked)}</p>
              </div>
              {decoration.type === "SECRET" ? (
                <span className="accord-guard-placeholder">Blocked</span>
              ) : (
                <span className="accord-guard-placeholder">
                  {state.draftText.slice(decoration.start, decoration.end)} -&gt; {decoration.placeholder}
                </span>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {state.attachmentNotice ? (
        <p className="accord-guard-boundary">{state.message || "Supported text and code attachments are governed before upload."}</p>
      ) : null}
    </div>
  );
}

function summaryCopy(state: SurfaceSnapshot, decorationCount: number) {
  if (state.attachmentNotice) {
    return state.message || "Supported text and code attachments are governed before upload. Unsupported files fail closed.";
  }

  if (state.phase === "blocked") {
    return "This value cannot be submitted to an external AI tool. Sending blocked.";
  }

  if (decorationCount > 0) {
    return `${decorationCount} identifier${decorationCount === 1 ? "" : "s"} protected. They will be replaced before AI submission.`;
  }

  if (state.phase === "scanning") return "Checking this draft locally.";
  if (state.phase === "failed") return state.message || "Accord could not verify this send.";
  return "Text governance is active on this AI surface.";
}

function countDecorations(decorations: EntityDecoration[]) {
  return decorations.reduce<Partial<Record<EntityDecoration["type"], number>>>((counts, decoration) => {
    counts[decoration.type] = (counts[decoration.type] || 0) + 1;
    return counts;
  }, {});
}

function entityLabel(type: EntityDecoration["type"]) {
  const labels: Record<EntityDecoration["type"], string> = {
    PERSON: "Person identifier",
    EMAIL: "Email address",
    PHONE: "Phone number",
    ADDRESS: "Address",
    ACCOUNT: "Account identifier",
    SECRET: "Possible API credential",
    OTHER: "Identifier"
  };

  return labels[type];
}

function shortEntityLabel(type: EntityDecoration["type"]) {
  const labels: Record<EntityDecoration["type"], string> = {
    PERSON: "Person",
    EMAIL: "Email",
    PHONE: "Phone",
    ADDRESS: "Address",
    ACCOUNT: "Account",
    SECRET: "Secret",
    OTHER: "Identifier"
  };

  return labels[type];
}

function entityAction(decoration: EntityDecoration, blocked: boolean) {
  if (blocked || decoration.type === "SECRET") {
    return decoration.type === "SECRET" ? "Sending blocked" : "Sending blocked by policy";
  }

  return "Will be hidden before submission";
}
