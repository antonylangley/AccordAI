import { NextResponse } from "next/server";
import { canManageOrganization, getAccordOrganizationContext } from "@/lib/auth/organization";
import { parseOrganizationRange } from "@/lib/organization/analytics";
import { getOrganizationPersonDetail } from "@/lib/organization/data";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { memberId: string } }) {
  const organization = await getAccordOrganizationContext();
  if (!organization.authenticated || !canManageOrganization(organization.role)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  const url = new URL(request.url);
  const range = parseOrganizationRange(url.searchParams.get("range") || undefined);
  const before = url.searchParams.get("before") || undefined;
  const detail = await getOrganizationPersonDetail(
    organization.companySlug,
    organization.userId,
    params.memberId,
    range,
    before
  );
  if (!detail) return NextResponse.json({ error: "Member not found" }, { status: 404 });
  return NextResponse.json(detail, { headers: { "Cache-Control": "private, no-store" } });
}
