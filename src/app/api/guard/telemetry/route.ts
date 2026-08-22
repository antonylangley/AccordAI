import { NextResponse } from "next/server";
import { recordExtensionTelemetryEvent } from "@/lib/db/accord-store";
import { authenticateGuardRequest, guardCorsHeaders } from "@/lib/auth/guard-api";

export const runtime = "nodejs";

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: guardCorsHeaders()
  });
}

export async function POST(request: Request) {
  try {
    const identity = await authenticateGuardRequest(request);
    if (!identity) return NextResponse.json({ recorded: false, error: "Unauthorized" }, { status: 401, headers: guardCorsHeaders() });
    if (!identity.organization || !identity.membership) {
      return NextResponse.json({ recorded: false, error: "No active organization membership." }, { status: 403, headers: guardCorsHeaders() });
    }
    const body = await request.json();
    const result = await recordExtensionTelemetryEvent(body, {
      authUserId: identity.user.id,
      organizationId: identity.organization.id,
      companySlug: identity.organization.slug,
      companyName: identity.organization.name,
      userLabel: identity.user.email || "Accord member"
    });

    return NextResponse.json(result, {
      status: result.recorded ? 202 : 503,
      headers: guardCorsHeaders()
    });
  } catch {
    return NextResponse.json(
      {
        recorded: false,
        error: "Accord telemetry recording failed."
      },
      {
        status: 500,
        headers: guardCorsHeaders()
      }
    );
  }
}
