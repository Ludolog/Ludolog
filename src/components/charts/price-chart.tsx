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

import { formatDate, formatPrice } from "@/lib/format";
import type { GamePriceSnapshot } from "@/lib/types";

export function PriceChart({ data }: { data: GamePriceSnapshot[] }): React.ReactElement {
  const chartData = data.map((snapshot) => ({
    date: formatDate(snapshot.capturedAt),
    price: snapshot.price,
    low: snapshot.historicalLow
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#32D6F6" stopOpacity={0.36} />
              <stop offset="95%" stopColor="#32D6F6" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#253044" strokeDasharray="3 3" />
          <XAxis dataKey="date" stroke="#94A3B8" tick={{ fontSize: 12 }} />
          <YAxis stroke="#94A3B8" tick={{ fontSize: 12 }} tickFormatter={(value) => `${value} zĹ‚`} />
          <Tooltip
            contentStyle={{ background: "#0D1220", border: "1px solid #253044", borderRadius: 8 }}
            formatter={(value: number) => [formatPrice(value), "Cena"]}
          />
          <Area type="monotone" dataKey="price" stroke="#32D6F6" fill="url(#priceFill)" strokeWidth={2} />
          <Area type="monotone" dataKey="low" stroke="#6EE7A8" fill="transparent" strokeDasharray="4 4" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

