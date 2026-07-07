import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  FileText,
  HeartPulse,
  Landmark,
  LockKeyhole,
  MessageSquareText,
  Scale,
  ShieldCheck,
  Sparkles,
  Users
} from "lucide-react";
import { LandingScrollReveal } from "@/components/landing/scroll-reveal";
import { AccordLogo } from "@/components/ui/accord-logo";

export const dynamic = "force-dynamic";

const steps = [
  {
    title: "Route AI usage through Accord",
    description: "Give every team one approved path to models, use-case context, and tenant controls.",
    icon: MessageSquareText
  },
  {
    title: "Detect risk before and after model calls",
    description: "Scan prompts and responses for PII, secrets, regulated advice, and bypass attempts.",
    icon: ShieldCheck
  },
  {
    title: "Govern usage with policies, logs, and reports",
    description: "Keep policy decisions, redacted previews, audit trails, and reviewer notes in one place.",
    icon: FileText
  }
];

const privacyFeatures = [
  ["Metadata by default", "Measure usage, providers, decisions, and risk without broad content retention."],
  ["Redacted previews", "Show only the context reviewers need, with identifiers masked before routing."],
  ["Policy exceptions", "Escalate risky requests with business justification and scoped review workflows."],
  ["Audit trails", "Reconstruct decisions with clean evidence designed for compliance teams."]
];

const useCases = [
  ["Financial services", "Loan, insurance, banking, and advisory workflows with regulated-review controls.", Landmark],
  ["Healthcare", "Clinical and support workflows with privacy-sensitive handling by default.", HeartPulse],
  ["HR/recruiting", "Candidate, employee, performance, and workplace content governed before routing.", Users],
  ["Legal and consulting", "Matter, client, contract, and privileged context guarded with policy checks.", Scale],
  ["SaaS/product teams", "Support, product, engineering, and customer data workflows through approved models.", Building2]
];

