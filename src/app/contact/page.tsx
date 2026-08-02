import Link from "next/link";
import { ArrowLeft, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { AccordLogo } from "@/components/ui/accord-logo";
import { ContactForm } from "./contact-form";

export const dynamic = "force-dynamic";

const highlights = [
  "Chrome extension governance for ChatGPT and approved AI tools",
  "Supabase-backed telemetry without raw prompt or response storage",
  "Policy bundles that admins can publish and Accord Guard can enforce"
];

export default function ContactPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#fbfcff] text-accord-text">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 bg-grid opacity-35" />
      <div aria-hidden="true" className="pointer-events-none fixed right-[-18rem] top-[-14rem] h-[34rem] w-[34rem] rounded-full bg-accord-primary/10 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none fixed bottom-[-18rem] left-[-14rem] h-[34rem] w-[34rem] rounded-full bg-[#101828]/5 blur-3xl" />

      <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <Link href="/" aria-label="Back to Accord home">
          <AccordLogo lockup framed compact />
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="hidden items-center gap-2 rounded-full border border-accord-border bg-white px-4 py-2 text-sm font-semibold text-accord-muted shadow-sm transition hover:border-accord-primary/30 hover:text-accord-text sm:inline-flex"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Home
          </Link>
          <Link
            href="/dashboard"
            className="rounded-full border border-accord-border bg-white px-4 py-2 text-sm font-semibold text-accord-text shadow-sm transition hover:border-accord-primary/30"
          >
            Open dashboard
          </Link>
        </div>
      </nav>

      <section className="relative z-10 mx-auto grid max-w-7xl gap-10 px-6 pb-20 pt-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:pt-20">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-accord-border bg-white/86 px-3 py-1.5 text-sm font-medium text-accord-primary shadow-sm backdrop-blur">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Book a demo
          </div>
          <h1 className="mt-6 max-w-2xl text-5xl font-semibold leading-[1.04] text-accord-text md:text-6xl">
            See how Accord governs AI without watching every conversation.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-accord-muted">
            Send a note and we&apos;ll route it straight to Antony. The demo can focus on the browser extension,
            dashboard telemetry, policy authoring, or the Supabase-backed governance loop.
          </p>

          <div className="mt-8 space-y-3">
            {highlights.map((item) => (
              <div key={item} className="flex items-start gap-3 text-sm font-medium leading-6 text-accord-text">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-accord-primary" aria-hidden="true" />
                {item}
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-[1.5rem] border border-accord-border bg-white/80 p-5 shadow-sm backdrop-blur">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f1f2ff] text-accord-primary">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-semibold text-accord-text">Privacy-first by default</p>
                <p className="mt-1 text-sm leading-6 text-accord-muted">
                  The form sends basic contact details only. Accord&apos;s product principle still holds: governance
                  metadata, redacted previews, and no raw AI conversation storage by default.
                </p>
              </div>
            </div>
          </div>
        </div>

        <ContactForm />
      </section>
    </main>
  );
}
