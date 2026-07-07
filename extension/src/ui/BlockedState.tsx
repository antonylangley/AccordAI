import type { SurfaceSnapshot } from "../state/surface-state";

type BlockedStateProps = {
  state: SurfaceSnapshot;
  onWhy: () => void;
};

export function BlockedState({ state, onWhy }: BlockedStateProps) {
  const failed = state.phase === "failed";

  return (
    <div className={`accord-guard-card ${failed ? "accord-guard-card-failed" : "accord-guard-card-blocked"}`}>
      <div>
        <p className="accord-guard-title">{failed ? "Accord could not verify this send" : "Possible credential detected"}</p>
        <p className="accord-guard-copy">
          {state.message || (failed ? "Message not sent." : "This message cannot be sent.")}
        </p>
      </div>
      <button type="button" className="accord-guard-small-button" onClick={onWhy}>
        {failed ? "Details" : "Why blocked?"}
      </button>
    </div>
  );
}
