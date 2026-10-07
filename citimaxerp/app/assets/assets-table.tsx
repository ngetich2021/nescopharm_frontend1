"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  MoreHorizontal,
  Search,
  Filter,
  Download,
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
} from "@/lib/assets"
import { AssetSheet } from "./components/asset-sheet"
import { AssetDetailsSheet } from "./components/asset-details-sheet"
import { useToast } from "@/hooks/use-toast"
import { PermissionGuard } from "@/components/PermissionGuard"
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
  onDataChanged?: () => void
}

type SortKey = "name" | "category" | "serial_number" | "location" | "quantity" | "purchase_cost"
type SortDir = "asc" | "desc"

const KES = new Intl.NumberFormat("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function AssetsTable({ onDataChanged }: AssetsTableProps) {
  const { toast } = useToast()

  const [assets, setAssets] = useState<Asset[]>([])
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [isLoading, setIsLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>("name")
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)
  const [viewingAsset, setViewingAsset] = useState<Asset | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null)

  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importPreview, setImportPreview] = useState<any>(null)
  const [importRows, setImportRows] = useState<any[] | null>(null)

  useEffect(() => {
    fetchAssets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchAssets() {
    setIsLoading(true)
    try {
      const data = await getAssets()
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

  const categories = useMemo(() => {
    return Array.from(new Set(assets.map((a) => a.category).filter(Boolean))) as string[]
  }, [assets])

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim()
    return assets.filter((a) => {
      const matchesCategory = categoryFilter === "all" || a.category === categoryFilter
      const matchesSearch =
        term === "" ||
        a.name.toLowerCase().includes(term) ||
        (a.category || "").toLowerCase().includes(term) ||
        (a.serial_number || "").toLowerCase().includes(term) ||
        (a.location || "").toLowerCase().includes(term)
      return matchesCategory && matchesSearch
    })
  }, [assets, search, categoryFilter])

  const sorted = useMemo(() => {
    const copy = [...filtered]
    copy.sort((a, b) => {
      let av: string | number = a[sortKey] as any
      let bv: string | number = b[sortKey] as any
      if (sortKey === "quantity" || sortKey === "purchase_cost") {
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

  const totalPages = Math.max(1, Math.ceil(sorted.length / rowsPerPage))
  const pageSafe = Math.min(currentPage, totalPages)
  const paginated = sorted.slice((pageSafe - 1) * rowsPerPage, pageSafe * rowsPerPage)

  useEffect(() => {
    setCurrentPage(1)
  }, [search, categoryFilter, rowsPerPage])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ChevronsUpDown className="h-3.5 w-3.5 ml-1 inline opacity-40" />
    return sortDir === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5 ml-1 inline" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 ml-1 inline" />
    )
  }

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

  const handleExport = async () => {
    setIsExporting(true)
    try {
      await exportAssets()
      toast({ title: "Success", description: "Assets exported successfully." })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to export assets",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
    }
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsImporting(true)
    try {
      const rows = await parseAssetFile(file)
      if (rows.length === 0) {
        toast({ title: "Empty file", description: "No rows found in the file.", variant: "destructive" })
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
      await importAssets(importRows, false)
      setImportPreview(null)
      setImportRows(null)
      toast({ title: "Success", description: "Assets imported successfully." })
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

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center">
          <div className="flex flex-wrap gap-3">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <Input
                className="pl-8 w-[260px] max-w-full"
                placeholder="Search assets..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 z-10" />
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[200px] pl-8">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={fetchAssets} disabled={isLoading}>
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
            <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>
              {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Export
            </Button>
            <PermissionGuard permissions={["can_create_assets", "can_manage_assets", "can_manage_system", "can_manage_company"]} hideOnDenied>
              <Button variant="outline" size="sm" onClick={downloadAssetTemplate}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Template
              </Button>
              <div className="relative">
                <input
                  type="file"
                  id="import-assets-file"
                  className="hidden"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleImportFile}
                />
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
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("name")}>
                  Asset Name/Description {sortIcon("name")}
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("category")}>
                  Category {sortIcon("category")}
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("serial_number")}>
                  Serial/Model No. {sortIcon("serial_number")}
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("location")}>
                  Location/Department {sortIcon("location")}
                </TableHead>
                <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleSort("quantity")}>
                  Qty {sortIcon("quantity")}
                </TableHead>
                <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleSort("purchase_cost")}>
                  Purchase Cost (Ksh) {sortIcon("purchase_cost")}
                </TableHead>
                <TableHead className="w-12">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    No assets found. Add an asset or import from Excel to get started.
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((asset, idx) => (
                  <TableRow
                    key={asset.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setViewingAsset(asset)}
                  >
                    <TableCell className="text-muted-foreground">
                      {(pageSafe - 1) * rowsPerPage + idx + 1}
                    </TableCell>
                    <TableCell className="font-medium">{asset.name}</TableCell>
                    <TableCell>{asset.category || "-"}</TableCell>
                    <TableCell>{asset.serial_number || "-"}</TableCell>
                    <TableCell>{asset.location || "-"}</TableCell>
                    <TableCell className="text-right">{asset.quantity}</TableCell>
                    <TableCell className="text-right">{KES.format(Number(asset.purchase_cost) || 0)}</TableCell>
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
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              Showing {sorted.length === 0 ? 0 : (pageSafe - 1) * rowsPerPage + 1} to{" "}
              {Math.min(pageSafe * rowsPerPage, sorted.length)} of {sorted.length} assets
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(pageSafe + 1)}
              disabled={pageSafe >= totalPages}
            >
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
              This will permanently remove &quot;{deleteTarget?.name}&quot; from the asset register. This action cannot be undone.
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
              <p className="text-sm text-gray-600 mt-1">Review the import summary before proceeding</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-3 rounded">
                  <div className="text-2xl font-bold text-blue-600">{importPreview.summary.created}</div>
                  <div className="text-sm text-gray-600">New assets</div>
                </div>
                <div className="bg-red-50 p-3 rounded">
                  <div className="text-2xl font-bold text-red-600">{importPreview.summary.errors}</div>
                  <div className="text-sm text-gray-600">Errors (skipped)</div>
                </div>
              </div>
              {importPreview.summary.errors > 0 && importPreview.summary.created > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800">
                  {importPreview.summary.errors} row(s) have problems and will be skipped. The{" "}
                  {importPreview.summary.created} valid row(s) will still be imported.
                </div>
              )}
              {importPreview.summary.created === 0 && (
                <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
                  No valid rows to import. Make sure the Asset Name/Description column is filled in, then try again.
                </div>
              )}
              {importPreview.rows && importPreview.rows.length > 0 && (
                <div className="mt-4">
                  <h3 className="font-semibold mb-2">Details ({importPreview.rows.length} rows):</h3>
                  <div className="max-h-[300px] overflow-y-auto border rounded">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left">Row</th>
                          <th className="px-3 py-2 text-left">Name</th>
                          <th className="px-3 py-2 text-left">Status</th>
                          <th className="px-3 py-2 text-left">Message</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.rows.slice(0, 50).map((row: any, idx: number) => (
                          <tr key={idx} className="border-t hover:bg-gray-50">
                            <td className="px-3 py-2">{row.row}</td>
                            <td className="px-3 py-2">{row.name}</td>
                            <td className="px-3 py-2">
                              <span
                                className={`px-2 py-1 text-xs rounded ${
                                  row.status === "created" ? "bg-blue-100 text-blue-800" : "bg-red-100 text-red-800"
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
              <Button onClick={handleConfirmImport} disabled={isImporting || importPreview.summary.created === 0}>
                {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {importPreview.summary.errors > 0
                  ? `Import ${importPreview.summary.created} valid row(s)`
                  : "Confirm Import"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
