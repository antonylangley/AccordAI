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
    <main className="app-geist flex min-h-screen flex-col bg-accord-panel px-6 py-6 text-accord-text">
      <nav className="flex items-center justify-between">
        <Link href="/" aria-label="Back to Accord home">
          <AccordLogo lockup framed compact />
        </Link>
        <Link
          href="/"
          className="inline-flex h-8 items-center rounded-md border border-accord-border bg-accord-panel px-3 text-[13px] font-medium text-accord-text transition-colors hover:border-accord-faint"
        >
          Back home
        </Link>
      </nav>

      <section className="flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-sm">
          <div className="rounded-lg border border-accord-border bg-accord-panel">
            <div className="border-b border-accord-border px-5 py-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-slate-400">Accord workspace</p>
              <h1 className="mt-1.5 text-lg font-semibold tracking-[-0.02em] text-accord-text">Sign in to Accord</h1>
              <p className="mt-1 text-[13px] leading-5 text-accord-muted">
                Google is recommended for company workspaces. GitHub is available for development teams.
              </p>
            </div>

            <div className="px-5 py-5">
              {searchParams?.error ? (
                <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] leading-5 text-amber-800">
                  {friendlyAuthError(searchParams.error)}
                </div>
              ) : null}

              {!context.authConfigured ? (
                <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] leading-5 text-amber-800">
                  Add <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
                  <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> to enable OAuth login.
                </div>
              ) : null}

              <div className="grid gap-2">
                <a
                  href="/auth/login?provider=google"
                  className="inline-flex h-9 items-center justify-center rounded-md bg-accord-night px-4 text-[13px] font-medium text-white transition-colors hover:bg-accord-navy"
                >
                  Continue with Google
                </a>
                <a
                  href="/auth/login?provider=github"
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-accord-border bg-accord-panel px-4 text-[13px] font-medium text-accord-text transition-colors hover:border-accord-faint"
                >
                  <Github className="h-3.5 w-3.5" aria-hidden="true" />
                  Continue with GitHub
                </a>
              </div>

              <p className="mt-4 text-xs leading-5 text-accord-muted">
                First login creates a starter organization. Invite-only onboarding replaces this once the account model
                is locked.
              </p>
            </div>
          </div>

          <p className="mt-4 flex items-start justify-center gap-1.5 px-2 text-center text-xs leading-5 text-accord-muted">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
            Accounts control access to metadata, policy decisions, and redacted previews — raw prompts and responses
            stay out of dashboard storage.
          </p>
        </div>
      </section>
    </main>
  );
}

function friendlyAuthError(error: string) {
  if (error === "supabase-not-configured") {
    return "Supabase Auth is not configured for this deployment yet.";
  }

  return `Login failed: ${error}`;
}
