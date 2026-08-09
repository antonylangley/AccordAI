"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type RiskCategoryChartPoint = {
  name: string;
  events: number;
};

const tooltipStyle = {
  backgroundColor: "var(--accord-panel)",
  borderRadius: 8,
  border: "1px solid var(--accord-border)",
  boxShadow: "0 4px 12px rgba(7,18,37,0.16)",
  color: "var(--accord-text)",
  fontSize: 12
};

export function RiskCategoryBars({ data }: { data: RiskCategoryChartPoint[] }) {
  if (!data.some((item) => item.events > 0)) {
    return <EmptyChartState label="No live risk categories yet." />;
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 44, right: 18, top: 8, bottom: 0 }}>
          <CartesianGrid stroke="rgba(148, 163, 184, 0.22)" horizontal={false} />
          <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: "#94A3B8", fontSize: 11 }} allowDecimals={false} />
          <YAxis
            dataKey="name"
            type="category"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#64748B", fontSize: 11 }}
            width={110}
          />
          <Tooltip cursor={{ fill: "rgba(7,18,37,0.03)" }} contentStyle={tooltipStyle} />
          <Bar dataKey="events" name="Events" fill="#625BFF" radius={[0, 2, 2, 0]} barSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function EmptyChartState({ label }: { label: string }) {
  return <div className="flex h-64 items-center justify-center text-[13px] text-accord-muted">{label}</div>;
}
