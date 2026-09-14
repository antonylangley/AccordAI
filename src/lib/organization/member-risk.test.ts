import { describe, expect, test } from "vitest";
import { riskLevelForScore, summarizeMemberRisk } from "./member-risk";

describe("organization member risk summaries", () => {
  test("groups direct and extension-linked audits by authenticated member", () => {
    const summaries = summarizeMemberRisk(
      ["user-a", "user-b"],
      [{ id: "extension-a", authUserId: "user-a" }],
      [
        { authUserId: "user-a", createdAt: "2026-09-14T15:00:00.000Z", riskScore: 80 },
        { extensionUserId: "extension-a", createdAt: "2026-09-14T14:00:00.000Z", riskScore: 40 },
        { authUserId: "outside-org", createdAt: "2026-09-14T16:00:00.000Z", riskScore: 100 }
      ]
    );

    expect(summaries.get("user-a")).toEqual({
      averageRiskScore: 60,
      highestRiskScore: 80,
      latestRiskScore: 80,
      lastAuditAt: "2026-09-14T15:00:00.000Z",
      auditCount: 2
    });
    expect(summaries.get("user-b")).toEqual({
      averageRiskScore: 0,
      highestRiskScore: 0,
      latestRiskScore: 0,
      auditCount: 0
    });
  });

  test("maps risk scores to the shared dashboard bands", () => {
    expect(riskLevelForScore(24)).toBe("low");
    expect(riskLevelForScore(25)).toBe("moderate");
    expect(riskLevelForScore(50)).toBe("high");
    expect(riskLevelForScore(75)).toBe("critical");
  });
});
