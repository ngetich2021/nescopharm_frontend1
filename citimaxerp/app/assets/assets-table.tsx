"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  MoreHorizontal,
  Search,
  Upload,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Trash2,
  Loader2,
  Plus,
  Edit,
  Eye,
  Package,
} from "lucide-react"
import {
  Asset,
  getAssets,
  deleteAsset,
  exportAssets,
  downloadAssetTemplate,
  parseAssetFile,
  importAssets,
  isAssigned,
} from "@/lib/assets"
import { ExportMenu } from "@/components/export-menu"
import type { ExportFormat } from "@/lib/table-export"
import { AssetSheet } from "./components/asset-sheet"
import { AssetDetailsSheet } from "./components/asset-details-sheet"
import { useToast } from "@/hooks/use-toast"
import { PermissionGuard } from "@/components/PermissionGuard"
import { displayDate } from "@/lib/date-format"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface AssetsTableProps {
  asAt: string
  onDataChanged?: () => void
}

type SortKey =
  | "asset_code" | "tag_number" | "name" | "category" | "location" | "assigned_to" | "quantity"
  | "purchase_date" | "total_cost" | "accumulated_depreciation" | "net_book_value" | "status"
type SortDir = "asc" | "desc"

const KES = new Intl.NumberFormat("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const NUMERIC: SortKey[] = ["quantity", "total_cost", "accumulated_depreciation", "net_book_value"]
const UNASSIGNED = "__unassigned__"

const STATUS_STYLE: Record<string, string> = {
  "In Use": "bg-green-100 text-green-800",
  "In Store": "bg-blue-100 text-blue-800",
  "Under Repair": "bg-amber-100 text-amber-800",
  Missing: "bg-red-100 text-red-800",
  Disposed: "bg-gray-200 text-gray-700",
  "Written Off": "bg-gray-200 text-gray-700",
}

export function AssetsTable({ asAt, onDataChanged }: AssetsTableProps) {
  const { toast } = useToast()

  const [assets, setAssets] = useState<Asset[]>([])
  const [search, setSearch] = useState("")
  const [classFilter, setClassFilter] = useState("all")
  const [locationFilter, setLocationFilter] = useState("all")
  const [assigneeFilter, setAssigneeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(25)
  const [isLoading, setIsLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>("asset_code")
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)
  const [viewingAsset, setViewingAsset] = useState<Asset | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null)

  const [isImporting, setIsImporting] = useState(false)
  const [importPreview, setImportPreview] = useState<any>(null)
  const [importRows, setImportRows] = useState<any[] | null>(null)

  useEffect(() => {
    fetchAssets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asAt])

  async function fetchAssets() {
    setIsLoading(true)
    try {
      const data = await getAssets({ as_at: asAt })
      setAssets(data.filter((a) => a != null))
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to fetch assets",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const distinct = (pick: (a: Asset) => string | null | undefined) =>
    Array.from(new Set(assets.map(pick).filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b))
  const classes = useMemo(() => distinct((a) => a.category), [assets]) // eslint-disable-line react-hooks/exhaustive-deps
  const locations = useMemo(() => distinct((a) => a.location), [assets]) // eslint-disable-line react-hooks/exhaustive-deps
  const assignees = useMemo(() => distinct((a) => (isAssigned(a.assigned_to) ? a.assigned_to : null)), [assets]) // eslint-disable-line react-hooks/exhaustive-deps
  const statuses = useMemo(() => distinct((a) => a.status), [assets]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim()
    return assets.filter((a) => {
      if (classFilter !== "all" && a.category !== classFilter) return false
      if (locationFilter !== "all" && a.location !== locationFilter) return false
      if (assigneeFilter === UNASSIGNED ? isAssigned(a.assigned_to) : assigneeFilter !== "all" && a.assigned_to !== assigneeFilter) return false
      if (statusFilter !== "all" && a.status !== statusFilter) return false
      if (!term) return true
      return [a.name, a.category, a.serial_number, a.location, a.asset_code, a.tag_number, a.assigned_to, a.supplier, a.invoice_number]
        .some((v) => (v || "").toLowerCase().includes(term))
    })
  }, [assets, search, classFilter, locationFilter, assigneeFilter, statusFilter])

  const sorted = useMemo(() => {
    const copy = [...filtered]
    copy.sort((a, b) => {
      let av: string | number = (a as any)[sortKey]
      let bv: string | number = (b as any)[sortKey]
      if (NUMERIC.includes(sortKey)) {
        av = Number(av) || 0
        bv = Number(bv) || 0
      } else {
        av = (av || "").toString().toLowerCase()
        bv = (bv || "").toString().toLowerCase()
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1
      if (av > bv) return sortDir === "asc" ? 1 : -1
      return 0
    })
    return copy
  }, [filtered, sortKey, sortDir])

  // The Total row follows the search and filters.
  const totals = useMemo(() => ({
    quantity: sorted.reduce((s, a) => s + (Number(a.quantity) || 0), 0),
    cost: sorted.reduce((s, a) => s + (Number(a.total_cost) || 0), 0),
    accumulated: sorted.reduce((s, a) => s + (Number(a.accumulated_depreciation) || 0), 0),
    nbv: sorted.reduce((s, a) => s + (Number(a.net_book_value) || 0), 0),
  }), [sorted])

  const totalPages = Math.max(1, Math.ceil(sorted.length / rowsPerPage))
  const pageSafe = Math.min(currentPage, totalPages)
  const paginated = sorted.slice((pageSafe - 1) * rowsPerPage, pageSafe * rowsPerPage)

  useEffect(() => {
    setCurrentPage(1)
  }, [search, classFilter, locationFilter, assigneeFilter, statusFilter, rowsPerPage])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir(NUMERIC.includes(key) ? "desc" : "asc")
    }
  }

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ChevronsUpDown className="h-3.5 w-3.5 ml-1 inline opacity-40" />
    return sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5 ml-1 inline" /> : <ArrowDown className="h-3.5 w-3.5 ml-1 inline" />
  }

  const SortHead = ({ k, children, right }: { k: SortKey; children: React.ReactNode; right?: boolean }) => (
    <TableHead className={`cursor-pointer select-none whitespace-nowrap ${right ? "text-right" : ""}`} onClick={() => toggleSort(k)}>
      {children} {sortIcon(k)}
    </TableHead>
  )

  const handleSaved = () => {
    fetchAssets()
    if (onDataChanged) onDataChanged()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteAsset(deleteTarget.id)
      toast({ title: "Success", description: "Asset deleted successfully." })
      setDeleteTarget(null)
      fetchAssets()
      if (onDataChanged) onDataChanged()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete asset",
        variant: "destructive",
      })
    }
  }

  // The export follows the search and filters; Excel uses the register's columns so it imports back.
  const handleExport = (format: ExportFormat) => exportAssets(format, sorted, asAt)

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsImporting(true)
    try {
      const rows = await parseAssetFile(file)
      if (rows.length === 0) {
        toast({ title: "Nothing to import", description: "No asset rows found. The sheet needs an Asset Description column.", variant: "destructive" })
        return
      }
      const result = await importAssets(rows, true)
      setImportPreview(result)
      setImportRows(rows)
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to read import file",
        variant: "destructive",
      })
    } finally {
      setIsImporting(false)
      e.target.value = ""
    }
  }

  const handleConfirmImport = async () => {
    if (!importRows) return
    setIsImporting(true)
    try {
      const result = await importAssets(importRows, false)
      setImportPreview(null)
      setImportRows(null)
      toast({ title: "Imported", description: `${result.summary.created} added, ${result.summary.updated} updated, ${result.summary.unchanged} unchanged.` })
      fetchAssets()
      if (onDataChanged) onDataChanged()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to import assets",
        variant: "destructive",
      })
    } finally {
      setIsImporting(false)
    }
  }

  const willChange = importPreview ? importPreview.summary.created + importPreview.summary.updated : 0

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:justify-between xl:items-start">
          <div className="flex flex-wrap gap-3">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <Input
                className="pl-8 w-[260px] max-w-full"
                placeholder="Search ID, tag, item, person, serial..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Asset class" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All classes</SelectItem>
                {classes.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-[190px]"><SelectValue placeholder="Location" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All locations</SelectItem>
                {locations.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="w-[190px]"><SelectValue placeholder="Assigned to" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everyone</SelectItem>
                <SelectItem value={UNASSIGNED}>Not assigned to anyone</SelectItem>
                {assignees.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {statuses.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={fetchAssets} disabled={isLoading} aria-label="Refresh">
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
            <PermissionGuard permissions={["can_create_assets", "can_manage_assets", "can_manage_system", "can_manage_company"]} hideOnDenied>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingAsset(null)
                  setIsSheetOpen(true)
                }}
                className="border-primary text-primary hover:bg-primary/10"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Asset
              </Button>
            </PermissionGuard>
            <ExportMenu onExport={handleExport} disabled={isLoading || sorted.length === 0} />
            <PermissionGuard permissions={["can_create_assets", "can_manage_assets", "can_manage_system", "can_manage_company"]} hideOnDenied>
              <Button variant="outline" size="sm" onClick={downloadAssetTemplate}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Template
              </Button>
              <div className="relative">
                <input type="file" id="import-assets-file" className="hidden" accept=".csv,.xlsx,.xls" onChange={handleImportFile} />
                <Button
                  onClick={() => document.getElementById("import-assets-file")?.click()}
                  variant="outline"
                  size="sm"
                  disabled={isImporting}
                >
                  {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Import
                </Button>
              </div>
            </PermissionGuard>
          </div>
        </div>

        <div className="rounded-md border bg-white overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">S/No</TableHead>
                <SortHead k="asset_code">Asset ID</SortHead>
                <SortHead k="tag_number">Tag No.</SortHead>
                <SortHead k="name">Asset Description</SortHead>
                <SortHead k="category">Class</SortHead>
                <SortHead k="location">Location</SortHead>
                <SortHead k="assigned_to">Assigned To</SortHead>
                <SortHead k="quantity" right>Qty</SortHead>
                <SortHead k="purchase_date">Purchase Date</SortHead>
                <SortHead k="total_cost" right>Cost (Ksh)</SortHead>
                <SortHead k="accumulated_depreciation" right>Accum. Dep. (Ksh)</SortHead>
                <SortHead k="net_book_value" right>Net Book Value (Ksh)</SortHead>
                <SortHead k="status">Status</SortHead>
                <TableHead className="w-12">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={14} className="h-32 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={14} className="h-32 text-center text-muted-foreground">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    No assets found. Add an asset or import the Fixed Asset Register.
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((asset, idx) => (
                  <TableRow key={asset.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setViewingAsset(asset)}>
                    <TableCell className="text-muted-foreground">{(pageSafe - 1) * rowsPerPage + idx + 1}</TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs">{asset.asset_code || "-"}</TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs">{asset.tag_number || "-"}</TableCell>
                    <TableCell className="font-medium">{asset.name}</TableCell>
                    <TableCell className="whitespace-nowrap">{asset.category || "-"}</TableCell>
                    <TableCell className="whitespace-nowrap">{asset.location || "-"}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {isAssigned(asset.assigned_to) ? asset.assigned_to : <span className="text-amber-700">Not assigned</span>}
                    </TableCell>
                    <TableCell className="text-right">{asset.quantity}</TableCell>
                    <TableCell className="whitespace-nowrap">{asset.purchase_date ? displayDate(new Date(asset.purchase_date)) : "-"}</TableCell>
                    <TableCell className="text-right tabular-nums">{KES.format(Number(asset.total_cost) || 0)}</TableCell>
                    <TableCell className="text-right tabular-nums">{KES.format(Number(asset.accumulated_depreciation) || 0)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{KES.format(Number(asset.net_book_value) || 0)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`whitespace-nowrap border-0 ${STATUS_STYLE[asset.status || ""] ?? "bg-gray-100 text-gray-700"}`}>
                        {asset.status || "In Use"}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => setViewingAsset(asset)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </DropdownMenuItem>
                          <PermissionGuard permissions={["can_update_assets", "can_manage_assets", "can_manage_system", "can_manage_company"]} hideOnDenied>
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingAsset(asset)
                                setIsSheetOpen(true)
                              }}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                          </PermissionGuard>
                          <PermissionGuard permissions={["can_delete_assets", "can_manage_assets", "can_manage_system", "can_manage_company"]} hideOnDenied>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600" onClick={() => setDeleteTarget(asset)}>
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </PermissionGuard>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {!isLoading && sorted.length > 0 && (
              <TableFooter className="bg-gray-100">
                <TableRow>
                  <TableCell />
                  <TableCell colSpan={6} className="font-semibold">Total ({sorted.length} asset{sorted.length === 1 ? "" : "s"})</TableCell>
                  <TableCell className="text-right font-semibold">{totals.quantity.toLocaleString()}</TableCell>
                  <TableCell />
                  <TableCell className="text-right font-semibold tabular-nums">{KES.format(totals.cost)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{KES.format(totals.accumulated)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{KES.format(totals.nbv)}</TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              Showing {sorted.length === 0 ? 0 : (pageSafe - 1) * rowsPerPage + 1} to {Math.min(pageSafe * rowsPerPage, sorted.length)} of {sorted.length} assets
            </span>
            <Select value={String(rowsPerPage)} onValueChange={(v) => setRowsPerPage(Number(v))}>
              <SelectTrigger className="w-[110px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} / page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(pageSafe - 1)} disabled={pageSafe <= 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Page {pageSafe} of {totalPages}
            </span>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(pageSafe + 1)} disabled={pageSafe >= totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <AssetSheet open={isSheetOpen} onOpenChange={setIsSheetOpen} onSaved={handleSaved} asset={editingAsset} />

      <AssetDetailsSheet asset={viewingAsset} open={!!viewingAsset} onOpenChange={(o) => !o && setViewingAsset(null)} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete asset?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove {deleteTarget?.asset_code ? `${deleteTarget.asset_code} ` : ""}&quot;{deleteTarget?.name}&quot; from the
              asset register. To keep its history, set its Status to Disposed or Written Off instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Preview Dialog */}
      {importPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-auto">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold">Import Preview</h2>
              <p className="text-sm text-gray-600 mt-1">
                A row whose Asset ID is already in the register updates that asset; other rows are added. Nothing is saved until you confirm.
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "New assets", value: importPreview.summary.created, tone: "bg-blue-50 text-blue-600" },
                  { label: "Updated", value: importPreview.summary.updated, tone: "bg-amber-50 text-amber-700" },
                  { label: "Unchanged", value: importPreview.summary.unchanged, tone: "bg-gray-50 text-gray-600" },
                  { label: "Errors (skipped)", value: importPreview.summary.errors, tone: "bg-red-50 text-red-600" },
                ].map((c) => (
                  <div key={c.label} className={`p-3 rounded ${c.tone}`}>
                    <div className="text-2xl font-bold">{c.value}</div>
                    <div className="text-sm text-gray-600">{c.label}</div>
                  </div>
                ))}
              </div>
              {willChange === 0 && (
                <div className="bg-gray-50 border rounded p-3 text-sm text-gray-700">Nothing to change: every row already matches the register.</div>
              )}
              {importPreview.rows && importPreview.rows.length > 0 && (
                <div className="mt-4">
                  <h3 className="font-semibold mb-2">Details ({importPreview.rows.length} rows):</h3>
                  <div className="max-h-[300px] overflow-y-auto border rounded">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left">Row</th>
                          <th className="px-3 py-2 text-left">Asset</th>
                          <th className="px-3 py-2 text-left">Status</th>
                          <th className="px-3 py-2 text-left">Detail</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.rows.map((row: any, idx: number) => (
                          <tr key={idx} className="border-t hover:bg-gray-50">
                            <td className="px-3 py-2">{row.row}</td>
                            <td className="px-3 py-2">{row.name}</td>
                            <td className="px-3 py-2">
                              <span
                                className={`px-2 py-1 text-xs rounded ${
                                  row.status === "created" ? "bg-blue-100 text-blue-800"
                                    : row.status === "updated" ? "bg-amber-100 text-amber-800"
                                    : row.status === "unchanged" ? "bg-gray-100 text-gray-700"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {row.status}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-gray-600">{row.message || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 border-t flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setImportPreview(null)
                  setImportRows(null)
                }}
                disabled={isImporting}
              >
                Cancel
              </Button>
              <Button onClick={handleConfirmImport} disabled={isImporting || willChange === 0}>
                {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirm Import
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
