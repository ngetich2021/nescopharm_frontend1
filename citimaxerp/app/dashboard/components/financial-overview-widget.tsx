"use client";
import { useEffect, useState } from "react";
import { FinancialAnalytics, fetchFinancialAnalytics } from "@/lib/dashboards";
import { Card } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

export function FinancialOverviewWidget({ period, groupBy }: { period: string; groupBy?: string }) {
  const [data, setData] = useState<FinancialAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const analytics = await fetchFinancialAnalytics({ period, group_by: groupBy || "month" });
      setData(analytics);
      setLoading(false);
    }
    load();
  }, [period, groupBy]);

  if (loading) {
    return <Card className="min-h-[300px] flex items-center justify-center text-muted-foreground">Loading financial analytics...</Card>;
  }

  if (!data) {
    return <Card className="min-h-[300px] flex items-center justify-center text-red-500">No financial analytics data</Card>;
  }

  return (
    <Card className="p-6 min-h-[340px] bg-gradient-to-br from-pink-100 to-pink-300 shadow-lg rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-lg font-bold text-pink-900">Financial Overview</div>
          <div className="text-2xl font-extrabold text-pink-700">Ksh. {data.cash_flow.cash_in.toLocaleString()}</div>
          <div className="text-sm text-pink-800">Total Payments</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-pink-900">Ksh. {data.expense_breakdown.total_expenses.toLocaleString()}</div>
          <div className="text-sm text-pink-800">Total Expenses</div>
        </div>
      </div>
      <div className="h-48 w-full mb-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.cash_flow.monthly_trend} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="cash_in" fill="#ec4899" name="Cash In" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm mt-2">
        <div>
          <div className="text-muted-foreground">Net Profit</div>
          <div className="font-bold">{data.profit_loss.net_profit}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Outstanding Receivables</div>
          <div className="font-bold">{data.accounts_receivable.total_outstanding}</div>
        </div>
      </div>
    </Card>
  );
}
