import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronDown,
  FileText,
  LockKeyhole,
  MessageSquareText,
  ShieldCheck,
  UploadCloud
} from "lucide-react";
import { LandingScrollReveal } from "@/components/landing/scroll-reveal";
import { AccordLogo } from "@/components/ui/accord-logo";

export const dynamic = "force-dynamic";

const audienceLabels = ["Financial services", "Healthcare", "Legal", "HR teams", "Product teams", "Security"];

const productCards = [
  {
    title: "Publish policy bundles",
    body: "Turn approved rules into compact bundles Accord Guard can enforce in the browser.",
    icon: FileText
  },
  {
    title: "Protect the moment",
    body: "Warn, redact, rewrite, or block before risky data leaves the employee workflow.",
    icon: ShieldCheck
  },
  {
    title: "Keep visibility private",
    body: "Track policy outcomes and trends without storing raw prompts or responses by default.",
    icon: LockKeyhole
  }
];

const platformStats = [
  ["Browser-first", "Runs where employees already use AI"],
  ["Metadata only", "Policy events, not conversation archives"],
  ["Policy bundles", "Admin-approved rules shipped to Accord Guard"],
  ["Local redaction", "Sensitive values stay protected in the session"]
];

const flowSteps = [
  ["Upload", "Bring an AI policy, employee handbook, or security procedure."],
  ["Review", "Accord extracts draft rules with citations and admin-facing explanations."],
  ["Publish", "Approved rules become the active bundle for Accord Guard."]
];

const faqs = [
  {
    question: "Does Accord replace the AI tools employees use?",
    answer: "No. Accord Guard works in the browser so employees can keep using familiar AI tools while company policy is enforced around the interaction."
  },
  {
    question: "Do admins read employee prompts?",
    answer: "No by default. Accord is built around policy metadata, actions, risk levels, and redacted previews instead of raw conversation storage."
  },
  {
    question: "Can we use our own AI policy?",
    answer: "Yes. Teams can upload policy documents, review extracted draft rules, approve what matters, and publish a bundle for the extension."
  },
  {
    question: "What happens when a prompt violates policy?",
    answer: "The rule decides the action. Accord can warn, redact, rewrite, require approval, or block the request before it reaches the AI surface."
  }
];

export default function LandingPage() {
  return (
    <main className="landing-page min-h-screen overflow-hidden bg-white text-accord-text">
      <LandingScrollReveal />
      <Hero />
      <AudienceStrip />
      <ProductSection />
      <PolicySection />
      <PrivacySection />
      <FAQSection />
      <FinalCTA />
      <SiteFooter />
    </main>
  );
}

