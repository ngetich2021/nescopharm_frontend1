"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react";
import { type Breakage } from "@/lib/breakages";

interface BreakagesSummaryProps {
  breakages: Breakage[];
  loading: boolean;
}

export function BreakagesSummary({ breakages, loading }: BreakagesSummaryProps) {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const totalBreakages = breakages.length;
  const pendingApproval = breakages.filter(b => b.approval_status === "pending").length;
  const approved = breakages.filter(b => b.approval_status === "approved").length;
  const rejected = breakages.filter(b => b.approval_status === "rejected").length;
  const totalItems = breakages.reduce((sum, breakage) => sum + breakage.items.length, 0);
  const totalQuantity = breakages.reduce((sum, breakage) => 
    sum + breakage.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0
  );
  const replacementRequested = breakages.reduce((sum, breakage) => 
    sum + breakage.items.filter(item => item.replacement_requested).length, 0
  );

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Breakages</CardTitle>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalBreakages}</div>
          <p className="text-xs text-muted-foreground">
            {totalItems} items • {totalQuantity} total qty
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-yellow-600">{pendingApproval}</div>
          <p className="text-xs text-muted-foreground">
            Awaiting manager approval
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Approved</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{approved}</div>
          <p className="text-xs text-muted-foreground">
            {replacementRequested} replacements requested
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Rejected</CardTitle>
          <XCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-primary">{rejected}</div>
          <p className="text-xs text-muted-foreground">
            Rejected breakage reports
          </p>
        </CardContent>
      </Card>
    </div>
  );
}