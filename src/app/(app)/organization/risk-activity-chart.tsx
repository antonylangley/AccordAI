"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { OrganizationTrendPoint } from "@/lib/organization/types";

export function RiskActivityChart({ data }: { data: OrganizationTrendPoint[] }) {
  const tickEvery = Math.max(1, Math.ceil(data.length / 7));
  return (
    <div className="h-[220px] w-full" aria-label="Governed AI activity over time">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--accord-border, #e2e8f0)" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            interval={tickEvery - 1}
            tick={{ fill: "#64748b", fontSize: 10 }}
            minTickGap={20}
          />
          <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 10 }} />
          <Tooltip
            cursor={{ stroke: "#94a3b8", strokeDasharray: "3 3" }}
            contentStyle={{ border: "1px solid #dbe2ea", borderRadius: 6, boxShadow: "0 8px 24px rgba(15,23,42,.08)", fontSize: 12 }}
          />
          <Line type="monotone" dataKey="total" name="Governed events" stroke="#64748b" strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
          <Line type="monotone" dataKey="enforced" name="Enforced" stroke="#6d5dfc" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
