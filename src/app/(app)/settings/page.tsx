import Link from "next/link";
import { KeyRound, LockKeyhole, UsersRound } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ProviderCard } from "@/components/ui/provider-card";
import { privacyControls, providers, settingsSections } from "@/lib/mock-data";

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Manage tenant configuration, provider connections, retention rules, review access, and integrations."
      />

      <section className="grid gap-6 xl:grid-cols-[280px_1fr]">
        <nav aria-label="Settings sections" className="rounded-2xl border border-accord-border bg-white/94 p-3 shadow-sm">
          {settingsSections.map((section, index) => (
            <a
              href={`#${section.toLowerCase().replaceAll(" ", "-")}`}
              key={section}
              className={`block rounded-xl px-3 py-2.5 text-sm font-medium ${
                index === 0 ? "bg-[#f1f2ff] text-accord-primary" : "text-slate-600 hover:bg-accord-mist"
              }`}
            >
              {section}
            </a>
          ))}
        </nav>

        <div className="space-y-6">
          <section id="organization" className="rounded-2xl border border-accord-border bg-white/94 p-5 shadow-accord-panel">
            <div className="flex gap-3">
              <UsersRound className="mt-1 h-5 w-5 text-accord-primary" aria-hidden="true" />
              <div>
                <h2 className="text-lg font-semibold text-accord-text">Organization</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Northstar Financial uses Accord across support, legal, HR, engineering, and research teams.
                </p>
              </div>
            </div>
          </section>

          <section id="providers">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-accord-text">Providers</h2>
              <Link
                href="/api-tokens"
                className="inline-flex items-center gap-2 rounded-xl border border-accord-border bg-white px-3 py-2 text-sm font-semibold text-accord-text shadow-sm"
              >
                <KeyRound className="h-4 w-4 text-accord-primary" aria-hidden="true" />
                Manage API tokens
              </Link>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {providers.map((provider) => (
                <ProviderCard key={provider.name} provider={provider} />
              ))}
            </div>
          </section>

          <section
            id="privacy-and-retention"
            className="rounded-2xl border border-accord-border bg-accord-night p-5 text-white shadow-accord-panel"
          >
            <div className="flex gap-3">
              <LockKeyhole className="mt-1 h-5 w-5 text-accord-violet" aria-hidden="true" />
              <div>
                <h2 className="text-lg font-semibold text-white">Privacy and retention</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Governance without broad employee content retention. Accord is configured to govern usage while
                  keeping raw content protected by default.
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {privacyControls.map((control) => (
                <div key={control} className="rounded-xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm font-medium text-slate-200">
                  {control}
                </div>
              ))}
            </div>
          </section>

          <section id="review-access" className="rounded-2xl border border-accord-border bg-white/94 p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-accord-text">Review access</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Reviewers see redacted previews by default. Raw-content access is disabled unless an approved exception
              workflow is configured.
            </p>
          </section>

          <section id="integrations" className="rounded-2xl border border-accord-border bg-white/94 p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-accord-text">Integrations</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Connect identity, SIEM, ticketing, and data-loss prevention systems when the backend integration layer is
              ready.
            </p>
          </section>
        </div>
      </section>
    </div>
  );
}
