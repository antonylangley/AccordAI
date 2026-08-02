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

  return (
    <div className="grid gap-5 md:grid-cols-[1fr_0.8fr]">
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={62}
              outerRadius={96}
              paddingAngle={4}
            >
              {data.map((item) => (
                <Cell key={item.name} fill={item.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E3E8F2", boxShadow: "0 12px 32px rgba(7,18,37,0.08)" }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-col justify-center space-y-3">
        {data.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-accord-muted">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              {item.name}
            </span>
            <span className="font-semibold text-accord-text">{item.value}%</span>
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
