"use client";
import { useEffect, useState } from "react";
import { SalesAnalytics, fetchSalesAnalytics } from "@/lib/dashboards";
import { Card } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
// You can use your preferred chart library, e.g. recharts, chart.js, nivo, etc.
// For now, we'll use a placeholder for the chart.

export function SalesOverviewWidget({ period, dateRange }: { period: string; dateRange?: string }) {
  const [data, setData] = useState<SalesAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      // Pass period and group_by to fetchSalesAnalytics
      const analytics = await fetchSalesAnalytics({ period, group_by: "day" });
      setData(analytics);
      setLoading(false);
    }
    load();
  }, [period, dateRange]);

  if (loading) {
    return <Card className="min-h-[300px] flex items-center justify-center text-muted-foreground">Loading sales analytics...</Card>;
  }

  if (!data) {
    return <Card className="min-h-[300px] flex items-center justify-center text-red-500">No sales analytics data</Card>;
  }

  const totalRevenue = data.revenue_trend.reduce((sum, d) => sum + d.revenue, 0);
  const totalOrders = data.revenue_trend.reduce((sum, d) => sum + d.orders, 0);

  return (
    <Card className="p-6 min-h-[340px] bg-gradient-to-br from-orange-100 to-orange-300 shadow-lg rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-lg font-bold text-orange-900">Sales Overview</div>
          <div className="text-2xl font-extrabold text-orange-700">Ksh. {totalRevenue.toLocaleString()}</div>
          <div className="text-sm text-orange-800">Total Revenue</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-orange-900">{totalOrders}</div>
          <div className="text-sm text-orange-800">Total Orders</div>
        </div>
      </div>
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.revenue_trend} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="revenue" fill="#fb923c" name="Revenue" radius={[8, 8, 0, 0]} />
            <Bar dataKey="orders" fill="#fbbf24" name="Orders" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
