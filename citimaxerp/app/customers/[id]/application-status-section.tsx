"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { usePermissions } from "@/hooks/use-permissions"
import {
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Upload,
  Printer,
  ExternalLink,
  Loader2,
  ShieldAlert,
  History,
} from "lucide-react"
import {
  type CustomerApproval,
  type CreditApplicationInput,
  getCustomerApprovals,
  submitCustomerApproval,
  uploadSignedCreditApplication,
  uploadStampedCreditApplication,
  fetchCustomerCreditTerms,
  type CustomerCreditTerms,
} from "@/lib/customers"
import { getCustomerAccount, updateCustomerAccount, type CustomerAccountWithDetails } from "@/lib/customer-accounts"
import { getDocuments, type Document as CustomerDocument } from "@/lib/documents"
import { compressImageIfLarge } from "@/lib/image-compression"

// Deliberately a small structural subset (not the full Customer type) - the
// different pages/modals that render this section each carry their own
// slightly-diverged local Customer type, and this only needs to read these
// few fields to show what was actually submitted for review.
interface ReviewableCustomer {
  account_id?: string | null
  pending_credit_application?: CreditApplicationInput | null
  accounts_contact_name?: string | null
  accounts_contact_designation?: string | null
  accounts_contact_phone?: string | null
  accounts_contact_email?: string | null
}

interface ApplicationStatusSectionProps {
  customerId: string
  /** The customer's current approval_status (undefined/null for customers not in the workflow). */
  approvalStatus: string | null | undefined
  /**
   * The full customer record, so the reviewer can see what was actually
   * submitted (directors, trade references, bank details, requested credit
   * terms, authorized/accounts contact) before approving or rejecting -
   * without this there's no data to review a decision against.
   */
  customer?: ReviewableCustomer | null
  /** Re-fetches the customer profile (and therefore approval_status) from the parent. */
  onRefresh: () => void | Promise<void>
}

export const STATUS_META: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-gray-100 text-gray-800" },
  pending_stage1: { label: "Pending Stage 1 Review", className: "bg-yellow-100 text-yellow-800" },
  pending_documents: { label: "Awaiting Signed Documents", className: "bg-blue-100 text-blue-800" },
  pending_stage2: { label: "Pending Final Review", className: "bg-yellow-100 text-yellow-800" },
  approved: { label: "Approved", className: "bg-green-100 text-green-800" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-800" },
}

// Statuses that always belong to the rep-submitted credit-approval workflow,
// regardless of history. "approved"/"draft"/undefined are ambiguous - those
// are also the resting state for normal staff-created customers, so we only
// show the section for them when there's actual approval history proving
// they went through the workflow (checked in the component below).
const ALWAYS_SHOW_STATUSES = new Set(["pending_stage1", "pending_documents", "pending_stage2", "rejected"])

// The print/download entry point exists so the rep can get a blank copy of
// the computer-generated form to take to the customer for signing - it's
// only useful during that one window (Stage 1 approved, signed copy not
// uploaded yet). Once a real signed scan exists, reviewers should look at
// that actual document (see DocumentPreview below), not a re-rendered PDF of
// the live data, so this must not appear at pending_stage2/approved.
const SHOW_PRINT_STATUSES = new Set(["pending_documents"])

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function fullName(person: { first_name: string; last_name: string } | null | undefined): string {
  if (!person) return "—"
  return `${person.first_name || ""} ${person.last_name || ""}`.trim() || "—"
}

function approvalTypeLabel(type: string): string {
  if (type === "stage1") return "Stage 1"
  if (type === "stage2") return "Stage 2 (Final)"
  return type
}

function formatKES(amount: string | number | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "—"
  const num = Number(amount)
  return Number.isNaN(num) ? "—" : `KES ${num.toLocaleString()}`
}

function formatKESOrPlain(amount: string | number | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "—"
  const num = Number(amount)
  return Number.isNaN(num) ? String(amount) : `KES ${num.toLocaleString()}`
}

