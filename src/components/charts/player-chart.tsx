"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { formatDate, formatNumber } from "@/lib/format";
import type { PlayerCountSnapshot } from "@/lib/types";

export function PlayerChart({ data }: { data: PlayerCountSnapshot[] }): React.ReactElement {
  const chartData = data.map((snapshot) => ({
    date: formatDate(snapshot.capturedAt),
    players: snapshot.playersOnline
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="playersFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6EE7A8" stopOpacity={0.36} />
              <stop offset="95%" stopColor="#6EE7A8" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#253044" strokeDasharray="3 3" />
          <XAxis dataKey="date" stroke="#94A3B8" tick={{ fontSize: 12 }} />
          <YAxis stroke="#94A3B8" tick={{ fontSize: 12 }} tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
          <Tooltip
            contentStyle={{ background: "#0D1220", border: "1px solid #253044", borderRadius: 8 }}
            formatter={(value: number) => [formatNumber(value), "Gracze online"]}
          />
          <Area type="monotone" dataKey="players" stroke="#6EE7A8" fill="url(#playersFill)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

