"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import {
  Search, Plus, MoreHorizontal, Loader2, Shield, ChevronLeft, ChevronRight, Pencil, Trash2,
} from "lucide-react"
import {
  getPermissions, createPermission, updatePermission, deletePermission,
  type Permission, type CreatePermissionPayload,
} from "@/lib/permissions"

export function PermissionsTable() {
  const { toast } = useToast()

  const [permissions, setPermissions] = useState<Permission[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(20)

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPermission, setEditingPermission] = useState<Permission | null>(null)
  const [formData, setFormData] = useState({ name: "", key: "", description: "", category: "" })
  const [saving, setSaving] = useState(false)

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingPermission, setDeletingPermission] = useState<Permission | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await getPermissions()
      setPermissions(res.permissions)
      setCategories(res.categories)
    } catch {
      toast({ title: "Error", description: "Failed to load permissions.", variant: "destructive" })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Filtering
  const filtered = permissions.filter((p) => {
    if (categoryFilter !== "all" && p.category?.toLowerCase() !== categoryFilter.toLowerCase()) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      p.name?.toLowerCase().includes(q) ||
      p.key?.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q)
    )
  })

  const totalPages = Math.ceil(filtered.length / rowsPerPage)
  const paginated = filtered.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)

  // Open create dialog
  const handleCreate = () => {
    setEditingPermission(null)
    setFormData({ name: "", key: "", description: "", category: "" })
    setDialogOpen(true)
  }

  // Open edit dialog
  const handleEdit = (perm: Permission) => {
    setEditingPermission(perm)
    setFormData({
      name: perm.name || "",
      key: perm.key || "",
      description: perm.description || "",
      category: perm.category || "",
    })
    setDialogOpen(true)
  }

  // Auto-generate key from name
  const handleNameChange = (name: string) => {
    const key = "can_" + name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")
    setFormData({ ...formData, name, key })
  }

  // Save (create or update)
  const handleSave = async () => {
    if (!formData.name.trim() || !formData.key.trim()) {
      toast({ title: "Validation", description: "Name and key are required.", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      if (editingPermission) {
        await updatePermission(editingPermission.id, formData)
        toast({ title: "Updated", description: `Permission "${formData.name}" updated.` })
      } else {
        await createPermission(formData as CreatePermissionPayload)
        toast({ title: "Created", description: `Permission "${formData.name}" created.` })
      }
      setDialogOpen(false)
      fetchData(true)
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to save permission.", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  // Delete
  const handleDelete = async () => {
    if (!deletingPermission) return
    setDeleting(true)
    try {
      await deletePermission(deletingPermission.id)
      toast({ title: "Deleted", description: `Permission "${deletingPermission.name}" deleted.` })
      setDeleteDialogOpen(false)
      setDeletingPermission(null)
      fetchData(true)
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to delete permission.", variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  const uniqueCategories = [...new Set(permissions.map((p) => p.category).filter(Boolean))].sort()

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-auto">
            <Input
              className="pl-8 w-full sm:w-[300px]"
              placeholder="Search permissions..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
            />
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
          </div>
          <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setCurrentPage(1) }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {uniqueCategories.map((cat) => (
                <SelectItem key={cat} value={cat.toLowerCase()}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          New Permission
        </Button>
      </div>

      {/* Table */}
      <div className={`rounded-md border transition-opacity duration-200 ${refreshing ? "opacity-50 pointer-events-none" : ""}`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && permissions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Loading permissions...
                  </div>
                </TableCell>
              </TableRow>
            ) : paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <div className="text-muted-foreground">
                    <Shield className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="font-medium">No permissions found</p>
                    <p className="text-sm">
                      {search || categoryFilter !== "all" ? "Try adjusting your search or filter." : "Create your first permission to get started."}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((perm) => (
                <TableRow key={perm.id} className="hover:bg-gray-50">
                  <TableCell>
                    <div>
                      <div className="font-medium">{perm.name}</div>
                      {perm.description && (
                        <div className="text-xs text-muted-foreground truncate max-w-[250px]">{perm.description}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-gray-100 px-2 py-0.5 rounded">{perm.key}</code>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{perm.category || "General"}</Badge>
                  </TableCell>
                  <TableCell>
                    {perm.is_system ? (
                      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 text-xs">System</Badge>
                    ) : (
                      <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100 text-xs">Custom</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {perm.is_active ? (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">Active</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-800 hover:bg-red-100 text-xs">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(perm)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => { setDeletingPermission(perm); setDeleteDialogOpen(true) }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
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
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <p className="text-sm font-medium">Rows per page</p>
          <Select value={rowsPerPage.toString()} onValueChange={(v) => { setRowsPerPage(Number(v)); setCurrentPage(1) }}>
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent side="top">
              {[10, 20, 50, 100].map((size) => (
                <SelectItem key={size} value={size.toString()}>{size}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            {filtered.length > 0
              ? `Showing ${(currentPage - 1) * rowsPerPage + 1}–${Math.min(currentPage * rowsPerPage, filtered.length)} of ${filtered.length}`
              : "No results"}
          </p>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))} disabled={currentPage === 1}>
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <div className="text-sm font-medium">Page {currentPage} of {totalPages}</div>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))} disabled={currentPage >= totalPages}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPermission ? "Edit Permission" : "Create Permission"}</DialogTitle>
            <DialogDescription>
              {editingPermission ? "Update the permission details below." : "Fill in the details to create a new permission."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => editingPermission ? setFormData({ ...formData, name: e.target.value }) : handleNameChange(e.target.value)}
                placeholder="View Reports"
              />
            </div>
            <div className="space-y-2">
              <Label>Key</Label>
              <Input
                value={formData.key}
                onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                placeholder="can_view_reports"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">Auto-generated from name. Should start with &quot;can_&quot;.</p>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Allows viewing reports"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Input
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="General"
                list="category-suggestions"
              />
              <datalist id="category-suggestions">
                {uniqueCategories.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : editingPermission ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Permission</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deletingPermission?.name}</strong>? This will remove it from all roles that currently have it assigned. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
