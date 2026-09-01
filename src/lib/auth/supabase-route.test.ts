import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteAuthClient } from "./supabase-route";

const ssr = vi.hoisted(() => ({
  createServerClient: vi.fn()
}));
const server = vi.hoisted(() => ({
  getSupabaseAuthConfig: vi.fn()
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: ssr.createServerClient
}));

vi.mock("./supabase-server", () => ({
  getSupabaseAuthConfig: server.getSupabaseAuthConfig
}));

beforeEach(() => {
  vi.clearAllMocks();
  server.getSupabaseAuthConfig.mockReturnValue({
    supabaseUrl: "https://project.supabase.co",
    publishableKey: "sb_publishable_test"
  });
});

describe("Supabase route auth client", () => {
  test("applies auth cookies and cache headers to redirect responses", () => {
    ssr.createServerClient.mockImplementation((_url, _key, options) => {
      options.cookies.setAll(
        [{ name: "sb-test-auth-token", value: "cookie-value", options: { path: "/" } }],
        { "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0", Expires: "0" }
      );
      return { auth: {} };
    });

    const routeAuth = createSupabaseRouteAuthClient(
      new NextRequest("https://www.accordgovernance.com/auth/login?provider=google")
    );
    const response = routeAuth?.applyAuthCookies(NextResponse.redirect("https://project.supabase.co/auth/v1/authorize"));

    expect(response?.cookies.get("sb-test-auth-token")?.value).toBe("cookie-value");
    expect(response?.headers.get("Cache-Control")).toBe("private, no-cache, no-store, must-revalidate, max-age=0");
    expect(response?.headers.get("Expires")).toBe("0");
  });
});
