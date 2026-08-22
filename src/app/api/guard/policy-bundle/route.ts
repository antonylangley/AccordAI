import { NextResponse } from "next/server";
import { getLatestPublishedPolicyBundle } from "@/lib/db/accord-store";
import { authenticateGuardRequest, guardCorsHeaders } from "@/lib/auth/guard-api";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: guardCorsHeaders() });
}

export async function GET(request: Request) {
  try {
    const identity = await authenticateGuardRequest(request);
    if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: guardCorsHeaders() });
    if (!identity.organization) {
      return NextResponse.json({ bundle: null, reason: "No active organization membership." }, { status: 404, headers: guardCorsHeaders() });
    }
    const bundle = await getLatestPublishedPolicyBundle(identity.organization.slug);

    if (!bundle) {
      return NextResponse.json(
        {
          bundle: null,
          reason: "No published Accord policy bundle is available."
        },
        { status: 404, headers: guardCorsHeaders() }
      );
    }

    return NextResponse.json({ bundle }, { headers: guardCorsHeaders() });
  } catch {
    return NextResponse.json(
      { error: "Accord policy bundle lookup failed." },
      { status: 500, headers: guardCorsHeaders() }
    );
  }
}
