"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  PayrollRun,
  fetchPayrollRun,
  fetchPayslips,
  processPayrollRun,
  formatKES,
  monthName,
} from "@/lib/payroll-runs";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Download,
  Users,
  TrendingUp,
  Banknote,
  Receipt,
  ShieldCheck,
  Home,
  ChevronLeft,
  ChevronRight,
  Play,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ViewPayslipDialog } from "../components/ViewPayslipDialog";
import { EditPayslipDialog } from "../components/EditPayslipDialog";

interface Payslip {
  id: string;
  employee: {
    id: string;
    user?: { name: string };
    employee_number: string;
    first_name?: string;
    last_name?: string;
  };
  gross_pay: number | string;
  nssf_employee: number | string;
  paye: number | string;
  shif: number | string;
  housing_levy_employee: number | string;
  total_deductions: number | string;
  net_pay: number | string;
  [key: string]: any;
}

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

export default function PayrollRunDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const runId = params.id as string;

  const [run, setRun] = useState<PayrollRun | null>(null);
  const [runLoading, setRunLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [payslipsLoading, setPayslipsLoading] = useState(true);
  const [payslipsRefreshing, setPayslipsRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchDebounce, setSearchDebounce] = useState("");

  const [viewPayslip, setViewPayslip] = useState<Payslip | null>(null);
  const [editPayslip, setEditPayslip] = useState<Payslip | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleProcess = async () => {
    setProcessing(true);
    try {
      await processPayrollRun(runId);
      toast({ title: "Success", description: "Payroll processed successfully." });
      loadRun();
      loadPayslips();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message ?? "Failed to process payroll.", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const loadRun = useCallback(async () => {
    setRunLoading(true);
    setError(null);
    try {
      const data = await fetchPayrollRun(runId);
      setRun(data);
    } catch (err: any) {
      setError(err?.message || "Failed to fetch payroll run");
    } finally {
      setRunLoading(false);
    }
  }, [runId]);

  const loadPayslips = useCallback(async () => {
    const isInitial = payslips.length === 0;
    if (isInitial) setPayslipsLoading(true);
    else setPayslipsRefreshing(true);
    try {
      const res = await fetchPayslips(runId, {
        page: currentPage,
        per_page: rowsPerPage,
        search: searchDebounce || undefined,
      });
      setPayslips(res.data ?? []);
      setTotalPages(res.last_page ?? 1);
      setTotalItems(res.total ?? 0);
    } catch {
      toast({
        title: "Error",
        description: "Failed to load payslips.",
        variant: "destructive",
      });
    } finally {
      setPayslipsLoading(false);
      setPayslipsRefreshing(false);
    }
  }, [runId, currentPage, rowsPerPage, searchDebounce]);

  useEffect(() => {
    loadRun();
  }, [loadRun]);

  useEffect(() => {
    loadPayslips();
  }, [loadPayslips]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounce(searchQuery);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleExport = (type: 'csv' | 'p10') => {
    if (!run) return;
    const token = localStorage.getItem("token") ?? "";
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
    const url = `${base}/payroll-runs/${runId}/export/${type}`;
    const filename = type === 'p10'
      ? `P10-${run.pay_year}-${String(run.pay_month).padStart(2, "0")}.csv`
      : `payroll-${run.pay_year}-${String(run.pay_month).padStart(2, "0")}.csv`;

    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (!r.ok) throw new Error("Export failed");
        return r.blob();
      })
      .then((blob) => {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
      })
      .catch(() => {
        toast({ title: "Error", description: `Failed to export ${type.toUpperCase()}.`, variant: "destructive" });
      });
  };

  const getEmployeeName = (payslip: Payslip): string => {
    if (payslip.employee?.user?.name) return payslip.employee.user.name;
    if (payslip.employee?.first_name)
      return `${payslip.employee.first_name} ${payslip.employee.last_name ?? ""}`.trim();
    return "---";
  };

  if (runLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <span className="ml-2">Loading payroll run...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-500 mb-4">Error: {error}</div>
        <Button onClick={() => router.push("/hr/payroll")}>Go Back</Button>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 mb-4">Payroll run not found</div>
        <Button onClick={() => router.push("/hr/payroll")}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/hr/payroll")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {monthName(run.pay_month)} {run.pay_year}
            </h1>
          </div>
          {getStatusBadge(run.status)}
        </div>
        {run.status === "draft" && hasPermission("can_create_payroll") && (
          <Button
            size="sm"
            onClick={handleProcess}
            disabled={processing}
          >
            {processing ? (
              <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />Processing...</>
            ) : (
              <><Play className="h-4 w-4 mr-2" />{(run.payslips_count ?? 0) > 0 ? "Re-process Payroll" : "Process Payroll"}</>
            )}
          </Button>
        )}
      </div>

      {/* Summary Cards - 8 cards in responsive grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Employees</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {run.payslips_count ?? "---"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Gross</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {run.total_gross != null ? formatKES(run.total_gross) : "---"}
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Net</CardTitle>
            <Banknote className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-green-700">
              {run.total_net != null ? formatKES(run.total_net) : "---"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Deductions
            </CardTitle>
            <Receipt className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-red-600">
              {run.total_deductions != null
                ? formatKES(run.total_deductions)
                : "---"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total PAYE</CardTitle>
            <ShieldCheck className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {run.total_paye != null ? formatKES(run.total_paye) : "---"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total NSSF</CardTitle>
            <ShieldCheck className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {run.total_nssf_employee != null ? formatKES(run.total_nssf_employee) : "---"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total SHIF</CardTitle>
            <ShieldCheck className="h-4 w-4 text-teal-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {run.total_shif != null ? formatKES(run.total_shif) : "---"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Housing Levy</CardTitle>
            <Home className="h-4 w-4 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {run.total_housing_levy != null
                ? formatKES(run.total_housing_levy)
                : "---"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payslips Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <Input
              placeholder="Search by name, number, department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full sm:w-[300px]"
            />
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
                <Download className="h-4 w-4 mr-1.5" />
                Export CSV
              </Button>
              {run?.status !== "draft" && (
                <Button variant="outline" size="sm" onClick={() => handleExport('p10')}>
                  <Download className="h-4 w-4 mr-1.5" />
                  Export P10
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className={`transition-opacity duration-200 ${payslipsRefreshing ? "opacity-50 pointer-events-none" : ""}`}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">NSSF</TableHead>
                <TableHead className="text-right">PAYE</TableHead>
                <TableHead className="text-right">SHIF</TableHead>
                <TableHead className="text-right">H.Levy</TableHead>
                <TableHead className="text-right">Deductions</TableHead>
                <TableHead className="text-right">Net Pay</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payslipsLoading && payslips.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                      Loading...
                    </div>
                  </TableCell>
                </TableRow>
              ) : payslips.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center py-12 text-muted-foreground"
                  >
                    No payslips in this run
                  </TableCell>
                </TableRow>
              ) : (
                payslips.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{getEmployeeName(p)}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.employee?.employee_number}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatKES(p.gross_pay)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {formatKES(p.nssf_employee)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {formatKES(p.paye)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {formatKES(p.shif)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {formatKES(p.housing_levy_employee)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium text-red-600">
                      {formatKES(p.total_deductions)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {formatKES(p.net_pay)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setViewPayslip(p)}
                        >
                          View
                        </Button>
                        {run?.status === "draft" && hasPermission("can_update_payroll") && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditPayslip(p)}
                          >
                            Edit
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalItems > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * rowsPerPage + 1} to{" "}
              {Math.min(currentPage * rowsPerPage, totalItems)} of {totalItems}
            </p>
            <Select value={String(rowsPerPage)} onValueChange={(v) => { setRowsPerPage(Number(v)); setCurrentPage(1); }}>
              <SelectTrigger className="h-8 w-[110px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 rows</SelectItem>
                <SelectItem value="25">25 rows</SelectItem>
                <SelectItem value="50">50 rows</SelectItem>
                <SelectItem value="100">100 rows</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {totalPages > 1 && (
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
          )}
        </div>
      )}

      {/* View Payslip Dialog */}
      <ViewPayslipDialog
        open={viewPayslip !== null}
        onOpenChange={(open) => { if (!open) setViewPayslip(null) }}
        payslip={viewPayslip ? { ...viewPayslip, payroll_run: run ?? undefined } as any : null}
      />

      <EditPayslipDialog
        open={editPayslip !== null}
        onOpenChange={(open) => { if (!open) setEditPayslip(null) }}
        payslip={editPayslip as any}
        runId={runId}
        onSaved={() => { loadRun(); loadPayslips(); }}
      />
    </div>
  );
}
