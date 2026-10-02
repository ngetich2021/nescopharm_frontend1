"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, CheckCircle, TrendingUp, Building } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { type CustomerAccountWithDetails } from "@/lib/customer-accounts";

interface CustomerAccountsSummaryProps {
  accounts: CustomerAccountWithDetails[];
  loading: boolean;
}

interface AccountSummary {
  totalAccounts: number;
  totalCreditLimit: number;
  averageCreditLimit: number;
  totalAnnualTurnover: number;
}

export function CustomerAccountsSummary({ accounts, loading }: CustomerAccountsSummaryProps) {
  const [summary, setSummary] = useState<AccountSummary>({
    totalAccounts: 0,
    totalCreditLimit: 0,
    averageCreditLimit: 0,
    totalAnnualTurnover: 0,
  });

  useEffect(() => {
    if (!loading && accounts.length > 0) {
      // Calculate real summaries based on actual data
      const newSummary = accounts.reduce(
        (acc, account) => {
          acc.totalAccounts += 1;
          
          // Calculate credit limit
          const creditLimit = parseFloat(account.credit_required || "0");
          acc.totalCreditLimit += creditLimit;
          
          // Calculate annual turnover
          const annualTurnover = parseFloat(account.annual_turnover || "0");
          acc.totalAnnualTurnover += annualTurnover;
          
          return acc;
        },
        {
          totalAccounts: 0,
          totalCreditLimit: 0,
          averageCreditLimit: 0,
          totalAnnualTurnover: 0,
        }
      );
      
      // Calculate average credit limit
      newSummary.averageCreditLimit = newSummary.totalAccounts > 0 
        ? newSummary.totalCreditLimit / newSummary.totalAccounts 
        : 0;
      
      setSummary(newSummary);
    } else if (!loading) {
      setSummary({
        totalAccounts: 0,
        totalCreditLimit: 0,
        averageCreditLimit: 0,
        totalAnnualTurnover: 0,
      });
    }
  }, [accounts, loading]);

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
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Accounts</CardTitle>
          <Building className="h-4 w-4 text-[primary]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.totalAccounts}</div>
          <p className="text-xs text-muted-foreground">All customer accounts</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Credit</CardTitle>
          <CreditCard className="h-4 w-4 text-[primary]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">KES {summary.totalCreditLimit.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">Combined credit limits</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg. Credit</CardTitle>
          <CheckCircle className="h-4 w-4 text-[primary]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">KES {summary.averageCreditLimit.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          <p className="text-xs text-muted-foreground">Average per account</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Turnover</CardTitle>
          <TrendingUp className="h-4 w-4 text-[primary]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">KES {summary.totalAnnualTurnover.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">Combined annual turnover</p>
        </CardContent>
      </Card>
    </div>
  );
}
