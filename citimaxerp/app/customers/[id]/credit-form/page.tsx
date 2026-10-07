"use client"

import { useState, useEffect, use, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getCustomerProfile, uploadSignedCreditApplication, CustomerProfileData } from "@/lib/customers"
import { getCustomerAccount, updateCustomerAccount, CustomerAccountWithDetails } from "@/lib/customer-accounts"
import { getCompany, Company } from "@/lib/company"
import { ArrowLeft, Download, Printer, Save, Upload } from "lucide-react"
import { Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth-context"
import { usePermissions } from "@/hooks/use-permissions"
import { compressImageIfLarge } from "@/lib/image-compression"

// The customer profile response includes several Credit Appraisal Form fields
// that aren't yet part of the shared `CustomerProfileData` type (confirmed live
// on the backend via tinker). Extend locally rather than editing the shared
// lib/customers.ts type, to avoid colliding with the parallel customer-creation
// and customer-approval work touching that area.
type CustomerProfileWithCreditFields = CustomerProfileData & {
  trading_name?: string | null
  business_type?: string | null
  registration_number?: string | null
  ppb_license_number?: string | null
  website?: string | null
  telephone?: string | null
  county?: string | null
  accounts_contact_name?: string | null
  accounts_contact_designation?: string | null
  accounts_contact_phone?: string | null
  accounts_contact_email?: string | null
  approval_status?: string | null
}

// Same rationale as above: `credit_period_pd_cheque_days` and bank account
// holder name are confirmed live fields not yet reflected in the shared type.
type CustomerAccountWithCreditFields = Omit<CustomerAccountWithDetails, "bank_details"> & {
  credit_period_pd_cheque_days?: string | number | null
  bank_details: (CustomerAccountWithDetails["bank_details"][number] & {
    account_name?: string | null
  })[]
}

// Approval statuses that mean "Stage 1 has not yet cleared" (or no application
// exists at all yet) — the document must not be shown for these.
const GATED_STATUSES = new Set(["pending_stage1", "draft", "", null, undefined])

function formatMoney(amount: string | number | undefined | null): string {
  if (amount === undefined || amount === null || amount === '') return '—'
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(num)) return '—'
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function field(value: string | number | null | undefined) {
  return value === null || value === undefined || value === '' ? '—' : value
}

// Table cells on the paper form are left genuinely blank when there's nothing
// to fill in, rather than showing a placeholder dash.
function blank(value: string | number | null | undefined) {
  return value === null || value === undefined || value === '' ? ' ' : value
}

// The reference form always prints a fixed number of ruled rows (three for
// directors and for trade references), whether or not they're all filled.
function padRows<T>(rows: T[] | undefined | null, minimum: number): (T | undefined)[] {
  const actual = rows ?? []
  if (actual.length >= minimum) return actual
  return [...actual, ...Array.from({ length: minimum - actual.length }, () => undefined)]
}

// Reference document (see the credit appraisal PDF) renders every field's
// static label in navy blue, with the actual captured data (what was filled
// in) standing out in black bold text on the underline - matches the paper
// form's convention of pre-printed labels vs. handwritten answers.
const NAVY = "#2B3990"
const VALUE_COLOR = "#000000"

// The editable Section 8 fields need to look like part of the same paper-form
// document as everything else on this page (underlined navy line, no boxy
// input chrome) instead of a generic bordered web-form input - shadcn's
// default Input/Textarea styling (rounded box, grey border, focus ring) reads
// as "not the form" next to the rest of the underline-styled document.
const DOC_INPUT_CLASS =
  "rounded-none border-0 border-b-2 bg-transparent px-1 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 font-bold"
const DOC_TEXTAREA_CLASS =
  "rounded-sm bg-transparent px-2 py-1.5 shadow-none focus-visible:ring-1 focus-visible:ring-offset-0 font-bold"

// Must live at module scope, not inside the page component - defining a
// component inside another component's render body creates a brand-new
// component type on every render, which breaks React's fiber identity
// tracking (this was the cause of the "Expected static flag was missing"
// internal React error).
function FormLine({ label, value, wide }: { label: string; value: string | number | null | undefined; wide?: boolean }) {
  return (
    <div className="text-sm leading-relaxed">
      <span className="font-bold" style={{ color: NAVY }}>{label} : </span>
      <span
        className={`inline-block border-b px-1 font-bold ${wide ? "min-w-[70%]" : "min-w-[160px]"}`}
        style={{ color: VALUE_COLOR, borderColor: NAVY }}
      >
        {field(value)}
      </span>
    </div>
  )
}

// Section 2 of the reference form puts Phone and Email side by side on a
// single line rather than stacked.
function FormLinePair({
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
}: {
  leftLabel: string
  leftValue: string | number | null | undefined
  rightLabel: string
  rightValue: string | number | null | undefined
}) {
  return (
    <div className="text-sm leading-relaxed flex flex-wrap gap-x-6">
      <span>
        <span className="font-bold" style={{ color: NAVY }}>{leftLabel} : </span>
        <span className="inline-block border-b px-1 font-bold min-w-[160px]" style={{ color: VALUE_COLOR, borderColor: NAVY }}>
          {field(leftValue)}
        </span>
      </span>
      <span>
        <span className="font-bold" style={{ color: NAVY }}>{rightLabel} : </span>
        <span className="inline-block border-b px-1 font-bold min-w-[200px]" style={{ color: VALUE_COLOR, borderColor: NAVY }}>
          {field(rightValue)}
        </span>
      </span>
    </div>
  )
}

export default function CreditAppraisalFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { toast } = useToast()
  const { user } = useAuth()
  const { hasPermission } = usePermissions()
  const canEditOfficialUse = hasPermission("can_approve_account") || hasPermission("can_update_accounts")
  const formRef = useRef<HTMLDivElement>(null)
  const [customer, setCustomer] = useState<CustomerProfileWithCreditFields | null>(null)
  const [account, setAccount] = useState<CustomerAccountWithCreditFields | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDownloading, setIsDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [letterheadFailed, setLetterheadFailed] = useState(false)

  // Section 8 "For Official Use Only" - the GM's actual digital sign-off,
  // replacing the paper form's blank lines for a pen signature. Saved onto
  // the CustomerAccount that Stage 1 approval already created.
  const [approvedCreditLimit, setApprovedCreditLimit] = useState("")
  const [approvedCreditDays, setApprovedCreditDays] = useState("")
  const [officialRemarks, setOfficialRemarks] = useState("")
  const [reviewedByName, setReviewedByName] = useState("")
  const [reviewedByPosition, setReviewedByPosition] = useState("")
  const [isSavingOfficialUse, setIsSavingOfficialUse] = useState(false)

  // Declaration (Section 7) - which director is signing. Prefilled from the
  // directors captured on the account; a dropdown only makes sense to show
  // when there's an actual choice to make.
  const [selectedDirectorId, setSelectedDirectorId] = useState<string>("")

  // Upload the physically signed/stamped scan - only meaningful while
  // awaiting it (approval_status === "pending_documents"). The rep who
  // submitted this customer is the one who'd typically have the signed copy
  // in hand, so this needs to work for them too, not just for approvers.
  const [selectedSignedFile, setSelectedSignedFile] = useState<File | null>(null)
  const [isUploadingSigned, setIsUploadingSigned] = useState(false)

  useEffect(() => {
    setApprovedCreditLimit(account?.credit_required != null ? String(account.credit_required) : "")
    setApprovedCreditDays(account?.credit_days != null ? String(account.credit_days) : "")
    setOfficialRemarks(account?.notes || "")
    // Once a review has actually been saved, always show that recorded
    // name/position, regardless of who's viewing. Before that, ONLY
    // convenience-default to the current session user if they're actually
    // the one who can approve/edit this - a sales rep (or anyone else
    // without approval rights) must never see their own name here just
    // because they happened to open the page before a GM/Director reviewed it.
    if (account?.reviewed_by_name) {
      setReviewedByName(account.reviewed_by_name)
    } else if (canEditOfficialUse && user) {
      setReviewedByName(`${user.first_name || ""} ${user.last_name || ""}`.trim())
    } else {
      setReviewedByName("")
    }
    if (account?.reviewed_by_position) {
      setReviewedByPosition(account.reviewed_by_position)
    } else if (canEditOfficialUse && user?.role?.name) {
      setReviewedByPosition(user.role.name)
    } else {
      setReviewedByPosition("")
    }
  }, [account?.credit_required, account?.credit_days, account?.notes, account?.reviewed_by_name, account?.reviewed_by_position, user, canEditOfficialUse])

  useEffect(() => {
    if (account?.directors && account.directors.length > 0 && !selectedDirectorId) {
      setSelectedDirectorId(account.directors[0].id)
    }
  }, [account?.directors, selectedDirectorId])

  const getData = async () => {
    try {
      const fetchedCustomer = (await getCustomerProfile(id)) as CustomerProfileWithCreditFields | null
      if (!fetchedCustomer) {
        setError("Customer not found")
        return
      }
      setCustomer(fetchedCustomer)

      if (fetchedCustomer.company_id) {
        try {
          const companyData = await getCompany(fetchedCustomer.company_id)
          setCompany(companyData)
        } catch (err) {
          console.error('Failed to fetch company:', err)
        }
      }

      if (fetchedCustomer.account_id) {
        try {
          const accountData = await getCustomerAccount(fetchedCustomer.account_id)
          setAccount(accountData as CustomerAccountWithCreditFields | null)
        } catch (err) {
          console.error('Failed to fetch customer account:', err)
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load customer")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    getData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const handleUploadSigned = async () => {
    if (!selectedSignedFile) return
    setIsUploadingSigned(true)
    try {
      // A phone photo of the signed form is usually the culprit for "too
      // large" - shrink it automatically instead of making the rep find a
      // way to resize it themselves. PDFs/already-small files pass through.
      const fileToUpload = await compressImageIfLarge(selectedSignedFile)
      if (fileToUpload.size > 15 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "The signed application must be 15MB or smaller, even after compression.",
          variant: "destructive",
        })
        return
      }
      await uploadSignedCreditApplication(id, fileToUpload)
      toast({ title: "Uploaded", description: "Signed credit application uploaded. Moved to final review." })
      setSelectedSignedFile(null)
      await getData()
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message || "Failed to upload the signed application.", variant: "destructive" })
    } finally {
      setIsUploadingSigned(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleDownloadPDF = async () => {
    if (!formRef.current || !customer) return

    setIsDownloading(true)

    try {
      const html2canvas = (await import('html2canvas')).default
      const { jsPDF } = await import('jspdf')

      const element = formRef.current

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      })

      const imgData = canvas.toDataURL('image/png')

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      })

      // This document is longer than a single A4 page (8 sections + tables),
      // so it must be sliced across as many pages as it actually needs at
      // full page width - scaling the whole thing down to fit one page (the
      // previous behavior) is what made everything render unreadably tiny.
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = pdfWidth
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      let heightLeft = imgHeight
      let position = 0

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pdfHeight

      while (heightLeft > 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pdfHeight
      }

      const nameForFile = customer.business_name || customer.name || 'Customer'
      pdf.save(`Credit-Appraisal-Form-${nameForFile}.pdf`)

      toast({
        title: "Success",
        description: "Credit Appraisal Form PDF downloaded successfully",
      })
    } catch (err) {
      console.error('Failed to generate PDF:', err)
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try printing instead.",
        variant: "destructive",
      })
    } finally {
      setIsDownloading(false)
    }
  }

  const handleSaveOfficialUse = async () => {
    if (!account) return
    setIsSavingOfficialUse(true)
    try {
      const updated = await updateCustomerAccount(account.id, {
        credit_required: approvedCreditLimit.trim() ? (approvedCreditLimit as any) : null,
        credit_days: approvedCreditDays.trim() ? (Number(approvedCreditDays) as any) : null,
        notes: officialRemarks.trim() || null,
        reviewed_by_name: reviewedByName.trim() || null,
        reviewed_by_position: reviewedByPosition.trim() || null,
      })
      setAccount((prev) => (prev ? { ...prev, ...updated } : prev))
      toast({ title: "Saved", description: "Official use details have been saved." })
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to save official use details.",
        variant: "destructive",
      })
    } finally {
      setIsSavingOfficialUse(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !customer) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-red-800">Error Loading Customer</h2>
          <p className="mt-2 text-red-600">{error || "Customer not found"}</p>
          <Button variant="outline" onClick={() => router.back()} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  // Gate: only reachable once Stage 1 approval has cleared. Anything still at
  // pending_stage1 / draft / unset implies no application has progressed far
  // enough yet for this document to be meaningful.
  const status = customer.approval_status ?? undefined
  const isGated = GATED_STATUSES.has(status as any)

  if (isGated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="max-w-lg w-full p-8 text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Credit Appraisal Form Not Yet Available</h2>
          <p className="text-sm text-gray-600 mb-6">
            This document becomes available once the customer&apos;s application has cleared Stage 1 approval.
            {status ? ` Current status: ${status.replace(/_/g, ' ')}.` : ' No application has been started for this customer yet.'}
          </p>
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 print:min-h-0 print:bg-white">
      {/* Action Bar - Hide on print */}
      <div className="bg-white border-b print:hidden sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => router.back()} size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadPDF}
                disabled={isDownloading}
              >
                {isDownloading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                {isDownloading ? 'Generating...' : 'Download PDF'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Signed Application - only while awaiting the physically
          signed/stamped scan. Shown prominently above the document itself so
          it isn't missed (this is the whole reason a rep would be on this
          page: print/show this form to the customer, get it signed, then
          upload it back here to move the application to final review). */}
      {customer.approval_status === "pending_documents" && (
        <div className="print:hidden">
          <div className="container mx-auto px-4 pt-6">
            <Card className="max-w-4xl mx-auto p-6 space-y-3 border-2 border-primary/30">
              <div className="flex items-center gap-2 font-medium text-sm">
                <Upload className="h-4 w-4" />
                Upload Signed Application
              </div>
              <p className="text-sm text-muted-foreground">
                Print or download the form above, have the customer sign and stamp it, then upload a scan or
                photo here to move this application to final review. Large photos are compressed automatically.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="file"
                  onChange={(e) => setSelectedSignedFile(e.target.files?.[0] || null)}
                  disabled={isUploadingSigned}
                  className="sm:max-w-sm"
                />
                <Button onClick={handleUploadSigned} disabled={!selectedSignedFile || isUploadingSigned}>
                  {isUploadingSigned ? (
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
              {selectedSignedFile && (
                <p className="text-xs text-muted-foreground">
                  Selected: {selectedSignedFile.name} ({(selectedSignedFile.size / 1024).toFixed(0)} KB)
                </p>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* Credit Appraisal Form Document */}
      <div className="container mx-auto px-4 py-8 print:p-0 print:m-0 print:max-w-none">
        <Card
          ref={formRef}
          className="max-w-4xl mx-auto bg-white p-8 md:p-12 shadow-lg print:shadow-none print:max-w-none print:m-0 print:p-8 print:border-0"
        >
          {/* Letterhead Banner - the sole source of company identity/contact info on this document */}
          {company?.letterhead_url && !letterheadFailed ? (
            <img
              src={company.letterhead_url}
              alt={`${company?.name || 'Company'} letterhead`}
              className="w-full h-auto mb-8"
              crossOrigin="anonymous"
              onError={() => setLetterheadFailed(true)}
            />
          ) : company?.name ? (
            // Fallback if the letterhead image can't load, so the document
            // never renders with blank space where the company identity
            // should be.
            <div className="mb-8 pb-4 border-b-2 text-center" style={{ borderColor: NAVY }}>
              <p className="text-xl font-bold" style={{ color: NAVY }}>{company.name}</p>
            </div>
          ) : null}

          {/* Title */}
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold underline" style={{ color: NAVY }}>CREDIT APPRAISAL FORM</h1>
          </div>

          {/* 1. Company Details */}
          <section className="mb-4">
            <h2 className="text-sm font-bold mb-3" style={{ color: NAVY }}>1. COMPANY DETAILS</h2>
            <div className="space-y-1">
              <FormLine label="Registered Business Name" value={customer.business_name} wide />
              <FormLine label="Trading Name (if different)" value={customer.trading_name} wide />
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm py-1">
                <span className="font-bold" style={{ color: NAVY }}>Type of Business:</span>
                {(["Pharmacy", "Hospital/Clinic", "Distributor", "NGO", "Other"] as const).map((label) => {
                  const key = label.toLowerCase().replace("/", "_")
                  const stored = (customer.business_type || "").toLowerCase().replace(/\s+/g, "_")
                  const isChecked = stored === key || (label === "Other" && !!customer.business_type && !["pharmacy", "hospital_clinic", "hospital/clinic", "distributor", "ngo"].includes(stored))
                  return (
                    <span key={label} style={{ color: NAVY }}>
                      <span className="inline-block w-3.5 h-3.5 border align-middle mr-1 text-center leading-none text-[10px]" style={{ borderColor: NAVY }}>{isChecked ? "✓" : ""}</span>
                      {label}{label === "Other" && isChecked && customer.business_type ? ` (${customer.business_type})` : ""}
                    </span>
                  )
                })}
              </div>
            </div>
            <div className="space-y-1 mt-3">
              <FormLine label="Registration/License Number" value={customer.registration_number} wide />
              <FormLine label="Pharmacy & Poisons board (PPB) License No." value={customer.ppb_license_number} />
              <FormLine label="KRA PIN" value={customer.pin_number} />
            </div>
            <div className="space-y-1 mt-3">
              <FormLine label="Postal Address" value={customer.postal_code} wide />
              <FormLine label="Physical Address" value={customer.address} wide />
              <FormLine label="Town/County" value={[customer.city, customer.county].filter(Boolean).join(", ") || null} wide />
              <FormLine label="Telephone" value={customer.telephone} />
              <FormLine label="Mobile" value={customer.phone} />
              <FormLine label="Email" value={customer.email} />
              <FormLine label="Website (if any)" value={customer.website} wide />
            </div>
            <p className="text-xs font-bold mt-4" style={{ color: NAVY }}>
              ATTACH A COPY OF COI, KRA, PPB PREMISES, PPB PHARMACY LICENSE
            </p>
          </section>
          <hr className="mb-4" style={{ borderTopWidth: 2, borderColor: NAVY }} />

          {/* 2. Contact Persons */}
          <section className="mb-4">
            <h2 className="text-sm font-bold mb-3" style={{ color: NAVY }}>2. CONTACT PERSONS</h2>
            <div className="space-y-1">
              <p className="text-sm font-bold mb-1" style={{ color: NAVY }}>Primary Contact (Procurement Officer/ Pharmacist-in-Charge)</p>
              <FormLine label="Name" value={customer.contact_person_name} />
              <FormLine label="Designation" value={customer.contact_person_designation} />
              <FormLinePair
                leftLabel="Phone"
                leftValue={customer.contact_person_phone}
                rightLabel="Email"
                rightValue={customer.contact_person_email}
              />
              <p className="text-sm font-bold mb-1 mt-3" style={{ color: NAVY }}>Accounts Contact</p>
              <FormLine label="Name" value={customer.accounts_contact_name} />
              <FormLine label="Designation" value={customer.accounts_contact_designation} />
              <FormLinePair
                leftLabel="Phone"
                leftValue={customer.accounts_contact_phone}
                rightLabel="Email"
                rightValue={customer.accounts_contact_email}
              />
            </div>
          </section>
          <hr className="mb-4" style={{ borderTopWidth: 2, borderColor: NAVY }} />

          {/* 3. Business Owners/Directors */}
          <section className="mb-4">
            <h2 className="text-sm font-bold mb-1" style={{ color: NAVY }}>3. BUSINESS OWNERS/DIRECTORS</h2>
            <p className="text-sm font-bold mb-2" style={{ color: NAVY }}>Full Name ID/Passport No, Phone Number, Pin No</p>
            <table className="w-full text-sm border" style={{ borderColor: NAVY, color: NAVY }}>
              <thead>
                <tr className="border-b" style={{ borderColor: NAVY }}>
                  <th className="py-1.5 px-2 border-r w-8" style={{ borderColor: NAVY }}></th>
                  <th className="text-center py-1.5 px-2 font-bold border-r" style={{ borderColor: NAVY }}>Full Name</th>
                  <th className="text-center py-1.5 px-2 font-bold border-r" style={{ borderColor: NAVY }}>ID / Person No.</th>
                  <th className="text-center py-1.5 px-2 font-bold border-r" style={{ borderColor: NAVY }}>Phone Number</th>
                  <th className="text-center py-1.5 px-2 font-bold">Pin No.</th>
                </tr>
              </thead>
              <tbody>
                {padRows(account?.directors, 3).map((director, i) => (
                  <tr key={director?.id ?? `blank-${i}`} className="border-b" style={{ borderColor: NAVY }}>
                    <td className="py-1.5 px-2 border-r font-bold" style={{ borderColor: NAVY }}>{i + 1}.</td>
                    <td className="py-1.5 px-2 border-r font-bold" style={{ borderColor: NAVY, color: VALUE_COLOR }}>{blank(director?.name)}</td>
                    <td className="py-1.5 px-2 border-r font-bold" style={{ borderColor: NAVY, color: VALUE_COLOR }}>{blank(director?.id_passport_number)}</td>
                    <td className="py-1.5 px-2 border-r font-bold" style={{ borderColor: NAVY, color: VALUE_COLOR }}>{blank(director?.phone_number)}</td>
                    <td className="py-1.5 px-2 font-bold" style={{ color: VALUE_COLOR }}>{blank(director?.pin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* 4. Trade References (Supplier References) */}
          <section className="mb-4">
            <h2 className="text-sm font-bold mb-1" style={{ color: NAVY }}>4. TRADE REFERENCES (SUPPLIER REFERENCES)</h2>
            <p className="text-sm mb-2" style={{ color: NAVY }}>Provide at least <span className="font-bold">three</span> suppliers you have credit history with:</p>
            <p className="text-sm font-bold mb-2" style={{ color: NAVY }}>Supplier Name, Contact Person, Credit Limit Ksh.</p>
            <table className="w-full text-sm border" style={{ borderColor: NAVY, color: NAVY }}>
              <thead>
                <tr className="border-b" style={{ borderColor: NAVY }}>
                  <th className="py-1.5 px-2 border-r w-8" style={{ borderColor: NAVY }}></th>
                  <th className="text-center py-1.5 px-2 font-bold border-r" style={{ borderColor: NAVY }}>Supplier Name</th>
                  <th className="text-center py-1.5 px-2 font-bold border-r" style={{ borderColor: NAVY }}>Contact Person &amp; Phone Number</th>
                  <th className="text-center py-1.5 px-2 font-bold">Credit Limit (Ksh)</th>
                </tr>
              </thead>
              <tbody>
                {padRows(account?.suppliers, 3).map((supplier, i) => (
                  <tr key={supplier?.id ?? `blank-${i}`} className="border-b" style={{ borderColor: NAVY }}>
                    <td className="py-1.5 px-2 border-r font-bold" style={{ borderColor: NAVY }}>{i + 1}.</td>
                    <td className="py-1.5 px-2 border-r font-bold" style={{ borderColor: NAVY, color: VALUE_COLOR }}>{blank(supplier?.name)}</td>
                    <td className="py-1.5 px-2 border-r font-bold" style={{ borderColor: NAVY, color: VALUE_COLOR }}>
                      {blank([supplier?.contact_person_name, supplier?.phone_number].filter(Boolean).join(" — "))}
                    </td>
                    <td className="py-1.5 px-2 font-bold" style={{ color: VALUE_COLOR }}>
                      {supplier ? formatMoney(supplier.credit_limit) : ' '}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* 5. Bank Details */}
          <section className="mb-4">
            <h2 className="text-sm font-bold mb-2" style={{ color: NAVY }}>5. BANK DETAILS</h2>
            {padRows(account?.bank_details, 1).map((bank, i) => (
              <div key={bank?.id ?? `blank-${i}`} className={`space-y-1 ${i > 0 ? "mt-3" : ""}`}>
                <FormLine label="Bank Name" value={bank?.bank_name} wide />
                <FormLine label="Branch" value={bank?.branch} wide />
                <FormLine label="Account Name" value={bank?.account_name} wide />
                <FormLine label="Account Number" value={bank?.account_number} wide />
              </div>
            ))}
          </section>

          {/* 6. Credit Terms */}
          <section className="mb-4">
            <h2 className="text-sm font-bold mb-3" style={{ color: NAVY }}>6. CREDIT TERMS</h2>
            <div className="space-y-1">
              <FormLine label="1.) Turnover KES" value={formatMoney(account?.annual_turnover)} wide />
              <FormLine label="2.) Credit Limit (KES)" value={formatMoney(account?.credit_required)} wide />
              <div className="flex flex-wrap items-center gap-x-4 text-sm py-1">
                <span className="font-bold" style={{ color: NAVY }}>3.) Credit Period (days):</span>
                {["30", "45"].map((opt) => (
                  <span key={opt} className="font-bold" style={{ color: NAVY }}>
                    {opt}
                    <span className="inline-block w-3.5 h-3.5 border align-middle ml-1 text-center leading-none text-[10px]" style={{ borderColor: NAVY }}>
                      {String(account?.credit_period_required || "") === opt ? "✓" : ""}
                    </span>
                  </span>
                ))}
                {account?.credit_period_required && !["30", "45"].includes(String(account.credit_period_required)) && (
                  <span className="font-bold" style={{ color: VALUE_COLOR }}>(as captured: {account.credit_period_required})</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 text-sm py-1">
                <span className="font-bold" style={{ color: NAVY }}>4.) Credit Period (days) on PD Cheques (max 60):</span>
                {[30, 60].map((opt) => (
                  <span key={opt} className="font-bold" style={{ color: NAVY }}>
                    {opt}
                    <span className="inline-block w-3.5 h-3.5 border align-middle ml-1 text-center leading-none text-[10px]" style={{ borderColor: NAVY }}>
                      {account?.credit_period_pd_cheque_days != null && Number(account.credit_period_pd_cheque_days) === opt ? "✓" : ""}
                    </span>
                  </span>
                ))}
                {account?.credit_period_pd_cheque_days != null && ![30, 60].includes(Number(account.credit_period_pd_cheque_days)) && (
                  <span className="font-bold" style={{ color: VALUE_COLOR }}>(as captured: {account.credit_period_pd_cheque_days})</span>
                )}
              </div>
            </div>
            <p className="text-xs mt-4" style={{ color: NAVY }}>
              <span className="font-bold">Late Payment:</span> Any payment made beyond the agreed credit period shall attract a late payment charge equivalent to three percent (3%) of the outstanding amount.
            </p>
          </section>
          <hr className="mb-4" style={{ borderTopWidth: 2, borderColor: NAVY }} />

          {/* 7. Declaration - printed blank for physical hand-signing */}
          <section className="mb-4">
            <h2 className="text-sm font-bold mb-2" style={{ color: NAVY }}>7. DECLARATION</h2>
            <p className="text-sm mb-1" style={{ color: NAVY }}>
              I/We declare that the information provided is true and correct. I/We authorise <span className="font-bold">{company?.name || "the Supplier"}</span> to request credit information from the references and to conduct due diligence.
            </p>
            <p className="text-sm mb-3" style={{ color: NAVY }}>
              I/WE agree to comply with your <span className="font-bold">credit terms</span>,
            </p>
            <div className="space-y-1">
              {account?.directors && account.directors.length > 1 ? (
                <>
                  <div className="text-sm py-1 print:hidden flex items-center gap-2">
                    <span className="font-bold" style={{ color: NAVY }}>Name of Director :</span>
                    <Select value={selectedDirectorId} onValueChange={setSelectedDirectorId}>
                      <SelectTrigger className="h-8 w-64" style={{ color: NAVY, borderColor: NAVY }}>
                        <SelectValue placeholder="Select director" />
                      </SelectTrigger>
                      <SelectContent>
                        {account.directors.map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="hidden print:block">
                    <FormLine
                      label="Name of Director"
                      value={account.directors.find((d) => d.id === selectedDirectorId)?.name}
                      wide
                    />
                  </div>
                </>
              ) : (
                <FormLine label="Name of Director" value={account?.directors?.[0]?.name} wide />
              )}
              <FormLine label="Designation" value={null} wide />
              <FormLine label="Signature" value={null} wide />
              <FormLine label="Company Stamp" value={null} wide />
              <FormLine label="Date" value={null} wide />
            </div>
          </section>

          {/* 8. For Official Use Only - the GM's digital sign-off. Editable/
              savable on screen for approvers; renders as a plain read-only
              summary when printed/downloaded, matching the rest of the document. */}
          <section>
            <h2 className="text-sm font-bold mb-2" style={{ color: NAVY }}>8. FOR OFFICIAL USE ONLY (Supplier Section)</h2>

            {/* Print-only summary */}
            <div className="hidden print:block space-y-1">
              <FormLine label="Review By" value={reviewedByName} wide />
              <FormLine label="Position" value={reviewedByPosition} wide />
              <FormLine label="Approved Credit Limit (KES)" value={formatMoney(approvedCreditLimit)} wide />
              <FormLine label="Approved Credit Terms (Days)" value={approvedCreditDays} wide />
              <FormLine label="Date Approved" value={account?.updated_at ? new Date(account.updated_at).toLocaleDateString() : null} wide />
              <FormLine label="Remarks" value={officialRemarks} wide />
            </div>

            {/* On-screen editable form */}
            <div className="print:hidden">
              {!account ? (
                <p className="text-sm text-muted-foreground">
                  These fields become available once the customer has a credit account (after Stage 1 approval).
                </p>
              ) : canEditOfficialUse ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                    <div className="space-y-1">
                      <Label htmlFor="reviewed-by-name" className="text-xs font-bold" style={{ color: NAVY }}>Review By</Label>
                      <Input
                        id="reviewed-by-name"
                        value={reviewedByName}
                        onChange={(e) => setReviewedByName(e.target.value)}
                        disabled={isSavingOfficialUse}
                        className={DOC_INPUT_CLASS}
                        style={{ color: VALUE_COLOR, borderColor: NAVY }}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="reviewed-by-position" className="text-xs font-bold" style={{ color: NAVY }}>Position</Label>
                      <Input
                        id="reviewed-by-position"
                        value={reviewedByPosition}
                        onChange={(e) => setReviewedByPosition(e.target.value)}
                        disabled={isSavingOfficialUse}
                        className={DOC_INPUT_CLASS}
                        style={{ color: VALUE_COLOR, borderColor: NAVY }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold" style={{ color: NAVY }}>Approved Credit Limit (KES)</Label>
                      <Input
                        id="approved-credit-limit"
                        type="number"
                        min="0"
                        value={approvedCreditLimit}
                        onChange={(e) => setApprovedCreditLimit(e.target.value)}
                        disabled={isSavingOfficialUse}
                        className={DOC_INPUT_CLASS}
                        style={{ color: VALUE_COLOR, borderColor: NAVY }}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="approved-credit-days" className="text-xs font-bold" style={{ color: NAVY }}>Approved Credit Terms (Days)</Label>
                      <Input
                        id="approved-credit-days"
                        type="number"
                        min="0"
                        value={approvedCreditDays}
                        onChange={(e) => setApprovedCreditDays(e.target.value)}
                        disabled={isSavingOfficialUse}
                        className={DOC_INPUT_CLASS}
                        style={{ color: VALUE_COLOR, borderColor: NAVY }}
                      />
                    </div>
                  </div>
                  <FormLine label="Date Approved" value={account.updated_at ? new Date(account.updated_at).toLocaleDateString() : null} wide />
                  <div className="space-y-1">
                    <Label htmlFor="official-remarks" className="text-xs font-bold" style={{ color: NAVY }}>Remarks</Label>
                    <Textarea
                      id="official-remarks"
                      value={officialRemarks}
                      onChange={(e) => setOfficialRemarks(e.target.value)}
                      rows={2}
                      disabled={isSavingOfficialUse}
                      className={DOC_TEXTAREA_CLASS}
                      style={{ color: VALUE_COLOR, borderColor: NAVY, border: `1px solid ${NAVY}` }}
                    />
                  </div>
                  <Button size="sm" onClick={handleSaveOfficialUse} disabled={isSavingOfficialUse}>
                    {isSavingOfficialUse ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    {isSavingOfficialUse ? "Saving..." : "Save"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-1">
                  <FormLine label="Review By" value={reviewedByName} wide />
                  <FormLine label="Position" value={reviewedByPosition} wide />
                  <FormLine label="Approved Credit Limit" value={formatMoney(approvedCreditLimit)} wide />
                  <FormLine label="Approved Credit Terms (Days)" value={approvedCreditDays} wide />
                </div>
              )}
            </div>
          </section>
        </Card>
      </div>
    </div>
  )
}
