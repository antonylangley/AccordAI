"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export type RiskDistributionChartPoint = {
  name: string;
  value: number;
  count: number;
  color: string;
};

export function RiskDistributionChart({ data }: { data: RiskDistributionChartPoint[] }) {
  if (!data.some((item) => item.count > 0)) {
    return <EmptyChartState label="No live risk outcomes yet." />;
  }

  const total = data.reduce((sum, item) => sum + item.count, 0);
  const palette: Record<string, string> = {
    Low: "#C8C2FF",
    Medium: "#8B7CFF",
    High: "#625BFF",
    Critical: "#271A6F"
  };

  return (
    <div className="grid gap-5 md:grid-cols-[1fr_0.9fr]">
      <div className="relative h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="name"
              innerRadius={72}
              outerRadius={104}
              paddingAngle={3}
              stroke="#FFFFFF"
              strokeWidth={4}
            >
              {data.map((item) => (
                <Cell key={item.name} fill={palette[item.name] || item.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: 16, border: "1px solid #E3E8F2", boxShadow: "0 18px 42px rgba(7,18,37,0.12)" }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-3xl font-semibold tracking-[-0.04em] text-[#271A6F]">{total}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-accord-muted">events</p>
          </div>
        </div>
      </div>
      <div className="flex flex-col justify-center space-y-2.5">
        {data.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-3 rounded-2xl border border-accord-border bg-gradient-to-r from-white to-[#f4f2ff] px-3.5 py-3 text-sm">
            <span className="flex items-center gap-2 text-accord-muted">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: palette[item.name] || item.color }} />
              {item.name}
            </span>
            <span className="font-semibold text-accord-text">{item.count.toLocaleString("en-US")} / {item.value}%</span>
          </div>
        ))}
      </div>
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
