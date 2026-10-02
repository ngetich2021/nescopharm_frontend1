"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { PermissionGuard } from "@/components/PermissionGuard"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { fetchSopPrintData, formatSopStatus, getUserDisplayName, SopPrintData } from "@/lib/sops"
import { formatDate } from "@/lib/utils"
import { ArrowLeft, Loader2, Printer, RefreshCw } from "lucide-react"

function getErrorMessage(error: any): string {
  const validationErrors = error?.apiResponse?.errors
  if (validationErrors && typeof validationErrors === "object") {
    return Object.values(validationErrors).flat().join(", ")
  }

  return error?.message || "An unexpected error occurred"
}

function formatColumnValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "-"
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No"
  }

  if (typeof value === "object") {
    return JSON.stringify(value)
  }

  return String(value)
}

export default function SopPrintPage() {
  const params = useParams()
  const { toast } = useToast()

  const sopId = params.id as string

  const [printData, setPrintData] = useState<SopPrintData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isApplyingFilters, setIsApplyingFilters] = useState(false)
  const [error, setError] = useState<string>("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const sortedComments = useMemo(() => {
    return [...(printData?.comments || [])].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
  }, [printData])

  const loadPrintData = useCallback(
    async (
      filters?: { date_from?: string; date_to?: string },
      options?: { showPageLoader?: boolean }
    ) => {
      const showPageLoader = options?.showPageLoader ?? false
      try {
        if (showPageLoader) {
          setIsLoading(true)
        }
        setError("")
        const data = await fetchSopPrintData(sopId, filters)
        setPrintData(data)
      } catch (error: any) {
        const message = getErrorMessage(error)
        setError(message)
        toast({
          title: "Failed to load print data",
          description: message,
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
        setIsApplyingFilters(false)
      }
    },
    [sopId, toast]
  )

  useEffect(() => {
    const runInitialLoad = async () => {
      await loadPrintData(undefined, { showPageLoader: true })
    }

    runInitialLoad()
  }, [loadPrintData])

  const handleApplyFilters = async () => {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      toast({
        title: "Invalid date range",
        description: "From date must be before or equal to To date.",
        variant: "destructive",
      })
      return
    }

    setIsApplyingFilters(true)
    await loadPrintData({
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    })
  }

  const handleResetFilters = async () => {
    setDateFrom("")
    setDateTo("")
    setIsApplyingFilters(true)
    await loadPrintData()
  }

  if (isLoading) {
    return (
      <PermissionGuard permissions={["can_view_sops_menu", "can_view_sops", "can_manage_system", "can_manage_company"]}>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      </PermissionGuard>
    )
  }

  if (!printData || error) {
    return (
      <PermissionGuard permissions={["can_view_sops_menu", "can_view_sops", "can_manage_system", "can_manage_company"]}>
        <div className="max-w-3xl mx-auto py-12 px-4">
          <Card className="p-6">
            <h1 className="text-xl font-semibold mb-2">Unable to load SOP print view</h1>
            <p className="text-muted-foreground mb-4">{error || "No data available."}</p>
            <Link href={`/sops/${sopId}`}>
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to SOP
              </Button>
            </Link>
          </Card>
        </div>
      </PermissionGuard>
    )
  }

  const { sop, annexures } = printData

  return (
    <PermissionGuard permissions={["can_view_sops_menu", "can_view_sops", "can_manage_system", "can_manage_company"]}>
      <div className="min-h-screen bg-gray-50 print:bg-white">
        <div className="sticky top-0 z-10 bg-white border-b print:hidden">
          <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
            <Link href={`/sops/${sop.id}`}>
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>

            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">From</p>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                  className="h-8 w-[160px]"
                />
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">To</p>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                  className="h-8 w-[160px]"
                />
              </div>

              <Button size="sm" variant="outline" onClick={handleApplyFilters} disabled={isApplyingFilters}>
                {isApplyingFilters ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Apply
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={handleResetFilters}
                disabled={isApplyingFilters || (!dateFrom && !dateTo)}
              >
                Reset
              </Button>

              <Button size="sm" onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto p-4 md:p-8 print:p-0 print:max-w-none">
          <Card className="p-6 md:p-8 shadow-lg print:shadow-none print:border-0">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl font-bold">{sop.title}</h1>
                <p className="text-muted-foreground">{sop.sop_number || "No SOP number"}</p>
              </div>
              <div className="text-right text-sm">
                <p>
                  <span className="text-muted-foreground">Year:</span> {sop.year}
                </p>
                <p>
                  <span className="text-muted-foreground">Status:</span> {formatSopStatus(sop.status)}
                </p>
                <p>
                  <span className="text-muted-foreground">Assigned Updater:</span>{" "}
                  {sop.assigned_updater ? getUserDisplayName(sop.assigned_updater) : "Unassigned"}
                </p>
              </div>
            </div>

            <div className="mb-6 text-sm">
              <p className="font-medium mb-1">Description</p>
              <p className="whitespace-pre-wrap">{sop.description || "-"}</p>
            </div>

          {annexures.map(({ annexure, entries }) => (
            <div key={annexure.id} className="mb-8 break-inside-avoid">
              <h2 className="text-lg font-semibold mb-2">{annexure.name}</h2>
              <p className="text-sm text-muted-foreground mb-3">
                {annexure.description || "No description"} • {annexure.update_frequency}
              </p>

              <div className="overflow-x-auto border rounded-md">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="text-left px-3 py-2">Entry Date</th>
                      {annexure.columns_definition.map((column) => (
                        <th key={column.key} className="text-left px-3 py-2">
                          {column.label}
                        </th>
                      ))}
                      <th className="text-left px-3 py-2">Updated By</th>
                      <th className="text-left px-3 py-2">Updated At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.length === 0 ? (
                      <tr>
                        <td className="px-3 py-3 text-muted-foreground" colSpan={3 + annexure.columns_definition.length}>
                          No entries
                        </td>
                      </tr>
                    ) : (
                      entries.map((entry) => (
                        <tr key={entry.id} className="border-b">
                          <td className="px-3 py-2">{formatDate(entry.entry_date)}</td>
                          {annexure.columns_definition.map((column) => (
                            <td key={column.key} className="px-3 py-2">
                              {formatColumnValue(entry.data_payload?.[column.key])}
                            </td>
                          ))}
                          <td className="px-3 py-2">
                            {entry.updated_by_user ? getUserDisplayName(entry.updated_by_user) : "-"}
                          </td>
                          <td className="px-3 py-2">{formatDate(entry.updated_at)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          <div className="break-inside-avoid">
            <h2 className="text-lg font-semibold mb-2">Comments</h2>
            {sortedComments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No comments</p>
            ) : (
              <div className="space-y-3">
                {sortedComments.map((comment) => (
                  <div key={comment.id} className="rounded-md border p-3 text-sm">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <span className="font-medium">
                        {comment.commented_by_user ? getUserDisplayName(comment.commented_by_user) : "Unknown"}
                      </span>
                      <span className="text-muted-foreground">{formatDate(comment.created_at)}</span>
                    </div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                      {comment.comment_type}
                    </p>
                    <p className="whitespace-pre-wrap">{comment.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          </Card>
        </div>
      </div>
    </PermissionGuard>
  )
}
