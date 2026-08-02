import { NextResponse } from "next/server";
import { getLatestPublishedPolicyBundle } from "@/lib/db/accord-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const companySlug = url.searchParams.get("companySlug") || "test-company";
    const bundle = await getLatestPublishedPolicyBundle(companySlug);

    if (!bundle) {
      return NextResponse.json(
        {
          bundle: null,
          reason: "No published Accord policy bundle is available."
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      bundle
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Accord policy bundle lookup failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
