"use client"

import { useState, useEffect } from "react"
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts"

const data = [
	{ name: "Jan", customers: 4000 },
	{ name: "Feb", customers: 4200 },
	{ name: "Mar", customers: 4500 },
	{ name: "Apr", customers: 4800 },
	{ name: "May", customers: 5100 },
	{ name: "Jun", customers: 5400 },
]

export function CustomerMetrics() {
	const [isClient, setIsClient] = useState(false)

	useEffect(() => {
		setIsClient(true)
	}, [])

	if (!isClient) {
		return <div className="h-[300px] flex items-center justify-center">Loading chart...</div>
	}

	return (
		<ResponsiveContainer width="100%" height={300}>
			<AreaChart
				data={data}
				margin={{
					top: 10,
					right: 30,
					left: 0,
					bottom: 0,
				}}
			>
				<defs>
					<linearGradient id="colorCustomers" x1="0" y1="0" x2="0" y2="1">
						<stop offset="5%" stopColor="#E30040" stopOpacity={0.8} />
						<stop offset="95%" stopColor="#E30040" stopOpacity={0.1} />
					</linearGradient>
				</defs>
				<CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
				<XAxis dataKey="name" tick={{ fill: "#666", fontWeight: 500 }} axisLine={false} tickLine={false} />
				<YAxis tick={{ fill: "#666" }} axisLine={false} tickLine={false} />
				<Tooltip
					contentStyle={{
						backgroundColor: "white",
						borderRadius: "8px",
						boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
						border: "none",
					}}
					formatter={(value) => [`${value}`, "Customers"]}
					labelStyle={{ color: "#333", fontWeight: "bold" }}
				/>
				<Area
					type="monotone"
					dataKey="customers"
					stroke="#E30040"
					fillOpacity={1}
					fill="url(#colorCustomers)"
					strokeWidth={3}
					activeDot={{
						r: 6,
						strokeWidth: 2,
						stroke: "#fff",
						fill: "#E30040",
					}}
				/>
			</AreaChart>
		</ResponsiveContainer>
	)
}
