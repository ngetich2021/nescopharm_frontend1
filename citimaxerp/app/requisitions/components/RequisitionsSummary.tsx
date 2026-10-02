"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, CheckCircle, Clock, XCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { type Requisition } from "@/lib/requisitions";

interface RequisitionsSummaryProps {
  requisitions: Requisition[];
  loading: boolean;
}

interface RequisitionSummary {
  totalRequisitions: number;
  pendingRequisitions: number;
  approvedRequisitions: number;
  rejectedRequisitions: number;
  totalItems: number;
}

export function RequisitionsSummary({ requisitions, loading }: RequisitionsSummaryProps) {
  const [summary, setSummary] = useState<RequisitionSummary>({
    totalRequisitions: 0,
    pendingRequisitions: 0,
    approvedRequisitions: 0,
    rejectedRequisitions: 0,
    totalItems: 0,
  });

  useEffect(() => {
    if (!loading && requisitions.length > 0) {
      const newSummary = {
        totalRequisitions: requisitions.length,
        pendingRequisitions: requisitions.filter(r => r.approval_status === "pending").length,
        approvedRequisitions: requisitions.filter(r => r.approval_status === "approved").length,
        rejectedRequisitions: requisitions.filter(r => r.approval_status === "rejected").length,
        totalItems: requisitions.reduce((total, r) => total + r.items.length, 0),
      };
      setSummary(newSummary);
    } else if (!loading) {
      setSummary({
        totalRequisitions: 0,
        pendingRequisitions: 0,
        approvedRequisitions: 0,
        rejectedRequisitions: 0,
        totalItems: 0,
      });
    }
  }, [requisitions, loading]);

  // Skeleton loader for loading state
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-24 mb-2" />
              <Skeleton className="h-4 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Requisitions</CardTitle>
          <ClipboardList className="h-4 w-4 text-[#E30040]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.totalRequisitions}</div>
          <p className="text-xs text-muted-foreground">{summary.totalItems} items total</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
          <Clock className="h-4 w-4 text-[#E30040]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.pendingRequisitions}</div>
          <p className="text-xs text-muted-foreground">Awaiting approval</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Approved</CardTitle>
          <CheckCircle className="h-4 w-4 text-[#E30040]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.approvedRequisitions}</div>
          <p className="text-xs text-muted-foreground">Ready for fulfillment</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Rejected</CardTitle>
          <XCircle className="h-4 w-4 text-[#E30040]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.rejectedRequisitions}</div>
          <p className="text-xs text-muted-foreground">Requires attention</p>
        </CardContent>
      </Card>
    </div>
  );
}