"use client"

import { useCallback, useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle2, Clock, AlertCircle, RefreshCw, Lock, ExternalLink, Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  getEtimsCreditNoteStatus,
  getEtimsInvoiceStatus,
  retryEtimsCreditNote,
  retryEtimsInvoice,
  submitEtimsInvoice,
  type EtimsInvoiceStatus,
} from "@/lib/etims"

/**
 * Drop-in eTIMS status panel for the invoice detail page.
 *
 * Per plan design review:
 *   - Real-time polling: 5s for the first 60s, then exponential backoff.
 *   - Lock-timeout escape hatch at 10 min: surface "Check status now" hint.
 *   - QR card on the right rail when completed.
 *
 * Usage:
 *   <InvoiceEtimsBadge invoiceId={invoice.id} />
 */
export function InvoiceEtimsBadge({ invoiceId, isCreditNote = false }: { invoiceId: string; isCreditNote?: boolean }) {
  const [status, setStatus] = useState<EtimsInvoiceStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const s = isCreditNote
        ? await getEtimsCreditNoteStatus(invoiceId)
        : await getEtimsInvoiceStatus(invoiceId)
      setStatus(s)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [invoiceId, isCreditNote])

  useEffect(() => { void fetchStatus() }, [fetchStatus])

  const pollStatus = status?.etims_status

  // Poll every 5s while pending/locked; back off after 60s
  useEffect(() => {
    if (!pollStatus) return
    const isTerminal = ["completed", "failed", "voided_with_cn"].includes(pollStatus)
    if (isTerminal) return

    const start = Date.now()
    let timer: ReturnType<typeof setTimeout>
    let cancelled = false
    const poll = async () => {
      await fetchStatus()
      if (cancelled) return
      const elapsed = Date.now() - start
      const delay = elapsed < 60_000 ? 5_000 : Math.min(60_000, 5_000 * Math.pow(2, Math.floor((elapsed - 60_000) / 30_000)))
      timer = setTimeout(poll, delay)
    }
    timer = setTimeout(poll, 5_000)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [pollStatus, fetchStatus])

  const onRetry = async () => {
    setRetrying(true)
    try {
      if (isCreditNote) {
        await retryEtimsCreditNote(invoiceId)
      } else {
        await retryEtimsInvoice(invoiceId)
      }
      toast.success("Re-queued for submission")
      await fetchStatus()
    } catch (e) {
      toast.error("Retry failed", { description: (e as Error).message })
    } finally {
      setRetrying(false)
    }
  }

  const onSubmit = async () => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      await submitEtimsInvoice(invoiceId)
      toast.success("Invoice queued for eTIMS")
      await fetchStatus()
    } catch (e) {
      const message = formatEtimsError(e)
      setSubmitError(message)
      toast.error("Could not raise invoice on eTIMS", { description: message })
    } finally {
      setSubmitting(false)
    }
  }

  if (error) {
    return <Badge variant="outline">eTIMS: {error}</Badge>
  }
  if (!status) {
    return <Badge variant="outline"><Loader2 className="h-3 w-3 animate-spin mr-1" /> Loading eTIMS…</Badge>
  }

  const s = status.etims_status
  if (!s) {
    if (isCreditNote) {
      return (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium">eTIMS credit note not raised</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Approve this draft to raise it against the original KRA-signed invoice.
            </p>
          </CardContent>
        </Card>
      )
    }

    return (
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">eTIMS receipt not raised</p>
              <p className="mt-1 text-xs text-muted-foreground">Submit this invoice to KRA through DigiTax.</p>
            </div>
            <Button size="sm" onClick={onSubmit} disabled={submitting}>
              {submitting && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Raise on eTIMS
            </Button>
          </div>
          {submitError && (
            <div className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="whitespace-pre-line">{submitError}</div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  // Stuck-lock escape hatch - 10+ minutes locked
  const lockedAgeMs = status.etims_lock_acquired_at ? Date.now() - new Date(status.etims_lock_acquired_at).getTime() : 0
  const showStuckHint = status.etims_lock_state === "locked_pending" && lockedAgeMs > 10 * 60 * 1000

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{isCreditNote ? "eTIMS credit note status" : "eTIMS status"}</span>
          <StatusBadge status={s} />
        </div>

        {status.etims_trader_invoice_number && (
          <div className="text-xs text-muted-foreground">
            Trader invoice #: <span className="font-mono">{status.etims_trader_invoice_number}</span>
          </div>
        )}
        {status.etims_submitted_at && (
          <div className="text-xs text-muted-foreground">
            Submitted: {new Date(status.etims_submitted_at).toLocaleString()}
          </div>
        )}
        {status.etims_synced_at && (
          <div className="text-xs text-muted-foreground">
            Confirmed: {new Date(status.etims_synced_at).toLocaleString()}
          </div>
        )}

        {/* QR card when completed */}
        {s === "completed" && status.etims_qr_url && (
          <div className="rounded-lg border bg-muted/30 p-3 flex items-center gap-3">
            <img src={qrImageUrl(status.etims_qr_url)} alt="KRA QR code" className="h-24 w-24 bg-white rounded" />
            <div className="flex-1 text-xs">
              <p className="font-medium mb-1">KRA-signed</p>
              <p className="text-muted-foreground break-all">{status.etims_qr_url}</p>
              <Button asChild variant="ghost" size="sm" className="mt-1 px-0">
                <a href={status.etims_qr_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3 mr-1" /> Verify on KRA
                </a>
              </Button>
            </div>
          </div>
        )}

        {/* Error + retry */}
        {(s === "failed" || s === "response_invalid") && status.etims_last_error && (
          <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
            {status.etims_last_error}
          </div>
        )}
        {(s === "failed" || s === "response_invalid") && (
          <Button size="sm" onClick={onRetry} disabled={retrying}>
            {retrying ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
            Retry submission
          </Button>
        )}

        {showStuckHint && (
          <div className="text-xs bg-yellow-50 border border-yellow-200 text-yellow-900 p-2 rounded">
            Locked for {Math.round(lockedAgeMs / 60_000)} minutes - the stuck-lock reaper runs every 5 min and will
            reset this to "failed" so you can retry. Contact an admin for force-unlock if needed.
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function StatusBadge({ status }: { status: NonNullable<EtimsInvoiceStatus["etims_status"]> }) {
  switch (status) {
    case "completed":
      return <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" /> KRA signed</Badge>
    case "submitted":
      return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Submitted, awaiting KRA</Badge>
    case "registering_items":
      return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Registering products</Badge>
    case "locked_pending":
      return <Badge variant="secondary"><Lock className="h-3 w-3 mr-1" /> Locked, processing</Badge>
    case "failed":
      return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> Failed</Badge>
    case "response_invalid":
      return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> Invalid response</Badge>
    case "voided_with_cn":
      return <Badge variant="outline"><AlertCircle className="h-3 w-3 mr-1" /> Voided (credit note)</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

// KRA QR URLs are visible - generate a QR image via a free image service for now.
// In production swap for a self-hosted QR generator to avoid third-party calls.
function qrImageUrl(text: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(text)}`
}

function formatEtimsError(error: unknown): string {
  const richError = error as Error & { errors?: Record<string, string[] | string> }
  const errors = richError?.errors

  if (errors && typeof errors === "object") {
    const labels: Record<string, string> = {
      etims_config: "Configuration",
      kra_pin: "KRA PIN",
      digitax_api_key: "DigiTax API key",
      test_connection: "Connection test",
      activation: "Activation",
      etims_status: "Invoice status",
    }

    const details = Object.entries(errors).flatMap(([field, messages]) => {
      const normalized = Array.isArray(messages) ? messages : [messages]
      return normalized.map((message) => `${labels[field] ?? field}: ${message}`)
    })

    if (details.length > 0) return details.join("\n")
  }

  return richError?.message || "The eTIMS request could not be submitted."
}
