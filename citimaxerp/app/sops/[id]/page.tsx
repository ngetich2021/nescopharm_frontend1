"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { PermissionGuard } from "@/components/PermissionGuard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth-context"
import {
  AnnexureColumn,
  CommentType,
  createAnnexure,
  createAnnexureEntry,
  createSopComment,
  deleteAnnexure,
  deleteAnnexureEntry,
  deleteSop,
  deleteSopComment,
  downloadSopDocument,
  fetchAnnexureEntries,
  fetchAnnexures,
  fetchSopById,
  fetchSopComments,
  formatSopStatus,
  getCommentTypeBadge,
  getSopStatusBadge,
  hasSopDocument,
  getUserDisplayName,
  sendSopByEmail,
  Sop,
  SopAnnexure,
  SopAnnexureEntry,
  SopComment,
  UpdateFrequency,
  updateAnnexure,
  updateAnnexureEntry,
  viewSopDocument,
} from "@/lib/sops"
import { formatDate } from "@/lib/utils"
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Download,
  Edit,
  Eye,
  FileText,
  Loader2,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Trash2,
  User,
  Wrench,
} from "lucide-react"
import { CapaTab } from "@/app/sops/components/capa-tab"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface AnnexureColumnDraft {
  key: string
  label: string
  type: AnnexureColumn["type"]
  required: boolean
  optionsText: string
  placeholder: string
}

const DEFAULT_COLUMN: AnnexureColumnDraft = {
  key: "",
  label: "",
  type: "text",
  required: false,
  optionsText: "",
  placeholder: "",
}

function getErrorMessage(error: any): string {
  const validationErrors = error?.apiResponse?.errors
  if (validationErrors && typeof validationErrors === "object") {
    return Object.values(validationErrors).flat().join(", ")
  }
  return error?.message || "An unexpected error occurred"
}

function parseApiStatusCode(error: any): number | undefined {
  return error?.statusCode || error?.apiResponse?.status || error?.apiResponse?.status_code
}

function formatColumnValue(value: unknown, type: AnnexureColumn["type"]): string {
  if (value === null || value === undefined || value === "") return "-"
  if (type === "boolean") return Boolean(value) ? "Yes" : "No"
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

function normalizeEntryPayload(columns: AnnexureColumn[], values: Record<string, unknown>): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  columns.forEach((column) => {
    const value = values[column.key]
    if (column.type === "number") {
      payload[column.key] = value === "" || value === undefined || value === null ? null : Number(value)
      return
    }
    if (column.type === "boolean") {
      if (value === "true" || value === true) payload[column.key] = true
      else if (value === "false" || value === false) payload[column.key] = false
      else payload[column.key] = null
      return
    }
    payload[column.key] = value ?? ""
  })
  return payload
}

