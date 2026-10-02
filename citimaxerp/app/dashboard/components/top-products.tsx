"use client"

import { useState, useEffect } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"

const data = [
  { name: "Product A", sales: 120 },
  { name: "Product B", sales: 98 },
  { name: "Product C", sales: 86 },
  { name: "Product D", sales: 72 },
  { name: "Product E", sales: 65 },
]

interface TopProductsProps {
  isLoading: boolean
}

export function TopProducts({ isLoading }: TopProductsProps) {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  if (isLoading || !isClient) {
    return <div className="h-[200px] flex items-center justify-center">Loading chart...</div>
  }

  return (
    <div className="h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart layout="vertical" data={data} margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
          <XAxis type="number" hide />
          <YAxis
            dataKey="name"
            type="category"
            tick={{ fill: "#666", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "white",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              border: "none",
            }}
            formatter={(value) => [value, "units sold"]}
            labelStyle={{ color: "#333", fontWeight: "bold" }}
          />
          <Bar dataKey="sales" fill="#E30040" radius={[0, 4, 4, 0]} barSize={12}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={index === 0 ? "#E30040" : `rgba(227, 0, 64, ${0.9 - index * 0.15})`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
