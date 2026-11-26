"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  PayrollRun,
  PayrollStats,
  fetchPayrollStats,
  fetchPayrollRuns,
  createPayrollRun,
  processPayrollRun,
  approvePayrollRun,
  reopenPayrollRun,
  deletePayrollRun,
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
import { Trash2, FileSpreadsheet, Upload } from "lucide-react";
import { fetchImportSchema, downloadTemplate, type ImportSchema } from "@/lib/data-import";
import { ImportDialog } from "@/app/settings/data-import/components/import-dialog";
import { displayDate } from "@/lib/date-format";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, Undo2 } from "lucide-react";
import { PayRunDialog } from "./components/PayRunDialog";
import { StatutoryPaymentsTab } from "./components/StatutoryPaymentsTab";
import { PaymentHistoryTab } from "./components/PaymentHistoryTab";
import { PayrollLedgerDialog } from "./components/PayrollLedgerDialog";
import { BookOpen } from "lucide-react";

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
    case "payment_initiated":
      return (
        <Badge variant="secondary" className="bg-purple-100 text-purple-800" title="Payment voucher prepared - not yet posted to the bank">
          Payment initiated
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
  // Every month on one page by default (1 to N, continuous); page controls only matter past 120 runs.
  const [rowsPerPage, setRowsPerPage] = useState(120);
  const [ledgerOpen, setLedgerOpen] = useState(false);

  // New Run dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newMonth, setNewMonth] = useState(String(new Date().getMonth() + 1));
  const [newYear, setNewYear] = useState(String(new Date().getFullYear()));
  const [newNotes, setNewNotes] = useState("");
  const [creating, setCreating] = useState(false);

  // Action loading states
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [payTarget, setPayTarget] = useState<{ run: PayrollRun; mode: "initiate" | "confirm" } | null>(null);
  const [reopeningId, setReopeningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [tab, setTab] = useState("runs");

  // Payroll History: past payrolls from Excel (one row per employee per month), preview first.
  const [historySchema, setHistorySchema] = useState<ImportSchema | null>(null);
  const [importSchema, setImportSchema] = useState<ImportSchema | null>(null);
  const loadHistorySchema = async () =>
    historySchema ?? fetchImportSchema("payroll_history").then((sc) => { setHistorySchema(sc); return sc; });
  const handleHistoryTemplate = async () => {
    try {
      downloadTemplate(await loadHistorySchema(), { fileName: "Payroll History Import Template.xlsx" });
    } catch (err: any) {
      toast({ title: "Error", description: err?.message ?? "Failed to download the template.", variant: "destructive" });
    }
  };
  const handleHistoryImport = async () => {
    try {
      setImportSchema(await loadHistorySchema());
    } catch (err: any) {
      toast({ title: "Error", description: err?.message ?? "Could not open the import.", variant: "destructive" });
    }
  };

  const handleDelete = async (run: PayrollRun) => {
    const label = `${monthName(run.pay_month)} ${run.pay_year}`;
    if (!confirm(`Delete the ${label} payroll (${run.payslips_count ?? 0} payslips, ${run.status})? This cannot be undone.`)) return;
    setDeletingId(run.id);
    try {
      toast({ title: "Deleted", description: await deletePayrollRun(run.id) });
      loadRuns();
      loadStats();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message ?? "Failed to delete the payroll.", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

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

  const handleReopen = async (run: PayrollRun) => {
    const label = `${monthName(run.pay_month)} ${run.pay_year}`;
    if (!confirm(`Send the ${label} payroll back to draft to correct it? Its payroll entry in the books is reversed until it is approved again.`)) return;
    setReopeningId(run.id);
    try {
      await reopenPayrollRun(run.id);
      toast({ title: "Back to draft", description: `${label} can now be re-processed and approved again.` });
      loadRuns();
      loadStats();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message ?? "Could not send the payroll back to draft.", variant: "destructive" });
    } finally {
      setReopeningId(null);
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
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setLedgerOpen(true)} title="Payroll accounts in the books: payables, entries (Dr/Cr) and payees">
            <BookOpen className="h-4 w-4 mr-2" />
            Open Ledger
          </Button>
          {hasPermission("can_create_payroll") && (
            <>
              <Button variant="outline" onClick={handleHistoryTemplate} title="Excel template for past payrolls: one row per employee per month">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                History Template
              </Button>
              <Button variant="outline" onClick={handleHistoryImport} title="Upload past payrolls from Excel - previewed before anything is saved">
                <Upload className="h-4 w-4 mr-2" />
                Import Payroll History
              </Button>
            </>
          )}
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Run
          </Button>
        </div>
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
                stats?.runs_this_year ?? 0
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
                formatKES(stats?.total_net_paid_this_year ?? 0)
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
                stats?.last_run?.payslips_count ?? 0
              )}
            </div>
            <p className="text-xs text-muted-foreground">employees</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="runs">Payroll Runs</TabsTrigger>
          <TabsTrigger value="statutory">Statutory Payments</TabsTrigger>
          <TabsTrigger value="history">Payment History</TabsTrigger>
        </TabsList>

        <TabsContent value="statutory">
          {tab === "statutory" && <StatutoryPaymentsTab />}
        </TabsContent>
        <TabsContent value="history">
          {tab === "history" && <PaymentHistoryTab />}
        </TabsContent>

        <TabsContent value="runs" className="space-y-4">
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
                <TableHead className="w-14">S/No</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Paid Date</TableHead>
                <TableHead>Paid From</TableHead>
                <TableHead>Employees</TableHead>
                <TableHead className="text-right">Total Gross</TableHead>
                <TableHead className="text-right">Total Net</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runsLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                      Loading...
                    </div>
                  </TableCell>
                </TableRow>
              ) : runs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center py-12 text-muted-foreground"
                  >
                    No payroll runs yet
                  </TableCell>
                </TableRow>
              ) : (
                runs.map((run, index) => (
                  <React.Fragment key={run.id}>
                  {(index === 0 || runs[index - 1].pay_year !== run.pay_year) && (
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableCell colSpan={9} className="py-2 font-semibold text-sm">
                        {run.pay_year}
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow>
                    <TableCell className="text-muted-foreground">{(currentPage - 1) * rowsPerPage + index + 1}</TableCell>
                    <TableCell className="font-medium">
                      {monthName(run.pay_month)} {run.pay_year}
                      {run.is_historical && (
                        <Badge variant="outline" className="ml-2 text-[10px] bg-slate-50 text-slate-600" title="A past payroll entered for the record: figures as typed, not posted to the books">
                          Record
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(run.status)}</TableCell>
                    <TableCell className="whitespace-nowrap">{run.status === "paid" && (run.payment_date || run.paid_at) ? displayDate(run.payment_date || run.paid_at) : "-"}</TableCell>
                    <TableCell className="text-sm">
                      {run.payment_account?.account_name ?? "-"}
                      {run.payment_reference && <div className="text-xs text-muted-foreground">ref {run.payment_reference}</div>}
                    </TableCell>
                    <TableCell>{run.payslips_count ?? 0}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatKES(run.total_gross)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {formatKES(run.total_net)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-1 justify-end">
                        {run.status === "draft" && !run.is_historical && hasPermission("can_create_payroll") && (
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
                        {run.status === "approved" && !run.is_historical && hasPermission("can_process_payroll") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Initiate payment (prepare the payment voucher - no bank entry yet)"
                            onClick={() => setPayTarget({ run, mode: "initiate" })}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        )}
                        {(run.status === "approved" || run.status === "payment_initiated") && !run.is_historical && hasPermission("can_process_payroll") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Confirm paid - choose the bank account, date and reference; posts to the bank"
                            onClick={() => setPayTarget({ run, mode: "confirm" })}
                          >
                            <CreditCard className="h-4 w-4 text-green-700" />
                          </Button>
                        )}
                        {(run.status === "approved" || run.status === "payment_initiated") && !run.is_historical && hasPermission("can_approve_payroll") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Send back to draft to correct"
                            onClick={() => handleReopen(run)}
                            disabled={reopeningId === run.id}
                          >
                            <Undo2 className="h-4 w-4" />
                          </Button>
                        )}
                        {hasPermission("can_delete_payroll") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Delete this payroll"
                            onClick={() => handleDelete(run)}
                            disabled={deletingId === run.id}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
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
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalItems > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * rowsPerPage + 1} to{" "}
            {Math.min(currentPage * rowsPerPage, totalItems)} of {totalItems}{" "}
            runs
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows per page</span>
            <Select
              value={String(rowsPerPage)}
              onValueChange={(v) => { setRowsPerPage(Number(v)); setCurrentPage(1); }}
            >
              <SelectTrigger className="h-8 w-[72px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[12, 24, 60, 120].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              title="First page"
            >
              First
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              title="Previous page"
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
              disabled={currentPage >= totalPages}
              title="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage >= totalPages}
              title="Last page"
            >
              Last
            </Button>
          </div>
        </div>
      )}
        </TabsContent>
      </Tabs>

      <PayrollLedgerDialog open={ledgerOpen} onOpenChange={setLedgerOpen} />

      <PayRunDialog
        run={payTarget?.run ?? null}
        mode={payTarget?.mode ?? "confirm"}
        onClose={() => setPayTarget(null)}
        onDone={() => { loadRuns(); loadStats(); }}
      />

      <ImportDialog
        schema={importSchema}
        onClose={() => setImportSchema(null)}
        onImported={() => { loadRuns(); loadStats(); }}
      />

      {/* New Run Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Payroll Run</DialogTitle>
            <DialogDescription>
              Start a new monthly payroll run. Select the month and year for
              the pay period. For past months with the figures actually paid,
              use Import Payroll History instead.
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
                min={2000}
                max={new Date().getFullYear() + 1}
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
