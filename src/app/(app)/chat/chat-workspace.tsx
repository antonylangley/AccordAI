"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound
} from "lucide-react";
import { cn } from "@/lib/utils";

type Message = {
  id: number;
  role: "assistant" | "user";
  content: string;
  meta?: string;
};

const modelOptions = ["GPT-4.1", "Claude Sonnet", "Gemini Pro", "Internal Model"];
const useCaseOptions = ["General", "Customer Support", "Legal Draft", "HR", "Code", "Research"];
const sensitivityOptions = ["Public", "Internal", "Confidential", "Regulated"];

const promptChips = [
  "Summarize this customer thread without retaining raw content",
  "Draft a response using approved support tone",
  "Compare two policy options for legal review",
  "Help rewrite this with all identifiers removed"
];

const initialMessages: Message[] = [
  {
    id: 1,
    role: "assistant",
    content:
      "Accord is ready. Choose a model and use case, then send a prompt. I will show policy context before anything leaves the gateway.",
    meta: "Metadata-only logging"
  }
];

function detectRisk(input: string, sensitivity: string) {
  const hasEmail = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(input);
  const hasName = /\b[A-Z][a-z]+ [A-Z][a-z]+\b/.test(input);
  const hasFinancialContext = /loan|credit|denied|approval|mortgage|account/i.test(input);
  const hasSecret = /api[_ -]?key|secret|token|password|sk-/i.test(input);
  const sensitiveMode = sensitivity === "Confidential" || sensitivity === "Regulated";

  const categories = [
    hasEmail || hasName ? "Personal data" : null,
    hasFinancialContext ? "Regulated financial context" : null,
    hasSecret ? "Secret or credential" : null,
    sensitiveMode ? `${sensitivity} workspace` : null
  ].filter(Boolean) as string[];

  const score = Math.min(96, 18 + categories.length * 22 + (hasSecret ? 18 : 0));
  const decision = hasSecret ? "Block" : score >= 70 ? "Warn" : score >= 45 ? "Log" : "Allow";

  return {
    categories: categories.length ? categories : ["No elevated category"],
    decision,
    score,
    tone: decision === "Block" ? "critical" : decision === "Warn" ? "warning" : "clear"
  };
}

function redactPrompt(input: string) {
  return input
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]")
    .replace(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, "[PERSON]")
    .replace(/(sk-|api[_ -]?key|secret|token|password)[^\s]*/gi, "[REDACTED_SECRET]");
}

function mockAssistantResponse(prompt: string, useCase: string) {
  if (/denied loan|loan application/i.test(prompt)) {
    return "Here is a redacted, compliance-safe outline: acknowledge the decision, reference the formal notice, avoid adding new reasons, and provide the approved next-step channel. I would keep customer identifiers out of the model transcript.";
  }

  if (/summarize|summary/i.test(prompt)) {
    return `Summary draft for ${useCase}: key facts, unresolved questions, policy-sensitive terms, and recommended human review points. I kept the response general because Accord is configured for metadata-first logging.`;
  }

  return `Draft response for ${useCase}: I can help structure the answer, identify risk-sensitive claims, and keep the output within the selected policy profile. No raw-content retention is required for this exchange.`;
}

