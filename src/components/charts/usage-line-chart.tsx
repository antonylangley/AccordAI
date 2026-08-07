"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
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
        <AreaChart data={data} margin={{ left: -18, right: 8, top: 18, bottom: 0 }}>
          <defs>
            <linearGradient id="accordRequests" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#625BFF" stopOpacity={0.22} />
              <stop offset="72%" stopColor="#625BFF" stopOpacity={0.035} />
              <stop offset="100%" stopColor="#625BFF" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#E8EDF6" strokeDasharray="4 7" vertical={false} />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 12 }} dy={8} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 12 }} allowDecimals={false} />
          <Tooltip
            cursor={{ stroke: "#625BFF", strokeDasharray: "4 6", strokeOpacity: 0.35 }}
            contentStyle={{
              borderRadius: 16,
              border: "1px solid #E3E8F2",
              boxShadow: "0 18px 42px rgba(7,18,37,0.12)",
              color: "#071225"
            }}
          />
          <Area type="monotone" dataKey="requests" fill="url(#accordRequests)" stroke="none" />
          <Line
            type="monotone"
            dataKey="requests"
            name="Requests"
            stroke="#625BFF"
            strokeWidth={3.5}
            dot={false}
            activeDot={{ r: 5, stroke: "#FFFFFF", strokeWidth: 2, fill: "#625BFF" }}
          />
          <Line
            type="monotone"
            dataKey="flagged"
            name="Flagged"
            stroke="#07101D"
            strokeWidth={2.4}
            dot={false}
            activeDot={{ r: 4, stroke: "#FFFFFF", strokeWidth: 2, fill: "#07101D" }}
          />
        </AreaChart>
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