function isImageUrl(url: string | null | undefined): boolean {
  if (!url) return false
  return /\.(png|jpe?g|gif|webp|heic|heif)(\?|#|$)/i.test(url)
}

// The reviewer needs to actually SEE the photo/scan the rep uploaded, right
// on this page - a bare "View signed document" link that opens a new tab
// makes them guess what's behind it. Show the image inline when it is one;
// fall back to a plain link for PDFs/other file types.
function DocumentPreview({ document: doc, emptyLabel }: { document: CustomerDocument | null; emptyLabel: string }) {
  if (!doc) {
    return (
      <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        {emptyLabel}
      </div>
    )
  }
  const url = (doc as any).url || doc.document_image || ""
  if (isImageUrl(url)) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block w-fit group">
        <img
          src={url}
          alt={doc.document_name}
          className="max-h-64 w-auto rounded-md border object-contain group-hover:opacity-90 transition-opacity"
        />
        <span className="mt-1 inline-flex items-center gap-1 text-xs text-primary group-hover:underline">
          <ExternalLink className="h-3 w-3" />
          Open full size
        </span>
      </a>
    )
  }
  return (
    <a
      href={url || "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
    >
      <FileText className="h-4 w-4" />
      View {doc.document_name}
      <ExternalLink className="h-3 w-3" />
    </a>
  )
}

