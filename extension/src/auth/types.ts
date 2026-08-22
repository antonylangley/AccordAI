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

export type GuardPolicySync = {
  state: "not_connected" | "syncing" | "synced" | "none" | "offline" | "error";
  bundleId?: string;
  version?: number;
  activeRuleCount?: number;
  lastPublishedAt?: string;
  lastSyncedAt?: string;
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
