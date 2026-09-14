import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { canManageOrganization, getAccordOrganizationContext } from "@/lib/auth/organization";
import { parseOrganizationRange } from "@/lib/organization/analytics";
import { getOrganizationOverview } from "@/lib/organization/data";
import { cn } from "@/lib/utils";
import { InviteMemberButton } from "./invite-member-button";
import { OrganizationCommandCenter } from "./organization-command-center";
import { OrganizationSettings } from "./organization-settings";

export const dynamic = "force-dynamic";

type OrganizationPageProps = {
  searchParams?: {
    range?: string | string[];
    person?: string | string[];
    member?: string | string[];
    workspace?: string | string[];
  };
};

export default async function OrganizationPage({ searchParams }: OrganizationPageProps) {
  const organization = await getAccordOrganizationContext({ autoCreate: true });
  const canManage = canManageOrganization(organization.role);
  const range = parseOrganizationRange(firstParam(searchParams?.range));
  const overview = canManage
    ? await getOrganizationOverview(organization.companySlug, organization.userId, range)
    : null;

  return (
    <div className="app-geist space-y-5">
      <PageHeader
        eyebrow={organization.companyName}
        title="Organization"
        description="Monitor workforce AI usage, enforcement, and policy exposure from one command center."
        action={canManage ? <HeaderActions range={range} /> : undefined}
      />

      {!canManage ? (
        <section className="rounded-lg border border-accord-border bg-accord-panel px-5 py-6">
          <h2 className="text-sm font-semibold text-accord-text">Admin access required</h2>
          <p className="mt-1 text-sm leading-6 text-accord-muted">Organization-level employee risk and membership details are available to workspace owners and admins.</p>
        </section>
      ) : !overview ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-5 text-amber-900">
          <h2 className="text-sm font-semibold">Organization analytics are unavailable</h2>
          <p className="mt-1 text-xs leading-5">The workspace could not be authorized or its telemetry could not be loaded. No cross-organization data was returned.</p>
        </section>
      ) : (
        <>
          <OrganizationCommandCenter overview={overview} initialPersonId={firstParam(searchParams?.person)} />
          <OrganizationSettings
            organization={organization}
            people={overview.people}
            memberStatus={firstParam(searchParams?.member)}
            workspaceStatus={firstParam(searchParams?.workspace)}
          />
        </>
      )}
    </div>
  );
}

function HeaderActions({ range }: { range: ReturnType<typeof parseOrganizationRange> }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-md border border-accord-border bg-accord-panel p-0.5" aria-label="Analytics date range">
        {(["7d", "30d", "90d"] as const).map((value) => (
          <Link
            key={value}
            href={`/organization?range=${value}`}
            className={cn("rounded px-2.5 py-1.5 font-mono text-[11px] font-semibold transition-colors", range === value ? "bg-accord-night text-white" : "text-accord-muted hover:bg-accord-surface hover:text-accord-text")}
            aria-current={range === value ? "page" : undefined}
          >
            {value.toUpperCase()}
          </Link>
        ))}
      </div>
      <InviteMemberButton />
    </div>
  );
}

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}
