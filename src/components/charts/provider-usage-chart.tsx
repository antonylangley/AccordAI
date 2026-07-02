"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { providerUsage } from "@/lib/mock-data";

const tooltipStyle = {
  borderRadius: 10,
  border: "1px solid #E7EAF1",
  boxShadow: "0 10px 30px rgba(10,18,37,0.08)",
  fontSize: 12,
  padding: "8px 10px"
};

export function ProviderUsageChart() {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={providerUsage} margin={{ left: -10, right: 8, top: 12, bottom: 0 }} barCategoryGap="34%">
          <defs>
            <linearGradient id="providerFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#625BFF" />
              <stop offset="100%" stopColor="#4F6BFF" />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#EEF1F7" strokeDasharray="3 5" vertical={false} />
          <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#667085", fontSize: 11 }} dy={6} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: "#667085", fontSize: 11 }} width={44} />
          <Tooltip cursor={{ fill: "rgba(98,91,255,0.06)" }} contentStyle={tooltipStyle} />
          <Bar dataKey="requests" name="Requests" fill="url(#providerFill)" radius={[6, 6, 0, 0]} maxBarSize={52} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