function Hero() {
  return (
    <section className="landing-hero relative min-h-[116vh] overflow-hidden bg-white">
      <div
        role="img"
        aria-label="Clay Accord landscape with people around a large Accord mark"
        className="landing-hero-bg absolute inset-0 bg-[url('/accord-hero-visual-people-2x.png')] bg-[length:2580px_auto] bg-[position:right_318px] bg-no-repeat"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[76%] bg-[linear-gradient(180deg,rgba(222,212,255,0.96)_0%,rgba(226,216,255,0.78)_33%,rgba(241,238,255,0.30)_66%,rgba(255,255,255,0)_100%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[30rem] bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.82)_62%,#fff_100%)]"
      />
      <div aria-hidden="true" className="absolute inset-0 bg-grid opacity-35" />
      <SiteNav />

      <div className="landing-hero-copy relative z-10 mx-auto flex w-full max-w-[1500px] items-start px-6 pb-[390px] pt-[98px] lg:px-10 xl:px-12">
        <div className="max-w-[94rem]" data-reveal>
          <h1 className="text-[clamp(3.05rem,4.55vw,5.25rem)] font-medium leading-[1.02] tracking-[-0.055em] text-[#050b16]">
            <span className="block">Your company already has an AI policy.</span>
            <span className="block">Accord makes it real.</span>
          </h1>
          <p className="mt-7 max-w-2xl text-xl leading-8 text-slate-700">
            Accord turns policies into browser-side guardrails for ChatGPT and other AI tools. Employees keep moving.
            Admins get the signal they need.
          </p>

          <form action="/contact" className="mt-9 flex max-w-2xl flex-col gap-2 rounded-[1.8rem] border border-slate-300/80 bg-white p-2 shadow-sm sm:flex-row sm:rounded-full">
            <label className="sr-only" htmlFor="hero-email">
              Work email
            </label>
            <input
              id="hero-email"
              name="email"
              type="email"
              placeholder="Enter your work email"
              className="min-w-0 flex-1 rounded-full bg-transparent px-5 py-3 text-base text-accord-text outline-none placeholder:text-slate-500 sm:py-0"
            />
            <button
              type="submit"
              className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition hover:bg-accord-night focus:outline-none focus:ring-4 focus:ring-accord-primary/20 sm:w-auto"
            >
              Book a demo
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>

          <p className="mt-4 text-sm text-slate-500">Privacy-first by default. No raw prompt or response storage.</p>
        </div>
      </div>
    </section>
  );
}

function SiteNav() {
  return (
    <nav className="relative z-20 mx-auto w-full max-w-[1500px] px-6 py-5 lg:px-10 xl:px-12" aria-label="Primary navigation">
      <div className="flex items-center justify-between gap-4 rounded-[1.45rem] border border-white/55 bg-white/56 px-3 py-3 shadow-[0_14px_48px_rgba(69,57,131,0.1)] ring-1 ring-white/30 backdrop-blur-xl sm:px-4">
        <Link href="/" aria-label="Accord home" className="shrink-0 rounded-2xl">
          <AccordLogo lockup framed compact />
        </Link>

        <div className="hidden items-center gap-8 text-sm font-semibold text-slate-700 md:flex">
          <a href="#product" className="transition hover:text-black">
            Product
          </a>
          <a href="#policy" className="transition hover:text-black">
            Policies
          </a>
          <a href="#privacy" className="transition hover:text-black">
            Privacy
          </a>
          <a href="#faq" className="transition hover:text-black">
            FAQ
          </a>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <Link
            href="/dashboard"
            className="hidden rounded-full border border-slate-300/80 bg-white/76 px-5 py-2.5 text-sm font-semibold text-accord-text shadow-sm backdrop-blur-md transition hover:bg-white md:inline-flex"
          >
            Open dashboard
          </Link>
          <Link
            href="/contact"
            className="rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-accord-night"
          >
            Contact
          </Link>
        </div>
      </div>
    </nav>
  );
}

function AudienceStrip() {
  return (
    <section className="border-b border-black/5 bg-white px-6 pb-14 pt-20 md:pb-16 md:pt-24">
      <div className="mx-auto max-w-[1500px]">
        <p className="text-center text-xl font-medium text-black">Built for teams handling sensitive data</p>
        <div className="audience-wheel mt-9" aria-label="Teams Accord is built for">
          <div className="audience-wheel-stage">
          {audienceLabels.map((label) => (
              <span key={label} className="audience-wheel-item">
                {label}
              </span>
          ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ProductSection() {
  return (
    <section id="product" className="rounded-t-[3.5rem] bg-[#020c0d] px-6 py-20 text-white md:py-28">
      <div className="mx-auto max-w-[1500px]">
        <div className="max-w-4xl" data-reveal>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accord-violet">Product</p>
          <h2 className="mt-5 text-[clamp(2.8rem,5vw,5.4rem)] font-medium leading-[1.02] tracking-[-0.055em]">
            Policy enforcement for the places work actually happens.
          </h2>
        </div>

        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          {productCards.map((card) => {
            const Icon = card.icon;
            return (
              <article key={card.title} className="scroll-card rounded-[1.7rem] bg-white/[0.075] p-8 ring-1 ring-white/10" data-reveal>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-accord-violet">
                  <Icon className="h-7 w-7" aria-hidden="true" />
                </div>
                <h3 className="mt-16 text-2xl font-medium tracking-[-0.03em]">{card.title}</h3>
                <p className="mt-4 text-lg leading-7 text-slate-300">{card.body}</p>
              </article>
            );
          })}
        </div>

        <div className="mt-16 rounded-[2rem] bg-white/[0.055] p-7 ring-1 ring-white/10" data-reveal>
          <div className="grid gap-4 md:grid-cols-4">
            {platformStats.map(([value, label]) => (
              <div key={value} className="rounded-3xl bg-black/[0.18] p-6 ring-1 ring-white/10">
                <p className="text-2xl font-medium tracking-[-0.04em]">{value}</p>
                <p className="mt-3 text-sm leading-6 text-slate-300">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function PolicySection() {
  return (
    <section id="policy" className="bg-[#f3f2ee] px-6 py-20 md:py-28">
      <div className="mx-auto grid max-w-[1500px] gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        <div data-reveal>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accord-primary">Policy authoring</p>
          <h2 className="mt-5 text-[clamp(2.6rem,4.7vw,5rem)] font-medium leading-[1.02] tracking-[-0.055em] text-black">
            Bring your policy. Ship real rules.
          </h2>
          <p className="mt-6 max-w-2xl text-xl leading-8 text-slate-700">
            Upload a policy document, review extracted rules, and publish a bundle your extension can enforce. No
            guessing. No giant policy PDF sitting unused.
          </p>
        </div>

        <div className="rounded-[2rem] border border-black/10 bg-white p-4 shadow-[0_22px_70px_rgba(7,18,37,0.08)]" data-reveal>
          <div className="rounded-[1.45rem] bg-[#f8f8f5] p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-accord-primary shadow-sm">
                  <UploadCloud className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-semibold text-black">External AI Usage Policy.pdf</p>
                  <p className="text-sm text-slate-500">Parsed into draft rules</p>
                </div>
              </div>
              <span className="rounded-full bg-black px-3 py-1 text-xs font-semibold text-white">Ready</span>
            </div>

            <div className="mt-8 grid gap-4">
              {flowSteps.map(([title, body], index) => (
                <div key={title} className="grid grid-cols-[3rem_1fr] gap-4 rounded-2xl bg-white p-5 ring-1 ring-black/5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f0edff] text-sm font-semibold text-accord-primary">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-lg font-semibold text-black">{title}</p>
                    <p className="mt-1 text-base leading-7 text-slate-600">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PrivacySection() {
  return (
    <section id="privacy" className="bg-[#f3f2ee] px-6 pb-20 md:pb-28">
      <div className="mx-auto max-w-[1500px] border-t border-black/10 pt-20">
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:items-end">
          <div data-reveal>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accord-primary">Privacy</p>
            <h2 className="mt-5 text-[clamp(2.4rem,4.3vw,4.7rem)] font-medium leading-[1.03] tracking-[-0.055em] text-black">
              Governance without conversation surveillance.
            </h2>
          </div>
          <p className="text-xl leading-8 text-slate-700" data-reveal>
            Accord records the facts a governance team needs: rule, action, risk level, destination, and time. Raw
            employee conversations stay out of the dashboard by default.
          </p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {[
            ["Local redaction", "Protected values are replaced before submission."],
            ["Redacted previews", "Teams can review outcomes without reading full conversations."],
            ["Bundle history", "Every published ruleset is versioned."],
            ["Audit trail", "Policy events are tracked for reporting."]
          ].map(([title, body]) => (
            <article key={title} className="scroll-card rounded-[1.7rem] bg-white p-7 ring-1 ring-black/[0.07]" data-reveal>
              <Check className="h-6 w-6 text-accord-primary" aria-hidden="true" />
              <h3 className="mt-8 text-2xl font-medium tracking-[-0.03em] text-black">{title}</h3>
              <p className="mt-3 text-lg leading-7 text-slate-600">{body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQSection() {
  return (
    <section id="faq" className="rounded-t-[3.5rem] bg-[#020c0d] px-6 py-20 text-white md:py-28">
      <div className="mx-auto max-w-[1500px]">
        <h2 className="text-[clamp(2.8rem,5vw,5.5rem)] font-medium leading-none tracking-[-0.055em]" data-reveal>
          Frequently asked questions
        </h2>
        <div className="mt-14 divide-y divide-white/[0.18]">
          {faqs.map((faq, index) => (
            <details key={faq.question} className="group py-7" data-reveal open={index === 0}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-8 text-2xl font-medium tracking-[-0.03em] marker:hidden">
                {faq.question}
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-black transition group-open:rotate-180">
                  <ChevronDown className="h-5 w-5" aria-hidden="true" />
                </span>
              </summary>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="bg-[#f3f2ee] px-6 py-20 text-center md:py-28">
      <div className="mx-auto max-w-4xl" data-reveal>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-black/10">
          <MessageSquareText className="h-7 w-7 text-accord-primary" aria-hidden="true" />
        </div>
        <h2 className="mt-8 text-[clamp(2.4rem,4.5vw,5rem)] font-medium leading-[1.02] tracking-[-0.055em] text-black">
          Ready to make AI governance usable?
        </h2>
        <form action="/contact" className="mx-auto mt-9 flex max-w-xl flex-col gap-2 rounded-[1.8rem] border border-slate-300/80 bg-white p-2 shadow-sm sm:flex-row sm:rounded-full">
          <label className="sr-only" htmlFor="cta-email">
            Work email
          </label>
          <input
            id="cta-email"
            name="email"
            type="email"
            placeholder="Enter your work email"
            className="min-w-0 flex-1 rounded-full bg-transparent px-5 py-3 text-base text-accord-text outline-none placeholder:text-slate-500 sm:py-0"
          />
          <button type="submit" className="w-full rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition hover:bg-accord-night sm:w-auto">
            Book a demo
          </button>
        </form>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="bg-black px-6 py-10 text-white">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-8 md:flex-row md:items-center md:justify-between">
        <div className="rounded-2xl bg-white p-1.5">
          <AccordLogo lockup compact />
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-slate-300">
          <a href="#product" className="transition hover:text-white">
            Product
          </a>
          <a href="#policy" className="transition hover:text-white">
            Policies
          </a>
          <a href="#privacy" className="transition hover:text-white">
            Privacy
          </a>
          <Link href="/contact" className="transition hover:text-white">
            Contact
          </Link>
        </div>
        <p className="text-sm text-slate-400">Copyright 2026 Accord.</p>
      </div>
    </footer>
  );
}
