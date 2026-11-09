"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getStaffActivity, type StaffActivity } from "@/lib/employee-portal";
import { leaveTypeLabel } from "@/lib/leave";
import { displayDate as formatDate } from "@/lib/date-format";

const STATUS: Record<string, string> = {
  approved: "bg-green-100 text-green-800",
  paid: "bg-green-100 text-green-800",
  pending: "bg-amber-100 text-amber-800",
  rejected: "bg-red-100 text-red-800",
};
const statusBadge = (s: string) => <Badge className={STATUS[s?.toLowerCase()] || "bg-slate-100 text-slate-700"}>{s?.replace(/_/g, " ")}</Badge>;
const money = (v: string | number) => `KES ${Number(v || 0).toLocaleString()}`;
const todayNairobi = () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });

/** Everyone's Employee Portal activity, for the GM and the Directors. */
export function StaffActivityPanel() {
  const [date, setDate] = useState(todayNairobi());
  const [data, setData] = useState<StaffActivity | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getStaffActivity(date)
      .then((d) => { if (live) { setData(d); setError(null); } })
      .catch((e) => { if (live) setError(e?.message || "Could not load staff activity."); });
    return () => { live = false; };
  }, [date]);

  const status = data?.daily_report_status;

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Staff Activity</CardTitle>
        <p className="text-sm text-muted-foreground">Every employee&apos;s daily reports, leave and salary advance requests. Daily reports close at 12 midnight.</p>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : !data ? (
          <p className="text-sm text-muted-foreground">Loading staff activity...</p>
        ) : (
          <Tabs defaultValue="today" className="space-y-4">
            <TabsList className="flex w-full flex-wrap h-auto">
              <TabsTrigger value="today">Reports by Day</TabsTrigger>
              <TabsTrigger value="reports">Daily Reports</TabsTrigger>
              <TabsTrigger value="leave">Leave</TabsTrigger>
              <TabsTrigger value="advances">Salary Advances</TabsTrigger>
            </TabsList>

            <TabsContent value="today" className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Input type="date" className="max-w-xs" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
                <span className="text-sm text-muted-foreground">
                  {formatDate(data.date)}: {status?.submitted.length ?? 0} sent, {status?.missing.length ?? 0} not sent
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border p-3">
                  <p className="mb-2 text-sm font-semibold text-red-700">Not sent ({status?.missing.length ?? 0})</p>
                  {status?.missing.length ? (
                    <table className="w-full text-sm">
                      <thead><tr className="text-left text-xs text-muted-foreground"><th className="w-10">S/No</th><th>Employee</th><th>Draft</th></tr></thead>
                      <tbody>
                        {status.missing.map((m, i) => (
                          <tr key={m.employee + i} className="border-t">
                            <td className="py-1">{i + 1}</td>
                            <td>{m.employee}</td>
                            <td className="text-xs text-muted-foreground">{m.has_draft ? "Writing - sent at midnight" : "Nothing written"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : <p className="text-xs text-muted-foreground">Everyone expected has sent their report.</p>}
                </div>
                <div className="rounded-xl border p-3">
                  <p className="mb-2 text-sm font-semibold text-green-700">Sent ({status?.submitted.length ?? 0})</p>
                  {status?.submitted.length ? (
                    <table className="w-full text-sm">
                      <thead><tr className="text-left text-xs text-muted-foreground"><th className="w-10">S/No</th><th>Employee</th><th>Status</th></tr></thead>
                      <tbody>
                        {status.submitted.map((s, i) => (
                          <tr key={s.employee + i} className="border-t">
                            <td className="py-1">{i + 1}</td>
                            <td>{s.employee}{s.auto_submitted && <span className="ml-1 text-xs text-muted-foreground">(sent at midnight)</span>}</td>
                            <td>{statusBadge(s.status)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : <p className="text-xs text-muted-foreground">No reports sent for this day yet.</p>}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="reports">
              <ActivityTable
                headers={["Employee", "Date", "Key Achievements", "Status"]}
                rows={data.daily_reports.map((r) => [
                  r.employee,
                  formatDate(r.reportDate),
                  <span key="k" className="line-clamp-2">{r.keyAchievements || "—"}{r.autoSubmitted ? " (sent at midnight)" : ""}</span>,
                  statusBadge(r.status),
                ])}
                empty="No daily reports yet."
              />
            </TabsContent>

            <TabsContent value="leave">
              <ActivityTable
                headers={["Employee", "Type", "From", "To", "Status"]}
                rows={data.leave_requests.map((l) => [l.employee, leaveTypeLabel(l.leaveType), formatDate(l.startDate), formatDate(l.endDate), statusBadge(l.status)])}
                empty="No leave requests yet."
              />
            </TabsContent>

            <TabsContent value="advances">
              <ActivityTable
                headers={["Employee", "Amount", "Requested", "Reason", "Status"]}
                rows={data.salary_advances.map((a) => [a.employee, money(a.amount), formatDate(a.requestDate), a.reason, statusBadge(a.status)])}
                empty="No salary advance requests yet."
              />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}

function ActivityTable({ headers, rows, empty }: { headers: string[]; rows: React.ReactNode[][]; empty: string }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th className="w-10 py-1">S/No</th>
            {headers.map((h) => <th key={h} className="py-1 pr-3">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i} className="border-t align-top">
              <td className="py-1.5">{i + 1}</td>
              {cells.map((c, j) => <td key={j} className="py-1.5 pr-3">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
