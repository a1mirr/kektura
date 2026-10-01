"use client";

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// `month` is an already localized label; `seriesName` is what the tooltip calls the count.
export default function StampsChart({
  data,
  seriesName,
}: {
  data: { month: string; count: number }[];
  seriesName: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data}>
        <XAxis dataKey="month" fontSize={12} />
        <YAxis allowDecimals={false} fontSize={12} width={24} />
        <Tooltip />
        <Bar dataKey="count" name={seriesName} fill="#2563eb" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
