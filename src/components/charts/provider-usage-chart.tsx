"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type ProviderUsageChartPoint = {
  name: string;
  requests: number;
};

export function ProviderUsageChart({ data }: { data: ProviderUsageChartPoint[] }) {
  if (!data.some((item) => item.requests > 0)) {
    return <EmptyChartState label="No live provider usage yet." />;
  }

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: -12, right: 8, top: 12, bottom: 0 }}>
          <CartesianGrid stroke="#E8EDF6" strokeDasharray="3 5" vertical={false} />
          <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 11 }} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 11 }} />
          <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E3E8F2", boxShadow: "0 12px 32px rgba(7,18,37,0.08)" }} />
          <Bar dataKey="requests" name="Requests" fill="#625BFF" radius={[7, 7, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function EmptyChartState({ label }: { label: string }) {
  return (
    <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-accord-border bg-accord-soft/60 text-sm text-accord-muted">
      {label}
    </div>
  );
}
