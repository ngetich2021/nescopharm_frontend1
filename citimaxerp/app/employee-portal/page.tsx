"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  createEmployeePortalLeaveRequest,
  createEmployeePortalSalaryAdvance,
  createEmployeePortalDailyReport,
  deleteEmployeePortalDailyReport,
  getEmployeePortalLeaveRequests,
  getEmployeePortalProfile,
  getEmployeePortalSalaryAdvances,
  getEmployeePortalDailyReports,
} from "@/lib/employee-portal";
import { getLeaveRequests, approveLeaveRequest, updateLeaveRequest } from "@/lib/leave";
import { getSalaryAdvances, approveSalaryAdvance, updateSalaryAdvance } from "@/lib/salary-advance";
import { getDailyReports, approveDailyReport, rejectDailyReport, isSunday, getEntriesForDate, saveDraftReport, getDraftReport, clearDraftReport, isFormComplete, shouldAutoSubmit } from "@/lib/daily-reports";
import { useAuth } from "@/lib/auth-context";
import type { Employee } from "@/lib/employees";
import type { LeaveRequest } from "@/lib/leave";
import type { SalaryAdvanceRequest } from "@/lib/salary-advance";
import type { DailyWorkReport, DailyWorkReportEntry } from "@/lib/daily-reports";
import { Briefcase, CalendarDays, CreditCard, UserRound, FileBarChart, ShieldCheck, CheckCircle2, XCircle, Plus, Trash2 } from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-green-100 text-green-800",
  paid: "bg-green-100 text-green-800",
  pending: "bg-amber-100 text-amber-800",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-slate-100 text-slate-700",
  inactive: "bg-slate-100 text-slate-700",
  active: "bg-emerald-100 text-emerald-800",
  terminated: "bg-red-100 text-red-800",
};

function formatStatus(status?: string | null) {
  if (!status) return "Not set";
  return status.replace(/_/g, " ");
}

function formatMoney(amount?: string | number | null) {
  const value = Number(amount || 0);
  return `KES ${value.toLocaleString()}`;
}

function getStatusClass(status?: string | null) {
  if (!status) return "bg-slate-100 text-slate-700";
  return STATUS_STYLES[status.toLowerCase()] || "bg-slate-100 text-slate-700";
}

