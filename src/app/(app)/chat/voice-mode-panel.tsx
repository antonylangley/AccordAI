"use client";

import { Mic, X } from "lucide-react";
import type { VoiceState } from "./types";

type VoiceModePanelProps = {
  state: VoiceState;
  onStateChange: (state: VoiceState) => void;
  onClose: () => void;
};

export function VoiceModePanel({ state, onStateChange, onClose }: VoiceModePanelProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-accord-night/45 p-4 backdrop-blur-sm">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-accord-night p-6 text-white shadow-accord-glow">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-accord-violet">Voice mode</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">Voice mode is a prototype.</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-white/10 p-2 text-slate-300">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mx-auto my-8 flex h-36 w-36 items-center justify-center rounded-full border border-accord-violet/30 bg-white/[0.055]">
          <div className="flex h-24 w-24 animate-pulse items-center justify-center rounded-full bg-gradient-to-br from-accord-primary to-accord-blue shadow-accord-glow">
            <Mic className="h-9 w-9" aria-hidden="true" />
          </div>
        </div>

        <p className="text-sm leading-6 text-slate-300">
          Audio would be transcribed before policy scanning. Voice transcripts follow the same metadata and redaction
          policy.
        </p>

        <div className="mt-5 grid grid-cols-3 gap-2">
          {(["idle", "listening", "processing"] as VoiceState[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onStateChange(item)}
              className={`rounded-xl border px-3 py-2 text-sm capitalize ${
                state === item
                  ? "border-accord-violet bg-accord-violet/20 text-white"
                  : "border-white/10 bg-white/[0.04] text-slate-300"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
