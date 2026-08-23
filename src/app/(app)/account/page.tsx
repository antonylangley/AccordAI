import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { createSupabaseServerAuthClient } from "@/lib/auth/supabase-server";
import { getAccordOrganizationContext } from "@/lib/auth/organization";
import { getAccordAuthProfile } from "@/lib/auth/user-profile";

export default async function AccountPage() {
  const client = createSupabaseServerAuthClient();
  const { data } = client ? await client.auth.getUser() : { data: { user: null } };
  if (!data.user) redirect("/login?returnTo=/account");
  const organization = await getAccordOrganizationContext();
  const profile = getAccordAuthProfile(data.user);
  const provider = String(data.user.app_metadata?.provider || "OAuth");

  return (
    <div className="app-geist space-y-6">
      <PageHeader eyebrow="Account" title="Profile" description="Your Accord identity and current organization access." />
      <section className="overflow-hidden rounded-lg border border-accord-border bg-white">
        <div className="flex items-center gap-4 border-b border-accord-border p-5">
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accord-night text-sm font-semibold text-white">{initials(profile.displayName)}</div>
          )}
          <div><h2 className="text-base font-semibold text-accord-text">{profile.displayName}</h2><p className="text-sm text-accord-muted">{profile.email}</p></div>
        </div>
        <dl className="divide-y divide-accord-border text-sm">
          <Row label="Authentication provider" value={provider[0].toUpperCase() + provider.slice(1)} />
          <Row label="Organization" value={organization.onboardingRequired ? "No organization" : organization.companyName} />
          <Row label="Role" value={organization.role === "demo" ? "Member" : organization.role[0].toUpperCase() + organization.role.slice(1)} />
        </dl>
        <form action="/auth/logout" method="post" className="border-t border-accord-border p-4">
          <button className="rounded-md border border-accord-border px-3.5 py-2 text-xs font-semibold text-accord-text hover:bg-accord-surface">Sign out</button>
        </form>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-4 px-5 py-3.5"><dt className="text-accord-muted">{label}</dt><dd className="font-medium capitalize text-accord-text">{value}</dd></div>; }
function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "A"; }
