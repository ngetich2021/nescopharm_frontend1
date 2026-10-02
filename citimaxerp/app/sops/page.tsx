"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { PermissionGuard } from "@/components/PermissionGuard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import TemperatureRecordsTab from "./components/temperature-records-tab"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import {
  deleteSop,
  downloadSopDocument,
  fetchSops,
  formatSopStatus,
  hasSopDocument,
  getUserDisplayName,
  Sop,
  SopStatus,
} from "@/lib/sops"
import { fetchUsers, UserData } from "@/lib/users"
import { cn, formatDate } from "@/lib/utils"
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Edit,
  Eye,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  ClipboardList,
  Calendar,
  CheckCircle2,
  Archive,
  MoreHorizontal,
} from "lucide-react"

type StatusFilter = "all" | SopStatus

function getErrorMessage(error: any): string {
  const validationErrors = error?.apiResponse?.errors
  if (validationErrors && typeof validationErrors === "object") {
    return Object.values(validationErrors).flat().join(", ")
  }

  return error?.message || "An unexpected error occurred"
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.setAttribute("download", filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function SopsPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [sops, setSops] = useState<Sop[]>([])
  const [users, setUsers] = useState<UserData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [downloadingSopId, setDownloadingSopId] = useState<string | null>(null)
  const [deletingSopId, setDeletingSopId] = useState<string | null>(null)

  const [search, setSearch] = useState("")
  const [yearFilter, setYearFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [updaterFilter, setUpdaterFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [lastPage, setLastPage] = useState(1)

  const sortedSops = useMemo(() => {
    return [...sops].sort((a, b) => {
      if (b.year !== a.year) {
        return b.year - a.year
      }
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })
  }, [sops])

  const yearOptions = useMemo(() => {
    const fromSops = sortedSops.map((sop) => sop.year)
    const now = new Date().getFullYear()
    const recentYears = Array.from({ length: 8 }, (_, index) => now - index)
    return Array.from(new Set([...fromSops, ...recentYears])).sort((a, b) => b - a)
  }, [sortedSops])

  const summary = useMemo(() => {
    const total = sortedSops.length
    const active = sortedSops.filter((sop) => sop.status === "active").length
    const archived = sortedSops.filter((sop) => sop.status === "archived").length
    const draft = sortedSops.filter((sop) => sop.status === "draft").length

    return { total, active, archived, draft }
  }, [sortedSops])

  const getStatusBadgeClass = (status: SopStatus) => {
    if (status === "active") {
      return "bg-green-100 text-green-800 border-green-500"
    }

    if (status === "draft") {
      return "bg-yellow-100 text-yellow-800 border-yellow-500"
    }

    return "bg-gray-100 text-gray-800 border-gray-500"
  }

  const loadSops = useCallback(
    async (showRefreshSpinner = false) => {
      try {
        if (showRefreshSpinner) {
          setIsRefreshing(true)
        } else {
          setIsLoading(true)
        }

        const response = await fetchSops({
          search: search.trim() || undefined,
          year: yearFilter !== "all" ? Number(yearFilter) : undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
          assigned_updater_id: updaterFilter !== "all" ? updaterFilter : undefined,
          page: currentPage,
          per_page: rowsPerPage,
        })

        setSops(response.data || [])
        setLastPage(response.meta?.last_page || 1)
      } catch (error: any) {
        setSops([])
        setLastPage(1)
        toast({
          title: "Failed to load SOPs",
          description: getErrorMessage(error),
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [search, yearFilter, statusFilter, updaterFilter, currentPage, rowsPerPage]
  )

  const loadUsers = useCallback(async () => {
    try {
      setIsLoadingUsers(true)
      const usersData = await fetchUsers()
      setUsers(usersData || [])
    } catch {
      setUsers([])
    } finally {
      setIsLoadingUsers(false)
    }
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  useEffect(() => {
    loadSops(false)
  }, [loadSops])

  useEffect(() => {
    setCurrentPage(1)
  }, [search, yearFilter, statusFilter, updaterFilter])

  const handleDownloadDocument = async (sop: Sop) => {
    if (!hasSopDocument(sop)) {
      toast({
        title: "No document uploaded",
        description: "This SOP does not have an attached document.",
      })
      return
    }

    try {
      setDownloadingSopId(sop.id)
      const { blob, filename } = await downloadSopDocument(sop)
      downloadBlob(blob, filename)
      toast({ title: "Downloaded", description: "SOP document downloaded successfully." })
    } catch (error: any) {
      toast({
        title: "Download failed",
        description: getErrorMessage(error),
        variant: "destructive",
      })
    } finally {
      setDownloadingSopId(null)
    }
  }

  const handleDeleteSop = async (sop: Sop) => {
    if (!window.confirm(`Delete SOP ${sop.sop_number || sop.title}? This action cannot be undone.`)) {
      return
    }

    try {
      setDeletingSopId(sop.id)
      await deleteSop(sop.id)
      toast({ title: "Deleted", description: "SOP deleted successfully." })
      await loadSops(false)
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: getErrorMessage(error),
        variant: "destructive",
      })
    } finally {
      setDeletingSopId(null)
    }
  }

  const handleRowClick = (sopId: string) => {
    router.push(`/sops/${sopId}`)
  }

  const ActionsDropdown = ({ sop }: { sop: Sop }) => {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => handleRowClick(sop.id)}>
            <Eye className="h-4 w-4 mr-2" />
            View SOP
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push(`/sops/${sop.id}/edit`)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit SOP
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleDownloadDocument(sop)}
            disabled={downloadingSopId === sop.id || !hasSopDocument(sop)}
          >
            <Download className="h-4 w-4 mr-2" />
            Download Document
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-primary"
            onClick={() => handleDeleteSop(sop)}
            disabled={deletingSopId === sop.id}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete SOP
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <PermissionGuard permissions={["can_view_sops_menu", "can_view_sops", "can_manage_system", "can_manage_company"]}>
      <div className="flex-1 space-y-6 p-2 sm:p-4 md:p-8 pt-4 sm:pt-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold">SOPs</h1>
        </div>

        <Tabs defaultValue="sops">
          <TabsList>
            <TabsTrigger value="sops">SOPs</TabsTrigger>
            <TabsTrigger value="temperature">Temperature Records</TabsTrigger>
          </TabsList>

          <TabsContent value="sops" className="space-y-6 mt-6">
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Total SOPs</CardTitle>
              <ClipboardList className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold">{summary.total}</div>
              <p className="text-xs text-muted-foreground hidden sm:block">On current page</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Active SOPs</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold">{summary.active}</div>
              <p className="text-xs text-muted-foreground hidden sm:block">Ready for operation</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Draft SOPs</CardTitle>
              <Calendar className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold">{summary.draft}</div>
              <p className="text-xs text-muted-foreground hidden sm:block">Pending activation</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Archived SOPs</CardTitle>
              <Archive className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold">{summary.archived}</div>
              <p className="text-xs text-muted-foreground hidden sm:block">Historical records</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Recent SOPs</h3>

          <div className="flex justify-between items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 h-4 w-4" />
                <Input
                  className="pl-8 w-[260px]"
                  placeholder="Search SOPs..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>

              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All years</SelectItem>
                  {yearOptions.map((yearOption) => (
                    <SelectItem key={yearOption} value={String(yearOption)}>
                      {yearOption}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>

              <Select value={updaterFilter} onValueChange={setUpdaterFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={isLoadingUsers ? "Loading users..." : "Assigned updater"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All updaters</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {getUserDisplayName(user as any)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => router.push("/sops/new")}
              >
                <Plus className="h-4 w-4 mr-2" />
                New SOP
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadSops(true)}
                disabled={isRefreshing}
                className="border-gray-800 text-gray-800 hover:bg-gray-100"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>

          <div className="rounded-md border bg-white overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold">Title</TableHead>
                  <TableHead className="font-semibold">Year</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Annexures</TableHead>
                  <TableHead className="font-semibold">Comments</TableHead>
                  <TableHead className="text-right font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                        <span>Loading SOPs...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : sortedSops.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      <div className="text-gray-500">
                        <p className="font-semibold">No SOPs found</p>
                        <p className="text-sm">Create your first SOP to get started</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedSops.map((sop) => (
                    <TableRow
                      key={sop.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleRowClick(sop.id)}
                    >
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-primary">{sop.title}</p>
                          <p className="text-xs text-gray-500">Updated {formatDate(sop.updated_at)}</p>
                        </div>
                      </TableCell>
                      <TableCell>{sop.year}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(getStatusBadgeClass(sop.status))}>
                          {formatSopStatus(sop.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>{sop.annexures_count ?? "-"}</TableCell>
                      <TableCell>{sop.comments_count ?? "-"}</TableCell>
                      <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                        <ActionsDropdown sop={sop} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <p className="text-sm font-medium">Rows per page</p>
              <Select
                value={rowsPerPage.toString()}
                onValueChange={(value) => {
                  setRowsPerPage(Number(value))
                  setCurrentPage(1)
                }}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue placeholder={rowsPerPage} />
                </SelectTrigger>
                <SelectContent side="top">
                  {[5, 10, 20, 30, 40, 50].map((pageSize) => (
                    <SelectItem key={pageSize} value={pageSize.toString()}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage <= 1}
                className="border-gray-200 hover:bg-[primary]/10 hover:text-[primary] hover:border-[primary]"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <div className="flex items-center justify-center text-sm font-medium">
                Page {currentPage} of {lastPage || 1}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, lastPage))}
                disabled={currentPage >= lastPage || lastPage === 0}
                className="border-gray-200 hover:bg-[primary]/10 hover:text-[primary] hover:border-[primary]"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
          </TabsContent>

          <TabsContent value="temperature" className="mt-6">
            <TemperatureRecordsTab />
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGuard>
  )
}
