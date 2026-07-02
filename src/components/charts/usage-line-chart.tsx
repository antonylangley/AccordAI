"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { usageOverTime } from "@/lib/mock-data";

const tooltipStyle = {
  borderRadius: 10,
  border: "1px solid #E7EAF1",
  boxShadow: "0 10px 30px rgba(10,18,37,0.08)",
  fontSize: 12,
  padding: "8px 10px"
};

export function UsageLineChart() {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={usageOverTime} margin={{ left: -14, right: 8, top: 10, bottom: 0 }}>
          <defs>
            <linearGradient id="usageFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4F6BFF" stopOpacity={0.16} />
              <stop offset="100%" stopColor="#4F6BFF" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#EEF1F7" strokeDasharray="3 5" vertical={false} />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#667085", fontSize: 11 }}
            dy={6}
          />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: "#667085", fontSize: 11 }} width={44} />
          <Tooltip
            cursor={{ stroke: "#CBD5E1", strokeDasharray: "3 5" }}
            contentStyle={tooltipStyle}
          />
          <Area
            type="monotone"
            dataKey="requests"
            name="Requests"
            stroke="#4F6BFF"
            strokeWidth={2.5}
            fill="url(#usageFill)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
          <Line
            type="monotone"
            dataKey="flagged"
            name="Flagged"
            stroke="#F97316"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
