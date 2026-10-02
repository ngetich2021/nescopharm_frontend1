"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Activity, CheckCircle2, RotateCcw, Loader2, FileText } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth-context"
import { fetchQuotes, confirmQuote, requestQuoteChanges, type Quote } from "@/lib/quotes"
import { getCustomers, type Customer } from "@/lib/customers"
import { useCart } from "./pos-interface"

// Only these states mean "still needs tracking" - accepted/rejected/expired
// quotes and approved/rejected customers are done, so they drop off the list.
const ACTIVE_QUOTE_STATUSES = new Set(["pending", "awaiting_rep_confirm"])
const DONE_CUSTOMER_APPROVAL_STATUSES = new Set(["approved", "rejected"])

const QUOTE_STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: "Sent for review", className: "bg-yellow-50 text-yellow-800 border-yellow-400" },
  awaiting_rep_confirm: { label: "Ready — needs your confirmation", className: "bg-purple-50 text-purple-800 border-purple-400" },
}

export function MyActivityPanel() {
  const { user } = useAuth()
  const { toast } = useToast()
  const { activityVersion } = useCart()
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const [busyQuoteId, setBusyQuoteId] = useState<string | null>(null)
  const [changesNoteFor, setChangesNoteFor] = useState<string | null>(null)
  const [changesNote, setChangesNote] = useState("")

  const load = () => {
    if (!user?.id) return
    setLoading(true)
    Promise.all([
      fetchQuotes({ mine: true }),
      getCustomers({ created_by: user.id }),
    ])
      .then(([myQuotes, myCustomers]) => {
        setQuotes(myQuotes)
        setCustomers(myCustomers)
      })
      .catch(() => {
        // My Activity is a convenience view; failures here shouldn't block POS.
      })
      .finally(() => {
        setLoading(false)
        setHasLoadedOnce(true)
      })
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, activityVersion])

  const handleProceed = async (quote: Quote) => {
    setBusyQuoteId(quote.id)
    try {
      const order = await confirmQuote(quote.id)
      toast({
        title: "Order created",
        description: `${quote.quote_number} is now order ${order?.order_number || order?.id || ""}.`,
      })
      load()
    } catch (error: any) {
      toast({ title: "Couldn't confirm quote", description: error.message || String(error), variant: "destructive" })
    } finally {
      setBusyQuoteId(null)
    }
  }

  const handleRequestChanges = async (quote: Quote) => {
    setBusyQuoteId(quote.id)
    try {
      await requestQuoteChanges(quote.id, changesNote || undefined)
      toast({ title: "Sent back for changes", description: `${quote.quote_number} was sent back for review.` })
      setChangesNoteFor(null)
      setChangesNote("")
      load()
    } catch (error: any) {
      toast({ title: "Couldn't request changes", description: error.message || String(error), variant: "destructive" })
    } finally {
      setBusyQuoteId(null)
    }
  }

  if (!user?.role?.is_sales_rep) return null

  // Nothing to show yet on first load - don't flash an empty/loading card.
  if (!hasLoadedOnce) return null

  const activeQuotes = quotes.filter((q) => ACTIVE_QUOTE_STATUSES.has(q.status))
  const activeCustomers = customers.filter(
    (c) => c.approval_status && !DONE_CUSTOMER_APPROVAL_STATUSES.has(c.approval_status)
  )

  // Nothing currently pending/in-progress - stay out of the way entirely.
  if (!loading && activeQuotes.length === 0 && activeCustomers.length === 0) return null

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-semibold">My Activity</h3>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-4">Loading...</div>
      ) : (
        <>
          {activeQuotes.length > 0 && (
            <div className="space-y-3">
              {activeQuotes.map((quote) => {
                const meta = QUOTE_STATUS_META[quote.status]
                const isBusy = busyQuoteId === quote.id
                return (
                  <div key={quote.id} className="border rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium">{quote.quote_number}</div>
                        <div className="text-xs text-muted-foreground">{quote.customer?.name || "Unknown customer"}</div>
                      </div>
                      <Badge variant="outline" className={meta.className}>{meta.label}</Badge>
                    </div>

                    {quote.status === "awaiting_rep_confirm" && (() => {
                      const total = Number.parseFloat(quote.final_amount || quote.total_amount || "0")

                      return (
                      <div className="mt-3 space-y-2">
                        <div className="text-xs text-muted-foreground">
                          Total: {quote.currency} {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>

                        {changesNoteFor === quote.id ? (
                          <div className="space-y-2">
                            <Textarea
                              placeholder="What needs adjusting? (optional)"
                              value={changesNote}
                              onChange={(e) => setChangesNote(e.target.value)}
                              rows={2}
                            />
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => { setChangesNoteFor(null); setChangesNote("") }} disabled={isBusy}>
                                Cancel
                              </Button>
                              <Button size="sm" onClick={() => handleRequestChanges(quote)} disabled={isBusy}>
                                {isBusy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RotateCcw className="h-3 w-3 mr-1" />}
                                Send Back
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => setChangesNoteFor(quote.id)} disabled={isBusy}>
                              Request Changes
                            </Button>
                            <Button size="sm" onClick={() => handleProceed(quote)} disabled={isBusy}>
                              {isBusy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                              Proceed
                            </Button>
                          </div>
                        )}
                      </div>
                      )
                    })()}
                  </div>
                )
              })}
            </div>
          )}

          {activeCustomers.length > 0 && (
            <div className={activeQuotes.length > 0 ? "mt-5 pt-4 border-t" : ""}>
              <div className="text-xs font-medium text-muted-foreground mb-2">Customers awaiting approval</div>
              <div className="space-y-1">
                {activeCustomers.map((c) => (
                  <Link
                    key={c.id}
                    href={`/customers/${c.id}/credit-form`}
                    className="flex items-center justify-between text-sm rounded-md px-2 py-1.5 -mx-2 hover:bg-muted transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      {c.name}
                    </span>
                    <Badge variant="outline" className="text-[11px] bg-blue-50 text-blue-800 border-blue-300">
                      {c.approval_status!.replace(/_/g, " ")}
                    </Badge>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  )
}
