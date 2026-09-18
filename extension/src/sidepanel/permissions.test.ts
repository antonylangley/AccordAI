import { describe, expect, test } from "vitest";
import { canAccessDashboard } from "./permissions";

describe("side-panel dashboard access", () => {
  test("allows owners and admins", () => {
    expect(canAccessDashboard("owner")).toBe(true);
    expect(canAccessDashboard("admin")).toBe(true);
  });

  test("hides the dashboard action from non-admin members", () => {
    expect(canAccessDashboard("member")).toBe(false);
    expect(canAccessDashboard("viewer")).toBe(false);
    expect(canAccessDashboard(undefined)).toBe(false);
  });
});
