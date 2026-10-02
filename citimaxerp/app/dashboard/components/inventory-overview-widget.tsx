"use client";
import { useEffect, useState } from "react";
import { InventoryAnalytics, fetchInventoryAnalytics } from "@/lib/dashboards";

import { Card } from "@/components/ui/card";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

export function InventoryOverviewWidget({ period, groupBy }: { period: string; groupBy?: string }) {
  const [data, setData] = useState<InventoryAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const analytics = await fetchInventoryAnalytics({ period, group_by: groupBy || "month" });
      setData(analytics);
      setLoading(false);
    }
    load();
  }, [period, groupBy]);

  if (loading) {
    return <Card className="min-h-[300px] flex items-center justify-center text-muted-foreground">Loading inventory analytics...</Card>;
  }

  if (!data) {
    return <Card className="min-h-[300px] flex items-center justify-center text-red-500">No inventory analytics data</Card>;
  }

  // Format KES currency with commas
  const formatKES = (amount: number) => `KES ${amount.toLocaleString()}`;
  // Pie chart data for stock distribution
  const stockDist = Object.entries(data.inventory_levels.stock_distribution || {}).map(([name, value]) => ({ name, value }));
  const COLORS = ["#22c55e", "#eab308", "#f59e42", "#84cc16", "#fde047", "#fbbf24", "#a3e635", "#facc15"];

  return (
    <Card className="p-6 min-h-[340px] bg-gradient-to-br from-green-100 to-yellow-100 shadow-lg rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-lg font-bold text-green-900">Inventory Overview</div>
          <div className="text-2xl font-extrabold text-green-700">{data.inventory_levels.total_products.toLocaleString()}</div>
          <div className="text-sm text-green-800">Total Products</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-green-900">{data.stock_alerts.low_stock_count.toLocaleString()}</div>
          <div className="text-sm text-green-800">Low Stock</div>
        </div>
      </div>
      <div className="h-48 w-full mb-2 flex items-center justify-center">
        {stockDist.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={stockDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label>
                {stockDist.map((entry, idx) => (
                  <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: any) => value.toLocaleString()} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">No stock distribution data</div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm mt-2">
        <div>
          <div className="text-muted-foreground">Dead Stock Value</div>
          <div className="font-bold">{formatKES(data.dead_stock.total_dead_stock_value)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Top Performer</div>
          <div className="font-bold">
            {data.product_performance.top_performers[0]?.product?.name || 
             data.product_performance.top_performers[0]?.product_name || 
             data.product_performance.top_performers[0]?.product_id || 
             "-"}
          </div>
        </div>
      </div>
    </Card>
  );
}
