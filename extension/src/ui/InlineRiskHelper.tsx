import type { SurfaceSnapshot } from "../state/surface-state";

type InlineRiskHelperProps = {
  state: SurfaceSnapshot;
  onWhy: () => void;
};

export function InlineRiskHelper({ state, onWhy }: InlineRiskHelperProps) {
  const count = state.scan?.detectedEntityCount || 0;

  return (
    <div className="accord-guard-card accord-guard-card-redact">
      <div>
        <p className="accord-guard-title">Sensitive info detected</p>
        <p className="accord-guard-copy">
          {count || "Detected"} identifier{count === 1 ? "" : "s"} will be redacted before sending.
        </p>
      </div>
      <button type="button" className="accord-guard-small-button" onClick={onWhy}>
        Why?
      </button>
    </div>
  );
}
