import { NextResponse } from "next/server";
import { recordExtensionTelemetryEvent } from "@/lib/db/accord-store";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Cache-Control": "no-store"
};

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await recordExtensionTelemetryEvent(body);

    return NextResponse.json(result, {
      status: result.recorded ? 202 : 503,
      headers: corsHeaders
    });
  } catch (error) {
    return NextResponse.json(
      {
        recorded: false,
        error: error instanceof Error ? error.message : "Accord Guard telemetry failed."
      },
      {
        status: 500,
        headers: corsHeaders
      }
    );
  }
}
