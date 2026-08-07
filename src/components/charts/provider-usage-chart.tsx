"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type ProviderUsageChartPoint = {
  name: string;
  requests: number;
};

export function ProviderUsageChart({ data, compact = false }: { data: ProviderUsageChartPoint[]; compact?: boolean }) {
  if (!data.some((item) => item.requests > 0)) {
    return <EmptyChartState label="No live provider usage yet." compact={compact} />;
  }

  return (
    <div className={compact ? "h-60" : "h-72"}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: -18, right: 8, top: 18, bottom: 0 }}>
          <defs>
            <linearGradient id="accordProviderBars" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#625BFF" />
              <stop offset="100%" stopColor="#8B7CFF" />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#E8EDF6" strokeDasharray="4 7" vertical={false} />
          <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 12 }} dy={8} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 12 }} allowDecimals={false} />
          <Tooltip contentStyle={{ borderRadius: 16, border: "1px solid #E3E8F2", boxShadow: "0 18px 42px rgba(7,18,37,0.12)" }} />
          <Bar dataKey="requests" name="Requests" fill="url(#accordProviderBars)" radius={[10, 10, 3, 3]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function EmptyChartState({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <div className={`flex ${compact ? "h-60" : "h-72"} items-center justify-center rounded-2xl border border-dashed border-accord-border bg-accord-soft/60 text-sm text-accord-muted`}>
      {label}
    </div>
  );
}
