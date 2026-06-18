import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatNumber, formatPrice, formatShortDate } from "@/format";
import type { ApiGamePriceSnapshot, ApiPlayerCountSnapshot } from "@shared/api-types";

export function PriceChart({ data }: { data: ApiGamePriceSnapshot[] }): React.ReactElement {
  const chartData = data.map((snapshot) => ({
    date: formatShortDate(snapshot.capturedAt),
    price: snapshot.price,
    low: snapshot.historicalLow
  }));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
          <defs>
            <linearGradient id="mobilePriceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#32D6F6" stopOpacity={0.36} />
              <stop offset="95%" stopColor="#32D6F6" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#253044" strokeDasharray="3 3" />
          <XAxis dataKey="date" stroke="#94A3B8" tick={{ fontSize: 10 }} minTickGap={16} />
          <YAxis stroke="#94A3B8" tick={{ fontSize: 10 }} tickFormatter={(value) => `${value}`} />
          <Tooltip
            contentStyle={{ background: "#0D1220", border: "1px solid #253044", borderRadius: 8 }}
            formatter={(value: number) => [formatPrice(value), "Cena"]}
          />
          <Area type="monotone" dataKey="price" stroke="#32D6F6" fill="url(#mobilePriceFill)" strokeWidth={2} />
          <Area type="monotone" dataKey="low" stroke="#6EE7A8" fill="transparent" strokeDasharray="4 4" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PlayerChart({ data }: { data: ApiPlayerCountSnapshot[] }): React.ReactElement {
  const chartData = data.map((snapshot) => ({
    date: formatShortDate(snapshot.capturedAt),
    players: snapshot.playersOnline
  }));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
          <defs>
            <linearGradient id="mobilePlayersFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6EE7A8" stopOpacity={0.36} />
              <stop offset="95%" stopColor="#6EE7A8" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#253044" strokeDasharray="3 3" />
          <XAxis dataKey="date" stroke="#94A3B8" tick={{ fontSize: 10 }} minTickGap={16} />
          <YAxis stroke="#94A3B8" tick={{ fontSize: 10 }} tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
          <Tooltip
            contentStyle={{ background: "#0D1220", border: "1px solid #253044", borderRadius: 8 }}
            formatter={(value: number) => [formatNumber(value), "Gracze"]}
          />
          <Area type="monotone" dataKey="players" stroke="#6EE7A8" fill="url(#mobilePlayersFill)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
