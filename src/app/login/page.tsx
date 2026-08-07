import Link from "next/link";
import { Github, ShieldCheck } from "lucide-react";
import { AccordLogo } from "@/components/ui/accord-logo";
import { getAccordOrganizationContext } from "@/lib/auth/organization";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams
}: {
  searchParams?: { error?: string };
}) {
  const context = await getAccordOrganizationContext();

  return (
    <main className="min-h-screen bg-[#f7f7fb] px-6 py-8 text-accord-text">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col">
        <nav className="flex items-center justify-between">
          <Link href="/" aria-label="Back to Accord home">
            <AccordLogo lockup framed compact />
          </Link>
          <Link
            href="/"
            className="rounded-full border border-accord-border bg-white px-4 py-2 text-sm font-semibold text-accord-text shadow-sm"
          >
            Back home
          </Link>
        </nav>

        <section className="grid flex-1 items-center gap-10 py-16 lg:grid-cols-[0.85fr_1fr]">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-accord-primary">
              Accord workspace
            </p>
            <h1 className="mt-5 text-5xl font-semibold tracking-[-0.055em] text-accord-text md:text-6xl">
              Sign in to your governance console.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-accord-muted">
              Connect dashboard data, policy bundles, and Accord Guard extension telemetry to the right organization.
            </p>

            <div className="mt-8 rounded-3xl border border-accord-border bg-white p-5 shadow-accord-panel">
              <div className="flex gap-3">
                <span className="mt-1 rounded-2xl bg-emerald-50 p-2 text-emerald-600">
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-semibold text-accord-text">Privacy-first by default</p>
                  <p className="mt-1 text-sm leading-6 text-accord-muted">
                    Accounts control access to metadata, policy decisions, redacted previews, and bundle history. Raw prompts and raw responses remain out of dashboard storage.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-accord-border bg-white p-8 shadow-accord-panel">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-accord-primary">
              Authentication
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-accord-text">
              Continue to Accord
            </h2>
            <p className="mt-3 text-sm leading-6 text-accord-muted">
              Google is the recommended login for company workspaces. GitHub is available for development teams.
            </p>

            {searchParams?.error ? (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                {friendlyAuthError(searchParams.error)}
              </div>
            ) : null}

            {!context.authConfigured ? (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to enable OAuth login.
              </div>
            ) : null}

            <div className="mt-6 grid gap-3">
              <a
                href="/auth/login?provider=google"
                className="inline-flex items-center justify-center rounded-2xl bg-accord-night px-5 py-4 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5"
              >
                Continue with Google
              </a>
              <a
                href="/auth/login?provider=github"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-accord-border bg-white px-5 py-4 text-sm font-semibold text-accord-text shadow-sm transition hover:-translate-y-0.5"
              >
                <Github className="h-4 w-4" aria-hidden="true" />
                Continue with GitHub
              </a>
            </div>

            <p className="mt-6 text-xs leading-5 text-accord-muted">
              First login creates a starter organization for now. We can replace that with invite-only onboarding once the customer/account model is locked.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function friendlyAuthError(error: string) {
  if (error === "supabase-not-configured") {
    return "Supabase Auth is not configured for this deployment yet.";
  }

  return `Login failed: ${error}`;
}
