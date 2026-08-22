import { NextResponse } from "next/server";
import { authenticateGuardRequest, guardCorsHeaders } from "@/lib/auth/guard-api";
import { getLatestPublishedPolicyBundle } from "@/lib/db/accord-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: guardCorsHeaders() });
}

export async function GET(request: Request) {
  const identity = await authenticateGuardRequest(request);
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: guardCorsHeaders() });

  const bundle = identity.organization ? await getLatestPublishedPolicyBundle(identity.organization.slug) : null;
  const metadata = identity.user.user_metadata || {};
  const provider = identity.user.app_metadata?.provider;
  return NextResponse.json(
    {
      user: {
        id: identity.user.id,
        email: identity.user.email || "",
        displayName: String(metadata.full_name || metadata.name || identity.user.email || "Accord user"),
        avatarUrl: typeof metadata.avatar_url === "string" ? metadata.avatar_url : undefined,
        provider: provider === "github" ? "github" : provider === "google" ? "google" : undefined
      },
      organization: identity.organization,
      membership: identity.membership,
      policy: bundle
        ? {
            bundleId: bundle.id,
            version: bundle.version,
            activeRuleCount: bundle.rules.length,
            lastPublishedAt: bundle.publishedAt
          }
        : null
    },
    { headers: guardCorsHeaders() }
  );
}
