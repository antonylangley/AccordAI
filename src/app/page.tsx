import Link from "next/link";
import {
  ArrowRight,
  Building2,
  HeartPulse,
  Landmark,
  LockKeyhole,
  Scale,
  ShieldCheck,
  Sparkles,
  Users
} from "lucide-react";
import { AccordLogo } from "@/components/ui/accord-logo";
import { RiskBadge } from "@/components/ui/risk-badge";

const steps = [
  {
    title: "Route AI usage through Accord",
    description: "Give employees a calm gateway for approved models, tenant controls, and use-case context."
  },
  {
    title: "Detect risk before and after model calls",
    description: "Scan prompts and responses for PII, confidential data, regulated advice, and policy bypass attempts."
  },
  {
    title: "Govern usage with policies, logs, and reports",
    description: "Keep audit-ready metadata, redacted previews, policy outcomes, and reviewer notes in one control plane."
  }
];

const useCases = [
  { label: "Financial services", icon: Landmark },
  { label: "Healthcare", icon: HeartPulse },
  { label: "HR/recruiting", icon: Users },
  { label: "Legal and consulting", icon: Scale },
  { label: "SaaS/product teams", icon: Building2 }
];

export default function LandingPage() {
  return (
    <main className="bg-white text-accord-text">
      <section className="relative overflow-hidden bg-accord-night text-white">
        <div className="absolute inset-0 dark-grid opacity-80" />
        <div className="absolute left-[-8rem] top-32 h-72 w-72 rotate-[-18deg] rounded-[2rem] bg-accord-primary/20 blur-3xl" />
        <div className="absolute right-[-7rem] top-20 h-80 w-80 rotate-12 rounded-[2rem] bg-accord-blue/16 blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-accord-night to-transparent" />
        <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <AccordLogo lockup framed />
          <div className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
            <a href="#how" className="hover:text-white">
              How it works
            </a>
            <a href="#privacy" className="hover:text-white">
              Privacy
            </a>
            <a href="#use-cases" className="hover:text-white">
              Use cases
            </a>
          </div>
          <Link
            href="/dashboard"
            className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
          >
            Open dashboard
          </Link>
        </nav>

        <div className="relative z-10 mx-auto grid min-h-[760px] max-w-7xl items-center gap-12 px-6 py-16 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3 py-1.5 text-sm text-slate-300">
              <Sparkles className="h-4 w-4 text-blue-300" aria-hidden="true" />
              AI governance, in accord.
            </div>
            <h1 className="max-w-4xl text-5xl font-semibold leading-[1.03] md:text-7xl">
              Govern every AI interaction before it becomes a risk.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Accord is the privacy-first control plane for enterprise AI usage, with risk scoring, audit logs,
              policy enforcement, and compliance-ready dashboards.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-accord-ink shadow-accord-glow transition hover:bg-slate-50"
              >
                View dashboard
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a
                href="#how"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.08] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.12]"
              >
                Explore governance flow
              </a>
            </div>
          </div>

          <div className="relative">
            <div className="rounded-[1.35rem] border border-white/15 bg-white/[0.055] p-3 shadow-accord-glow backdrop-blur">
              <div className="rounded-2xl border border-white/10 bg-accord-navy p-5">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <p className="text-sm text-slate-400">Northstar Financial</p>
                    <h2 className="mt-1 text-xl font-semibold">Governance overview</h2>
                  </div>
                  <RiskBadge level="medium" />
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {[
                    ["18,420", "AI requests"],
                    ["47", "High-risk events"],
                    ["12", "Blocked"]
                  ].map(([value, label]) => (
                    <div key={label} className="rounded-xl border border-white/10 bg-white/[0.045] p-4">
                      <p className="text-2xl font-semibold">{value}</p>
                      <p className="mt-1 text-xs text-slate-400">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm font-medium">Policy events</p>
                    <p className="text-xs text-slate-400">Redacted previews only</p>
                  </div>
                  <div className="space-y-3">
                    {["PII exposure", "Confidential data", "Regulated advice"].map((item, index) => (
                      <div key={item} className="flex items-center gap-3">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-accord-blue to-accord-violet"
                            style={{ width: `${74 - index * 18}%` }}
                          />
                        </div>
                        <span className="w-36 text-xs text-slate-300">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-sm font-medium">Recent event</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    Draft an email to [PERSON] at [EMAIL] about a denied loan application...
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-orange-400/15 px-2 py-1 text-orange-200">Warned</span>
                    <span className="rounded-full bg-accord-blue/15 px-2 py-1 text-blue-200">Metadata logged</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-7xl px-6 py-24">
        <div className="max-w-2xl">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-accord-primary">How Accord works</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-[-0.03em] text-accord-text">A policy layer between teams and models.</h2>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            Accord gives admins governance without surveillance by focusing on aggregate usage, policy outcomes,
            redacted previews, and audit readiness.
          </p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {steps.map((step, index) => (
            <article key={step.title} className="rounded-2xl border border-accord-border bg-white p-6 shadow-accord-panel">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accord-primary to-accord-blue text-sm font-semibold text-white">
                {index + 1}
              </div>
              <h3 className="mt-6 text-lg font-semibold text-slate-950">{step.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-accord-border bg-accord-mist px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-12 lg:grid-cols-[0.75fr_1.25fr]">
            <div>
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-accord-primary">Dashboard preview</p>
              <h2 className="mt-3 text-4xl font-semibold tracking-[-0.03em] text-accord-text">Compliance posture at a glance.</h2>
              <p className="mt-4 text-lg leading-8 text-slate-600">
                See how teams use AI, where policy decisions happen, and what needs review without exposing raw
                employee conversations by default.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {[
                ["AI usage over time", "18.4k requests routed"],
                ["Risk distribution", "91% low or medium"],
                ["Provider usage", "4 approved model providers"],
                ["Audit readiness", "180 days metadata logs"]
              ].map(([title, detail]) => (
                <article key={title} className="rounded-2xl border border-accord-border bg-white p-5 shadow-accord-panel">
                  <p className="font-semibold text-slate-950">{title}</p>
                  <p className="mt-2 text-sm text-slate-500">{detail}</p>
                  <div className="mt-5 h-20 rounded-xl bg-gradient-to-br from-[#f1f2ff] to-accord-mist p-3">
                    <div className="h-full rounded-lg border border-accord-border bg-white/70" />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="privacy" className="mx-auto grid max-w-7xl gap-12 px-6 py-24 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <div className="mb-5 inline-flex rounded-2xl bg-[#f1f2ff] p-3 text-accord-primary">
            <LockKeyhole className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="text-4xl font-semibold tracking-[-0.03em] text-accord-text">Privacy-first governance by design.</h2>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            Accord stores risk metadata and redacted previews by default, not raw employee conversations. Review
            access can require justification, and every admin action is audit logged.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ["Metadata by default", "Understand policy outcomes without broad content retention."],
            ["Redacted previews", "Give reviewers enough context while masking identifiers and sensitive text."],
            ["Policy exceptions", "Require business justification when a team needs to continue."],
            ["Audit trails", "Generate evidence for governance reviews without manual reconstruction."]
          ].map(([title, detail]) => (
            <article key={title} className="rounded-2xl border border-accord-border bg-white p-5 shadow-sm">
              <ShieldCheck className="h-5 w-5 text-accord-primary" aria-hidden="true" />
              <h3 className="mt-4 font-semibold text-accord-text">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="use-cases" className="bg-accord-night px-6 py-24 text-white">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-accord-violet">Use cases</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-[-0.03em]">Built for teams with real governance obligations.</h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {useCases.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.05] p-5">
                  <Icon className="h-5 w-5 text-accord-violet" aria-hidden="true" />
                  <h3 className="mt-4 font-semibold">{item.label}</h3>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-24 text-center">
        <AccordLogo markOnly tone="light" className="justify-center" />
        <h2 className="mt-5 text-4xl font-semibold tracking-[-0.03em] text-accord-text">
          Start with governance your employees can trust.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-600">
          Route AI usage through a responsible control plane that keeps policy enforcement precise, evidence
          audit-ready, and raw content protected by default.
        </p>
        <div className="mt-8 flex justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl bg-accord-night px-5 py-3 text-sm font-semibold text-white shadow-accord-soft"
          >
            View dashboard
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </main>
  );
}
