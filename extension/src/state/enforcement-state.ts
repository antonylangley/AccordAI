import { getGuardAuthSnapshot } from "../auth/session";
import { readStoredValue, removeStoredValue, writeStoredValue } from "../auth/storage";
import type {
  GuardAuthSnapshot,
  GuardEnforcementPauseReason,
  GuardEnforcementState,
  GuardRole
} from "../auth/types";
import type { SafeScanResult, ScanDraftPayload } from "../messaging/types";

const PAUSE_STORAGE_KEY_PREFIX = "accordGuardEnforcementPause";
const now = () => new Date().toISOString();

type OwnerScope = {
  userId: string;
  organizationId: string;
  role: GuardRole;
};

type PauseRecord = {
  paused: true;
  userId: string;
  organizationId: string;
  updatedAt: string;
};

export async function getGuardEnforcementState({
  forceAuth = false,
  requireFreshRole = false
}: { forceAuth?: boolean; requireFreshRole?: boolean } = {}): Promise<GuardEnforcementState> {
  const snapshot = await getGuardAuthSnapshot({ force: forceAuth });
  const state = await resolveGuardEnforcementState(snapshot);

  if (!state.paused || !requireFreshRole) {
    return state;
  }

  const freshSnapshot = await getGuardAuthSnapshot({ force: true });
  return resolveGuardEnforcementState(freshSnapshot, { requireFreshRole: true });
}

export async function isGuardEnforcementEnabled(options?: {
  forceAuth?: boolean;
  requireFreshRole?: boolean;
}): Promise<boolean> {
  return (await getGuardEnforcementState(options)).enabled;
}

export async function setGuardEnforcementPaused(paused: boolean): Promise<GuardEnforcementState> {
  const snapshot = await getGuardAuthSnapshot({ force: true });
  const owner = ownerScopeForSnapshot(snapshot, { requireFreshRole: true });

  if (!owner.scope) {
    return activeState(owner.reason, undefined);
  }

  const key = pauseStorageKey(owner.scope);
  if (paused) {
    await writeStoredValue(key, {
      paused: true,
      userId: owner.scope.userId,
      organizationId: owner.scope.organizationId,
      updatedAt: now()
    } satisfies PauseRecord);
  } else {
    await removeStoredValue(key);
  }

  return resolveGuardEnforcementState(snapshot, { requireFreshRole: true });
}

export async function resolveGuardEnforcementState(
  snapshot: GuardAuthSnapshot,
  { requireFreshRole = false }: { requireFreshRole?: boolean } = {}
): Promise<GuardEnforcementState> {
  const owner = ownerScopeForSnapshot(snapshot, { requireFreshRole });
  if (!owner.scope) return activeState(owner.reason, undefined);

  const record = await readStoredValue<PauseRecord>(pauseStorageKey(owner.scope));
  if (!isPauseRecordForScope(record, owner.scope)) {
    return activeState("active", owner.scope);
  }

  return {
    enabled: false,
    paused: true,
    canPause: true,
    reason: "owner_paused",
    updatedAt: record.updatedAt,
    scope: owner.scope
  };
}

export function pausedScanResult(_payload: ScanDraftPayload): SafeScanResult {
  return {
    scanId: `scan_paused_${Date.now().toString(36)}`,
    action: "allow",
    riskScore: 0,
    riskLevel: "low",
    detectedEntityCount: 0,
    entityCounts: {},
    decorations: [],
    flags: [],
    explanation: "Accord Guard enforcement is paused in this browser.",
    enforcementSource: "accord_core",
    personDetection: {
      mode: "local-ner",
      nerStatus: "unavailable",
      detector: "enforcement-paused",
      candidateCount: 0,
      timedOut: false,
      model: {
        name: "accord-ner-v0.3.1",
        assetSizeBytes: 0,
        executionContext: "service_worker"
      }
    }
  };
}

function ownerScopeForSnapshot(
  snapshot: GuardAuthSnapshot,
  { requireFreshRole }: { requireFreshRole: boolean }
): { scope?: OwnerScope; reason: GuardEnforcementPauseReason } {
  switch (snapshot.status) {
    case "signed_out":
    case "loading":
    case "connecting":
      return { reason: "signed_out" };
    case "error":
      return { reason: "role_unresolved" };
    case "authenticated":
      break;
  }

  if (!snapshot.organization || !snapshot.membership) {
    return { reason: "no_organization" };
  }

  if (requireFreshRole && snapshot.policy.syncError?.category === "account_sync_unavailable") {
    return { reason: "role_unresolved" };
  }

  if (snapshot.membership.role !== "owner") {
    return { reason: "not_owner" };
  }

  return {
    reason: "active",
    scope: {
      userId: snapshot.user.id,
      organizationId: snapshot.organization.id,
      role: snapshot.membership.role
    }
  };
}

function activeState(reason: GuardEnforcementPauseReason, scope: OwnerScope | undefined): GuardEnforcementState {
  return {
    enabled: true,
    paused: false,
    canPause: Boolean(scope),
    reason,
    updatedAt: now(),
    scope
  };
}

function pauseStorageKey(scope: OwnerScope) {
  return `${PAUSE_STORAGE_KEY_PREFIX}:${scope.organizationId}:${scope.userId}`;
}

function isPauseRecordForScope(value: unknown, scope: OwnerScope): value is PauseRecord {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (value as PauseRecord).paused === true &&
      (value as PauseRecord).userId === scope.userId &&
      (value as PauseRecord).organizationId === scope.organizationId &&
      typeof (value as PauseRecord).updatedAt === "string"
  );
}