export default function LandingPage() {
  return (
    <main className="landing-page relative overflow-hidden bg-[#fbfcff] text-accord-text">
      <LandingScrollReveal />
      <section className="landing-hero relative min-h-screen overflow-hidden border-b border-accord-border/70 bg-white">
        <div
          aria-hidden="true"
          className="landing-hero-bg absolute inset-0 bg-white bg-[url('/accord-hero-visual.png')] bg-[length:100%_auto] bg-top bg-no-repeat"
        />
        <div aria-hidden="true" className="absolute inset-0 bg-grid opacity-35" />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.92)_0%,rgba(255,255,255,0.72)_35%,rgba(255,255,255,0.08)_72%),linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.02)_42%,rgba(251,252,255,0.88)_62%,#fbfcff_100%)]"
        />

        <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <AccordLogo lockup framed compact />
          <div className="hidden items-center gap-7 text-sm font-medium text-accord-muted md:flex">
            <a href="#how" className="transition hover:text-accord-text">
              How it works
            </a>
            <a href="#product" className="transition hover:text-accord-text">
              Product
            </a>
            <a href="#privacy" className="transition hover:text-accord-text">
              Privacy
            </a>
            <a href="#use-cases" className="transition hover:text-accord-text">
              Use cases
            </a>
          </div>
          <Link
            href="/dashboard"
            className="rounded-full border border-accord-border bg-white px-4 py-2 text-sm font-semibold text-accord-text shadow-sm transition hover:border-accord-primary/30"
          >
            Open dashboard
          </Link>
        </nav>

        <div className="relative z-10 mx-auto flex min-h-[calc(100vh-84px)] max-w-7xl items-center px-6 pb-20 pt-10">
          <div className="landing-hero-copy max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-accord-border bg-white/86 px-3 py-1.5 text-sm font-medium text-accord-primary shadow-sm backdrop-blur">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              AI governance without surveillance
            </div>
            <h1 className="max-w-[38rem] text-5xl font-semibold leading-[1.04] text-accord-text md:text-7xl">
              Govern AI usage before it becomes a compliance risk.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-accord-muted">
              Accord is a privacy-first control plane for enterprise AI. Route model usage, detect sensitive data,
              enforce policy, and keep audit-ready evidence without storing raw conversations by default.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-accord-night px-5 py-3 text-sm font-semibold text-white shadow-accord-soft transition hover:bg-accord-elevated"
              >
                View dashboard
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/chat"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-accord-border bg-white/88 px-5 py-3 text-sm font-semibold text-accord-text shadow-sm backdrop-blur transition hover:border-accord-primary/30"
              >
                Try governed chat
              </Link>
            </div>
            <div className="mt-8 grid max-w-xl grid-cols-3 gap-3 text-sm">
              {[
                ["0", "raw stores"],
                ["184ms", "median scan"],
                ["92%", "low/medium risk"]
              ].map(([value, label]) => (
                <div
                  key={label}
                  className="scroll-card rounded-2xl border border-accord-border bg-white/74 px-4 py-3 shadow-sm backdrop-blur"
                  data-reveal
                >
                  <p className="font-semibold text-accord-text">{value}</p>
                  <p className="mt-1 text-xs text-accord-muted">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="landing-section relative z-10 border-b border-accord-border/70 bg-white/94 px-6 py-24 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center" data-reveal>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-accord-primary">
            How it works
          </p>
          <h2 className="mt-3 text-4xl font-semibold leading-tight text-accord-text">
            A governance layer that fits between teams and models.
          </h2>
          <p className="mt-4 text-lg leading-8 text-accord-muted">
            Accord makes the approved path feel easy for employees and evidence-ready for governance teams.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <article
                key={step.title}
                className="scroll-card group relative overflow-hidden rounded-3xl border border-accord-border bg-white p-6 shadow-accord-panel"
                data-reveal
              >
                <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-accord-primary/40 to-transparent" />
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f1f2ff] text-accord-primary ring-1 ring-accord-primary/10">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="font-mono text-[11px] font-semibold text-accord-muted">0{index + 1}</span>
                </div>
                <h3 className="mt-8 text-lg font-semibold text-accord-text">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-accord-muted">{step.description}</p>
              </article>
            );
          })}
        </div>
        </div>
      </section>

      <section id="product" className="landing-section relative z-10 border-y border-accord-border bg-[#f6f8ff]/94 px-6 py-24 backdrop-blur-sm">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[0.72fr_1.28fr]">
          <div data-reveal>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-accord-primary">
              Product preview
            </p>
            <h2 className="mt-3 text-4xl font-semibold leading-tight text-accord-text">
              A real control plane for governed AI operations.
            </h2>
            <p className="mt-4 text-lg leading-8 text-accord-muted">
              See usage patterns, provider mix, policy decisions, flagged events, and review evidence in one credible
              dashboard without exposing raw employee content by default.
            </p>
            <div className="mt-8 space-y-3">
              {["Approved provider routing", "Redacted evidence previews", "Export-ready audit posture"].map((item) => (
                <div key={item} className="flex items-center gap-3 text-sm font-medium text-accord-text">
                  <CheckCircle2 className="h-4 w-4 text-accord-primary" aria-hidden="true" />
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="scroll-depth" data-reveal>
            <DashboardMockup />
          </div>
        </div>
      </section>

      <section id="privacy" className="landing-section relative z-10 bg-white/94 px-6 py-24 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-accord-border bg-[linear-gradient(135deg,#ffffff_0%,#f8f9ff_60%,#eef2ff_100%)] p-6 shadow-accord-panel md:p-10">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
            <div data-reveal>
              <div className="mb-5 inline-flex rounded-2xl bg-white p-3 text-accord-primary shadow-sm ring-1 ring-accord-border">
                <LockKeyhole className="h-6 w-6" aria-hidden="true" />
              </div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-accord-primary">
                Privacy-first governance
              </p>
              <h2 className="mt-3 text-4xl font-semibold leading-tight text-accord-text">
                Designed to govern AI without turning into surveillance.
              </h2>
              <p className="mt-4 text-lg leading-8 text-accord-muted">
                Accord keeps the evidence governance teams need while limiting broad raw-content retention.
              </p>
              <div className="mt-8 overflow-hidden rounded-[1.75rem] border border-accord-border bg-white p-2 shadow-sm">
                <Image
                  src="/accord-clay-mark.jpg"
                  width={1024}
                  height={1024}
                  alt="Tactile Accord mark"
                  className="aspect-[1.45/1] w-full rounded-[1.35rem] object-cover object-center"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {privacyFeatures.map(([title, detail]) => (
                <article
                  key={title}
                  className="scroll-card rounded-2xl border border-accord-border bg-white/90 p-5 shadow-sm"
                  data-reveal
                >
                  <ShieldCheck className="h-5 w-5 text-accord-primary" aria-hidden="true" />
                  <h3 className="mt-4 font-semibold text-accord-text">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-accord-muted">{detail}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="use-cases" className="landing-section relative z-10 overflow-hidden bg-accord-night px-6 py-24 text-white">
        <div className="absolute inset-0 dark-grid opacity-70" />
        <div className="absolute right-[-10rem] top-[-10rem] h-80 w-80 rounded-full bg-accord-primary/20 blur-3xl" />
        <div className="relative mx-auto max-w-7xl">
          <div className="max-w-2xl" data-reveal>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-accord-violet">
              Use cases
            </p>
            <h2 className="mt-3 text-4xl font-semibold leading-tight">For teams with real governance obligations.</h2>
            <p className="mt-4 text-lg leading-8 text-slate-400">
              Accord gives regulated and data-sensitive teams a safer default path for AI adoption.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {useCases.map(([label, detail, Icon]) => (
              <article
                key={label as string}
                className="scroll-card rounded-3xl border border-white/10 bg-white/[0.055] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur"
                data-reveal
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-accord-violet ring-1 ring-white/10">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="mt-5 font-semibold text-white">{label as string}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-400">{detail as string}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section relative z-10 bg-white/95 px-6 py-24 text-center backdrop-blur-sm">
        <div className="absolute inset-x-0 top-0 mx-auto h-px max-w-5xl bg-gradient-to-r from-transparent via-accord-border to-transparent" />
        <div className="mx-auto max-w-4xl" data-reveal>
          <div className="mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-accord-border bg-white shadow-accord-panel">
            <Image
              src="/accord-clay-mark.jpg"
              width={1024}
              height={1024}
              alt="Accord emblem"
              className="h-full w-full object-cover"
            />
          </div>
          <h2 className="mt-6 text-4xl font-semibold leading-tight text-accord-text">
            Bring AI governance into the flow of work.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-accord-muted">
            Start with a control plane that employees can use, compliance can trust, and admins can audit without
            storing raw conversations by default.
          </p>
          <div className="mt-8 flex justify-center">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl bg-accord-night px-5 py-3 text-sm font-semibold text-white shadow-accord-soft transition hover:bg-accord-elevated"
            >
              Open Accord
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-accord-border bg-white px-6 py-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm text-accord-muted md:flex-row md:items-center md:justify-between">
          <AccordLogo lockup compact />
          <p>Governance without surveillance. Metadata and redacted previews by default.</p>
        </div>
      </footer>
    </main>
  );
}

function DashboardMockup() {
  return (
    <div className="rounded-[2rem] border border-accord-border bg-white p-3 shadow-accord-glow">
      <div className="overflow-hidden rounded-[1.45rem] border border-accord-border bg-[#fbfcff]">
        <div className="flex items-center justify-between border-b border-accord-border bg-white px-5 py-4">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-accord-primary">
              Northstar Financial
            </p>
            <h3 className="mt-1 text-lg font-semibold text-accord-text">Governance overview</h3>
          </div>
          <span className="rounded-full border border-accord-border bg-[#f6f8ff] px-3 py-1 text-xs font-semibold text-accord-muted">
            Raw content disabled
          </span>
        </div>

        <div className="grid gap-4 p-5 lg:grid-cols-[0.82fr_1.18fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-accord-border bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-accord-text">Policy posture</p>
              <p className="mt-2 text-3xl font-semibold text-accord-text">Stable</p>
              <p className="mt-2 text-sm leading-6 text-accord-muted">
                Approved model usage with redacted evidence and no broad employee content retention.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["18.4k", "AI requests"],
                ["47", "risk events"],
                ["12", "blocked"],
                ["0", "raw stores"]
              ].map(([value, label]) => (
                <div key={label} className="rounded-2xl border border-accord-border bg-white p-4 shadow-sm">
                  <p className="text-xl font-semibold text-accord-text">{value}</p>
                  <p className="mt-1 text-xs text-accord-muted">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-accord-border bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-accord-text">AI usage over time</p>
                <p className="text-xs text-accord-muted">30 days</p>
              </div>
              <div className="mt-5 overflow-hidden rounded-2xl border border-accord-border/80 bg-[linear-gradient(180deg,#fbfcff_0%,#f5f7ff_100%)] p-4">
                <div className="mb-2 flex items-center justify-between text-[11px] font-medium text-accord-muted">
                  <span>Requests routed</span>
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-600">+14.2%</span>
                </div>
                <svg
                  className="h-36 w-full overflow-visible"
                  viewBox="0 0 360 150"
                  role="img"
                  aria-label="Line chart showing Accord AI usage rising over the last 30 days"
                >
                  <defs>
                    <linearGradient id="usageAreaGradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#625bff" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="#625bff" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="usageLineGradient" x1="0" x2="1" y1="0" y2="0">
                      <stop offset="0%" stopColor="#625bff" />
                      <stop offset="100%" stopColor="#4f6bff" />
                    </linearGradient>
                  </defs>

                  {[34, 66, 98, 130].map((y) => (
                    <line
                      key={y}
                      x1="34"
                      x2="342"
                      y1={y}
                      y2={y}
                      stroke="#e3e8f2"
                      strokeDasharray="4 7"
                      strokeWidth="1"
                    />
                  ))}

                  <path
                    d="M38 118 C72 110 96 98 124 90 C158 80 180 86 210 70 C238 55 254 39 284 43 C309 46 324 57 340 49 L340 132 L38 132 Z"
                    fill="url(#usageAreaGradient)"
                  />
                  <path
                    d="M38 118 C72 110 96 98 124 90 C158 80 180 86 210 70 C238 55 254 39 284 43 C309 46 324 57 340 49"
                    fill="none"
                    stroke="url(#usageLineGradient)"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="5"
                  />
                  {[["38", "118"], ["124", "90"], ["210", "70"], ["284", "43"], ["340", "49"]].map(([cx, cy]) => (
                    <circle key={`${cx}-${cy}`} cx={cx} cy={cy} fill="#ffffff" r="5" stroke="#625bff" strokeWidth="3" />
                  ))}
                  <text fill="#94a3b8" fontSize="10" fontWeight="600" x="34" y="148">
                    Week 1
                  </text>
                  <text fill="#94a3b8" fontSize="10" fontWeight="600" x="292" y="148">
                    Week 4
                  </text>
                </svg>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {["Pre-flight scan", "Prompt redacted", "Post-scan passed"].map((item) => (
                <div key={item} className="rounded-2xl border border-accord-border bg-white p-3 text-sm font-medium text-accord-text shadow-sm">
                  <CheckCircle2 className="mb-2 h-4 w-4 text-emerald-500" aria-hidden="true" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
