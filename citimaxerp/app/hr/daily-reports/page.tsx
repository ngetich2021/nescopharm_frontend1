"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { getDailyReports, deleteEmployeePortalDailyReport } from "@/lib/daily-reports"
import type { DailyWorkReport, DailyWorkReportEntry } from "@/lib/daily-reports"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { ArrowUpDown, ArrowUp, ArrowDown, Eye, Edit2, MoreVertical, Check, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { approveDailyReport, rejectDailyReport } from "@/lib/daily-reports"

type SortField = "reportDate" | "employee" | "status"
type SortOrder = "asc" | "desc" | null

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-green-100 text-green-800",
  pending: "bg-amber-100 text-amber-800",
  rejected: "bg-red-100 text-red-800",
}

function formatStatus(status?: string | null) {
  if (!status) return "Not set"
  return status.replace(/_/g, " ")
}

export default function DailyReportsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [reports, setReports] = useState<DailyWorkReport[]>([])
  const [loading, setLoading] = useState(true)
  const [sortField, setSortField] = useState<SortField>("reportDate")
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc")
  const [filterDate, setFilterDate] = useState<string>("")
  const [filterStatus, setFilterStatus] = useState<string>("")
  const [viewingReport, setViewingReport] = useState<DailyWorkReport | null>(null)
  const [editingReport, setEditingReport] = useState<DailyWorkReport | null>(null)
  const [editFormData, setEditFormData] = useState<{
    entries: DailyWorkReportEntry[]
    key_achievements: string
    pending_work: string
  } | null>(null)
  const [submittingEdit, setSubmittingEdit] = useState(false)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState<string>("")
  const [approvalRemarks, setApprovalRemarks] = useState<string>("")
  const [rejectionRemarks, setRejectionRemarks] = useState<string>("")
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null)

  useEffect(() => {
    const loadReports = async () => {
      try {
        setLoading(true)
        const data = await getDailyReports()
        setReports(data)
      } catch (error) {
        console.error("Failed to load daily reports:", error)
      } finally {
        setLoading(false)
      }
    }
    loadReports()
  }, [])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : sortOrder === "desc" ? null : "asc")
    } else {
      setSortField(field)
      setSortOrder("asc")
    }
  }

  const handleEditClick = (report: DailyWorkReport) => {
    setEditingReport(report)
    setEditFormData({
      entries: report.entries || [],
      key_achievements: report.keyAchievements || "",
      pending_work: report.pendingWork || "",
    })
  }

  const handleResubmit = async () => {
    if (!editingReport || !editFormData) return
    setSubmittingEdit(true)
    try {
      await deleteEmployeePortalDailyReport(editingReport.id)

      const { createEmployeePortalDailyReport } = await import("@/lib/employee-portal")
      await createEmployeePortalDailyReport({
        report_date: editingReport.reportDate,
        entries: editFormData.entries,
        key_achievements: editFormData.key_achievements,
        pending_work: editFormData.pending_work,
      })

      toast({ title: "Success", description: "Report resubmitted successfully." })
      setEditingReport(null)
      setEditFormData(null)

      const data = await getDailyReports()
      setReports(data)
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to resubmit report.", variant: "destructive" })
    } finally {
      setSubmittingEdit(false)
    }
  }

  const handleApprove = async (reportId: string) => {
    setApprovingId(reportId)
    try {
      await approveDailyReport(reportId, approvalRemarks)
      toast({ title: "Success", description: "Report approved successfully." })
      setApprovalRemarks("")
      const data = await getDailyReports()
      setReports(data)
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to approve report.", variant: "destructive" })
    } finally {
      setApprovingId(null)
    }
  }

  const handleReject = async (reportId: string) => {
    setRejectingId(reportId)
    try {
      await rejectDailyReport(reportId, rejectionReason, rejectionRemarks)
      toast({ title: "Success", description: "Report rejected successfully." })
      setShowRejectModal(null)
      setRejectionReason("")
      setRejectionRemarks("")
      const data = await getDailyReports()
      setReports(data)
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to reject report.", variant: "destructive" })
    } finally {
      setRejectingId(null)
    }
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown size={16} className="text-gray-400" />
    return sortOrder === "asc" ? <ArrowUp size={16} /> : <ArrowDown size={16} />
  }

  const filteredAndSortedReports = reports
    .filter((report) => {
      if (filterDate && report.reportDate !== filterDate) return false
      if (filterStatus && report.status !== filterStatus) return false
      return true
    })
    .sort((a, b) => {
      if (sortOrder === null) return 0

      let aVal, bVal

      if (sortField === "reportDate") {
        aVal = new Date(a.reportDate).getTime()
        bVal = new Date(b.reportDate).getTime()
      } else if (sortField === "employee") {
        aVal = a.employee.toLowerCase()
        bVal = b.employee.toLowerCase()
      } else {
        aVal = a.status
        bVal = b.status
      }

      if (sortOrder === "asc") {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0
      }
    })

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-800 p-6 text-white shadow-sm">
        <h1 className="text-3xl font-bold tracking-tight">Daily Work Reports</h1>
        <p className="mt-2 text-sm text-slate-200">View and manage all daily work reports</p>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Reports</CardTitle>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium">Filter by Date</label>
              <Input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="max-w-xs"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Filter by Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFilterDate("")
                setFilterStatus("")
              }}
            >
              Clear Filters
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading reports...</div>
          ) : filteredAndSortedReports.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              No daily work reports found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3 text-left font-semibold">
                      <button
                        onClick={() => handleSort("reportDate")}
                        className="flex items-center gap-2 hover:text-gray-700"
                      >
                        Date {getSortIcon("reportDate")}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">
                      <button
                        onClick={() => handleSort("employee")}
                        className="flex items-center gap-2 hover:text-gray-700"
                      >
                        Employee {getSortIcon("employee")}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">Position/Role</th>
                    <th className="px-4 py-3 text-left font-semibold">Approver</th>
                    <th className="px-4 py-3 text-left font-semibold">
                      <button
                        onClick={() => handleSort("status")}
                        className="flex items-center gap-2 hover:text-gray-700"
                      >
                        Status {getSortIcon("status")}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">Submitted</th>
                    <th className="px-4 py-3 text-center font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedReports.map((report) => (
                    <tr key={report.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">{report.reportDate}</td>
                      <td className="px-4 py-3 font-medium">{report.employee}</td>
                      <td className="px-4 py-3 text-gray-600 font-medium">
                        {report.designation && report.designation.trim() ? report.designation : report.department || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {report.approver || (report.approverRole || "Self-certified")}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={STATUS_STYLES[report.status] || "bg-gray-100 text-gray-800"}>
                          {formatStatus(report.status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {report.created_at
                          ? new Date(report.created_at).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                            >
                              <MoreVertical size={16} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => setViewingReport(report)}
                              className="cursor-pointer gap-2"
                            >
                              <Eye size={14} /> View Details
                            </DropdownMenuItem>
                            {report.status === "pending" && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => handleEditClick(report)}
                                  className="cursor-pointer gap-2"
                                >
                                  <Edit2 size={14} /> Resubmit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleApprove(report.id)}
                                  disabled={approvingId === report.id}
                                  className="cursor-pointer gap-2 text-green-600"
                                >
                                  <Check size={14} /> Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setShowRejectModal(report.id)}
                                  disabled={rejectingId === report.id}
                                  className="cursor-pointer gap-2 text-red-600"
                                >
                                  <X size={14} /> Reject
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Modal */}
      {viewingReport && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Daily Report - {viewingReport.reportDate}</CardTitle>
                <button
                  onClick={() => setViewingReport(null)}
                  className="text-2xl text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-gray-500">Employee</p>
                  <p className="text-sm font-medium">{viewingReport.employee}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">Status</p>
                  <Badge className={STATUS_STYLES[viewingReport.status] || "bg-gray-100 text-gray-800"}>
                    {formatStatus(viewingReport.status)}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">Designation</p>
                  <p className="text-sm">{viewingReport.designation || "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">Department</p>
                  <p className="text-sm">{viewingReport.department || "—"}</p>
                </div>
              </div>

              <div>
                <p className="font-semibold mb-3">Work / Activity Log</p>
                <div className="space-y-3">
                  {viewingReport.entries && viewingReport.entries.length > 0 ? (
                    viewingReport.entries.map((entry, idx) => (
                      <div key={idx} className="border rounded-lg p-4 bg-gray-50">
                        <p className="font-medium text-sm text-gray-700 mb-2">{entry.time}</p>
                        <p className="text-sm text-gray-600">{entry.activity || "—"}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No activities recorded</p>
                  )}
                </div>
              </div>

              {viewingReport.keyAchievements && (
                <div>
                  <p className="font-semibold mb-2">Key Achievements</p>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{viewingReport.keyAchievements}</p>
                </div>
              )}

              {viewingReport.pendingWork && (
                <div>
                  <p className="font-semibold mb-2">Pending Work / Challenges</p>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{viewingReport.pendingWork}</p>
                </div>
              )}

              {viewingReport.remarks && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="font-semibold text-blue-600 mb-2">Additional Notes / Remarks</p>
                  <p className="text-sm text-blue-600 whitespace-pre-wrap">{viewingReport.remarks}</p>
                </div>
              )}

              {viewingReport.status === "rejected" && viewingReport.rejectionReason && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="font-semibold text-red-600 mb-1">Rejection Reason</p>
                  <p className="text-sm text-red-600">{viewingReport.rejectionReason}</p>
                </div>
              )}

              {viewingReport.status === "pending" && (
                <div className="space-y-3 pt-4 border-t">
                  <Label className="font-semibold">Approval Remarks <span className="text-gray-500 text-sm">(Optional - visible to staff)</span></Label>
                  <Textarea
                    rows={3}
                    placeholder="Add remarks or comments for this report..."
                    value={approvalRemarks}
                    onChange={(e) => setApprovalRemarks(e.target.value)}
                    className="resize-none"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={() => setViewingReport(null)}
                  variant="outline"
                  className="flex-1"
                >
                  Close
                </Button>
                {viewingReport.status === "pending" && (
                  <>
                    <Button
                      onClick={() => {
                        setViewingReport(null)
                        handleApprove(viewingReport.id)
                      }}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      <Check size={16} className="mr-2" /> Approve
                    </Button>
                    <Button
                      onClick={() => {
                        setViewingReport(null)
                        setShowRejectModal(viewingReport.id)
                      }}
                      variant="destructive"
                      className="flex-1"
                    >
                      <X size={16} className="mr-2" /> Reject
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Modal */}
      {editingReport && editFormData && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Resubmit Report - {editingReport.reportDate}</CardTitle>
                <button
                  onClick={() => {
                    setEditingReport(null)
                    setEditFormData(null)
                  }}
                  className="text-2xl text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="font-semibold mb-3 block">Work / Activity Log</Label>
                <div className="space-y-3">
                  {editFormData.entries.map((entry, idx) => (
                    <div key={idx} className="border rounded-lg p-4 space-y-2">
                      <Label className="font-semibold text-base">{entry.time}</Label>
                      <Textarea
                        placeholder="Describe activities for this time period..."
                        rows={3}
                        value={entry.activity}
                        onChange={(e) => {
                          const updated = [...editFormData.entries]
                          updated[idx].activity = e.target.value
                          setEditFormData({ ...editFormData, entries: updated })
                        }}
                        className="resize-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="achievements" className="font-semibold">
                  Key Achievements
                </Label>
                <Textarea
                  id="achievements"
                  placeholder="Enter key achievements..."
                  rows={4}
                  value={editFormData.key_achievements}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, key_achievements: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pending" className="font-semibold">
                  Pending Work / Challenges
                </Label>
                <Textarea
                  id="pending"
                  placeholder="Enter pending work or challenges..."
                  rows={4}
                  value={editFormData.pending_work}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, pending_work: e.target.value })
                  }
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingReport(null)
                    setEditFormData(null)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleResubmit}
                  disabled={submittingEdit}
                  className="flex-1"
                >
                  {submittingEdit ? "Resubmitting..." : "Resubmit Report"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Reject Report</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reason" className="font-semibold">
                  Rejection Reason
                </Label>
                <Textarea
                  id="reason"
                  placeholder="Enter the reason for rejection..."
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="remarks" className="font-semibold">
                  Remarks <span className="text-gray-500 text-sm">(Optional - visible to staff)</span>
                </Label>
                <Textarea
                  id="remarks"
                  placeholder="Add any additional remarks or comments..."
                  rows={3}
                  value={rejectionRemarks}
                  onChange={(e) => setRejectionRemarks(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowRejectModal(null)
                    setRejectionReason("")
                    setRejectionRemarks("")
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleReject(showRejectModal)}
                  disabled={rejectingId === showRejectModal}
                  className="flex-1"
                >
                  {rejectingId === showRejectModal ? "Rejecting..." : "Reject Report"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
