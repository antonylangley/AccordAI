"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { riskDistribution } from "@/lib/mock-data";

const tooltipStyle = {
  borderRadius: 10,
  border: "1px solid #E7EAF1",
  boxShadow: "0 10px 30px rgba(10,18,37,0.08)",
  fontSize: 12,
  padding: "8px 10px"
};

export function RiskDistributionChart() {
  return (
    <div className="grid gap-5 md:grid-cols-[1fr_0.85fr]">
      <div className="relative h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={riskDistribution}
              dataKey="value"
              nameKey="name"
              innerRadius={64}
              outerRadius={94}
              paddingAngle={3}
              stroke="none"
            >
              {riskDistribution.map((item) => (
                <Cell key={item.name} fill={item.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="tnum text-2xl font-semibold tracking-[-0.02em] text-accord-text">91%</span>
          <span className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-accord-muted">
            Low / Medium
          </span>
        </div>
      </div>
      <div className="flex flex-col justify-center gap-2.5">
        {riskDistribution.map((item) => (
          <div
            key={item.name}
            className="flex items-center justify-between gap-3 rounded-lg border border-accord-hairline bg-accord-mist/40 px-3 py-2 text-sm"
          >
            <span className="flex items-center gap-2 text-accord-muted">
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: item.color }} />
              {item.name}
            </span>
            <span className="tnum font-semibold text-accord-text">{item.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
