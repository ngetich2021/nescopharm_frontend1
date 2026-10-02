"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import {
  createSop,
  fetchSopById,
  getUserDisplayName,
  SopStatus,
  updateSop,
} from "@/lib/sops"
import { fetchUsers, UserData } from "@/lib/users"
import { ArrowLeft, Loader2 } from "lucide-react"

interface SopFormProps {
  mode: "create" | "edit"
  sopId?: string
}

const MAX_FILE_SIZE_MB = 50
const ALLOWED_EXTENSIONS = ["pdf", "doc", "docx", "xls", "xlsx"]

function getErrorMessage(error: any): string {
  const validationErrors = error?.apiResponse?.errors
  if (validationErrors && typeof validationErrors === "object") {
    return Object.values(validationErrors).flat().join(", ")
  }

  return error?.message || "An unexpected error occurred"
}

function getDefaultYear() {
  return new Date().getFullYear()
}

export function SopForm({ mode, sopId }: SopFormProps) {
  const router = useRouter()
  const { toast } = useToast()

  const [users, setUsers] = useState<UserData[]>([])
  const [isLoadingPage, setIsLoadingPage] = useState(mode === "edit")
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [title, setTitle] = useState("")
  const [sopNumber, setSopNumber] = useState("")
  const [description, setDescription] = useState("")
  const [year, setYear] = useState<number>(getDefaultYear())
  const [status, setStatus] = useState<SopStatus>("draft")
  const [assignedUpdaterId, setAssignedUpdaterId] = useState("unassigned")
  const [effectiveDate, setEffectiveDate] = useState("")
  const [reviewDate, setReviewDate] = useState("")
  const [documentFile, setDocumentFile] = useState<File | null>(null)
  const [existingDocumentName, setExistingDocumentName] = useState<string>("")
  const [removeDocument, setRemoveDocument] = useState(false)

  const heading = mode === "create" ? "Create SOP" : "Edit SOP"
  const subheading =
    mode === "create"
      ? "Add a standard operating procedure and upload the document."
      : "Update SOP details, assignment, and attached document."

  const backHref = mode === "create" ? "/sops" : `/sops/${sopId}`

  const isYearValid = useMemo(() => year >= 2000 && year <= 2100, [year])

  const loadUsers = async () => {
    try {
      setIsLoadingUsers(true)
      const usersData = await fetchUsers()
      setUsers(usersData || [])
    } catch (error: any) {
      setUsers([])
      toast({
        title: "Failed to load users",
        description: getErrorMessage(error),
        variant: "destructive",
      })
    } finally {
      setIsLoadingUsers(false)
    }
  }

  const loadSop = async (id: string) => {
    try {
      setIsLoadingPage(true)
      const sop = await fetchSopById(id)

      setTitle(sop.title || "")
      setSopNumber(sop.sop_number || "")
      setDescription(sop.description || "")
      setYear(Number(sop.year) || getDefaultYear())
      setStatus((sop.status || "draft") as SopStatus)
      setAssignedUpdaterId(sop.assigned_updater_id || "unassigned")
      setEffectiveDate(sop.effective_date || "")
      setReviewDate(sop.review_date || "")
      setExistingDocumentName(sop.original_file_name || "")
    } catch (error: any) {
      toast({
        title: "Failed to load SOP",
        description: getErrorMessage(error),
        variant: "destructive",
      })
      router.replace("/sops")
    } finally {
      setIsLoadingPage(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  useEffect(() => {
    if (mode === "edit" && sopId) {
      loadSop(sopId)
    }
  }, [mode, sopId])

  const handleFileChange = (file: File | null) => {
    if (!file) {
      setDocumentFile(null)
      return
    }

    const extension = file.name.split(".").pop()?.toLowerCase() || ""
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      toast({
        title: "Invalid file type",
        description: "Allowed file types: PDF, DOC, DOCX, XLS, XLSX.",
        variant: "destructive",
      })
      return
    }

    const fileSizeMb = file.size / (1024 * 1024)
    if (fileSizeMb > MAX_FILE_SIZE_MB) {
      toast({
        title: "File too large",
        description: `Maximum file size is ${MAX_FILE_SIZE_MB}MB.`,
        variant: "destructive",
      })
      return
    }

    setDocumentFile(file)
    setRemoveDocument(false)
  }

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({
        title: "Title is required",
        description: "Please enter an SOP title.",
        variant: "destructive",
      })
      return
    }

    if (!isYearValid) {
      toast({
        title: "Invalid year",
        description: "Year must be between 2000 and 2100.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSubmitting(true)

      const payload = {
        title: title.trim(),
        sop_number: sopNumber.trim() || undefined,
        description: description.trim() || undefined,
        year,
        status,
        assigned_updater_id: assignedUpdaterId === "unassigned" ? undefined : assignedUpdaterId,
        effective_date: effectiveDate || undefined,
        review_date: reviewDate || undefined,
        document: documentFile,
      }

      if (mode === "create") {
        const created = await createSop(payload)
        toast({ title: "SOP created", description: "SOP has been created successfully." })
        router.push(`/sops/${created.id}`)
      } else if (sopId) {
        const updated = await updateSop(sopId, {
          ...payload,
          remove_document: removeDocument,
        })
        toast({ title: "SOP updated", description: "SOP has been updated successfully." })
        router.push(`/sops/${updated.id}`)
      }
    } catch (error: any) {
      toast({
        title: "Failed to save SOP",
        description: getErrorMessage(error),
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoadingPage) {
    return (
      <div className="flex-1 space-y-6 p-2 sm:p-4 md:p-8 pt-4 sm:pt-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading SOP...
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-6 p-2 sm:p-4 md:p-8 pt-4 sm:pt-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href={backHref}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">{heading}</h1>
            <p className="text-sm text-muted-foreground">{subheading}</p>
          </div>
        </div>

        <Button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {mode === "create" ? "Create SOP" : "Save Changes"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>SOP Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sop_number">SOP Number</Label>
              <Input
                id="sop_number"
                value={sopNumber}
                onChange={(event) => setSopNumber(event.target.value)}
                placeholder="SOP-001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="year">Year *</Label>
              <Input
                id="year"
                type="number"
                min={2000}
                max={2100}
                value={year}
                onChange={(event) => setYear(Number(event.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label>Status *</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as SopStatus)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Assigned Updater</Label>
              <Select value={assignedUpdaterId} onValueChange={setAssignedUpdaterId}>
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingUsers ? "Loading users..." : "Select updater"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {getUserDisplayName(user as any)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="effective_date">Effective Date</Label>
              <Input
                id="effective_date"
                type="date"
                value={effectiveDate}
                onChange={(event) => setEffectiveDate(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="review_date">Review Date</Label>
              <Input
                id="review_date"
                type="date"
                value={reviewDate}
                onChange={(event) => setReviewDate(event.target.value)}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                placeholder="Describe the SOP scope and intent"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="document">Document ({ALLOWED_EXTENSIONS.join(", ").toUpperCase()}; max {MAX_FILE_SIZE_MB}MB)</Label>
              <Input
                id="document"
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx"
                onChange={(event) => handleFileChange(event.target.files?.[0] || null)}
              />

              {existingDocumentName && mode === "edit" && (
                <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-2">
                  <p>
                    Existing file: <span className="font-medium">{existingDocumentName}</span>
                  </p>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={removeDocument}
                      onChange={(event) => setRemoveDocument(event.target.checked)}
                    />
                    Remove existing document on save
                  </label>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Link href={backHref}>
          <Button variant="outline">Cancel</Button>
        </Link>
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {mode === "create" ? "Create SOP" : "Save Changes"}
        </Button>
      </div>
    </div>
  )
}
