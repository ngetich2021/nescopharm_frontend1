"use client"

import { useState, useEffect } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"

const data = [
  { name: "Jan", actual: 18500, forecast: 18500 },
  { name: "Feb", actual: 22300, forecast: 22300 },
  { name: "Mar", actual: 30200, forecast: 30200 },
  { name: "Apr", actual: 27800, forecast: 27800 },
  { name: "May", actual: 32900, forecast: 32900 },
  { name: "Jun", actual: 38600, forecast: 38600 },
  { name: "Jul", actual: null, forecast: 42000 },
  { name: "Aug", actual: null, forecast: 45000 },
  { name: "Sep", actual: null, forecast: 48000 },
  { name: "Oct", actual: null, forecast: 52000 },
  { name: "Nov", actual: null, forecast: 58000 },
  { name: "Dec", actual: null, forecast: 65000 },
]

interface SalesForecastProps {
  isLoading: boolean
}

export function SalesForecast({ isLoading }: SalesForecastProps) {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  if (isLoading || !isClient) {
    return <div className="h-[300px] flex items-center justify-center">Loading chart...</div>
  }

  // Find the last month with actual data
  const lastActualIndex = data.findIndex((item) => item.actual === null) - 1
  const currentMonth = lastActualIndex >= 0 ? data[lastActualIndex].name : "Jun"

  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
          <XAxis dataKey="name" tick={{ fill: "#666", fontWeight: 500 }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fill: "#666" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value) => `Ksh ${(value / 1000)}k`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "white",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              border: "none",
            }}
            formatter={(value) => [`Ksh ${value.toLocaleString()}`, ""]}
            labelStyle={{ color: "#333", fontWeight: "bold" }}
          />
          <ReferenceLine
            x={currentMonth}
            stroke="#888"
            strokeDasharray="3 3"
            label={{ value: "Current", position: "top", fill: "#888" }}
          />
          <Line
            type="monotone"
            dataKey="actual"
            stroke="#E30040"
            name="Actual Revenue"
            strokeWidth={3}
            dot={{ r: 4, strokeWidth: 2, fill: "white" }}
            activeDot={{ r: 6, strokeWidth: 2, stroke: "#fff" }}
          />
          <Line
            type="monotone"
            dataKey="forecast"
            stroke="#94a3b8"
            name="Forecast"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ r: 3, strokeWidth: 1, fill: "white" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
