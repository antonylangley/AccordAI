import type { User } from "@supabase/supabase-js";

export type AccordAuthProfile = {
  displayName: string;
  email: string;
  avatarUrl?: string;
};

function firstNonEmptyString(values: unknown[]) {
  return values.find(
    (value): value is string => typeof value === "string" && value.trim().length > 0
  );
}

export function getAccordAuthProfile(user: User): AccordAuthProfile {
  const metadata = user.user_metadata ?? {};
  const identityMetadata = (user.identities ?? []).map((identity) => identity.identity_data ?? {});

  const displayName =
    firstNonEmptyString([
      metadata.full_name,
      metadata.name,
      ...identityMetadata.flatMap((identity) => [identity.full_name, identity.name]),
      user.email
    ]) ?? "Accord user";

  const avatarUrl = firstNonEmptyString([
    metadata.avatar_url,
    metadata.picture,
    ...identityMetadata.flatMap((identity) => [identity.avatar_url, identity.picture])
  ]);

  return {
    displayName,
    email: user.email ?? "",
    avatarUrl
  };
}
