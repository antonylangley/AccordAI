"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
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

const tooltipStyle = {
  backgroundColor: "var(--accord-panel)",
  borderRadius: 8,
  border: "1px solid var(--accord-border)",
  boxShadow: "0 4px 12px rgba(7,18,37,0.16)",
  color: "var(--accord-text)",
  fontSize: 12
};

export function UsageLineChart({ data }: { data: UsageLineChartPoint[] }) {
  if (!data.some((item) => item.requests > 0 || item.flagged > 0)) {
    return <EmptyChartState label="No live usage events yet." />;
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: -12, right: 12, top: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="guardedTrafficFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#625BFF" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#625BFF" stopOpacity={0.015} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(148, 163, 184, 0.22)" vertical={false} />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "#94A3B8", fontSize: 11 }} dy={8} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: "#94A3B8", fontSize: 11 }} allowDecimals={false} />
          <Tooltip cursor={{ stroke: "#CBD5E1", strokeWidth: 1 }} contentStyle={tooltipStyle} />
          <Legend
            align="right"
            verticalAlign="top"
            iconType="circle"
            iconSize={7}
            wrapperStyle={{ color: "#64748B", fontSize: 11, paddingBottom: 8 }}
          />
          <Area
            type="monotone"
            dataKey="requests"
            name="Requests"
            fill="url(#guardedTrafficFill)"
            stroke="none"
            legendType="none"
          />
          <Line
            type="monotone"
            dataKey="requests"
            name="Requests"
            stroke="#625BFF"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5, fill: "#625BFF" }}
          />
          <Line
            type="monotone"
            dataKey="flagged"
            name="Flagged"
            stroke="#8B7CFF"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, stroke: "#FFFFFF", strokeWidth: 1.5, fill: "#8B7CFF" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function EmptyChartState({ label }: { label: string }) {
  return <div className="flex h-64 items-center justify-center text-[13px] text-accord-muted">{label}</div>;
}
