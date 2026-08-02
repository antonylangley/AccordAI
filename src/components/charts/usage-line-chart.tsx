"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

export type UsageLineChartPoint = {
  day: string;
  requests: number;
  flagged: number;
};

export function UsageLineChart({ data }: { data: UsageLineChartPoint[] }) {
  if (!data.some((item) => item.requests > 0 || item.flagged > 0)) {
    return <EmptyChartState label="No live usage events yet." />;
  }

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: -16, right: 10, top: 10, bottom: 0 }}>
          <CartesianGrid stroke="#E8EDF6" strokeDasharray="3 5" vertical={false} />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 11 }} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 11 }} />
          <Tooltip
            cursor={{ stroke: "#CBD5E1", strokeDasharray: "3 5" }}
            contentStyle={{ borderRadius: 12, border: "1px solid #E3E8F2", boxShadow: "0 12px 32px rgba(7,18,37,0.08)" }}
          />
          <Line
            type="monotone"
            dataKey="requests"
            name="Requests"
            stroke="#4F6BFF"
            strokeWidth={3}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="flagged"
            name="Flagged"
            stroke="#F97316"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
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
