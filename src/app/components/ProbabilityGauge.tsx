"use client";

import {
  RadialBar,
  RadialBarChart,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";

type Props = {
  probability: number;
  riskLevel: string;
};

export default function ProbabilityGauge({ probability, riskLevel }: Props) {
  const pct = Math.round(Math.min(1, Math.max(0, probability)) * 100);
  const fill =
    riskLevel === "green" ? "#22c55e" : riskLevel === "yellow" ? "#eab308" : "#ef4444";
  const data = [{ name: "rejection", value: pct, fill }];

  return (
    <div className="w-full max-w-md mx-auto">
      <ResponsiveContainer width="100%" height={220}>
        <RadialBarChart
          innerRadius="55%"
          outerRadius="105%"
          data={data}
          startAngle={180}
          endAngle={0}
          cx="50%"
          cy="70%"
        >
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar
            background={{ fill: "rgba(148, 163, 184, 0.25)" }}
            dataKey="value"
            cornerRadius={8}
            angleAxisId={0}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="text-center -mt-16 space-y-1">
        <div className="text-4xl font-semibold tabular-nums">{pct}%</div>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Estimated rejection probability
        </div>
      </div>
    </div>
  );
}
