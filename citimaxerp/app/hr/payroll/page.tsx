"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  PayrollRun,
  PayrollStats,
  fetchPayrollStats,
  fetchPayrollRuns,
  createPayrollRun,
  processPayrollRun,
  approvePayrollRun,
  markPayrollRunPaid,
  formatKES,
  monthName,
} from "@/lib/payroll-runs";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Play,
  CheckCircle2,
  CreditCard,
  ChevronRight,
  ChevronLeft,
  TrendingUp,
  Clock,
  Banknote,
  Users,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function getStatusBadge(status: string) {
  switch (status) {
    case "draft":
      return (
        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
          Draft
        </Badge>
      );
    case "approved":
      return (
        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
          Approved
        </Badge>
      );
    case "paid":
      return (
        <Badge variant="secondary" className="bg-green-100 text-green-800">
          Paid
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export default function PayrollPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { hasPermission } = useAuth();

  // Stats
  const [stats, setStats] = useState<PayrollStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Payroll runs
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(15);

  // New Run dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newMonth, setNewMonth] = useState(String(new Date().getMonth() + 1));
  const [newYear, setNewYear] = useState(String(new Date().getFullYear()));
  const [newNotes, setNewNotes] = useState("");
  const [creating, setCreating] = useState(false);

  // Action loading states
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await fetchPayrollStats();
      setStats(data);
    } catch {
      // non-critical
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadRuns = useCallback(async () => {
    setRunsLoading(true);
    try {
      const res = await fetchPayrollRuns({
        page: currentPage,
        per_page: rowsPerPage,
      });
      setRuns(res.data ?? []);
      setTotalPages(res.last_page ?? 1);
      setTotalItems(res.total ?? 0);
    } catch {
      toast({
        title: "Error",
        description: "Failed to load payroll runs.",
        variant: "destructive",
      });
    } finally {
      setRunsLoading(false);
    }
  }, [currentPage, rowsPerPage]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  const handleCreate = async (andProcess = false) => {
    setCreating(true);
    try {
      const run = await createPayrollRun({
        pay_month: Number(newMonth),
        pay_year: Number(newYear),
        notes: newNotes || undefined,
      });

      if (andProcess) {
        toast({ title: "Processing...", description: `Running payroll for ${MONTHS[Number(newMonth) - 1]} ${newYear}...` });
        await processPayrollRun(run.id);
        toast({ title: "Success", description: `Payroll for ${MONTHS[Number(newMonth) - 1]} ${newYear} created and processed.` });
      } else {
        toast({ title: "Success", description: `Payroll run for ${MONTHS[Number(newMonth) - 1]} ${newYear} created.` });
      }

      setCreateOpen(false);
      setNewNotes("");
      loadRuns();
      loadStats();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message ?? "Failed to create payroll run.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleProcess = async (run: PayrollRun) => {
    setProcessingId(run.id);
    try {
      await processPayrollRun(run.id);
      toast({
        title: "Success",
        description: `Payroll for ${monthName(run.pay_month)} ${run.pay_year} processed.`,
      });
      loadRuns();
      loadStats();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message ?? "Failed to process payroll.",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleApprove = async (run: PayrollRun) => {
    setApprovingId(run.id);
    try {
      await approvePayrollRun(run.id);
      toast({
        title: "Success",
        description: `Payroll for ${monthName(run.pay_month)} ${run.pay_year} approved.`,
      });
      loadRuns();
      loadStats();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message ?? "Failed to approve payroll.",
        variant: "destructive",
      });
    } finally {
      setApprovingId(null);
    }
  };

  const handleMarkPaid = async (run: PayrollRun) => {
    setMarkingPaidId(run.id);
    try {
      await markPayrollRunPaid(run.id);
      toast({
        title: "Success",
        description: "Payroll run marked as paid.",
      });
      loadRuns();
      loadStats();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message ?? "Failed to mark as paid.",
        variant: "destructive",
      });
    } finally {
      setMarkingPaidId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Payroll</h1>
          <p className="text-sm text-gray-600">
            Manage monthly payroll runs
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Run
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Runs This Year
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? (
                <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" />
              ) : (
                stats?.total_runs_this_year ?? 0
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Payroll runs created
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Approval
            </CardTitle>
            <Clock
              className={`h-4 w-4 ${
                (stats?.pending_approval ?? 0) > 0
                  ? "text-yellow-600"
                  : "text-muted-foreground"
              }`}
            />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                (stats?.pending_approval ?? 0) > 0
                  ? "text-yellow-600"
                  : ""
              }`}
            >
              {statsLoading ? (
                <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" />
              ) : (
                stats?.pending_approval ?? 0
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Awaiting review
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Net Paid This Year
            </CardTitle>
            <Banknote className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold truncate">
              {statsLoading ? (
                <div className="h-6 w-20 bg-gray-200 rounded animate-pulse" />
              ) : (
                formatKES(stats?.total_paid_this_year ?? 0)
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Total disbursed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {statsLoading || !stats?.last_run
                ? "Last Run Employees"
                : `${monthName(stats.last_run.pay_month)} ${stats.last_run.pay_year}`}
            </CardTitle>
            <Users className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? (
                <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" />
              ) : (
                stats?.last_run?.employees ?? 0
              )}
            </div>
            <p className="text-xs text-muted-foreground">employees</p>
          </CardContent>
        </Card>
      </div>

      {/* Payroll Runs Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium">
              Payroll Runs
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {runsLoading
                ? "..."
                : `${totalItems} run${totalItems !== 1 ? "s" : ""}`}
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Employees</TableHead>
                <TableHead className="text-right">Total Gross</TableHead>
                <TableHead className="text-right">Total Net</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runsLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                      Loading...
                    </div>
                  </TableCell>
                </TableRow>
              ) : runs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-12 text-muted-foreground"
                  >
                    No payroll runs yet
                  </TableCell>
                </TableRow>
              ) : (
                runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="font-medium">
                      {monthName(run.pay_month)} {run.pay_year}
                    </TableCell>
                    <TableCell>{getStatusBadge(run.status)}</TableCell>
                    <TableCell>{run.payslips_count ?? 0}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatKES(run.total_gross)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {formatKES(run.total_net)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-1 justify-end">
                        {run.status === "draft" && hasPermission("can_create_payroll") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title={run.payslips_count ? "Re-process payroll" : "Process payroll"}
                              onClick={() => handleProcess(run)}
                              disabled={processingId === run.id}
                            >
                              {processingId === run.id ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        {run.status === "draft" &&
                          (run.payslips_count ?? 0) > 0 &&
                          hasPermission("can_approve_payroll") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Approve"
                              onClick={() => handleApprove(run)}
                              disabled={approvingId === run.id}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          )}
                        {run.status === "approved" && hasPermission("can_process_payroll") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Mark as paid"
                            onClick={() => handleMarkPaid(run)}
                            disabled={markingPaidId === run.id}
                          >
                            <CreditCard className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          title="View detail"
                          onClick={() =>
                            router.push(`/hr/payroll/${run.id}`)
                          }
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * rowsPerPage + 1} to{" "}
            {Math.min(currentPage * rowsPerPage, totalItems)} of {totalItems}{" "}
            runs
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setCurrentPage((p) => Math.min(totalPages, p + 1))
              }
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* New Run Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Payroll Run</DialogTitle>
            <DialogDescription>
              Start a new monthly payroll run. Select the month and year for
              the pay period.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="pay-month">Month</Label>
              <Select value={newMonth} onValueChange={setNewMonth}>
                <SelectTrigger id="pay-month">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-year">Year</Label>
              <Input
                id="pay-year"
                type="number"
                value={newYear}
                onChange={(e) => setNewYear(e.target.value)}
                min={2020}
                max={2099}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-notes">Notes (optional)</Label>
              <Textarea
                id="pay-notes"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Any notes for this payroll run..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button variant="outline" onClick={() => handleCreate(false)} disabled={creating}>
              {creating ? "Creating..." : "Create Draft"}
            </Button>
            <Button onClick={() => handleCreate(true)} disabled={creating}>
              {creating ? "Processing..." : "Create & Process"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
