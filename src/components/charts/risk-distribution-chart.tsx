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
    <div className="grid items-center gap-2 sm:grid-cols-[minmax(190px,1fr)_150px]">
      <div className="relative h-72 min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="name"
              innerRadius={64}
              outerRadius={94}
              paddingAngle={2.5}
              stroke="none"
            >
              {data.map((item) => (
                <Cell key={item.name} fill={palette[item.name] || item.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--accord-panel)",
                borderRadius: 8,
                border: "1px solid var(--accord-border)",
                boxShadow: "0 4px 12px rgba(7,18,37,0.16)",
                color: "var(--accord-text)",
                fontSize: 12
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-2xl font-semibold tracking-[-0.02em] text-accord-text [font-variant-numeric:tabular-nums]">{total}</p>
            <p className="mt-0.5 text-[11px] uppercase tracking-[0.06em] text-accord-muted">events</p>
          </div>
        </div>
      </div>
      <div className="flex flex-col justify-center divide-y divide-accord-border/60">
        {data.map((item) => (
          <div key={item.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-2 text-[13px]">
            <span className="flex items-center gap-2 text-accord-muted">
              <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: palette[item.name] || item.color }} />
              {item.name}
            </span>
            <span className="font-medium text-accord-text [font-variant-numeric:tabular-nums]">
              {item.count.toLocaleString("en-US")} · {item.value}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyChartState({ label }: { label: string }) {
  return <div className="flex h-72 items-center justify-center text-[13px] text-accord-muted">{label}</div>;
}
