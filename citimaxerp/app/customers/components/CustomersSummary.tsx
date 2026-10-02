"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, UserX, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { type Customer } from "@/lib/customers";

interface CustomersSummaryProps {
  customers: Customer[];
  loading: boolean;
}

interface CustomerSummary {
  totalCustomers: number;
  activeCustomers: number;
  inactiveCustomers: number;
  leadsCustomers: number;
  totalSpend: number;
}

export function CustomersSummary({ customers, loading }: CustomersSummaryProps) {
  const [summary, setSummary] = useState<CustomerSummary>({
    totalCustomers: 0,
    activeCustomers: 0,
    inactiveCustomers: 0,
    leadsCustomers: 0,
    totalSpend: 0,
  });

  useEffect(() => {
    if (!loading && customers.length > 0) {
      const newSummary = customers.reduce(
        (acc, customer) => {
          acc.totalCustomers += 1;
          
          switch (customer.status?.toLowerCase()) {
            case "active":
              acc.activeCustomers += 1;
              break;
            case "inactive":
              acc.inactiveCustomers += 1;
              break;
            case "lead":
              acc.leadsCustomers += 1;
              break;
          }
          
          acc.totalSpend += parseFloat(customer.total_spend) || 0;
          
          return acc;
        },
        {
          totalCustomers: 0,
          activeCustomers: 0,
          inactiveCustomers: 0,
          leadsCustomers: 0,
          totalSpend: 0,
        }
      );
      
      setSummary(newSummary);
    } else if (!loading) {
      setSummary({
        totalCustomers: 0,
        activeCustomers: 0,
        inactiveCustomers: 0,
        leadsCustomers: 0,
        totalSpend: 0,
      });
    }
  }, [customers, loading]);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-3 w-24" />
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
          <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
          <Users className="h-4 w-4 text-[primary]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.totalCustomers}</div>
          <p className="text-xs text-muted-foreground">All registered customers</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
          <UserCheck className="h-4 w-4 text-[primary]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.activeCustomers}</div>
          <p className="text-xs text-muted-foreground">Currently active</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Leads</CardTitle>
          <UserX className="h-4 w-4 text-[primary]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.leadsCustomers}</div>
          <p className="text-xs text-muted-foreground">Potential customers</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          <TrendingUp className="h-4 w-4 text-[primary]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">KES {summary.totalSpend.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">All-time customer spend</p>
        </CardContent>
      </Card>
    </div>
  );
}