function createInitialPayload(columns: AnnexureColumn[], source?: Record<string, unknown>): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  columns.forEach((column) => {
    if (source && source[column.key] !== undefined) {
      const sourceValue = source[column.key]
      if (column.type === "boolean") {
        payload[column.key] = sourceValue === true ? "true" : sourceValue === false ? "false" : ""
      } else {
        payload[column.key] = sourceValue as any
      }
      return
    }
    payload[column.key] = ""
  })
  return payload
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

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "-"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SopDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const { userProfile } = useAuth()

  const sopId = params.id as string

  // Core data
  const [sop, setSop] = useState<Sop | null>(null)
  const [annexures, setAnnexures] = useState<SopAnnexure[]>([])
  const [comments, setComments] = useState<SopComment[]>([])
  const [entriesByAnnexure, setEntriesByAnnexure] = useState<Record<string, SopAnnexureEntry[]>>({})

  // Loading states
  const [isLoading, setIsLoading] = useState(true)
  const [isViewingDocument, setIsViewingDocument] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isDeletingSop, setIsDeletingSop] = useState(false)

  // Annexure state
  const [selectedAnnexureId, setSelectedAnnexureId] = useState<string>("")
  const [isLoadingEntries, setIsLoadingEntries] = useState(false)
  const [entryGuardMessage, setEntryGuardMessage] = useState("")

  // Annexure dialog
  const [isAnnexureDialogOpen, setIsAnnexureDialogOpen] = useState(false)
  const [editingAnnexureId, setEditingAnnexureId] = useState<string | null>(null)
  const [annexureName, setAnnexureName] = useState("")
  const [annexureDescription, setAnnexureDescription] = useState("")
  const [annexureFrequency, setAnnexureFrequency] = useState<UpdateFrequency>("monthly")
  const [annexureIsActive, setAnnexureIsActive] = useState(true)
  const [columnDrafts, setColumnDrafts] = useState<AnnexureColumnDraft[]>([{ ...DEFAULT_COLUMN }])
  const [isSavingAnnexure, setIsSavingAnnexure] = useState(false)

  // Entry state
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split("T")[0])
  const [entryPayload, setEntryPayload] = useState<Record<string, unknown>>({})
  const [isSavingEntry, setIsSavingEntry] = useState(false)

  // Edit entry dialog
  const [isEditEntryDialogOpen, setIsEditEntryDialogOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<SopAnnexureEntry | null>(null)
  const [editEntryDate, setEditEntryDate] = useState("")
  const [editEntryPayload, setEditEntryPayload] = useState<Record<string, unknown>>({})

  // Comment state
  const [commentType, setCommentType] = useState<CommentType>("general")
  const [commentText, setCommentText] = useState("")
  const [commentAnnexureId, setCommentAnnexureId] = useState("none")
  const [commentEntryId, setCommentEntryId] = useState("none")
  const [commentFilter, setCommentFilter] = useState<"all" | CommentType>("all")
  const [commentContextFilter, setCommentContextFilter] = useState<"all" | "annexure" | "entry" | "none">("all")
  const [isSavingComment, setIsSavingComment] = useState(false)

  // Email dialog
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false)
  const [emailRecipientsText, setEmailRecipientsText] = useState("")
  const [emailSubject, setEmailSubject] = useState("")
  const [emailMessage, setEmailMessage] = useState("")
  const [isSendingEmail, setIsSendingEmail] = useState(false)

  const currentUserId = (userProfile as any)?.id || ""

  // ---------------------------------------------------------------------------
  // Derived / memoised
  // ---------------------------------------------------------------------------

  const selectedAnnexure = useMemo(
    () => annexures.find((a) => a.id === selectedAnnexureId) || null,
    [annexures, selectedAnnexureId],
  )

  const selectedAnnexureEntries = useMemo(
    () => (selectedAnnexureId ? entriesByAnnexure[selectedAnnexureId] || [] : []),
    [entriesByAnnexure, selectedAnnexureId],
  )

  const annexureNameById = useMemo(() => {
    const map = new Map<string, string>()
    annexures.forEach((a) => map.set(a.id, a.name))
    return map
  }, [annexures])

  const entryLabelById = useMemo(() => {
    const map = new Map<string, string>()
    Object.values(entriesByAnnexure).forEach((entries) => {
      entries.forEach((e) => map.set(e.id, `${formatDate(e.entry_date)} • ${e.id.slice(0, 8)}`))
    })
    return map
  }, [entriesByAnnexure])

  const isAssignedUpdater = Boolean(sop?.assigned_updater_id && sop.assigned_updater_id === currentUserId)

  const canModifyEntries = useMemo(() => {
    if (!sop?.assigned_updater_id) return false
    return isAssignedUpdater
  }, [sop, isAssignedUpdater])

  const entriesReadOnly = !canModifyEntries || Boolean(entryGuardMessage)

  const filteredComments = useMemo(() => {
    const sorted = [...comments].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    let result = sorted
    if (commentFilter !== "all") result = result.filter((c) => c.comment_type === commentFilter)
    if (commentContextFilter === "annexure") return result.filter((c) => Boolean(c.sop_annexure_id))
    if (commentContextFilter === "entry") return result.filter((c) => Boolean(c.sop_annexure_entry_id))
    if (commentContextFilter === "none") return result.filter((c) => !c.sop_annexure_id && !c.sop_annexure_entry_id)
    return result
  }, [comments, commentFilter, commentContextFilter])

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const loadSopData = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true)
      const [sopData, annexureData, commentData] = await Promise.all([
        fetchSopById(sopId),
        fetchAnnexures(sopId),
        fetchSopComments(sopId),
      ])
      setSop(sopData)
      setAnnexures(annexureData)
      setComments(commentData)
      if (!selectedAnnexureId && annexureData.length > 0) setSelectedAnnexureId(annexureData[0].id)
    } catch (error: any) {
      toast({ title: "Failed to load SOP", description: getErrorMessage(error), variant: "destructive" })
      router.replace("/sops")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (sopId) loadSopData(false)
  }, [sopId])

  const handleLoadEntries = useCallback(
    async (annexureId: string) => {
      try {
        setIsLoadingEntries(true)
        const entries = await fetchAnnexureEntries(sopId, annexureId)
        setEntriesByAnnexure((cur) => ({ ...cur, [annexureId]: entries }))
      } catch (error: any) {
        toast({ title: "Failed to load entries", description: getErrorMessage(error), variant: "destructive" })
      } finally {
        setIsLoadingEntries(false)
      }
    },
    [sopId, toast],
  )

  useEffect(() => {
    if (!selectedAnnexure) return
    setEntryPayload(createInitialPayload(selectedAnnexure.columns_definition))
    setEntryDate(new Date().toISOString().split("T")[0])
    if (!entriesByAnnexure[selectedAnnexure.id]) handleLoadEntries(selectedAnnexure.id)
  }, [selectedAnnexure, entriesByAnnexure, handleLoadEntries])

  useEffect(() => {
    if (!sop) return
    if (!sop.assigned_updater_id) {
      setEntryGuardMessage("No assigned updater set for this SOP. Annexure entries are read-only.")
      return
    }
    if (sop.assigned_updater_id !== currentUserId) {
      setEntryGuardMessage("Only the assigned updater can create, edit, or delete annexure entries.")
      return
    }
    setEntryGuardMessage("")
  }, [sop, currentUserId])

  useEffect(() => {
    if (commentAnnexureId === "none") {
      setCommentEntryId("none")
      return
    }
    if (!entriesByAnnexure[commentAnnexureId]) handleLoadEntries(commentAnnexureId)
  }, [commentAnnexureId, entriesByAnnexure, handleLoadEntries])

  // ---------------------------------------------------------------------------
  // Document handlers
  // ---------------------------------------------------------------------------

  const handleDownloadDocument = async () => {
    if (!sop || !hasSopDocument(sop)) return
    try {
      setIsDownloading(true)
      const { blob, filename } = await downloadSopDocument(sop)
      downloadBlob(blob, filename)
      toast({ title: "Downloaded", description: "SOP document downloaded successfully." })
    } catch (error: any) {
      toast({ title: "Download failed", description: getErrorMessage(error), variant: "destructive" })
    } finally {
      setIsDownloading(false)
    }
  }

  const handleViewDocument = async () => {
    if (!sop || !hasSopDocument(sop)) return
    const previewWindow = window.open("about:blank", "_blank")
    try {
      setIsViewingDocument(true)
      const { blob, filename } = await viewSopDocument(sop)
      const objectUrl = URL.createObjectURL(blob)
      if (previewWindow && !previewWindow.closed) {
        previewWindow.location.href = objectUrl
        try { previewWindow.document.title = filename } catch { /* cross-origin */ }
      } else {
        const a = document.createElement("a")
        a.href = objectUrl
        a.target = "_blank"
        a.rel = "noopener noreferrer"
        a.click()
      }
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    } catch (error: any) {
      if (previewWindow && !previewWindow.closed) previewWindow.close()
      console.error("Document view error:", error)
      toast({ title: "Cannot view document", description: "The document may not be available. Try downloading instead.", variant: "destructive" })
    } finally {
      setIsViewingDocument(false)
    }
  }

  // ---------------------------------------------------------------------------
  // SOP actions
  // ---------------------------------------------------------------------------

  const handleDeleteSop = async () => {
    if (!sop) return
    if (!window.confirm(`Delete SOP ${sop.sop_number || sop.title}? This action cannot be undone.`)) return
    try {
      setIsDeletingSop(true)
      await deleteSop(sop.id)
      toast({ title: "Deleted", description: "SOP deleted successfully." })
      router.push("/sops")
    } catch (error: any) {
      toast({ title: "Delete failed", description: getErrorMessage(error), variant: "destructive" })
    } finally {
      setIsDeletingSop(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Annexure CRUD
  // ---------------------------------------------------------------------------

  const resetAnnexureForm = () => {
    setEditingAnnexureId(null)
    setAnnexureName("")
    setAnnexureDescription("")
    setAnnexureFrequency("monthly")
    setAnnexureIsActive(true)
    setColumnDrafts([{ ...DEFAULT_COLUMN }])
  }

  const openCreateAnnexureDialog = () => {
    resetAnnexureForm()
    setIsAnnexureDialogOpen(true)
  }

  const openEditAnnexureDialog = (annexure: SopAnnexure) => {
    setEditingAnnexureId(annexure.id)
    setAnnexureName(annexure.name)
    setAnnexureDescription(annexure.description || "")
    setAnnexureFrequency(annexure.update_frequency)
    setAnnexureIsActive(annexure.is_active)
    setColumnDrafts(
      annexure.columns_definition.length > 0
        ? annexure.columns_definition.map((col) => ({
            key: col.key,
            label: col.label,
            type: col.type,
            required: Boolean(col.required),
            optionsText: (col.options || []).join(", "),
            placeholder: col.placeholder || "",
          }))
        : [{ ...DEFAULT_COLUMN }],
    )
    setIsAnnexureDialogOpen(true)
  }

  const upsertColumnDraft = (index: number, key: keyof AnnexureColumnDraft, value: any) => {
    setColumnDrafts((cur) => cur.map((col, i) => (i !== index ? col : { ...col, [key]: value })))
  }

  const handleSaveAnnexure = async () => {
    if (!annexureName.trim()) {
      toast({ title: "Annexure name required", description: "Enter a name for the annexure.", variant: "destructive" })
      return
    }
    const normalizedColumns: AnnexureColumn[] = columnDrafts
      .map((col) => ({
        key: col.key.trim(),
        label: col.label.trim(),
        type: col.type,
        required: col.required,
        options: col.type === "select" ? col.optionsText.split(",").map((o) => o.trim()).filter(Boolean) : undefined,
        placeholder: col.placeholder.trim() || undefined,
      }))
      .filter((col) => col.key && col.label)

    if (normalizedColumns.length === 0) {
      toast({ title: "Columns required", description: "Add at least one valid column with key and label.", variant: "destructive" })
      return
    }
    const keys = normalizedColumns.map((c) => c.key)
    if (new Set(keys).size !== keys.length) {
      toast({ title: "Duplicate column keys", description: "Each annexure column key must be unique.", variant: "destructive" })
      return
    }
    try {
      setIsSavingAnnexure(true)
      const payload = {
        name: annexureName.trim(),
        description: annexureDescription.trim() || undefined,
        update_frequency: annexureFrequency,
        columns_definition: normalizedColumns,
        is_active: annexureIsActive,
      }
      if (editingAnnexureId) {
        await updateAnnexure(sopId, editingAnnexureId, payload)
        toast({ title: "Annexure updated", description: "Annexure changes saved." })
      } else {
        await createAnnexure(sopId, payload)
        toast({ title: "Annexure created", description: "New annexure template created." })
      }
      setIsAnnexureDialogOpen(false)
      resetAnnexureForm()
      await loadSopData(true)
    } catch (error: any) {
      toast({ title: "Failed to save annexure", description: getErrorMessage(error), variant: "destructive" })
    } finally {
      setIsSavingAnnexure(false)
    }
  }

  const handleDeleteAnnexure = async (annexure: SopAnnexure) => {
    if (!window.confirm(`Delete annexure '${annexure.name}'?`)) return
    try {
      await deleteAnnexure(sopId, annexure.id)
      toast({ title: "Annexure deleted", description: "Annexure removed successfully." })
      const updated = annexures.filter((a) => a.id !== annexure.id)
      setAnnexures(updated)
      setEntriesByAnnexure((cur) => { const n = { ...cur }; delete n[annexure.id]; return n })
      if (selectedAnnexureId === annexure.id) setSelectedAnnexureId(updated[0]?.id || "")
      await loadSopData(true)
    } catch (error: any) {
      toast({ title: "Failed to delete annexure", description: getErrorMessage(error), variant: "destructive" })
    }
  }

  // ---------------------------------------------------------------------------
  // Entry CRUD
  // ---------------------------------------------------------------------------

  const handleCreateEntry = async () => {
    if (!selectedAnnexure || !entryDate) {
      toast({ title: "Entry date required", description: "Please provide entry date.", variant: "destructive" })
      return
    }
    try {
      setIsSavingEntry(true)
      await createAnnexureEntry(sopId, selectedAnnexure.id, {
        entry_date: entryDate,
        data_payload: normalizeEntryPayload(selectedAnnexure.columns_definition, entryPayload),
      })
      toast({ title: "Entry saved", description: "Annexure entry created successfully." })
      setEntryPayload(createInitialPayload(selectedAnnexure.columns_definition))
      await handleLoadEntries(selectedAnnexure.id)
      await loadSopData(true)
      if (sop?.assigned_updater_id && isAssignedUpdater) setEntryGuardMessage("")
    } catch (error: any) {
      const sc = parseApiStatusCode(error)
      const msg = getErrorMessage(error)
      if (sc === 400 || sc === 403) setEntryGuardMessage(msg)
      toast({ title: "Failed to create entry", description: msg, variant: "destructive" })
    } finally {
      setIsSavingEntry(false)
    }
  }

  const openEditEntryDialog = (entry: SopAnnexureEntry) => {
    if (!selectedAnnexure) return
    setEditingEntry(entry)
    setEditEntryDate(entry.entry_date)
    setEditEntryPayload(createInitialPayload(selectedAnnexure.columns_definition, entry.data_payload || {}))
    setIsEditEntryDialogOpen(true)
  }

  const handleSaveEditedEntry = async () => {
    if (!selectedAnnexure || !editingEntry) return
    try {
      setIsSavingEntry(true)
      await updateAnnexureEntry(sopId, selectedAnnexure.id, editingEntry.id, {
        entry_date: editEntryDate,
        data_payload: normalizeEntryPayload(selectedAnnexure.columns_definition, editEntryPayload),
      })
      toast({ title: "Entry updated", description: "Annexure entry updated successfully." })
      setIsEditEntryDialogOpen(false)
      setEditingEntry(null)
      await handleLoadEntries(selectedAnnexure.id)
      if (sop?.assigned_updater_id && isAssignedUpdater) setEntryGuardMessage("")
    } catch (error: any) {
      const sc = parseApiStatusCode(error)
      const msg = getErrorMessage(error)
      if (sc === 400 || sc === 403) setEntryGuardMessage(msg)
      toast({ title: "Failed to update entry", description: msg, variant: "destructive" })
    } finally {
      setIsSavingEntry(false)
    }
  }

  const handleDeleteEntry = async (entry: SopAnnexureEntry) => {
    if (!selectedAnnexure || !window.confirm("Delete this annexure entry?")) return
    try {
      await deleteAnnexureEntry(sopId, selectedAnnexure.id, entry.id)
      toast({ title: "Entry deleted", description: "Annexure entry deleted." })
      await handleLoadEntries(selectedAnnexure.id)
      await loadSopData(true)
      if (sop?.assigned_updater_id && isAssignedUpdater) setEntryGuardMessage("")
    } catch (error: any) {
      const sc = parseApiStatusCode(error)
      const msg = getErrorMessage(error)
      if (sc === 400 || sc === 403) setEntryGuardMessage(msg)
      toast({ title: "Failed to delete entry", description: msg, variant: "destructive" })
    }
  }

  // ---------------------------------------------------------------------------
  // Comment CRUD
  // ---------------------------------------------------------------------------

  const handleCreateComment = async () => {
    if (!commentText.trim()) {
      toast({ title: "Comment required", description: "Please enter a comment.", variant: "destructive" })
      return
    }
    try {
      setIsSavingComment(true)
      await createSopComment(sopId, {
        comment_type: commentType,
        comment: commentText.trim(),
        sop_annexure_id: commentAnnexureId !== "none" ? commentAnnexureId : undefined,
        sop_annexure_entry_id: commentEntryId !== "none" ? commentEntryId : undefined,
      })
      toast({ title: "Comment posted", description: "Comment has been added." })
      setCommentText("")
      setCommentType("general")
      setCommentAnnexureId("none")
      setCommentEntryId("none")
      const commentData = await fetchSopComments(sopId)
      setComments(commentData)
    } catch (error: any) {
      toast({ title: "Failed to post comment", description: getErrorMessage(error), variant: "destructive" })
    } finally {
      setIsSavingComment(false)
    }
  }

  const handleDeleteComment = async (comment: SopComment) => {
    if (!window.confirm("Delete this comment?")) return
    try {
      await deleteSopComment(sopId, comment.id)
      toast({ title: "Comment deleted", description: "Comment has been removed." })
      setComments((cur) => cur.filter((c) => c.id !== comment.id))
    } catch (error: any) {
      toast({ title: "Failed to delete comment", description: getErrorMessage(error), variant: "destructive" })
    }
  }

  // ---------------------------------------------------------------------------
  // Email
  // ---------------------------------------------------------------------------

  const handleSendEmail = async () => {
    const recipients = emailRecipientsText.split(/[\n,]/).map((s) => s.trim()).filter(Boolean)
    if (recipients.length === 0) {
      toast({ title: "Recipients required", description: "Enter at least one email recipient.", variant: "destructive" })
      return
    }
    try {
      setIsSendingEmail(true)
      await sendSopByEmail(sopId, {
        recipients,
        subject: emailSubject.trim() || undefined,
        message: emailMessage.trim() || undefined,
      })
      toast({ title: "Email sent", description: "SOP sent as email attachment." })
      setIsEmailDialogOpen(false)
      setEmailRecipientsText("")
      setEmailSubject("")
      setEmailMessage("")
    } catch (error: any) {
      toast({ title: "Email failed", description: getErrorMessage(error), variant: "destructive" })
    } finally {
      setIsSendingEmail(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Dynamic input renderer
  // ---------------------------------------------------------------------------

  const renderDynamicInput = (column: AnnexureColumn, value: unknown, onChange: (v: unknown) => void, inputId: string) => {
    const baseProps = { id: inputId, placeholder: column.placeholder || undefined }

    if (column.type === "number") return <Input {...baseProps} type="number" value={value as any} onChange={(e) => onChange(e.target.value)} />
    if (column.type === "date") return <Input {...baseProps} type="date" value={value as any} onChange={(e) => onChange(e.target.value)} />
    if (column.type === "time") return <Input {...baseProps} type="time" value={value as any} onChange={(e) => onChange(e.target.value)} />

    if (column.type === "select") {
      return (
        <Select value={(value as string) || ""} onValueChange={onChange}>
          <SelectTrigger><SelectValue placeholder={`Select ${column.label}`} /></SelectTrigger>
          <SelectContent>
            {(column.options || []).map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    }

    if (column.type === "boolean") {
      return (
        <Select value={(value as string) || ""} onValueChange={onChange}>
          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Yes</SelectItem>
            <SelectItem value="false">No</SelectItem>
          </SelectContent>
        </Select>
      )
    }

    return <Input {...baseProps} value={value as any} onChange={(e) => onChange(e.target.value)} />
  }

  // ---------------------------------------------------------------------------
  // Loading / empty states
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <PermissionGuard permissions={["can_view_sops_menu", "can_view_sops", "can_manage_system", "can_manage_company"]}>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading SOP details...</p>
          </div>
        </div>
      </PermissionGuard>
    )
  }

  if (!sop) {
    return (
      <PermissionGuard permissions={["can_view_sops_menu", "can_view_sops", "can_manage_system", "can_manage_company"]}>
        <div className="flex-1 p-8">
          <div className="text-center text-muted-foreground py-10">SOP not found.</div>
        </div>
      </PermissionGuard>
    )
  }

  const hasDocument = hasSopDocument(sop)

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <PermissionGuard permissions={["can_view_sops_menu", "can_view_sops", "can_manage_system", "can_manage_company"]}>
      <div className="flex-1 space-y-6 p-3 sm:p-4 md:p-8 pt-4 sm:pt-6">

        {/* ----------------------------------------------------------------- */}
        {/* Header                                                            */}
        {/* ----------------------------------------------------------------- */}
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            {/* Left: back + title */}
            <div className="flex items-start gap-3 min-w-0">
              <Link href="/sops" className="mt-1 shrink-0">
                <Button variant="outline" size="icon" className="h-8 w-8">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold truncate">{sop.title}</h1>
                  <Badge className={getSopStatusBadge(sop.status)}>{formatSopStatus(sop.status)}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {sop.sop_number || "No SOP number"} &middot; Year {sop.year}
                </p>
              </div>
            </div>

            {/* Right: primary actions + overflow */}
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={handleViewDocument} disabled={isViewingDocument || !hasDocument} className="hidden sm:inline-flex">
                {isViewingDocument ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
                View
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadDocument} disabled={isDownloading || !hasDocument} className="hidden sm:inline-flex">
                {isDownloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                Download
              </Button>
              <Link href={`/sops/${sop.id}/edit`}>
                <Button variant="outline" size="sm" className="hidden sm:inline-flex">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </Link>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {/* Show on mobile only */}
                  <DropdownMenuItem className="sm:hidden" onClick={handleViewDocument} disabled={!hasDocument || isViewingDocument}>
                    <Eye className="h-4 w-4 mr-2" />View Document
                  </DropdownMenuItem>
                  <DropdownMenuItem className="sm:hidden" onClick={handleDownloadDocument} disabled={!hasDocument || isDownloading}>
                    <Download className="h-4 w-4 mr-2" />Download
                  </DropdownMenuItem>
                  <DropdownMenuItem className="sm:hidden" onClick={() => router.push(`/sops/${sop.id}/edit`)}>
                    <Edit className="h-4 w-4 mr-2" />Edit SOP
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="sm:hidden" />

                  {/* Always visible */}
                  <DropdownMenuItem onClick={() => router.push(`/sops/${sop.id}/print`)}>
                    <Printer className="h-4 w-4 mr-2" />Print Preview
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsEmailDialogOpen(true)}>
                    <Mail className="h-4 w-4 mr-2" />Send via Email
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => loadSopData(true)}>
                    <RefreshCw className="h-4 w-4 mr-2" />Refresh
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={handleDeleteSop} disabled={isDeletingSop}>
                    <Trash2 className="h-4 w-4 mr-2" />Delete SOP
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* Two-column info section                                           */}
        {/* ----------------------------------------------------------------- */}
        <div className="grid gap-6 lg:grid-cols-3">

          {/* Left column — SOP details (2/3) */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-500" />
                  SOP Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Status</p>
                    <Badge className={getSopStatusBadge(sop.status)}>{formatSopStatus(sop.status)}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Year</p>
                    <p className="text-sm font-medium">{sop.year}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Effective Date</p>
                    <p className="text-sm font-medium">{sop.effective_date ? formatDate(sop.effective_date) : "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Review Date</p>
                    <p className="text-sm font-medium">{sop.review_date ? formatDate(sop.review_date) : "-"}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs text-muted-foreground mb-1">Description</p>
                    <p className="text-sm whitespace-pre-wrap">{sop.description || "No description provided."}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stats row */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              <Card className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-muted-foreground">Year</p>
                  <Calendar className="h-3.5 w-3.5 text-blue-500" />
                </div>
                <p className="text-xl font-bold">{sop.year}</p>
              </Card>
              <Card className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-muted-foreground">Updater</p>
                  <User className="h-3.5 w-3.5 text-green-500" />
                </div>
                <p className="text-sm font-semibold truncate">
                  {sop.assigned_updater ? getUserDisplayName(sop.assigned_updater) : "Unassigned"}
                </p>
              </Card>
              <Card className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-muted-foreground">Annexures</p>
                  <CheckCircle2 className="h-3.5 w-3.5 text-amber-500" />
                </div>
                <p className="text-xl font-bold">{annexures.length}</p>
              </Card>
              <Card className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-muted-foreground">Comments</p>
                  <MessageSquare className="h-3.5 w-3.5 text-purple-500" />
                </div>
                <p className="text-xl font-bold">{comments.length}</p>
              </Card>
            </div>
          </div>

          {/* Right column — Document card (1/3, sticky) */}
          <div className="lg:sticky lg:top-6 lg:self-start space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-amber-500" />
                  Document
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {hasDocument ? (
                  <>
                    <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                      <p className="text-sm font-medium truncate" title={sop.original_file_name || ""}>
                        {sop.original_file_name || "Attached document"}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{sop.mime_type === "application/pdf" ? "PDF" : sop.mime_type || "File"}</span>
                        <span>&middot;</span>
                        <span>{formatFileSize(sop.file_size)}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button size="sm" className="w-full" onClick={handleViewDocument} disabled={isViewingDocument}>
                        {isViewingDocument ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
                        View Document
                      </Button>
                      <Button variant="outline" size="sm" className="w-full" onClick={handleDownloadDocument} disabled={isDownloading}>
                        {isDownloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                        Download
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg border border-dashed p-6 text-center">
                    <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No document attached</p>
                    <Link href={`/sops/${sop.id}/edit`} className="mt-2 inline-block">
                      <Button variant="outline" size="sm">Upload Document</Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4 text-green-500" />
                  Assignment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Assigned Updater</p>
                  <p className="font-medium">{sop.assigned_updater ? getUserDisplayName(sop.assigned_updater) : "Unassigned"}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Created</p>
                  <p className="font-medium">{formatDate(sop.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Last Updated</p>
                  <p className="font-medium">{formatDate(sop.updated_at)}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* Tabs: Annexures & Comments                                        */}
        {/* ----------------------------------------------------------------- */}
        <Tabs defaultValue="annexures" className="space-y-4">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="annexures" className="gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Annexures
            </TabsTrigger>
            <TabsTrigger value="comments" className="gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              Comments ({comments.length})
            </TabsTrigger>
            <TabsTrigger value="capas" className="gap-1.5">
              <Wrench className="h-3.5 w-3.5" />
              CAPA ({comments.filter(c => c.comment_type === 'capa').length})
            </TabsTrigger>
          </TabsList>

          {/* ---- Annexures Tab ---- */}
          <TabsContent value="annexures">
            <div className="grid gap-6 xl:grid-cols-[1fr_2fr]">
              {/* Annexure list */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-base">Templates</CardTitle>
                  <Button size="sm" variant="outline" onClick={openCreateAnnexureDialog}>
                    <Plus className="h-4 w-4 mr-1" />Add
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2">
                  {annexures.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No annexures yet.</p>
                  ) : (
                    annexures.map((annexure) => (
                      <button
                        key={annexure.id}
                        type="button"
                        onClick={() => setSelectedAnnexureId(annexure.id)}
                        className={`w-full text-left rounded-lg border p-3 transition-colors hover:bg-muted/50 ${
                          selectedAnnexureId === annexure.id ? "border-primary bg-primary/5 ring-1 ring-primary/20" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{annexure.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {annexure.update_frequency} &middot; {annexure.columns_definition.length} col(s)
                            </p>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditAnnexureDialog(annexure)}>
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteAnnexure(annexure)}>
                              <Trash2 className="h-3.5 w-3.5 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Entries */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-base">
                    {selectedAnnexure ? `${selectedAnnexure.name} — Entries` : "Select an Annexure"}
                  </CardTitle>
                  {selectedAnnexure && (
                    <Button variant="ghost" size="sm" onClick={() => handleLoadEntries(selectedAnnexure.id)}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {!selectedAnnexure ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">Select an annexure template from the left to manage its entries.</p>
                  ) : (
                    <>
                      {entryGuardMessage && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{entryGuardMessage}</div>
                      )}

                      {/* New entry form */}
                      <details className="group" open={!entriesReadOnly}>
                        <summary className="cursor-pointer text-sm font-medium flex items-center gap-2 py-1 select-none">
                          <Plus className="h-4 w-4 text-primary transition-transform group-open:rotate-45" />
                          New Entry
                        </summary>
                        <div className="mt-3 rounded-lg border p-4 space-y-3">
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-1.5 md:col-span-2">
                              <Label htmlFor="entry_date" className="text-xs">Entry Date</Label>
                              <Input id="entry_date" type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} disabled={entriesReadOnly} />
                            </div>
                            {selectedAnnexure.columns_definition.map((col) => (
                              <div key={col.key} className="space-y-1.5">
                                <Label className="text-xs">{col.label}{col.required ? " *" : ""}</Label>
                                {renderDynamicInput(col, entryPayload[col.key], (v) => setEntryPayload((c) => ({ ...c, [col.key]: v })), `entry-${col.key}`)}
                              </div>
                            ))}
                          </div>
                          <Button size="sm" onClick={handleCreateEntry} disabled={entriesReadOnly || isSavingEntry}>
                            {isSavingEntry ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                            Save Entry
                          </Button>
                        </div>
                      </details>

                      {/* Entries table */}
                      <div className="rounded-lg border overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Date</TableHead>
                              {selectedAnnexure.columns_definition.map((col) => (
                                <TableHead key={col.key} className="text-xs">{col.label}</TableHead>
                              ))}
                              <TableHead className="text-xs">Updated By</TableHead>
                              <TableHead className="text-xs">Updated</TableHead>
                              <TableHead className="text-xs text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {isLoadingEntries ? (
                              <TableRow>
                                <TableCell colSpan={5 + selectedAnnexure.columns_definition.length} className="h-20 text-center">
                                  <Loader2 className="h-4 w-4 animate-spin inline-block mr-2" />Loading...
                                </TableCell>
                              </TableRow>
                            ) : selectedAnnexureEntries.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={5 + selectedAnnexure.columns_definition.length} className="h-20 text-center text-muted-foreground">
                                  No entries yet.
                                </TableCell>
                              </TableRow>
                            ) : (
                              selectedAnnexureEntries.map((entry) => (
                                <TableRow key={entry.id}>
                                  <TableCell className="text-xs whitespace-nowrap">{formatDate(entry.entry_date)}</TableCell>
                                  {selectedAnnexure.columns_definition.map((col) => (
                                    <TableCell key={col.key} className="text-xs">{formatColumnValue(entry.data_payload?.[col.key], col.type)}</TableCell>
                                  ))}
                                  <TableCell className="text-xs">{entry.updated_by_user ? getUserDisplayName(entry.updated_by_user) : "-"}</TableCell>
                                  <TableCell className="text-xs whitespace-nowrap">{formatDate(entry.updated_at)}</TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-0.5">
                                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditEntryDialog(entry)} disabled={entriesReadOnly}>
                                        <Edit className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteEntry(entry)} disabled={entriesReadOnly}>
                                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ---- Comments Tab ---- */}
          <TabsContent value="comments">
            <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
              {/* Post comment */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Post Comment</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Type</Label>
                    <Select value={commentType} onValueChange={(v) => setCommentType(v as CommentType)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="guidance">Guidance</SelectItem>
                        <SelectItem value="capa">CAPA</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Annexure Context</Label>
                    <Select value={commentAnnexureId} onValueChange={setCommentAnnexureId}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {annexures.map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {commentAnnexureId !== "none" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Entry Context</Label>
                      <Select value={commentEntryId} onValueChange={setCommentEntryId}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {(entriesByAnnexure[commentAnnexureId] || []).map((e) => (
                            <SelectItem key={e.id} value={e.id}>{formatDate(e.entry_date)} &middot; {e.id.slice(0, 8)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-xs">Comment</Label>
                    <Textarea rows={4} value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Write your comment..." />
                  </div>

                  <Button size="sm" onClick={handleCreateComment} disabled={isSavingComment} className="w-full">
                    {isSavingComment ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                    Post Comment
                  </Button>
                </CardContent>
              </Card>

              {/* Comments timeline */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3 gap-3">
                  <CardTitle className="text-base">Timeline</CardTitle>
                  <div className="flex items-center gap-2">
                    <Select value={commentFilter} onValueChange={(v) => setCommentFilter(v as any)}>
                      <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All types</SelectItem>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="guidance">Guidance</SelectItem>
                        <SelectItem value="capa">CAPA</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={commentContextFilter} onValueChange={(v) => setCommentContextFilter(v as any)}>
                      <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All contexts</SelectItem>
                        <SelectItem value="annexure">Annexure</SelectItem>
                        <SelectItem value="entry">Entry</SelectItem>
                        <SelectItem value="none">No context</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {filteredComments.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">No comments found.</p>
                  ) : (
                    filteredComments.map((comment) => (
                      <div key={comment.id} className="rounded-lg border p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className={getCommentTypeBadge(comment.comment_type)}>
                              {comment.comment_type.toUpperCase()}
                            </Badge>
                            <span className="text-sm font-medium">
                              {comment.commented_by_user ? getUserDisplayName(comment.commented_by_user) : "Unknown"}
                            </span>
                            <span className="text-xs text-muted-foreground">{formatDate(comment.created_at)}</span>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => handleDeleteComment(comment)}>
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{comment.comment}</p>
                        {(comment.sop_annexure_id || comment.sop_annexure_entry_id) && (
                          <p className="text-xs text-muted-foreground">
                            {comment.sop_annexure_id ? `Annexure: ${annexureNameById.get(comment.sop_annexure_id) || comment.sop_annexure_id}` : ""}
                            {comment.sop_annexure_id && comment.sop_annexure_entry_id ? " \u00b7 " : ""}
                            {comment.sop_annexure_entry_id ? `Entry: ${entryLabelById.get(comment.sop_annexure_entry_id) || comment.sop_annexure_entry_id}` : ""}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ---- CAPA Tab ---- */}
          <TabsContent value="capas">
            <CapaTab
              sopId={sopId}
              capas={comments}
              loading={false}
              onAddCapa={async (comment, file) => {
                const formData = new FormData()
                formData.append('comment', comment)
                formData.append('comment_type', 'capa')
                if (file) {
                  formData.append('file', file)
                }

                const response = await fetch(`/api/sops/${sopId}/comments`, {
                  method: 'POST',
                  body: formData,
                })

                if (!response.ok) {
                  throw new Error('Failed to create CAPA')
                }

                const data = await response.json()
                setComments((cur) => [data.data, ...cur])
              }}
              onDeleteCapa={async (capaId) => {
                await handleDeleteComment(capaId)
              }}
              onDownloadFile={async (capaId, fileName) => {
                try {
                  const response = await fetch(`/api/sops/${sopId}/comments/${capaId}/download`)
                  if (!response.ok) {
                    toast({
                      title: "Error",
                      description: "Failed to download file",
                      variant: "destructive",
                    })
                    return
                  }

                  const blob = await response.blob()
                  const url = window.URL.createObjectURL(blob)
                  const link = document.createElement('a')
                  link.href = url
                  link.download = fileName || 'capa-document'
                  document.body.appendChild(link)
                  link.click()
                  document.body.removeChild(link)
                  window.URL.revokeObjectURL(url)
                } catch (error) {
                  console.error('Download error:', error)
                  toast({
                    title: "Error",
                    description: "Failed to download file",
                    variant: "destructive",
                  })
                }
              }}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* Dialogs                                                             */}
      {/* ------------------------------------------------------------------- */}

      {/* Annexure create/edit dialog */}
      <Dialog open={isAnnexureDialogOpen} onOpenChange={setIsAnnexureDialogOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editingAnnexureId ? "Edit Annexure" : "Create Annexure"}</DialogTitle>
            <DialogDescription>Build dynamic columns for this annexure template.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Name *</Label>
                <Input value={annexureName} onChange={(e) => setAnnexureName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Update Frequency *</Label>
                <Select value={annexureFrequency} onValueChange={(v) => setAnnexureFrequency(v as UpdateFrequency)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                    <SelectItem value="ad_hoc">Ad Hoc</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs">Description</Label>
                <Textarea value={annexureDescription} onChange={(e) => setAnnexureDescription(e.target.value)} rows={2} />
              </div>
              <div className="md:col-span-2">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={annexureIsActive} onChange={(e) => setAnnexureIsActive(e.target.checked)} />
                  Active Annexure
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Columns</h4>
                <Button type="button" variant="outline" size="sm" onClick={() => setColumnDrafts((c) => [...c, { ...DEFAULT_COLUMN }])}>
                  <Plus className="h-4 w-4 mr-1" />Column
                </Button>
              </div>
              {columnDrafts.map((col, idx) => (
                <div key={idx} className="rounded-lg border p-3 space-y-3">
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Key *</Label>
                      <Input value={col.key} onChange={(e) => upsertColumnDraft(idx, "key", e.target.value)} placeholder="shift" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Label *</Label>
                      <Input value={col.label} onChange={(e) => upsertColumnDraft(idx, "label", e.target.value)} placeholder="Shift" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Type *</Label>
                      <Select value={col.type} onValueChange={(v) => upsertColumnDraft(idx, "type", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="number">Number</SelectItem>
                          <SelectItem value="date">Date</SelectItem>
                          <SelectItem value="time">Time</SelectItem>
                          <SelectItem value="select">Select</SelectItem>
                          <SelectItem value="boolean">Boolean</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Placeholder</Label>
                      <Input value={col.placeholder} onChange={(e) => upsertColumnDraft(idx, "placeholder", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Options (comma-separated)</Label>
                      <Input value={col.optionsText} onChange={(e) => upsertColumnDraft(idx, "optionsText", e.target.value)} placeholder="Morning, Evening" disabled={col.type !== "select"} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Required</Label>
                      <div className="h-10 flex items-center">
                        <label className="inline-flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={col.required} onChange={(e) => upsertColumnDraft(idx, "required", e.target.checked)} />
                          Required
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setColumnDrafts((c) => c.length === 1 ? c : c.filter((_, i) => i !== idx))} disabled={columnDrafts.length === 1}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" />Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAnnexureDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveAnnexure} disabled={isSavingAnnexure}>
              {isSavingAnnexure && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save Annexure
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit entry dialog */}
      <Dialog open={isEditEntryDialogOpen} onOpenChange={setIsEditEntryDialogOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Entry</DialogTitle>
          </DialogHeader>
          {selectedAnnexure && editingEntry && (
            <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit_entry_date" className="text-xs">Entry Date</Label>
                <Input id="edit_entry_date" type="date" value={editEntryDate} onChange={(e) => setEditEntryDate(e.target.value)} />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {selectedAnnexure.columns_definition.map((col) => (
                  <div key={col.key} className="space-y-1.5">
                    <Label className="text-xs">{col.label}</Label>
                    {renderDynamicInput(col, editEntryPayload[col.key], (v) => setEditEntryPayload((c) => ({ ...c, [col.key]: v })), `edit-entry-${col.key}`)}
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditEntryDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEditedEntry} disabled={isSavingEntry || entriesReadOnly}>
              {isSavingEntry && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email dialog */}
      <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Email SOP</DialogTitle>
            <DialogDescription>Send SOP document as attachment to one or more recipients.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Recipients *</Label>
              <Textarea rows={3} value={emailRecipientsText} onChange={(e) => setEmailRecipientsText(e.target.value)} placeholder="email1@example.com, email2@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Subject</Label>
              <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} placeholder={`SOP: ${sop.title}`} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Message</Label>
              <Textarea rows={4} value={emailMessage} onChange={(e) => setEmailMessage(e.target.value)} placeholder="Please find attached SOP document." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEmailDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSendEmail} disabled={isSendingEmail}>
              {isSendingEmail && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Send Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PermissionGuard>
  )
}
