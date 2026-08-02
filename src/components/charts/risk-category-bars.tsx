"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type RiskCategoryChartPoint = {
  name: string;
  events: number;
};

export function RiskCategoryBars({ data }: { data: RiskCategoryChartPoint[] }) {
  if (!data.some((item) => item.events > 0)) {
    return <EmptyChartState label="No live risk categories yet." />;
  }

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ left: 78, right: 16, top: 8, bottom: 0 }}
        >
          <CartesianGrid stroke="#E8EDF6" strokeDasharray="3 5" horizontal={false} />
          <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 11 }} />
          <YAxis
            dataKey="name"
            type="category"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#64748B", fontSize: 11 }}
            width={110}
          />
          <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E3E8F2", boxShadow: "0 12px 32px rgba(7,18,37,0.08)" }} />
          <Bar dataKey="events" name="Events" fill="#4F6BFF" radius={[0, 7, 7, 0]} />
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
