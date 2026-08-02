"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Mail } from "lucide-react";

const recipientEmail = "antony.s.langley@gmail.com";

export function ContactForm() {
  const [status, setStatus] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const company = String(formData.get("company") ?? "").trim();
    const role = String(formData.get("role") ?? "").trim();
    const message = String(formData.get("message") ?? "").trim();

    const subjectContext = company || name || "Accord";
    const subject = `Accord demo request - ${subjectContext}`;
    const body = [
      "New Accord demo request",
      "",
      name ? `Name: ${name}` : "",
      email ? `Email: ${email}` : "",
      company ? `Company: ${company}` : "",
      role ? `Role: ${role}` : "",
      "",
      "Message:",
      message || "I'd like to learn more about Accord."
    ]
      .filter(Boolean)
      .join("\n");

    window.location.href = `mailto:${recipientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setStatus(`Opening your email app with ${recipientEmail} as the recipient.`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[2rem] border border-accord-border bg-white/92 p-5 shadow-accord-panel backdrop-blur md:p-7"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f1f2ff] text-accord-primary">
          <Mail className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-accord-primary">
            Contact Accord
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-accord-text">Book a demo</h2>
        </div>
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-semibold text-accord-text">
          Name
          <input
            required
            name="name"
            type="text"
            autoComplete="name"
            className="w-full rounded-xl border border-accord-border bg-[#fbfcff] px-4 py-3 text-sm font-medium text-accord-text outline-none transition placeholder:text-accord-muted/60 focus:border-accord-primary/50 focus:bg-white focus:ring-4 focus:ring-accord-primary/10"
            placeholder="Your name"
          />
        </label>
        <label className="space-y-2 text-sm font-semibold text-accord-text">
          Work email
          <input
            required
            name="email"
            type="email"
            autoComplete="email"
            className="w-full rounded-xl border border-accord-border bg-[#fbfcff] px-4 py-3 text-sm font-medium text-accord-text outline-none transition placeholder:text-accord-muted/60 focus:border-accord-primary/50 focus:bg-white focus:ring-4 focus:ring-accord-primary/10"
            placeholder="you@company.com"
          />
        </label>
        <label className="space-y-2 text-sm font-semibold text-accord-text">
          Company
          <input
            name="company"
            type="text"
            autoComplete="organization"
            className="w-full rounded-xl border border-accord-border bg-[#fbfcff] px-4 py-3 text-sm font-medium text-accord-text outline-none transition placeholder:text-accord-muted/60 focus:border-accord-primary/50 focus:bg-white focus:ring-4 focus:ring-accord-primary/10"
            placeholder="Company name"
          />
        </label>
        <label className="space-y-2 text-sm font-semibold text-accord-text">
          Role
          <input
            name="role"
            type="text"
            autoComplete="organization-title"
            className="w-full rounded-xl border border-accord-border bg-[#fbfcff] px-4 py-3 text-sm font-medium text-accord-text outline-none transition placeholder:text-accord-muted/60 focus:border-accord-primary/50 focus:bg-white focus:ring-4 focus:ring-accord-primary/10"
            placeholder="Compliance, security, product..."
          />
        </label>
      </div>

      <label className="mt-4 block space-y-2 text-sm font-semibold text-accord-text">
        What do you want to see?
        <textarea
          name="message"
          rows={6}
          className="w-full resize-none rounded-xl border border-accord-border bg-[#fbfcff] px-4 py-3 text-sm font-medium leading-6 text-accord-text outline-none transition placeholder:text-accord-muted/60 focus:border-accord-primary/50 focus:bg-white focus:ring-4 focus:ring-accord-primary/10"
          placeholder="Tell me about your AI governance workflow, extension rollout, or compliance use case."
        />
      </label>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-accord-muted">
          Sends to <span className="font-semibold text-accord-text">{recipientEmail}</span>.
        </p>
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-accord-night px-5 py-3 text-sm font-semibold text-white shadow-accord-soft transition hover:bg-accord-elevated"
        >
          Send request
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {status ? <p className="mt-4 rounded-xl bg-[#f1f2ff] px-4 py-3 text-sm font-medium text-accord-primary">{status}</p> : null}
    </form>
  );
}
