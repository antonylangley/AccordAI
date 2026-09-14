export type OrganizationRiskEvent = {
  authUserId?: string;
  extensionUserId?: string;
  createdAt: string;
  riskScore: number;
};

export type OrganizationExtensionUser = {
  id: string;
  authUserId?: string;
};

export type MemberRiskSummary = {
  averageRiskScore: number;
  highestRiskScore: number;
  latestRiskScore: number;
  lastAuditAt?: string;
  auditCount: number;
};

const emptySummary: MemberRiskSummary = {
  averageRiskScore: 0,
  highestRiskScore: 0,
  latestRiskScore: 0,
  auditCount: 0
};

export function summarizeMemberRisk(
  memberUserIds: string[],
  extensionUsers: OrganizationExtensionUser[],
  events: OrganizationRiskEvent[]
): Map<string, MemberRiskSummary> {
  const extensionUserOwners = new Map(
    extensionUsers
      .filter((user): user is OrganizationExtensionUser & { authUserId: string } => Boolean(user.authUserId))
      .map((user) => [user.id, user.authUserId])
  );
  const memberIds = new Set(memberUserIds);
  const eventsByMember = new Map<string, OrganizationRiskEvent[]>();

  for (const event of events) {
    const userId = event.authUserId || (event.extensionUserId ? extensionUserOwners.get(event.extensionUserId) : undefined);
    if (!userId || !memberIds.has(userId)) continue;
    const current = eventsByMember.get(userId) || [];
    current.push(event);
    eventsByMember.set(userId, current);
  }

  return new Map(
    memberUserIds.map((userId) => {
      const memberEvents = (eventsByMember.get(userId) || []).sort(
        (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
      );
      if (!memberEvents.length) return [userId, { ...emptySummary }];

      const totalRisk = memberEvents.reduce((sum, event) => sum + clampRiskScore(event.riskScore), 0);
      return [
        userId,
        {
          averageRiskScore: Math.round(totalRisk / memberEvents.length),
          highestRiskScore: Math.max(...memberEvents.map((event) => clampRiskScore(event.riskScore))),
          latestRiskScore: clampRiskScore(memberEvents[0].riskScore),
          lastAuditAt: memberEvents[0].createdAt,
          auditCount: memberEvents.length
        }
      ];
    })
  );
}

export function riskLevelForScore(score: number) {
  if (score >= 75) return "critical" as const;
  if (score >= 50) return "high" as const;
  if (score >= 25) return "moderate" as const;
  return "low" as const;
}

function clampRiskScore(score: number) {
  return Math.max(0, Math.min(100, Number.isFinite(score) ? score : 0));
}
