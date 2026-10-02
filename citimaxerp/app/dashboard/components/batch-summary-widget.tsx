"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getBatchSummary } from "@/lib/batches";
import { Package, Calendar, AlertTriangle, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function BatchSummaryWidget() {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSummary() {
      try {
        setLoading(true);
        const data = await getBatchSummary();
        setSummary(data);
      } catch (err: any) {
        setError(err.message || "Failed to load batch summary");
      } finally {
        setLoading(false);
      }
    }
    
    loadSummary();
  }, []);

  if (loading) {
    return (
      <Card className="min-h-[200px] flex items-center justify-center">
        <div className="text-muted-foreground">Loading batch summary...</div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="min-h-[200px] flex items-center justify-center">
        <div className="text-red-500">Error: {error}</div>
      </Card>
    );
  }

  if (!summary) {
    return (
      <Card className="min-h-[200px] flex items-center justify-center">
        <div className="text-muted-foreground">No batch data available</div>
      </Card>
    );
  }

  // Extract data from the new batch summary structure
  const overview = summary.overview || {};
  const inventory = summary.inventory || {};
  const financial = summary.financial || {};
  const alerts = summary.alerts || {};

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Package className="h-5 w-5 text-blue-600" />
          Batch Tracking Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white p-3 rounded-lg border border-blue-100">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-xs font-medium text-muted-foreground">Active</span>
            </div>
            <div className="text-xl font-bold text-green-600">{overview.active_batches || 0}</div>
            <div className="text-xs text-muted-foreground">batches</div>
          </div>
          
          <div className="bg-white p-3 rounded-lg border border-blue-100">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <span className="text-xs font-medium text-muted-foreground">Expiring Soon</span>
            </div>
            <div className="text-xl font-bold text-orange-600">{alerts.expiring_batches_count || 0}</div>
            <div className="text-xs text-muted-foreground">batches</div>
          </div>
          
          <div className="bg-white p-3 rounded-lg border border-blue-100">
            <div className="flex items-center gap-2 mb-1">
              <Package className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-medium text-muted-foreground">Total</span>
            </div>
            <div className="text-xl font-bold text-blue-600">{overview.total_batches || 0}</div>
            <div className="text-xs text-muted-foreground">batches</div>
          </div>
          
          <div className="bg-white p-3 rounded-lg border border-blue-100">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="h-4 w-4 text-red-500" />
              <span className="text-xs font-medium text-muted-foreground">Expired</span>
            </div>
            <div className="text-xl font-bold text-red-600">{overview.expired_batches || 0}</div>
            <div className="text-xs text-muted-foreground">batches</div>
          </div>
        </div>
        
        <div className="pt-2 border-t border-blue-100">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Total Batch Value</span>
            <span className="font-bold text-blue-600">
              KES {financial.total_inventory_value?.toLocaleString() || "0"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}