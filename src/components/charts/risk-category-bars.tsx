"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { riskCategories } from "@/lib/mock-data";

const tooltipStyle = {
  borderRadius: 10,
  border: "1px solid #E7EAF1",
  boxShadow: "0 10px 30px rgba(10,18,37,0.08)",
  fontSize: 12,
  padding: "8px 10px"
};

export function RiskCategoryBars() {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={riskCategories}
          layout="vertical"
          margin={{ left: 78, right: 16, top: 4, bottom: 0 }}
          barCategoryGap="30%"
        >
          <defs>
            <linearGradient id="categoryFill" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#4F6BFF" />
              <stop offset="100%" stopColor="#8B7CFF" />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#EEF1F7" strokeDasharray="3 5" horizontal={false} />
          <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: "#667085", fontSize: 11 }} />
          <YAxis
            dataKey="name"
            type="category"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#667085", fontSize: 11 }}
            width={110}
          />
          <Tooltip cursor={{ fill: "rgba(98,91,255,0.06)" }} contentStyle={tooltipStyle} />
          <Bar dataKey="events" name="Events" fill="url(#categoryFill)" radius={[0, 6, 6, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
