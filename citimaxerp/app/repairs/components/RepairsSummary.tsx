"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wrench, Clock, CheckCircle, XCircle, AlertTriangle, Zap } from "lucide-react";
import { type Repair } from "@/lib/repairs";

interface RepairsSummaryProps {
  repairs: Repair[];
  loading: boolean;
}

export function RepairsSummary({ repairs, loading }: RepairsSummaryProps) {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                <div className="h-4 bg-gray-200 rounded animate-pulse" />
              </CardTitle>
              <div className="h-4 w-4 bg-gray-200 rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-200 rounded animate-pulse mb-2" />
              <div className="h-3 bg-gray-200 rounded animate-pulse w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Calculate statistics
  const totalRepairs = repairs.length;
  const pendingRepairs = repairs.filter(repair => repair.approval_status === "pending").length;
  const approvedRepairs = repairs.filter(repair => repair.approval_status === "approved").length;
  const rejectedRepairs = repairs.filter(repair => repair.approval_status === "rejected").length;
  const resolvedRepairs = repairs.filter(repair => repair.status === "resolved").length;
  const totalItems = repairs.reduce((sum, repair) => sum + repair.items.length, 0);
  const repairableItems = repairs.reduce((sum, repair) => 
    sum + repair.items.filter(item => item.is_repairable).length, 0);
  const nonRepairableItems = repairs.reduce((sum, repair) => 
    sum + repair.items.filter(item => !item.is_repairable).length, 0);

  const completionRate = totalRepairs > 0 ? ((resolvedRepairs / totalRepairs) * 100).toFixed(1) : "0";

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Repairs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Repairs</CardTitle>
          <Wrench className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalRepairs}</div>
          <div className="flex items-center space-x-2 text-xs text-muted-foreground">
            <span>Items: {totalItems}</span>
            <Badge variant="secondary" className="text-xs">
              {repairableItems} Repairable
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Pending Approvals */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{pendingRepairs}</div>
          <div className="flex items-center space-x-2 text-xs text-muted-foreground">
            <span>Awaiting review</span>
            {pendingRepairs > 0 && (
              <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Needs attention
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Approved Repairs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Approved</CardTitle>
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{approvedRepairs}</div>
          <p className="text-xs text-muted-foreground">
            Ready for repair work
          </p>
        </CardContent>
      </Card>

      {/* Resolved Repairs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Resolved</CardTitle>
          <XCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">{resolvedRepairs}</div>
          <div className="flex items-center space-x-2 text-xs text-muted-foreground">
            <span>{completionRate}% completion rate</span>
            {rejectedRepairs > 0 && (
              <Badge variant="destructive" className="text-xs">
                {rejectedRepairs} Rejected
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}