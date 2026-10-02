"use client"

import { useState, useEffect } from "react"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, Sector } from "recharts"

const data = [
  { name: "In Stock", value: 7000 },
  { name: "Low Stock", value: 2000 },
  { name: "Out of Stock", value: 1000 },
]

const COLORS = ["#36B37E", "#FFAB00", "#E30040"]

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
      <text x={cx} y={cy} dy={-15} textAnchor="middle" fill="#333" fontSize={14} fontWeight="bold">
        {payload.name}
      </text>
      <text x={cx} y={cy} dy={15} textAnchor="middle" fill="#666" fontSize={14}>
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    </g>
  )
}

export function InventoryOverview() {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  if (!isClient) {
    return <div className="h-[300px] flex items-center justify-center">Loading chart...</div>
  }

  const onPieEnter = (_, index) => {
    setActiveIndex(index)
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          activeIndex={activeIndex}
          activeShape={renderActiveShape}
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
          onMouseEnter={onPieEnter}
          paddingAngle={3}
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
          formatter={(value) => [`${value.toLocaleString()} units`, ""]}
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
  )
}
