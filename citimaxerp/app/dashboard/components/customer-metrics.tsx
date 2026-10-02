"use client"

import { useState, useEffect } from "react"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, Sector } from "recharts"

const data = [
  { name: "New Customers", value: 540 },
  { name: "Returning", value: 620 },
  { name: "Inactive", value: 210 },
]

const COLORS = ["#E30040", "#3b82f6", "#94a3b8"]

interface CustomerMetricsProps {
  isLoading: boolean
}

export function CustomerMetrics({ isLoading }: CustomerMetricsProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  if (isLoading || !isClient) {
    return <div className="h-[300px] flex items-center justify-center">Loading chart...</div>
  }

  const renderActiveShape = (props) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props

    return (
      <g>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius + 10}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
        />
        <text x={cx} y={cy - 15} textAnchor="middle" fill="#333" fontSize={16} fontWeight="bold">
          {payload.name}
        </text>
        <text x={cx} y={cy + 15} textAnchor="middle" fill="#666" fontSize={16}>
          {value.toLocaleString()} ({(percent * 100).toFixed(0)}%)
        </text>
      </g>
    )
  }

  const onPieEnter = (_, index) => {
    setActiveIndex(index)
  }

  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            activeIndex={activeIndex}
            activeShape={renderActiveShape}
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
            onMouseEnter={onPieEnter}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "white",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              border: "none",
            }}
            formatter={(value) => [value.toLocaleString(), ""]}
            labelStyle={{ color: "#333", fontWeight: "bold" }}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            formatter={(value) => <span style={{ color: "#666", fontSize: 14 }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