export function ChatWorkspace() {
  const [model, setModel] = useState(modelOptions[0]);
  const [useCase, setUseCase] = useState(useCaseOptions[0]);
  const [sensitivity, setSensitivity] = useState("Regulated");
  const [input, setInput] = useState(
    "Can you write an email to John Smith at john.smith@email.com about his denied loan application?"
  );
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [justification, setJustification] = useState("");
  const [showJustification, setShowJustification] = useState(false);

  const risk = useMemo(() => detectRisk(input, sensitivity), [input, sensitivity]);
  const hasPolicyWarning = input.trim().length > 0 && (risk.decision === "Warn" || risk.decision === "Block");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || risk.decision === "Block") {
      return;
    }

    const nextId = Date.now();
    setMessages((current) => [
      ...current,
      {
        id: nextId,
        role: "user",
        content: trimmed,
        meta: `${model} / ${useCase} / ${sensitivity}`
      },
      {
        id: nextId + 1,
        role: "assistant",
        content: mockAssistantResponse(trimmed, useCase),
        meta: risk.decision === "Warn" ? "Sent with policy warning" : "Allowed by policy"
      }
    ]);
    setInput("");
    setJustification("");
    setShowJustification(false);
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="overflow-hidden rounded-2xl border border-accord-border bg-white/95 shadow-accord-panel">
        <div className="flex flex-col gap-3 border-b border-accord-border bg-accord-night px-5 py-4 text-white lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-accord-violet">Secure model gateway</p>
            <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em]">Chat with policy context in the loop</h2>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Raw content storage disabled
          </div>
        </div>

        <div className="grid gap-3 border-b border-accord-border bg-accord-mist/70 p-4 md:grid-cols-3">
          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-accord-muted">
            Model
            <select
              value={model}
              onChange={(event) => setModel(event.target.value)}
              className="mt-2 w-full rounded-xl border border-accord-border bg-white px-3 py-2.5 text-sm normal-case tracking-normal text-accord-text outline-none focus:border-accord-primary"
            >
              {modelOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-accord-muted">
            Use case
            <select
              value={useCase}
              onChange={(event) => setUseCase(event.target.value)}
              className="mt-2 w-full rounded-xl border border-accord-border bg-white px-3 py-2.5 text-sm normal-case tracking-normal text-accord-text outline-none focus:border-accord-primary"
            >
              {useCaseOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-accord-muted">
            Sensitivity
            <select
              value={sensitivity}
              onChange={(event) => setSensitivity(event.target.value)}
              className="mt-2 w-full rounded-xl border border-accord-border bg-white px-3 py-2.5 text-sm normal-case tracking-normal text-accord-text outline-none focus:border-accord-primary"
            >
              {sensitivityOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="h-[460px] space-y-4 overflow-y-auto bg-[linear-gradient(180deg,#fff,#fafbff)] p-5">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn("flex gap-3", message.role === "user" ? "justify-end" : "justify-start")}
            >
              {message.role === "assistant" ? (
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accord-night text-white">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                </div>
              ) : null}
              <article
                className={cn(
                  "max-w-[78%] rounded-2xl border px-4 py-3 text-sm leading-6",
                  message.role === "user"
                    ? "border-accord-primary/20 bg-[#f1f2ff] text-accord-text"
                    : "border-accord-border bg-white text-slate-700 shadow-sm"
                )}
              >
                <p>{message.content}</p>
                {message.meta ? (
                  <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.08em] text-accord-muted">
                    {message.meta}
                  </p>
                ) : null}
              </article>
              {message.role === "user" ? (
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accord-primary to-accord-blue text-white">
                  <UserRound className="h-4 w-4" aria-hidden="true" />
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="border-t border-accord-border bg-white p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {promptChips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setInput(chip)}
                className="rounded-full border border-accord-border bg-accord-mist px-3 py-1.5 text-xs font-medium text-accord-muted transition hover:border-accord-primary/40 hover:text-accord-text"
              >
                {chip}
              </button>
            ))}
          </div>

          {hasPolicyWarning ? (
            <div className="mb-3 rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-white p-4">
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-orange-950">
                    {risk.decision === "Block" ? "Policy block" : "Policy warning"}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-orange-900">
                    This prompt may contain personal data and regulated context. Remove identifiers or continue with
                    justification where policy allows.
                  </p>
                  {showJustification ? (
                    <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-orange-900">
                      Justification
                      <input
                        value={justification}
                        onChange={(event) => setJustification(event.target.value)}
                        placeholder="Business reason for this model call"
                        className="mt-2 w-full rounded-xl border border-orange-200 bg-white px-3 py-2 text-sm normal-case tracking-normal outline-none"
                      />
                    </label>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setInput(redactPrompt(input))}
                      className="rounded-xl bg-accord-night px-3 py-2 text-sm font-semibold text-white"
                    >
                      Redact automatically
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowJustification(true)}
                      className="rounded-xl border border-orange-300 bg-white px-3 py-2 text-sm font-semibold text-orange-800"
                    >
                      Continue with justification
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <label className="sr-only" htmlFor="chat-input">
            Chat prompt
          </label>
          <div className="flex gap-3 rounded-2xl border border-accord-border bg-accord-mist p-2">
            <textarea
              id="chat-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              className="min-h-24 flex-1 resize-none bg-transparent px-3 py-2 text-sm leading-6 text-accord-text outline-none placeholder:text-slate-400"
              placeholder="Ask an approved model through Accord..."
            />
            <button
              type="submit"
              disabled={!input.trim() || risk.decision === "Block"}
              className="self-end rounded-xl bg-accord-night px-4 py-2 text-sm font-semibold text-white transition hover:bg-accord-elevated disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span className="inline-flex items-center gap-2">
                Send
                <Send className="h-4 w-4" aria-hidden="true" />
              </span>
            </button>
          </div>
        </form>
      </div>

      <aside className="space-y-4 rounded-2xl border border-accord-border bg-white/95 p-5 shadow-accord-panel">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-accord-primary">Policy engine</p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.025em] text-accord-text">Live scan</h2>
        </div>
        <div className="rounded-2xl border border-[#dfe4ff] bg-[#f3f4ff] p-4">
          <div className="flex items-center gap-3">
            <Clock3 className="h-5 w-5 text-accord-primary" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-accord-text">Pre-flight scan</p>
              <p className="text-xs text-slate-600">Updates as you type</p>
            </div>
          </div>
        </div>
        <div className="grid gap-3">
          <div
            className={cn(
              "rounded-2xl border p-4",
              risk.tone === "clear" && "border-emerald-200 bg-emerald-50",
              risk.tone === "warning" && "border-orange-200 bg-orange-50",
              risk.tone === "critical" && "border-red-200 bg-red-50"
            )}
          >
            <p className="text-sm font-medium text-slate-700">Policy decision</p>
            <p
              className={cn(
                "mt-1 text-2xl font-semibold",
                risk.tone === "clear" && "text-emerald-700",
                risk.tone === "warning" && "text-orange-700",
                risk.tone === "critical" && "text-red-700"
              )}
            >
              {risk.decision}
            </p>
          </div>
          <div className="rounded-2xl border border-accord-border bg-accord-mist p-4">
            <p className="text-sm font-medium text-slate-600">Risk score</p>
            <p className="mt-1 text-2xl font-semibold text-accord-text">{risk.score} / 100</p>
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-accord-text">Detected categories</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {risk.categories.map((category) => (
              <span
                key={category}
                className="rounded-full bg-[#f1f2ff] px-3 py-1 text-xs font-semibold text-accord-primary"
              >
                {category}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-accord-border bg-accord-mist p-4">
          <div className="flex gap-3">
            <LockKeyhole className="mt-0.5 h-5 w-5 text-slate-500" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-accord-text">Logging behavior</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Metadata by default. Redacted previews only when review evidence is needed.
              </p>
            </div>
          </div>
        </div>
        <div className="space-y-2 rounded-2xl border border-accord-border bg-white p-4">
          {[
            ["Gateway route", model],
            ["Use case", useCase],
            ["Sensitivity", sensitivity]
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-accord-muted">{label}</span>
              <span className="font-medium text-accord-text">{value}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          <span>Admin review actions are audited.</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-accord-muted">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          <span>Governance without broad content retention.</span>
        </div>
      </aside>
    </section>
  );
}