export default function EmployeePortalPage() {
  const { toast } = useToast();
  const { hasPermission, user } = useAuth();
  const canApproveLeave = hasPermission("can_approve_leave");
  const canApproveSalary = hasPermission("can_approve_salary_changes");
  const canApproveDailyReports = hasPermission("can_approve_daily_reports");
  const isGMOrDirector = user?.role?.name && (user.role.name === 'GM' || user.role.name === 'Director');
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [salaryAdvances, setSalaryAdvances] = useState<SalaryAdvanceRequest[]>([]);
  const [dailyReports, setDailyReports] = useState<DailyWorkReport[]>([]);
  const [pendingLeaveApprovals, setPendingLeaveApprovals] = useState<LeaveRequest[]>([]);
  const [pendingAdvanceApprovals, setPendingAdvanceApprovals] = useState<SalaryAdvanceRequest[]>([]);
  const [pendingDailyReportApprovals, setPendingDailyReportApprovals] = useState<DailyWorkReport[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [leaveForm, setLeaveForm] = useState({
    leave_type: "annual",
    start_date: "",
    end_date: "",
    reason: "",
  });
  const [advanceForm, setAdvanceForm] = useState({
    amount: "",
    request_date: "",
    reason: "",
  });
  const [dailyReportForm, setDailyReportForm] = useState<{
    report_date: string;
    entries: DailyWorkReportEntry[];
    key_achievements: string;
    pending_work: string;
  }>({
    report_date: new Date().toISOString().split('T')[0], // Set to today
    entries: getEntriesForDate(new Date().toISOString().split('T')[0]).map((entry) => ({ ...entry })),
    key_achievements: "",
    pending_work: "",
  });
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [viewingReportId, setViewingReportId] = useState<string | null>(null);
  const [editReportForm, setEditReportForm] = useState<{
    report_date: string;
    entries: DailyWorkReportEntry[];
    key_achievements: string;
    pending_work: string;
  } | null>(null);
  const [submittingEditReport, setSubmittingEditReport] = useState(false);
  const [reportDateFilter, setReportDateFilter] = useState<string>("");
  const [submittingLeave, setSubmittingLeave] = useState(false);
  const [submittingAdvance, setSubmittingAdvance] = useState(false);
  const [submittingDailyReport, setSubmittingDailyReport] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [profile, leaveData, advanceData, dailyReportData] = await Promise.all([
        getEmployeePortalProfile(),
        getEmployeePortalLeaveRequests(),
        getEmployeePortalSalaryAdvances(),
        getEmployeePortalDailyReports(),
      ]);
      setEmployee(profile);
      setLeaveRequests(leaveData);
      setSalaryAdvances(advanceData);
      setDailyReports(dailyReportData);
    } catch (error: any) {
      toast({
        title: "Employee Portal",
        description: error.message || "Failed to load employee portal.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };


  // Separate from the self-service data above: what THIS user (as an
  // approver - GM/Director, or explicitly granted approval rights) needs to
  // review for other employees. Fetched independently so an ordinary
  // employee without approval rights never triggers this (and never sees a
  // needless 403) - the section itself is only rendered when eligible too.
  const loadPendingApprovals = async () => {
    try {
      const [leaveData, advanceData, dailyReportData] = await Promise.all([
        canApproveLeave ? getLeaveRequests({ status: "pending" }) : Promise.resolve([]),
        canApproveSalary ? getSalaryAdvances({ status: "pending" }) : Promise.resolve([]),
        canApproveDailyReports ? getDailyReports({ status: "pending" }) : Promise.resolve([]),
      ]);
      setPendingLeaveApprovals(leaveData);
      setPendingAdvanceApprovals(advanceData);
      setPendingDailyReportApprovals(dailyReportData);
    } catch (error: any) {
      // Non-fatal - the self-service portal above still works either way.
      console.error("Failed to load pending approvals", error);
    }
  };

  useEffect(() => {
    loadData();
    loadPendingApprovals();
  }, []);

  const handleApproveLeave = async (id: string) => {
    setApprovingId(id);
    try {
      await approveLeaveRequest(id);
      toast({ title: "Success", description: "Leave request approved." });
      loadPendingApprovals();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to approve leave request.", variant: "destructive" });
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejectLeave = async (id: string) => {
    setApprovingId(id);
    try {
      await updateLeaveRequest(id, { status: "rejected" });
      toast({ title: "Leave request rejected" });
      loadPendingApprovals();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to reject leave request.", variant: "destructive" });
    } finally {
      setApprovingId(null);
    }
  };

  const handleApproveAdvance = async (id: string) => {
    setApprovingId(id);
    try {
      await approveSalaryAdvance(id);
      toast({ title: "Success", description: "Salary advance approved." });
      loadPendingApprovals();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to approve salary advance.", variant: "destructive" });
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejectAdvance = async (id: string) => {
    setApprovingId(id);
    try {
      await updateSalaryAdvance(id, { status: "rejected" });
      toast({ title: "Salary advance rejected" });
      loadPendingApprovals();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to reject salary advance.", variant: "destructive" });
    } finally {
      setApprovingId(null);
    }
  };

  const handleApproveDailyReport = async (id: string) => {
    setApprovingId(id);
    try {
      await approveDailyReport(id);
      toast({ title: "Success", description: "Daily work report approved." });
      loadPendingApprovals();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to approve daily work report.", variant: "destructive" });
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejectDailyReport = async (id: string) => {
    setApprovingId(id);
    try {
      await rejectDailyReport(id);
      toast({ title: "Daily work report rejected" });
      loadPendingApprovals();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to reject daily work report.", variant: "destructive" });
    } finally {
      setApprovingId(null);
    }
  };

  const updateDailyReportEntry = (index: number, value: string) => {
    setDailyReportForm((prev) => ({
      ...prev,
      entries: prev.entries.map((entry, i) => (i === index ? { ...entry, activity: value } : entry)),
    }));
  };

  const handleDailyReportDateChange = (date: string) => {
    setDailyReportForm((prev) => ({
      ...prev,
      report_date: date,
      entries: getEntriesForDate(date).map((entry) => ({ ...entry })),
    }));

    // Load any existing draft for this date
    const draft = getDraftReport(date);
    if (draft) {
      setDailyReportForm((prev) => ({
        ...prev,
        ...draft,
        report_date: date,
      }));
    }
  };

  const handleSaveDraft = () => {
    if (!dailyReportForm.report_date) {
      toast({ title: "Error", description: "Please select a report date.", variant: "destructive" });
      return;
    }
    saveDraftReport(dailyReportForm.report_date, dailyReportForm);
    toast({ title: "Draft saved", description: "Your progress has been saved." });
  };

  const handleEditReport = (report: DailyWorkReport) => {
    setEditingReportId(report.id);
    setEditReportForm({
      report_date: report.reportDate,
      entries: report.entries || [],
      key_achievements: report.keyAchievements || "",
      pending_work: report.pendingWork || "",
    });
  };

  const handleEditReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReportId || !editReportForm) return;
    if (submittingEditReport) return;

    setSubmittingEditReport(true);
    try {
      // Delete old report and create new one with updated data
      await deleteEmployeePortalDailyReport(editingReportId);

      await createEmployeePortalDailyReport({
        report_date: editReportForm.report_date,
        entries: editReportForm.entries,
        key_achievements: editReportForm.key_achievements,
        pending_work: editReportForm.pending_work,
      });

      toast({ title: "Success", description: "Daily work report updated and resubmitted." });
      setEditingReportId(null);
      setEditReportForm(null);
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to update daily work report.", variant: "destructive" });
    } finally {
      setSubmittingEditReport(false);
    }
  };

  const handleDailyReportSubmit = async (e: React.FormEvent, isAutoSubmit: boolean = false) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }

    if (submittingDailyReport) return;
    if (!dailyReportForm.report_date) {
      if (!isAutoSubmit) {
        toast({ title: "Error", description: "Please select a report date.", variant: "destructive" });
      }
      return;
    }
    if (isSunday(dailyReportForm.report_date)) {
      if (!isAutoSubmit) {
        toast({
          title: "Sundays are skipped",
          description: "Daily work reports are not required on Sundays. Please pick another date.",
          variant: "destructive",
        });
      }
      return;
    }

    setSubmittingDailyReport(true);
    try {
      await createEmployeePortalDailyReport({
        report_date: dailyReportForm.report_date,
        entries: dailyReportForm.entries,
        key_achievements: dailyReportForm.key_achievements,
        pending_work: dailyReportForm.pending_work,
      });

      if (!isAutoSubmit) {
        toast({ title: "Success", description: "Daily work report submitted." });
      }

      clearDraftReport(dailyReportForm.report_date);
      const today = new Date().toISOString().split('T')[0];
      setDailyReportForm({
        report_date: today,
        entries: getEntriesForDate(today).map((entry) => ({ ...entry })),
        key_achievements: "",
        pending_work: "",
      });
      loadData();
    } catch (error: any) {
      if (!isAutoSubmit) {
        toast({ title: "Error", description: error.message || "Failed to submit daily work report.", variant: "destructive" });
      }
    } finally {
      setSubmittingDailyReport(false);
    }
  };

  // Auto-submit at 8:00 PM regardless of completion
  useEffect(() => {
    if (!dailyReportForm.report_date || dailyReportForm.entries.length === 0) return;

    const checkAndAutoSubmit = () => {
      if (shouldAutoSubmit()) {
        handleDailyReportSubmit(null as any, true);
      }
    };

    const timer = setInterval(checkAndAutoSubmit, 60000); // Check every minute
    return () => clearInterval(timer);
  }, [dailyReportForm]);

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Guard against double-submission (double-click, slow network + repeat
    // click, etc.) creating multiple identical requests.
    if (submittingLeave) return;
    setSubmittingLeave(true);
    try {
      await createEmployeePortalLeaveRequest(leaveForm);
      toast({ title: "Success", description: "Leave request submitted." });
      setLeaveForm({ leave_type: "annual", start_date: "", end_date: "", reason: "" });
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to submit leave request.", variant: "destructive" });
    } finally {
      setSubmittingLeave(false);
    }
  };

  const handleAdvanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingAdvance) return;
    setSubmittingAdvance(true);
    try {
      await createEmployeePortalSalaryAdvance({
        amount: Number(advanceForm.amount),
        request_date: advanceForm.request_date,
        reason: advanceForm.reason,
      });
      toast({ title: "Success", description: "Salary advance request submitted." });
      setAdvanceForm({ amount: "", request_date: "", reason: "" });
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to submit salary advance request.", variant: "destructive" });
    } finally {
      setSubmittingAdvance(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading employee portal...</div>;
  }

  if (!employee) {
    return <div className="p-6 text-sm text-muted-foreground">No employee profile is linked to this login yet.</div>;
  }

  const employeeStatus = employee.employment_status || (employee.is_active ? "active" : "inactive");
  const pendingLeaveCount = leaveRequests.filter((item) => item.status.toLowerCase() === "pending").length;
  const pendingAdvanceCount = salaryAdvances.filter((item) => item.status.toLowerCase() === "pending").length;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-800 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <Badge className="w-fit border border-white/20 bg-white/10 text-white hover:bg-white/10">Employee Portal</Badge>
            <div className="space-y-1">
              <h1 className="text-3xl font-bold tracking-tight">
                {[employee.first_name, employee.last_name].filter(Boolean).join(" ") || "Employee Workspace"}
              </h1>
              <p className="max-w-2xl text-sm text-slate-200">
                Submit leave and salary advance requests, track approval progress, and see who is responsible for reviewing each request.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="border-white/10 bg-white/10 text-white shadow-none">
              <CardContent className="flex items-center gap-3 p-4">
                <UserRound className="h-5 w-5 text-emerald-200" />
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-300">Status</p>
                  <p className="text-sm font-semibold capitalize">{formatStatus(employeeStatus)}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-white/10 text-white shadow-none">
              <CardContent className="flex items-center gap-3 p-4">
                <CalendarDays className="h-5 w-5 text-emerald-200" />
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-300">Pending Leave</p>
                  <p className="text-sm font-semibold">{pendingLeaveCount}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-white/10 text-white shadow-none">
              <CardContent className="flex items-center gap-3 p-4">
                <CreditCard className="h-5 w-5 text-emerald-200" />
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-300">Pending Advances</p>
                  <p className="text-sm font-semibold">{pendingAdvanceCount}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {(canApproveLeave || canApproveSalary || canApproveDailyReports) && (
        <Card className="shadow-sm border-amber-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Pending Approvals
              {(pendingLeaveApprovals.length + pendingAdvanceApprovals.length + pendingDailyReportApprovals.length) > 0 && (
                <Badge className="bg-amber-100 text-amber-800">
                  {pendingLeaveApprovals.length + pendingAdvanceApprovals.length + pendingDailyReportApprovals.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingLeaveApprovals.length === 0 && pendingAdvanceApprovals.length === 0 && pendingDailyReportApprovals.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing waiting on your review right now.</p>
            ) : (
              <>
                {canApproveLeave && pendingLeaveApprovals.map((req) => (
                  <div key={req.id} className="flex items-center justify-between rounded-xl border p-3">
                    <div>
                      <p className="text-sm font-semibold">{req.employee} - {req.leaveType} leave</p>
                      <p className="text-xs text-muted-foreground">{req.startDate} to {req.endDate}</p>
                      {req.reason && <p className="text-xs text-muted-foreground mt-1">{req.reason}</p>}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-700 border-green-300 hover:bg-green-50"
                        disabled={approvingId === req.id}
                        onClick={() => handleApproveLeave(req.id)}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-700 border-red-300 hover:bg-red-50"
                        disabled={approvingId === req.id}
                        onClick={() => handleRejectLeave(req.id)}
                      >
                        <XCircle className="h-4 w-4 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                ))}
                {canApproveSalary && pendingAdvanceApprovals.map((adv) => (
                  <div key={adv.id} className="flex items-center justify-between rounded-xl border p-3">
                    <div>
                      <p className="text-sm font-semibold">{adv.employee} - {formatMoney(adv.amount)}</p>
                      <p className="text-xs text-muted-foreground">Requested {adv.requestDate}</p>
                      {adv.reason && <p className="text-xs text-muted-foreground mt-1">{adv.reason}</p>}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-700 border-green-300 hover:bg-green-50"
                        disabled={approvingId === adv.id}
                        onClick={() => handleApproveAdvance(adv.id)}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-700 border-red-300 hover:bg-red-50"
                        disabled={approvingId === adv.id}
                        onClick={() => handleRejectAdvance(adv.id)}
                      >
                        <XCircle className="h-4 w-4 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                ))}
                {canApproveDailyReports && pendingDailyReportApprovals.map((report) => (
                  <div key={report.id} className="flex items-center justify-between rounded-xl border p-3">
                    <div>
                      <p className="text-sm font-semibold">{report.employee} - Daily Work Report</p>
                      <p className="text-xs text-muted-foreground">{report.reportDate}</p>
                      {report.keyAchievements && <p className="text-xs text-muted-foreground mt-1">{report.keyAchievements}</p>}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-700 border-green-300 hover:bg-green-50"
                        disabled={approvingId === report.id}
                        onClick={() => handleApproveDailyReport(report.id)}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-700 border-red-300 hover:bg-red-50"
                        disabled={approvingId === report.id}
                        onClick={() => handleRejectDailyReport(report.id)}
                      >
                        <XCircle className="h-4 w-4 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Employment Summary</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Department</p>
              <p className="mt-2 text-sm font-semibold">{employee.department || "Not assigned"}</p>
            </div>
            <div className="rounded-2xl border bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Position</p>
              <p className="mt-2 text-sm font-semibold">{employee.position || "Not assigned"}</p>
            </div>
            <div className="rounded-2xl border bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Employee Number</p>
              <p className="mt-2 text-sm font-semibold">{employee.employee_number || "Pending"}</p>
            </div>
            <div className="rounded-2xl border bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Basic Salary</p>
              <p className="mt-2 text-sm font-semibold">{employee.basic_salary ? formatMoney(employee.basic_salary) : "Not set"}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Approval Routing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border p-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-emerald-700" />
                <p className="text-sm font-semibold">Leave Approver</p>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {employee.leave_approver
                  ? `${employee.leave_approver.first_name} ${employee.leave_approver.last_name}`.trim()
                  : "No leave approver has been assigned yet."}
              </p>
            </div>
            <div className="rounded-2xl border p-4">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-emerald-700" />
                <p className="text-sm font-semibold">Salary Advance Approver</p>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {employee.salary_advance_approver
                  ? `${employee.salary_advance_approver.first_name} ${employee.salary_advance_approver.last_name}`.trim()
                  : "No salary advance approver has been assigned yet."}
              </p>
            </div>
            <div className="rounded-2xl border p-4">
              <div className="flex items-center gap-2">
                <FileBarChart className="h-4 w-4 text-emerald-700" />
                <p className="text-sm font-semibold">Daily Report Approver</p>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Routed automatically to the GM, or the Managing Director if you are the GM.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="leave" className="space-y-4">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="leave">Leave</TabsTrigger>
          <TabsTrigger value="salary">Salary Advance</TabsTrigger>
          <TabsTrigger value="daily-reports">Daily Reports</TabsTrigger>
          <TabsTrigger value="data-privacy">Data Privacy &amp; Security</TabsTrigger>
        </TabsList>

        <TabsContent value="leave" className="grid gap-4 xl:grid-cols-[1.05fr_1.2fr]">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Apply for Leave</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLeaveSubmit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Leave Type</Label>
                    <Input value={leaveForm.leave_type} onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value })} placeholder="annual" />
                  </div>
                  <div className="rounded-2xl border bg-slate-50 p-4 text-sm text-muted-foreground">
                    Requests submitted here also appear in the main leave management table for authorized reviewers.
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input type="date" value={leaveForm.start_date} onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input type="date" value={leaveForm.end_date} onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Textarea value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} rows={5} />
                </div>
                <Button type="submit" disabled={submittingLeave}>
                  {submittingLeave ? "Submitting..." : "Submit Leave Request"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Recent Leave Requests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {leaveRequests.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                  No leave requests yet. Your submissions will show here and on the HR leave management table.
                </div>
              ) : (
                leaveRequests.map((request) => (
                  <div key={request.id} className="rounded-2xl border p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold capitalize">{formatStatus(request.leaveType)} leave</p>
                        <p className="text-sm text-muted-foreground">
                          {request.startDate} to {request.endDate}
                        </p>
                      </div>
                      <Badge className={getStatusClass(request.status)}>{formatStatus(request.status)}</Badge>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">{request.reason}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="salary" className="grid gap-4 xl:grid-cols-[1.05fr_1.2fr]">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Request Salary Advance</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAdvanceSubmit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Amount</Label>
                    <Input type="number" value={advanceForm.amount} onChange={(e) => setAdvanceForm({ ...advanceForm, amount: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Request Date</Label>
                    <Input type="date" value={advanceForm.request_date} onChange={(e) => setAdvanceForm({ ...advanceForm, request_date: e.target.value })} />
                  </div>
                </div>
                <div className="rounded-2xl border bg-slate-50 p-4 text-sm text-muted-foreground">
                  Salary advance requests submitted here feed into the salary advance management page for reviewers and finance teams.
                </div>
                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Textarea value={advanceForm.reason} onChange={(e) => setAdvanceForm({ ...advanceForm, reason: e.target.value })} rows={5} />
                </div>
                <Button type="submit" disabled={submittingAdvance}>
                  {submittingAdvance ? "Submitting..." : "Submit Salary Advance Request"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Recent Salary Advance Requests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {salaryAdvances.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                  No salary advance requests yet. Submitted requests will show here and in the HR salary advance table.
                </div>
              ) : (
                salaryAdvances.map((request) => (
                  <div key={request.id} className="rounded-2xl border p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold">{formatMoney(request.amount)}</p>
                        <p className="text-sm text-muted-foreground">{request.requestDate}</p>
                      </div>
                      <Badge className={getStatusClass(request.status)}>{formatStatus(request.status)}</Badge>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">{request.reason}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="daily-reports" className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Submit Daily Work Report</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleDailyReportSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    className="max-w-xs"
                    value={dailyReportForm.report_date}
                    onChange={(e) => handleDailyReportDateChange(e.target.value)}
                  />
                  {dailyReportForm.report_date && isSunday(dailyReportForm.report_date) && (
                    <p className="text-xs text-red-600">Sundays are skipped - no report is required that day. Please pick another date.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Work / Activity Log</Label>
                  <p className="text-xs text-muted-foreground">You can save your progress and submit later. The form will auto-submit at 8:00 PM daily (except Sundays).</p>
                  <div className="space-y-4">
                    {dailyReportForm.entries.map((entry, index) => (
                      <div key={index} className="space-y-2 rounded-xl border p-4">
                        <div className="flex items-center justify-between">
                          <Label className="font-semibold text-base">{entry.time}</Label>
                        </div>
                        <Textarea
                          placeholder="Describe your activities for this time period..."
                          rows={4}
                          value={entry.activity}
                          onChange={(e) => updateDailyReportEntry(index, e.target.value)}
                          className="resize-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Today&apos;s Key Achievements</Label>
                    <Textarea
                      rows={4}
                      value={dailyReportForm.key_achievements}
                      onChange={(e) => setDailyReportForm({ ...dailyReportForm, key_achievements: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Pending Work / Challenges</Label>
                    <Textarea
                      rows={4}
                      value={dailyReportForm.pending_work}
                      onChange={(e) => setDailyReportForm({ ...dailyReportForm, pending_work: e.target.value })}
                    />
                  </div>
                </div>


                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={handleSaveDraft}>
                    Save Draft
                  </Button>
                  {isFormComplete(dailyReportForm.entries, dailyReportForm.key_achievements, dailyReportForm.pending_work) && (
                    <Button type="submit" disabled={submittingDailyReport}>
                      {submittingDailyReport ? "Submitting..." : "Submit Daily Work Report"}
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>Recent Daily Reports</CardTitle>
                <Input
                  type="date"
                  placeholder="Filter by date"
                  value={reportDateFilter}
                  onChange={(e) => setReportDateFilter(e.target.value)}
                  className="max-w-xs"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {dailyReports.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                  No daily work reports yet. Submitted reports will show here.
                </div>
              ) : (
                dailyReports
                  .filter((report) => !reportDateFilter || report.reportDate === reportDateFilter)
                  .map((report) => (
                    <div key={report.id} className="rounded-2xl border">
                      <button
                        onClick={() => setViewingReportId(viewingReportId === report.id ? null : report.id)}
                        className="w-full p-4 text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
                      >
                        <div className="flex-1 space-y-1">
                          <p className="text-sm font-semibold">{report.reportDate}</p>
                          <p className="text-xs text-muted-foreground">
                            {report.approverRole ? `Approver: ${report.approverRole}` : "Self-certified"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusClass(report.status)}>{formatStatus(report.status)}</Badge>
                          <span className="text-gray-400 text-sm">
                            {viewingReportId === report.id ? "▼" : "▶"}
                          </span>
                        </div>
                      </button>

                      {viewingReportId === report.id && (
                        <div className="border-t p-4 bg-gray-50 space-y-3">
                          <div className="space-y-2">
                            <p className="text-sm font-semibold">Work / Activity Log</p>
                            {report.entries && report.entries.length > 0 ? (
                              <div className="space-y-2">
                                {report.entries.map((entry, idx) => (
                                  <div key={idx} className="rounded-lg border bg-white p-3">
                                    <p className="text-xs font-medium text-gray-600">{entry.time}</p>
                                    <p className="mt-1 text-sm text-gray-700">{entry.activity || "—"}</p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">No activities recorded</p>
                            )}
                          </div>

                          {report.keyAchievements && (
                            <div>
                              <p className="text-sm font-semibold mb-1">Key Achievements</p>
                              <p className="text-sm text-gray-700">{report.keyAchievements}</p>
                            </div>
                          )}

                          {report.pendingWork && (
                            <div>
                              <p className="text-sm font-semibold mb-1">Pending Work / Challenges</p>
                              <p className="text-sm text-gray-700">{report.pendingWork}</p>
                            </div>
                          )}

                          {report.status === "rejected" && report.rejectionReason && (
                            <div className="rounded-lg bg-red-50 p-3">
                              <p className="text-sm font-semibold text-red-600 mb-1">Rejection Reason</p>
                              <p className="text-sm text-red-600">{report.rejectionReason}</p>
                            </div>
                          )}

                          <div className="flex gap-2 pt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setViewingReportId(null)}
                            >
                              Close
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
              )}
              {dailyReports.length > 0 && reportDateFilter && dailyReports.filter((r) => r.reportDate === reportDateFilter).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No reports found for this date.</p>
              )}
            </CardContent>
          </Card>

          {isGMOrDirector && (
            <Card className="shadow-sm xl:col-span-2">
              <CardHeader>
                <CardTitle>Pending Staff Reports - Resubmit</CardTitle>
                <p className="text-sm text-muted-foreground mt-2">As a {user?.role?.name}, you can edit and resubmit pending reports from your staff members.</p>
              </CardHeader>
              <CardContent>
                {pendingDailyReportApprovals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No pending reports to review.</p>
                ) : (
                  <div className="space-y-3">
                    {pendingDailyReportApprovals.map((report) => (
                      <div key={report.id} className="flex items-center justify-between rounded-lg border p-4">
                        <div>
                          <p className="font-medium">{report.employee}</p>
                          <p className="text-xs text-muted-foreground">{report.reportDate}</p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleEditReport(report)}
                        >
                          Resubmit
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {editingReportId && editReportForm && (
            <Card className="shadow-sm xl:col-span-2 border-blue-200 bg-blue-50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Resubmit Daily Work Report</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingReportId(null);
                      setEditReportForm(null);
                    }}
                  >
                    ✕
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleEditReportSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Work / Activity Log</Label>
                    <div className="space-y-4">
                      {editReportForm.entries.map((entry, index) => (
                        <div key={index} className="space-y-2 rounded-xl border p-4">
                          <Label className="font-semibold text-base">{entry.time}</Label>
                          <Textarea
                            placeholder="Describe your activities for this time period..."
                            rows={4}
                            value={entry.activity}
                            onChange={(e) => {
                              setEditReportForm((prev) => ({
                                ...prev!,
                                entries: prev!.entries.map((ent, i) => (i === index ? { ...ent, activity: e.target.value } : ent)),
                              }));
                            }}
                            className="resize-none"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Key Achievements</Label>
                      <Textarea
                        rows={4}
                        value={editReportForm.key_achievements}
                        onChange={(e) =>
                          setEditReportForm((prev) => ({
                            ...prev!,
                            key_achievements: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Pending Work / Challenges</Label>
                      <Textarea
                        rows={4}
                        value={editReportForm.pending_work}
                        onChange={(e) =>
                          setEditReportForm((prev) => ({
                            ...prev!,
                            pending_work: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>


                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setEditingReportId(null);
                        setEditReportForm(null);
                      }}
                    >
                      Cancel
                    </Button>
                    {isFormComplete(editReportForm.entries, editReportForm.key_achievements, editReportForm.pending_work) && (
                      <Button type="submit" disabled={submittingEditReport}>
                        {submittingEditReport ? "Resubmitting..." : "Resubmit Report"}
                      </Button>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="data-privacy">
          <Card className="shadow-sm">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <ShieldCheck className="h-10 w-10 text-muted-foreground" />
              <p className="text-lg font-semibold">Data Privacy and Security</p>
              <p className="text-sm text-muted-foreground">coming soon ...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
