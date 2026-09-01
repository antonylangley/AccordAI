export type GuardRole = "owner" | "admin" | "member" | "viewer";
export type GuardAuthProvider = "google" | "github";

export type GuardUser = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  provider?: GuardAuthProvider;
};

export type GuardOrganization = {
  id: string;
  slug: string;
  name: string;
};

export type GuardMembership = {
  id: string;
  role: GuardRole;
  status: "active";
};

export type GuardPolicySyncState =
  | "organization_synced"
  | "organization_cached"
  | "local_fallback"
  | "syncing"
  | "none"
  | "error"
  | "not_connected"
  | "synced"
  | "offline";

export type GuardPolicySourceType = "organization" | "organization_cache" | "local_fallback" | "none";

export type GuardPolicySyncError = {
  category:
    | "not_authenticated"
    | "no_organization"
    | "storage_unavailable"
    | "access_token_unavailable"
    | "http_response"
    | "schema_validation"
    | "request"
    | "account_sync_unavailable"
    | "unknown";
  httpStatus?: number;
  occurredAt: string;
  recoverable: boolean;
};

export type GuardPolicySync = {
  state: GuardPolicySyncState;
  sourceType?: GuardPolicySourceType;
  bundleId?: string;
  version?: number;
  activeRuleCount?: number;
  lastPublishedAt?: string;
  lastSyncedAt?: string;
  lastSuccessfulSyncAt?: string;
  fallbackActive?: boolean;
  organizationSpecificRulesAvailable?: boolean;
  syncError?: GuardPolicySyncError;
};

type GuardBaseState = {
  localProtection: true;
  updatedAt: string;
};

export type GuardAuthSnapshot =
  | (GuardBaseState & { status: "loading" | "signed_out" | "connecting" })
  | (GuardBaseState & {
      status: "authenticated";
      user: GuardUser;
      organization: GuardOrganization | null;
      membership: GuardMembership | null;
      policy: GuardPolicySync;
    })
  | (GuardBaseState & {
      status: "error";
      code: string;
      message: string;
      recoverable: boolean;
      cachedAccount?: {
        user: GuardUser;
        organization: GuardOrganization | null;
        membership: GuardMembership | null;
      };
    });

export type GuardBootstrapResponse = {
  user: GuardUser;
  organization: GuardOrganization | null;
  membership: GuardMembership | null;
  policy: Omit<GuardPolicySync, "state" | "lastSyncedAt"> | null;
};
