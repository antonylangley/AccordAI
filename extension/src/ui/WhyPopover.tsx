import type { SurfaceSnapshot } from "../state/surface-state";

type WhyPopoverProps = {
  state: SurfaceSnapshot;
  onClose: () => void;
};

export function WhyPopover({ state, onClose }: WhyPopoverProps) {
  const flags = state.scan?.flags || [];

  return (
    <div className="accord-guard-popover">
      <div className="accord-guard-popover-header">
        <p>Accord Guard</p>
        <button type="button" onClick={onClose} aria-label="Close Accord explanation">
          ×
        </button>
      </div>
      <p className="accord-guard-popover-copy">
        {state.message || state.scan?.explanation || "Detected identifiers are removed before governed message submission."}
      </p>
      {flags.length ? (
        <div className="accord-guard-flags">
          {flags.map((flag) => (
            <span key={`${flag.type}-${flag.label}`}>{flag.label}</span>
          ))}
        </div>
      ) : null}
      <p className="accord-guard-boundary">
        Browser mode scans typed text in the ChatGPT page DOM. It does not govern file uploads, images, screenshots, or voice input.
      </p>
    </div>
  );
}
