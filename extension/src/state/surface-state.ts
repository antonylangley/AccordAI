import type { ComposerDecorationState } from "../adapters/types";
import type { SafeScanResult } from "../messaging/types";

export type SurfacePhase = ComposerDecorationState;

export type SurfaceSnapshot = {
  phase: SurfacePhase;
  scan?: SafeScanResult;
  message?: string;
  whyOpen: boolean;
  attachmentNotice: boolean;
};

export type SurfacePatch = Partial<SurfaceSnapshot>;

export function createSurfaceState() {
  let snapshot: SurfaceSnapshot = {
    phase: "idle",
    whyOpen: false,
    attachmentNotice: false
  };
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => snapshot,
    set(patch: SurfacePatch) {
      snapshot = {
        ...snapshot,
        ...patch
      };
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}
