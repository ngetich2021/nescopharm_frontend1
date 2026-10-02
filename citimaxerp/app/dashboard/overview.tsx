"use client"

import { useState, useEffect } from "react"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts"

const data = [
	{
		name: "Jan",
		total: Math.floor(Math.random() * 5000) + 1000,
	},
	{
		name: "Feb",
		total: Math.floor(Math.random() * 5000) + 1000,
	},
	{
		name: "Mar",
		total: Math.floor(Math.random() * 5000) + 1000,
	},
	{
		name: "Apr",
		total: Math.floor(Math.random() * 5000) + 1000,
	},
	{
		name: "May",
		total: Math.floor(Math.random() * 5000) + 1000,
	},
	{
		name: "Jun",
		total: Math.floor(Math.random() * 5000) + 1000,
	},
	{
		name: "Jul",
		total: Math.floor(Math.random() * 5000) + 1000,
	},
	{
		name: "Aug",
		total: Math.floor(Math.random() * 5000) + 1000,
	},
	{
		name: "Sep",
		total: Math.floor(Math.random() * 5000) + 1000,
	},
	{
		name: "Oct",
		total: Math.floor(Math.random() * 5000) + 1000,
	},
	{
		name: "Nov",
		total: Math.floor(Math.random() * 5000) + 1000,
	},
	{
		name: "Dec",
		total: Math.floor(Math.random() * 5000) + 1000,
	},
]

export function SalesOverview() {
	const [isClient, setIsClient] = useState(false)

	useEffect(() => {
		setIsClient(true)
	}, [])

	if (!isClient) {
		return <div className="h-[350px] flex items-center justify-center">Loading chart...</div>
	}

	return (
		<ResponsiveContainer width="100%" height={350}>
			<BarChart data={data} className="mt-4">
				<defs>
					<linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
						<stop offset="5%" stopColor="#E30040" stopOpacity={0.8} />
						<stop offset="95%" stopColor="#E30040" stopOpacity={0.2} />
					</linearGradient>
				</defs>
				<CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
				<XAxis
					dataKey="name"
					stroke="#888888"
					fontSize={12}
					tickLine={false}
					axisLine={false}
					tick={{ fill: "#666", fontWeight: 500 }}
				/>
				<YAxis
					stroke="#888888"
					fontSize={12}
					tickLine={false}
					axisLine={false}
					tickFormatter={(value) => `Ksh ${value}`}
					tick={{ fill: "#666" }}
				/>
				<Tooltip
					contentStyle={{
						backgroundColor: "white",
						borderRadius: "8px",
						boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
						border: "none",
					}}
					formatter={(value) => [`Ksh ${value}`, "Revenue"]}
					labelStyle={{ color: "#333", fontWeight: "bold" }}
				/>
				<Bar
					dataKey="total"
					fill="url(#colorTotal)"
					radius={[4, 4, 0, 0]}
					animationDuration={1500}
					barSize={30}
				/>
			</BarChart>
		</ResponsiveContainer>
	)
}
