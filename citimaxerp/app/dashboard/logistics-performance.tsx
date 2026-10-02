"use client"

import { useState, useEffect } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, Cell } from "recharts"

const data = [
  {
    name: "On Time",
    value: 85,
    fill: "#36B37E",
  },
  {
    name: "Delayed",
    value: 12,
    fill: "#FFAB00",
  },
  {
    name: "Lost",
    value: 3,
    fill: "#E30040",
  },
]

const CustomLabel = (props) => {
  const { x, y, width, value } = props
  return (
    <text x={x + width + 5} y={y + 15} fill="#666" fontSize={14} textAnchor="start" dominantBaseline="middle">
      {`${value}%`}
    </text>
  )
}

export function LogisticsPerformance() {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  if (!isClient) {
    return <div className="h-[300px] flex items-center justify-center">Loading chart...</div>
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{
          top: 20,
          right: 50,
          left: 20,
          bottom: 5,
        }}
        barSize={30}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
        <XAxis type="number" domain={[0, 100]} tick={{ fill: "#666" }} axisLine={false} tickLine={false} />
        <YAxis
          dataKey="name"
          type="category"
          tick={{ fill: "#666", fontWeight: 500 }}
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
          formatter={(value) => [`${value}%`, ""]}
          labelStyle={{ color: "#333", fontWeight: "bold" }}
        />
        <Bar
          dataKey="value"
          radius={[0, 4, 4, 0]}
          animationDuration={1500}
          background={{ fill: "#f5f5f5", radius: [0, 4, 4, 0] }}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
          <LabelList dataKey="value" content={<CustomLabel />} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
