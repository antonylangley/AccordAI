"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type ProviderUsageChartPoint = {
  name: string;
  requests: number;
};

const tooltipStyle = {
  backgroundColor: "var(--accord-panel)",
  borderRadius: 8,
  border: "1px solid var(--accord-border)",
  boxShadow: "0 4px 12px rgba(7,18,37,0.16)",
  color: "var(--accord-text)",
  fontSize: 12
};

export function ProviderUsageChart({ data, compact = false }: { data: ProviderUsageChartPoint[]; compact?: boolean }) {
  if (!data.some((item) => item.requests > 0)) {
    return <EmptyChartState label="No live provider usage yet." compact={compact} />;
  }

  return (
    <div className={compact ? "h-52" : "h-64"}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: -22, right: 8, top: 12, bottom: 0 }}>
          <CartesianGrid stroke="rgba(148, 163, 184, 0.22)" vertical={false} />
          <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#94A3B8", fontSize: 11 }} dy={8} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: "#94A3B8", fontSize: 11 }} allowDecimals={false} />
          <Tooltip cursor={{ fill: "rgba(7,18,37,0.03)" }} contentStyle={tooltipStyle} />
          <Bar dataKey="requests" name="Requests" fill="#625BFF" radius={[2, 2, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function EmptyChartState({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <div className={`flex ${compact ? "h-52" : "h-64"} items-center justify-center text-[13px] text-accord-muted`}>
      {label}
    </div>
  );
}