export function ApplicationStatusSection({ customerId, approvalStatus: rawApprovalStatus, customer, onRefresh }: ApplicationStatusSectionProps) {
  const { toast } = useToast()
  const { hasPermission } = usePermissions()
  const canApprove = hasPermission("can_approve_account")

  const [approvals, setApprovals] = useState<CustomerApproval[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)

  const [signedDocument, setSignedDocument] = useState<CustomerDocument | null>(null)
  const [stampedDocument, setStampedDocument] = useState<CustomerDocument | null>(null)
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true)

  const [creditTerms, setCreditTerms] = useState<CustomerCreditTerms | null>(null)

  const [notes, setNotes] = useState("")
  const [isSubmittingDecision, setIsSubmittingDecision] = useState<"approved" | "rejected" | null>(null)

  // Editable credit terms for Stage 1 approval - default to what the rep
  // submitted, but the approver can adjust before the CustomerAccount gets
  // created from these values.
  const [editAnnualTurnover, setEditAnnualTurnover] = useState("")
  const [editCreditRequired, setEditCreditRequired] = useState("")
  const [editCreditPeriod, setEditCreditPeriod] = useState("")
  const [editPdChequeDays, setEditPdChequeDays] = useState("")

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  // The approver's own company-stamped copy - a separate attachment from the
  // rep's customer-signed scan above, uploaded once there's something to
  // stamp (pending_stage2 onward).
  const [selectedStampedFile, setSelectedStampedFile] = useState<File | null>(null)
  const [isUploadingStamped, setIsUploadingStamped] = useState(false)

  // Official Approval Details (Section 8 of the paper Credit Appraisal Form)
  // - once the customer has a CustomerAccount (post Stage 1), the approver
  // can set/adjust the actually-granted credit limit and terms right here,
  // instead of having to find the separate printable credit-form page.
  const [account, setAccount] = useState<CustomerAccountWithDetails | null>(null)
  const [isLoadingAccount, setIsLoadingAccount] = useState(false)
  const [approvedCreditLimit, setApprovedCreditLimit] = useState("")
  const [approvedCreditDays, setApprovedCreditDays] = useState("")
  const [officialRemarks, setOfficialRemarks] = useState("")
  const [isSavingOfficialUse, setIsSavingOfficialUse] = useState(false)

  const approvalStatus = rawApprovalStatus || "draft"

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoadingHistory(true)
      try {
        const data = await getCustomerApprovals(customerId)
        if (!cancelled) setApprovals(data)
      } catch {
        if (!cancelled) setApprovals([])
      } finally {
        if (!cancelled) setIsLoadingHistory(false)
      }
    }

    if (customerId) load()
    return () => {
      cancelled = true
    }
  }, [customerId, approvalStatus])

  // Only relevant once documents can exist (pending_documents or later), but
  // it's cheap enough to just always check so the Stage 2 approve button can
  // be gated the moment it's needed.
  useEffect(() => {
    let cancelled = false

    async function loadDocuments() {
      setIsLoadingDocuments(true)
      try {
        const docs = await getDocuments("Customer", customerId)
        if (cancelled) return
        const signed = docs.find((d) =>
          (d.document_name || "").toLowerCase().includes("signed credit application"),
        )
        setSignedDocument(signed || null)
        const stamped = docs.find((d) =>
          (d.document_name || "").toLowerCase().includes("stamped credit application"),
        )
        setStampedDocument(stamped || null)
      } catch {
        if (!cancelled) {
          setSignedDocument(null)
          setStampedDocument(null)
        }
      } finally {
        if (!cancelled) setIsLoadingDocuments(false)
      }
    }

    if (customerId) loadDocuments()
    return () => {
      cancelled = true
    }
  }, [customerId, approvalStatus])

  useEffect(() => {
    let cancelled = false

    async function loadTerms() {
      try {
        const terms = await fetchCustomerCreditTerms(customerId)
        if (!cancelled) setCreditTerms(terms)
      } catch {
        if (!cancelled) setCreditTerms(null)
      }
    }

    if (customerId && approvalStatus === "pending_stage2") loadTerms()
    return () => {
      cancelled = true
    }
  }, [customerId, approvalStatus])

  const pendingApp = customer?.pending_credit_application
  useEffect(() => {
    setEditAnnualTurnover(pendingApp?.annual_turnover != null ? String(pendingApp.annual_turnover) : "")
    setEditCreditRequired(pendingApp?.credit_required != null ? String(pendingApp.credit_required) : "")
    setEditCreditPeriod(pendingApp?.credit_period_required || "")
    setEditPdChequeDays(pendingApp?.credit_period_pd_cheque_days != null ? String(pendingApp.credit_period_pd_cheque_days) : "")
  }, [customerId, pendingApp?.annual_turnover, pendingApp?.credit_required, pendingApp?.credit_period_required, pendingApp?.credit_period_pd_cheque_days])

  const accountId = customer?.account_id
  useEffect(() => {
    let cancelled = false

    async function loadAccount() {
      setIsLoadingAccount(true)
      try {
        const data = await getCustomerAccount(accountId as string)
        if (!cancelled) setAccount(data)
      } catch {
        if (!cancelled) setAccount(null)
      } finally {
        if (!cancelled) setIsLoadingAccount(false)
      }
    }

    if (accountId) loadAccount()
    else setAccount(null)
    return () => {
      cancelled = true
    }
  }, [accountId])

  useEffect(() => {
    setApprovedCreditLimit(account?.credit_required != null ? String(account.credit_required) : "")
    setApprovedCreditDays(account?.credit_days != null ? String(account.credit_days) : "")
    setOfficialRemarks(account?.notes || "")
  }, [account?.credit_required, account?.credit_days, account?.notes])

  async function handleSaveOfficialUse() {
    if (!account) return
    setIsSavingOfficialUse(true)
    try {
      const updated = await updateCustomerAccount(account.id, {
        credit_required: approvedCreditLimit.trim() ? (approvedCreditLimit as any) : null,
        credit_days: approvedCreditDays.trim() ? (Number(approvedCreditDays) as any) : null,
        notes: officialRemarks.trim() || null,
      })
      setAccount((prev) => (prev ? { ...prev, ...updated } : prev))
      toast({ title: "Saved", description: "Official approval details have been saved." })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save official approval details.",
        variant: "destructive",
      })
    } finally {
      setIsSavingOfficialUse(false)
    }
  }

  const hasWorkflowHistory = approvals.length > 0
  const shouldRender = ALWAYS_SHOW_STATUSES.has(approvalStatus) || hasWorkflowHistory

  if (!shouldRender) {
    return null
  }

  const meta = STATUS_META[approvalStatus] || {
    label: approvalStatus.charAt(0).toUpperCase() + approvalStatus.slice(1).replace(/_/g, " "),
    className: "bg-gray-100 text-gray-800",
  }

  const showPrintEntryPoint = SHOW_PRINT_STATUSES.has(approvalStatus)
  const canGiveDecision = canApprove && (approvalStatus === "pending_stage1" || approvalStatus === "pending_stage2")
  const isStage2 = approvalStatus === "pending_stage2"
  const stage2Blocked = isStage2 && !isLoadingDocuments && !signedDocument
  // The CustomerAccount is only (re)built from these terms at Stage 1 -
  // Stage 2 is just the final document check, so editing them there would
  // have no effect and would be misleading to show as editable.
  const canEditCreditTerms = canGiveDecision && !isStage2

  const latestRejection = [...approvals].reverse().find((a) => a.status === "rejected")

  async function handleDecision(status: "approved" | "rejected") {
    setIsSubmittingDecision(status)
    try {
      const overrides = status === "approved" && canEditCreditTerms
        ? {
            annual_turnover: editAnnualTurnover.trim() ? Number(editAnnualTurnover) : undefined,
            credit_required: editCreditRequired.trim() ? Number(editCreditRequired) : undefined,
            credit_period_required: editCreditPeriod.trim() || undefined,
            credit_period_pd_cheque_days: editPdChequeDays.trim() ? Number(editPdChequeDays) : undefined,
          }
        : {}
      await submitCustomerApproval(customerId, { status, notes: notes.trim() || undefined, ...overrides })
      toast({
        title: status === "approved" ? "Approved" : "Rejected",
        description: `The application has been ${status} successfully.`,
      })
      setNotes("")
      await onRefresh()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || `Failed to ${status === "approved" ? "approve" : "reject"} the application.`,
        variant: "destructive",
      })
    } finally {
      setIsSubmittingDecision(null)
    }
  }

  async function handleUpload() {
    if (!selectedFile) return

    setIsUploading(true)
    try {
      // A phone photo of the signed form is usually why this was "too
      // large" - shrink it automatically instead of making whoever's
      // uploading find a way to resize it themselves.
      const fileToUpload = await compressImageIfLarge(selectedFile)
      if (fileToUpload.size > 15 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "The signed application must be 15MB or smaller, even after compression.",
          variant: "destructive",
        })
        return
      }
      await uploadSignedCreditApplication(customerId, fileToUpload)
      toast({
        title: "Uploaded",
        description: "Signed credit application uploaded. Moved to Stage 2 review.",
      })
      setSelectedFile(null)
      await onRefresh()
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload the signed application.",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  async function handleUploadStamped() {
    if (!selectedStampedFile) return

    setIsUploadingStamped(true)
    try {
      const fileToUpload = await compressImageIfLarge(selectedStampedFile)
      if (fileToUpload.size > 15 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "The stamped copy must be 15MB or smaller, even after compression.",
          variant: "destructive",
        })
        return
      }
      const { document } = await uploadStampedCreditApplication(customerId, fileToUpload)
      setStampedDocument(document as unknown as CustomerDocument)
      toast({
        title: "Uploaded",
        description: "Company-stamped copy uploaded.",
      })
      setSelectedStampedFile(null)
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload the stamped copy.",
        variant: "destructive",
      })
    } finally {
      setIsUploadingStamped(false)
    }
  }

  return (
    <Card className="border-2">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-5 w-5 text-primary" />
              Application Status
            </CardTitle>
            <CardDescription>Credit-approval workflow for this customer</CardDescription>
          </div>
          <Badge className={meta.className}>{meta.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Rejected banner */}
        {approvalStatus === "rejected" && (
          <div className="rounded-md border border-red-200 bg-red-50 p-4">
            <div className="flex items-center gap-2 text-red-800 font-medium">
              <XCircle className="h-4 w-4" />
              This application was rejected
            </div>
            {latestRejection && (
              <div className="mt-2 text-sm text-red-700 space-y-1">
                <p>
                  <span className="font-medium">By:</span> {fullName(latestRejection.approver)} on{" "}
                  {formatDateTime(latestRejection.approved_at || latestRejection.created_at)}
                </p>
                {latestRejection.notes && (
                  <p>
                    <span className="font-medium">Reason:</span> {latestRejection.notes}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Print / download for stamping - only from pending_documents onward, never before */}
        {showPrintEntryPoint && (
          <div className="flex items-center justify-between rounded-md border p-4 bg-muted/30">
            <div className="flex items-center gap-2 text-sm">
              <Printer className="h-4 w-4 text-muted-foreground" />
              <span>Print or download the credit application for the customer to sign and stamp.</span>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/customers/${customerId}/credit-form`}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Print / Download
              </Link>
            </Button>
          </div>
        )}

        {/* Upload signed application - only while awaiting documents */}
        {approvalStatus === "pending_documents" && (
          <div className="rounded-md border p-4 space-y-3">
            <div className="flex items-center gap-2 font-medium text-sm">
              <Upload className="h-4 w-4" />
              Upload Signed Application
            </div>
            <p className="text-sm text-muted-foreground">
              Once the customer has signed and stamped the printed application, upload a scan or photo here
              to move this application to Stage 2 review. Large photos are compressed automatically.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                type="file"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                disabled={isUploading}
                className="sm:max-w-sm"
              />
              <Button onClick={handleUpload} disabled={!selectedFile || isUploading}>
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload
                  </>
                )}
              </Button>
            </div>
            {selectedFile && (
              <p className="text-xs text-muted-foreground">
                Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} KB)
              </p>
            )}
          </div>
        )}

        {/* Submitted Application Details - directors, trade references, bank
            details, requested credit terms, and the authorized/accounts
            contact captured when the rep submitted this application. Shown
            for both Stage 1 and Stage 2 review - without this there's no
            data to actually review before approving or rejecting. */}
        {(() => {
          const app = customer?.pending_credit_application
          const hasDirectors = !!app?.directors?.length
          const hasSuppliers = !!app?.suppliers?.length
          const hasBankDetails = !!app?.bank_details?.length
          const hasCreditTerms = app && (
            app.annual_turnover != null || app.credit_required != null ||
            app.credit_period_required != null || app.credit_period_pd_cheque_days != null
          )
          const hasAccountsContact = !!(
            customer?.accounts_contact_name || customer?.accounts_contact_phone || customer?.accounts_contact_email
          )
          const hasAnything = hasDirectors || hasSuppliers || hasBankDetails || hasCreditTerms || hasAccountsContact

          if (!hasAnything) return null

          return (
            <div className="rounded-md border p-4 space-y-4">
              <div className="font-medium text-sm">Submitted Application Details</div>

              {(hasCreditTerms || canEditCreditTerms) && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">
                    {canEditCreditTerms ? "Credit Terms (as requested - adjust to what you're approving)" : "Requested Credit Terms"}
                  </p>
                  {canEditCreditTerms ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div className="space-y-1">
                        <Label htmlFor="edit-annual-turnover" className="text-xs text-muted-foreground font-normal">Annual Turnover (KES)</Label>
                        <Input
                          id="edit-annual-turnover"
                          type="number"
                          min="0"
                          value={editAnnualTurnover}
                          onChange={(e) => setEditAnnualTurnover(e.target.value)}
                          disabled={isSubmittingDecision !== null}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="edit-credit-required" className="text-xs text-muted-foreground font-normal">Credit Required (KES)</Label>
                        <Input
                          id="edit-credit-required"
                          type="number"
                          min="0"
                          value={editCreditRequired}
                          onChange={(e) => setEditCreditRequired(e.target.value)}
                          disabled={isSubmittingDecision !== null}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="edit-credit-period" className="text-xs text-muted-foreground font-normal">Credit Period</Label>
                        <Input
                          id="edit-credit-period"
                          value={editCreditPeriod}
                          onChange={(e) => setEditCreditPeriod(e.target.value)}
                          placeholder="e.g. 30 days"
                          disabled={isSubmittingDecision !== null}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="edit-pd-cheque-days" className="text-xs text-muted-foreground font-normal">Post-Dated Cheque Days</Label>
                        <Input
                          id="edit-pd-cheque-days"
                          type="number"
                          min="0"
                          max="365"
                          value={editPdChequeDays}
                          onChange={(e) => setEditPdChequeDays(e.target.value)}
                          disabled={isSubmittingDecision !== null}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Annual Turnover</p>
                        <p className="font-medium">{formatKES(app?.annual_turnover)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Credit Required</p>
                        <p className="font-medium">{formatKES(app?.credit_required)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Credit Period</p>
                        <p className="font-medium">{app?.credit_period_required || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Post-Dated Cheque Days</p>
                        <p className="font-medium">{app?.credit_period_pd_cheque_days ?? "—"}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {hasAccountsContact && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Authorized / Accounts Contact</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Name</p>
                      <p className="font-medium">{customer?.accounts_contact_name || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Designation</p>
                      <p className="font-medium">{customer?.accounts_contact_designation || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Phone</p>
                      <p className="font-medium">{customer?.accounts_contact_phone || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="font-medium">{customer?.accounts_contact_email || "—"}</p>
                    </div>
                  </div>
                </div>
              )}

              {hasDirectors && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Directors / Business Owners</p>
                  <div className="space-y-1.5">
                    {app!.directors!.map((d, i) => (
                      <div key={i} className="text-sm rounded border px-3 py-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div><span className="text-xs text-muted-foreground">Name: </span>{d.name || "—"}</div>
                        <div><span className="text-xs text-muted-foreground">ID/Passport: </span>{d.id_passport_number || "—"}</div>
                        <div><span className="text-xs text-muted-foreground">PIN: </span>{d.pin || "—"}</div>
                        <div><span className="text-xs text-muted-foreground">Phone: </span>{d.phone_number || "—"}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {hasSuppliers && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Trade References / Suppliers</p>
                  <div className="space-y-1.5">
                    {app!.suppliers!.map((s, i) => (
                      <div key={i} className="text-sm rounded border px-3 py-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div><span className="text-xs text-muted-foreground">Name: </span>{s.name || "—"}</div>
                        <div><span className="text-xs text-muted-foreground">Contact Person: </span>{s.contact_person_name || "—"}</div>
                        <div><span className="text-xs text-muted-foreground">Phone: </span>{s.phone_number || "—"}</div>
                        <div><span className="text-xs text-muted-foreground">Credit Limit: </span>{formatKESOrPlain(s.credit_limit)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {hasBankDetails && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Bank Details</p>
                  <div className="space-y-1.5">
                    {app!.bank_details!.map((b, i) => (
                      <div key={i} className="text-sm rounded border px-3 py-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div><span className="text-xs text-muted-foreground">Bank: </span>{b.bank_name || "—"}</div>
                        <div><span className="text-xs text-muted-foreground">Branch: </span>{b.branch || "—"}</div>
                        <div><span className="text-xs text-muted-foreground">Account Name: </span>{b.account_name || "—"}</div>
                        <div><span className="text-xs text-muted-foreground">Account Number: </span>{b.account_number || "—"}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })()}

        {/* Official Approval Details (Section 8 of the paper form) - once the
            customer has a CustomerAccount (Stage 1 cleared), this is where
            the approver sets/adjusts the actually-granted credit limit and
            terms. Shown directly here (not just on the separate printable
            credit-form page) so it's not easy to miss. */}
        {accountId && (
          <div className="rounded-md border p-4 space-y-4">
            <div className="font-medium text-sm">Official Approval Details</div>
            {isLoadingAccount ? (
              <p className="text-sm text-muted-foreground">Loading account…</p>
            ) : !account ? (
              <p className="text-sm text-muted-foreground">Could not load the customer's credit account.</p>
            ) : canApprove ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="space-y-1">
                    <Label htmlFor="approved-credit-limit" className="text-xs text-muted-foreground font-normal">Approved Credit Limit (KES)</Label>
                    <Input
                      id="approved-credit-limit"
                      type="number"
                      min="0"
                      value={approvedCreditLimit}
                      onChange={(e) => setApprovedCreditLimit(e.target.value)}
                      disabled={isSavingOfficialUse}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="approved-credit-days" className="text-xs text-muted-foreground font-normal">Approved Credit Terms (Days)</Label>
                    <Input
                      id="approved-credit-days"
                      type="number"
                      min="0"
                      value={approvedCreditDays}
                      onChange={(e) => setApprovedCreditDays(e.target.value)}
                      disabled={isSavingOfficialUse}
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label htmlFor="official-remarks" className="text-xs text-muted-foreground font-normal">Remarks</Label>
                    <Textarea
                      id="official-remarks"
                      value={officialRemarks}
                      onChange={(e) => setOfficialRemarks(e.target.value)}
                      rows={2}
                      disabled={isSavingOfficialUse}
                    />
                  </div>
                </div>
                <Button size="sm" onClick={handleSaveOfficialUse} disabled={isSavingOfficialUse}>
                  {isSavingOfficialUse ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                  {isSavingOfficialUse ? "Saving..." : "Save"}
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Approved Credit Limit</p>
                  <p className="font-medium">{formatKES(account.credit_required)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Approved Credit Terms (Days)</p>
                  <p className="font-medium">{account.credit_days ?? "—"}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Stage 2: what was captured/agreed, plus the signed document, before approving */}
        {isStage2 && (
          <div className="rounded-md border p-4 space-y-3">
            <div className="font-medium text-sm">Credit Terms Captured</div>
            {creditTerms ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Payment Method</p>
                  <p className="font-medium capitalize">{creditTerms.payment_method || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Requested Credit Limit</p>
                  <p className="font-medium">{formatKES(creditTerms.credit_required)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Credit Days</p>
                  <p className="font-medium">{creditTerms.credit_days ? `Net ${creditTerms.credit_days}` : "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Terms</p>
                  <p className="font-medium">{creditTerms.credit_terms || "—"}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Loading credit terms…</p>
            )}

            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-2">
                Signed, Stamped Credit Application (uploaded by the rep) - review this before deciding.
              </p>
              {isLoadingDocuments ? (
                <p className="text-sm text-muted-foreground">Checking for uploaded document…</p>
              ) : (
                <DocumentPreview
                  document={signedDocument}
                  emptyLabel="No signed document found yet. Final approval is blocked until one is uploaded."
                />
              )}
            </div>
          </div>
        )}

        {/* Approve / Reject controls */}
        {canGiveDecision && (
          <div className="rounded-md border p-4 space-y-3">
            <div className="font-medium text-sm">
              {isStage2 ? "Stage 2 - Final Decision" : "Stage 1 - Initial Decision"}
            </div>
            <div className="space-y-2">
              <Label htmlFor="approval-notes">Notes</Label>
              <Textarea
                id="approval-notes"
                placeholder="Optional notes explaining this decision"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                disabled={isSubmittingDecision !== null}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => handleDecision("approved")}
                disabled={isSubmittingDecision !== null || stage2Blocked}
                className="bg-green-600 hover:bg-green-700 text-white"
                title={stage2Blocked ? "Upload the signed, stamped credit application first." : undefined}
              >
                {isSubmittingDecision === "approved" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                {isStage2 ? "Give Final Approval" : "Approve"}
              </Button>
              <Button
                onClick={() => handleDecision("rejected")}
                disabled={isSubmittingDecision !== null}
                variant="destructive"
              >
                {isSubmittingDecision === "rejected" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
                )}
                Reject
              </Button>
            </div>
            {stage2Blocked && (
              <p className="text-xs text-amber-700">
                Final approval is disabled until the signed, stamped credit application is uploaded.
              </p>
            )}
          </div>
        )}

        {/* Approver's own company-stamped copy - purely a record-keeping
            attachment, available once there's something to stamp; never
            blocks approve/reject. */}
        {canApprove && (approvalStatus === "pending_stage2" || approvalStatus === "approved") && (
          <div className="rounded-md border p-4 space-y-3">
            <div className="font-medium text-sm">Company-Stamped Copy</div>
            <p className="text-sm text-muted-foreground">
              After stamping your copy of the credit application, upload a scan or photo here for the record.
              This is optional and doesn't affect the approval decision above.
            </p>
            {isLoadingDocuments ? (
              <p className="text-sm text-muted-foreground">Checking for uploaded document…</p>
            ) : (
              <DocumentPreview document={stampedDocument} emptyLabel="No stamped copy uploaded yet." />
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                type="file"
                onChange={(e) => setSelectedStampedFile(e.target.files?.[0] || null)}
                disabled={isUploadingStamped}
                accept="image/*,.pdf"
                className="flex-1"
              />
              <Button
                onClick={handleUploadStamped}
                disabled={!selectedStampedFile || isUploadingStamped}
                variant="outline"
              >
                {isUploadingStamped ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                {stampedDocument ? "Replace" : "Upload"}
              </Button>
            </div>
          </div>
        )}

        {approvalStatus === "pending_stage1" && !canApprove && (
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            Awaiting Stage 1 review by an authorized approver.
          </p>
        )}
        {approvalStatus === "pending_stage2" && !canApprove && (
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            Awaiting final review by an authorized approver.
          </p>
        )}

        {/* Approval history */}
        <div className="space-y-2">
          <div className="font-medium text-sm">Approval History</div>
          {isLoadingHistory ? (
            <p className="text-sm text-muted-foreground">Loading history…</p>
          ) : approvals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No approval decisions recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {approvals.map((approval) => (
                <div key={approval.id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <span className="font-medium">{approvalTypeLabel(approval.approval_type)}</span>
                    <Badge className={STATUS_META[approval.status]?.className || "bg-gray-100 text-gray-800"}>
                      {approval.status.charAt(0).toUpperCase() + approval.status.slice(1)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {approval.status === "pending"
                      ? `Requested by ${fullName(approval.createdBy)} on ${formatDateTime(approval.created_at)}`
                      : `${fullName(approval.approver)} on ${formatDateTime(approval.approved_at || approval.created_at)}`}
                  </p>
                  {approval.notes && <p className="text-sm mt-1">{approval.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
