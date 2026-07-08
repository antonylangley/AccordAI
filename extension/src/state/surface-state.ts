import type { ComposerDecorationState } from "../adapters/types";
import type { EntityCountSummary } from "@accord/governance-core";
import type { SafeScanResult } from "../messaging/types";

export type SurfacePhase = ComposerDecorationState;

export type SurfaceSnapshot = {
  phase: SurfacePhase;
  scan?: SafeScanResult;
  message?: string;
  draftText: string;
  whyOpen: boolean;
  attachmentNotice: boolean;
  attachmentEntityCounts?: EntityCountSummary;
  attachmentRedactionCount?: number;
};

export type SurfacePatch = Partial<SurfaceSnapshot>;

export function createSurfaceState() {
  let snapshot: SurfaceSnapshot = {
    phase: "idle",
    draftText: "",
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
