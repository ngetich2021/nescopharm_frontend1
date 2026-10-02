"use client";
import { useEffect, useState } from "react";
import { CustomerAnalytics, fetchCustomerAnalytics } from "@/lib/dashboards";

import { Card } from "@/components/ui/card";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

export function CustomerOverviewWidget({ period, groupBy }: { period: string; groupBy?: string }) {
  const [data, setData] = useState<CustomerAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const analytics = await fetchCustomerAnalytics({ period, group_by: groupBy || "month" });
      setData(analytics);
      setLoading(false);
    }
    load();
  }, [period, groupBy]);

  if (loading) {
    return <Card className="min-h-[300px] flex items-center justify-center text-muted-foreground">Loading customer analytics...</Card>;
  }

  if (!data) {
    return <Card className="min-h-[300px] flex items-center justify-center text-red-500">No customer analytics data</Card>;
  }

  // Format KES currency with commas
  const formatKES = (amount: number) => `KES ${amount.toLocaleString()}`;

  return (
    <Card className="p-6 min-h-[340px] bg-gradient-to-br from-blue-100 to-teal-200 shadow-lg rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-lg font-bold text-blue-900">Customer Overview</div>
          <div className="text-2xl font-extrabold text-blue-700">{data.customer_acquisition.total_new_customers.toLocaleString()}</div>
          <div className="text-sm text-blue-800">New Customers</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-blue-900">{data.customer_retention.retention_rate}%</div>
          <div className="text-sm text-blue-800">Retention Rate</div>
        </div>
      </div>
      <div className="h-48 w-full mb-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.customer_acquisition.daily_acquisition} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorNew" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.2}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value: any) => value.toLocaleString()} />
            <Legend />
            <Area type="monotone" dataKey="new_customers" stroke="#0ea5e9" fillOpacity={1} fill="url(#colorNew)" name="New Customers" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm mt-2">
        <div>
          <div className="text-muted-foreground">Avg Lifetime Value</div>
          <div className="font-bold">{formatKES(data.customer_lifetime_value.avg_lifetime_value)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Top Customer</div>
          <div className="font-bold">{data.top_customers[0]?.name || "-"}</div>
        </div>
      </div>
    </Card>
  );
}
