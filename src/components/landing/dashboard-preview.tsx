import { RiskBadge } from "@/components/ui/risk-badge";
import type { RiskLevel } from "@/lib/mock-data";

const kpis: Array<[string, string]> = [
  ["AI requests", "1,284"],
  ["Active users", "63"],
  ["Policy events", "112"],
  ["Blocked", "9"]
];

const statusRows: Array<[string, string]> = [
  ["Supabase", "Connected"],
  ["Extension telemetry", "Receiving events"],
  ["Raw content storage", "Disabled"]
];

const riskLegend: Array<[string, string, string]> = [
  ["Low", "#C8C2FF", "61 · 55%"],
  ["Medium", "#8B7CFF", "22 · 20%"],
  ["High", "#625BFF", "17 · 15%"],
  ["Critical", "#271A6F", "12 · 10%"]
];

const providerBars: Array<[string, string]> = [
  ["ChatGPT", "82%"],
  ["Claude", "58%"],
  ["Gemini", "30%"],
  ["Copilot", "44%"]
];

const activityRows: Array<{ time: string; dept: string; risk: RiskLevel; action: string; status: string }> = [
  { time: "10:46 PM", dept: "Chrome extension", risk: "medium", action: "Blocked before AI", status: "Blocked" },
  { time: "10:44 PM", dept: "Accord Chat", risk: "low", action: "Allowed and logged", status: "Resolved" },
  { time: "9:31 PM", dept: "Chrome extension", risk: "critical", action: "Redacted and sent", status: "Logged" }
];

