import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { ProviderCard } from "@/components/ui/provider-card";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { privacyControls, providers } from "@/lib/mock-data";

export default function SettingsPage() {
  return (
    <div className="app-geist space-y-6">
      <PageHeader title="Settings" description="Tenant configuration, provider connections, retention, and access" />

      <SettingsPanel title="Appearance">
        <SettingsRow label="Interface theme" hint="Applies to the Accord dashboard on this device">
          <ThemeToggle />
        </SettingsRow>
      </SettingsPanel>

      <SettingsPanel title="Organization">
        <p className="px-4 py-3.5 text-[13px] leading-5 text-accord-muted">
          Northstar Financial uses Accord across support, legal, HR, engineering, and research teams.
        </p>
      </SettingsPanel>

      <SettingsPanel
        title="Providers"
        action={
          <Link
            href="/api-tokens"
            className="inline-flex h-8 items-center rounded-md border border-accord-border bg-accord-panel px-3 text-[13px] font-medium text-accord-text transition-colors hover:border-accord-faint"
          >
            Manage API tokens
          </Link>
        }
      >
        <div className="grid gap-3 p-4 md:grid-cols-2">
          {providers.map((provider) => (
            <ProviderCard key={provider.name} provider={provider} />
          ))}
        </div>
      </SettingsPanel>

      <SettingsPanel title="Privacy and retention" description="Governance without broad employee content retention — raw content stays protected by default">
        <div className="divide-y divide-accord-border/60 px-4">
          {privacyControls.map((control) => (
            <div key={control} className="flex items-center gap-2 py-2.5 text-[13px] text-accord-text">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              {control}
            </div>
          ))}
        </div>
      </SettingsPanel>

      <SettingsPanel title="Review access">
        <p className="px-4 py-3.5 text-[13px] leading-5 text-accord-muted">
          Reviewers see redacted previews by default. Raw-content access is disabled unless an approved exception
          workflow is configured.
        </p>
      </SettingsPanel>

      <SettingsPanel title="Integrations">
        <p className="px-4 py-3.5 text-[13px] leading-5 text-accord-muted">
          Connect identity, SIEM, ticketing, and data-loss prevention systems when the backend integration layer is
          ready.
        </p>
      </SettingsPanel>
    </div>
  );
}

function SettingsPanel({
  title,
  description,
  action,
  children
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-accord-border bg-accord-panel">
      <div className="flex items-center justify-between gap-4 border-b border-accord-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-accord-text">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-accord-muted">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function SettingsRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
      <div>
        <p className="text-[13px] font-medium text-accord-text">{label}</p>
        {hint ? <p className="mt-0.5 text-xs text-accord-muted">{hint}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
