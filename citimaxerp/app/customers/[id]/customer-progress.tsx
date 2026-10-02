"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from "recharts"

interface CustomerProgressProps {
  progress: number
}

export function CustomerProgress({ progress }: CustomerProgressProps) {
  const data = [{ value: progress }]

  return (
    <Card className="col-span-2 md:col-span-1">
      <CardHeader>
        <CardTitle>Customer Progress</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              cx="50%"
              cy="50%"
              innerRadius="60%"
              outerRadius="100%"
              barSize={10}
              data={data}
              startAngle={90}
              endAngle={-270}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
              <RadialBar background dataKey="value" cornerRadius={30} fill="url(#progressGradient)" />
              <text
                x="50%"
                y="50%"
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-primary text-3xl font-bold"
              >
                {`${progress}%`}
              </text>
              <defs>
                <linearGradient id="progressGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </RadialBarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