export function DashboardPreview() {
  return (
    <div
      role="img"
      aria-label="Preview of the Accord governance dashboard showing usage metrics, guarded traffic, system status, and recent governed activity"
      className="select-none overflow-hidden rounded-lg border border-accord-border bg-accord-panel text-left"
    >
      {/* Mini top bar */}
      <div className="flex items-center justify-between border-b border-accord-border px-4 py-2.5">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-slate-400">Northstar Financial / Overview</p>
        <div className="flex items-center gap-3">
          <MiniStatus label="Supabase live" />
          <MiniStatus label="Extension live" />
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 divide-x divide-accord-border border-b border-accord-border">
        {kpis.map(([label, value]) => (
          <div key={label} className="px-4 py-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.06em] text-accord-muted">{label}</p>
            <p className="mt-1 text-lg font-semibold leading-none tracking-[-0.02em] text-accord-text [font-variant-numeric:tabular-nums]">
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Chart + status */}
      <div className="grid gap-0 border-b border-accord-border md:grid-cols-[1.5fr_1fr] md:divide-x md:divide-accord-border">
        <div className="px-4 py-3">
          <p className="text-xs font-semibold text-accord-text">Guarded traffic</p>
          <TrafficSpark />
        </div>
        <div className="px-4 py-3">
          <p className="text-xs font-semibold text-accord-text">System status</p>
          <div className="mt-1 divide-y divide-accord-border/60">
            {statusRows.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 py-1.5">
                <span className="text-[11px] text-accord-muted">{label}</span>
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-accord-text">
                  <span className="h-1 w-1 rounded-full bg-emerald-500" />
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Risk breakdown + provider usage */}
      <div className="grid gap-0 border-b border-accord-border md:grid-cols-2 md:divide-x md:divide-accord-border">
        <div className="px-4 py-3">
          <p className="text-xs font-semibold text-accord-text">Risk breakdown</p>
          <div className="mt-2 flex items-center gap-4">
            <RiskDonut />
            <div className="min-w-0 flex-1 divide-y divide-accord-border/60">
              {riskLegend.map(([label, color, value]) => (
                <div key={label} className="flex items-center justify-between gap-2 py-1">
                  <span className="flex items-center gap-1.5 text-[10px] text-accord-muted">
                    <span className="h-1.5 w-1.5 rounded-sm" style={{ backgroundColor: color }} />
                    {label}
                  </span>
                  <span className="text-[10px] font-medium text-accord-text [font-variant-numeric:tabular-nums]">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="px-4 py-3">
          <p className="text-xs font-semibold text-accord-text">Provider usage</p>
          <div className="mt-3 grid grid-cols-4 gap-5 px-1">
            {providerBars.map(([label, height]) => (
              <div key={label} className="flex min-w-0 flex-col items-center gap-1.5">
                <div className="flex h-16 w-full items-end justify-center border-b border-accord-border/60">
                  <div className="w-full max-w-[2.25rem] rounded-t-sm bg-accord-primary" style={{ height }} />
                </div>
                <span className="truncate text-[9px] text-accord-muted">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Activity table */}
      <div className="px-4 py-3">
        <p className="text-xs font-semibold text-accord-text">Recent governed activity</p>
        <table className="mt-2 w-full text-left text-[11px]">
          <thead className="text-[9px] uppercase tracking-[0.06em] text-accord-muted">
            <tr>
              <th className="py-1 pr-3 font-medium">Time</th>
              <th className="py-1 pr-3 font-medium">Source</th>
              <th className="py-1 pr-3 font-medium">Risk</th>
              <th className="hidden py-1 pr-3 font-medium sm:table-cell">Action</th>
              <th className="py-1 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-accord-border/60">
            {activityRows.map((row) => (
              <tr key={row.time}>
                <td className="py-1.5 pr-3 font-mono text-[10px] text-accord-muted [font-variant-numeric:tabular-nums]">{row.time}</td>
                <td className="py-1.5 pr-3 font-medium text-accord-text">{row.dept}</td>
                <td className="py-1.5 pr-3">
                  <RiskBadge level={row.risk} />
                </td>
                <td className="hidden py-1.5 pr-3 text-accord-muted sm:table-cell">{row.action}</td>
                <td className="py-1.5 text-accord-muted">{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MiniStatus({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-accord-muted">
      <span className="h-1 w-1 rounded-full bg-emerald-500" />
      {label}
    </span>
  );
}

function RiskDonut() {
  // circumference of r=30 circle
  const c = 2 * Math.PI * 30;
  const segments: Array<[string, number]> = [
    ["#C8C2FF", 0.55],
    ["#8B7CFF", 0.2],
    ["#625BFF", 0.15],
    ["#271A6F", 0.1]
  ];
  let offset = 0;
  return (
    <div className="relative h-[5.25rem] w-[5.25rem] shrink-0">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90" aria-hidden="true">
        {segments.map(([color, fraction]) => {
          const dash = fraction * c;
          const el = (
            <circle
              key={color}
              cx="40"
              cy="40"
              r="30"
              fill="none"
              stroke={color}
              strokeWidth="11"
              strokeDasharray={`${dash - 1.5} ${c - dash + 1.5}`}
              strokeDashoffset={-offset}
            />
          );
          offset += dash;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-semibold leading-none text-accord-text [font-variant-numeric:tabular-nums]">112</span>
        <span className="mt-0.5 text-[8px] uppercase tracking-[0.06em] text-accord-muted">events</span>
      </div>
    </div>
  );
}

function TrafficSpark() {
  return (
    <svg viewBox="0 0 560 120" className="mt-2 h-24 w-full" preserveAspectRatio="none" aria-hidden="true">
      {[24, 56, 88].map((y) => (
        <line key={y} x1="0" x2="560" y1={y} y2={y} stroke="rgba(148,163,184,0.22)" strokeWidth="1" />
      ))}
      <path
        d="M0,104 C60,96 100,64 160,58 C220,52 260,76 320,70 C380,64 420,30 480,26 C510,24 540,30 560,34 L560,120 L0,120 Z"
        fill="#625BFF"
        fillOpacity="0.07"
      />
      <path
        d="M0,104 C60,96 100,64 160,58 C220,52 260,76 320,70 C380,64 420,30 480,26 C510,24 540,30 560,34"
        fill="none"
        stroke="#625BFF"
        strokeWidth="2"
      />
      <path
        d="M0,112 C80,110 140,102 200,102 C280,102 340,94 420,92 C470,91 520,88 560,88"
        fill="none"
        stroke="#8B7CFF"
        strokeWidth="1.5"
      />
    </svg>
  );
}
