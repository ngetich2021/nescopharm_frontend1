"use client"

import { useState, useEffect } from "react"
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Line, ComposedChart } from "recharts"

const data = [
  { name: "Jan", revenue: 18500, orders: 120 },
  { name: "Feb", revenue: 22300, orders: 132 },
  { name: "Mar", revenue: 30200, orders: 145 },
  { name: "Apr", revenue: 27800, orders: 138 },
  { name: "May", revenue: 32900, orders: 160 },
  { name: "Jun", revenue: 38600, orders: 182 },
  { name: "Jul", revenue: 42100, orders: 201 },
  { name: "Aug", revenue: 45300, orders: 210 },
  { name: "Sep", revenue: 48200, orders: 232 },
  { name: "Oct", revenue: 51800, orders: 250 },
  { name: "Nov", revenue: 58900, orders: 280 },
  { name: "Dec", revenue: 68400, orders: 310 },
]

interface SalesOverviewProps {
  isLoading: boolean
}

export function SalesOverview({ isLoading }: SalesOverviewProps) {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  if (isLoading || !isClient) {
    return <div className="h-[350px] flex items-center justify-center">Loading chart...</div>
  }

  return (
    <ResponsiveContainer width="100%" height={350}>
      <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 10 }}>
        <defs>
          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#E30040" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#E30040" stopOpacity={0.1} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
        <XAxis dataKey="name" tick={{ fill: "#666", fontWeight: 500 }} axisLine={false} tickLine={false} />
        <YAxis
          yAxisId="left"
          orientation="left"
          tick={{ fill: "#666" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(value) => `Ksh ${(value / 1000)}k`}
        />
        <YAxis yAxisId="right" orientation="right" tick={{ fill: "#666" }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{
            backgroundColor: "white",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            border: "none",
          }}
          formatter={(value, name) => {
            if (name === "revenue") return [`Ksh ${value.toLocaleString()}`, "Revenue"]
            return [value, "Orders"]
          }}
          labelStyle={{ color: "#333", fontWeight: "bold" }}
        />
        <Legend />
        <Bar
          yAxisId="left"
          dataKey="revenue"
          fill="url(#colorRevenue)"
          name="Revenue"
          radius={[4, 4, 0, 0]}
          barSize={30}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="orders"
          stroke="#2563eb"
          name="Orders"
          strokeWidth={2}
          dot={{ r: 4, strokeWidth: 2, fill: "white" }}
          activeDot={{ r: 6, strokeWidth: 2, stroke: "#fff" }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
