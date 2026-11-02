"use client"

import { useState } from "react"
import { format } from "date-fns"
import { Loader2, CalendarClock, MessageSquarePlus } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import {
  addCollectionNote,
  setPromiseOutcome,
  promiseState,
  PROMISE_META,
  type CollectionNote,
  type PartyType,
} from "@/lib/collection-notes"

// What the panel shows about one customer or supplier; the page works it out from the aging rows.
export interface PartyView {
  partyId: string | null
  party: string
  terms: number
  balance: number
  notYetDue: number
  overdue: number
  buckets: { label: string; amount: number }[]
  oldestOverdue: number
  nextDue: string | null
  pdCheques: number
  overdueNetOfPd: number
  action: string
  invoices: {
    id: string
    number: string
    invoiceDate: string
    dueDate: string
    balance: number
    daysOverdue: number
    statusLabel: string
    statusClass: string
  }[]
}

const money = (n: number) => n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const day = (d: string | null) => (d ? format(new Date(d), "dd/MM/yyyy") : "-")
const stamp = (d: string | null) => (d ? format(new Date(d), "dd/MM/yyyy HH:mm") : "")

interface Props {
  view: PartyView | null
  partyType: PartyType
  notes: CollectionNote[]
  asOf: string
  // Invoice to tie a new note to, when the panel was opened from an invoice line.
  invoiceId?: string | null
  onClose: () => void
  onChanged: () => void
}

/**
 * Everything about one customer (or supplier) on the aging page: the full breakdown, its unpaid
 * invoices, and the collection notes - add a call note or a promise to pay, and mark a promise
 * kept or broken when its date comes.
 */
export function PartySheet({ view, partyType, notes, asOf, invoiceId, onClose, onChanged }: Props) {
  const { toast } = useToast()
  const [note, setNote] = useState("")
  const [promiseDate, setPromiseDate] = useState("")
  const [promiseAmount, setPromiseAmount] = useState("")
  const [saving, setSaving] = useState(false)
  const [marking, setMarking] = useState<string | null>(null)

  const reset = () => {
    setNote("")
    setPromiseDate("")
    setPromiseAmount("")
  }

  const save = async () => {
    if (!view?.partyId || !note.trim()) return
    setSaving(true)
    try {
      await addCollectionNote({
        party_type: partyType,
        party_id: view.partyId,
        invoice_id: invoiceId ?? null,
        note: note.trim(),
        promise_date: promiseDate || null,
        promise_amount: promiseAmount ? Number(promiseAmount) : null,
      })
      toast({ title: "Note saved" })
      reset()
      onChanged()
    } catch (e: any) {
      toast({ title: "Could not save the note", description: e?.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const mark = async (id: string, outcome: "kept" | "broken" | null) => {
    setMarking(id)
    try {
      await setPromiseOutcome(id, outcome)
      onChanged()
    } catch (e: any) {
      toast({ title: "Could not update the promise", description: e?.message, variant: "destructive" })
    } finally {
      setMarking(null)
    }
  }

  const who = partyType === "customer" ? "customer" : "supplier"

  return (
    <Sheet open={!!view} onOpenChange={(open) => { if (!open) { reset(); onClose() } }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        {view && (
          <>
            <SheetHeader className="mb-4">
              <SheetTitle>{view.party}</SheetTitle>
              <SheetDescription>
                Terms {view.terms} days · {view.invoices.length} unpaid {view.invoices.length === 1 ? "invoice" : "invoices"} · as at {day(asOf)}
              </SheetDescription>
            </SheetHeader>

            {/* Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              {[
                ["Total balance due", money(view.balance), "font-bold"],
                ["Not yet due", money(view.notYetDue), "text-emerald-700"],
                ["Total overdue", money(view.overdue), view.overdue > 0 ? "text-red-700 font-semibold" : ""],
                ...view.buckets.map((b) => [b.label, money(b.amount), ""]),
                ["Oldest days overdue", view.oldestOverdue ? String(view.oldestOverdue) : "-", ""],
                ["Next due date", day(view.nextDue), ""],
                ["PD cheques held", view.pdCheques ? money(view.pdCheques) : "-", ""],
                ["Overdue net of PD cheques", view.pdCheques ? money(view.overdueNetOfPd) : "-", ""],
              ].map(([label, value, cls]) => (
                <div key={label} className="rounded-md border p-2">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className={`tabular-nums ${cls}`}>{value}</p>
                </div>
              ))}
            </div>
            {view.action && <p className="mt-3 text-sm"><span className="font-medium">Action:</span> {view.action}</p>}

            {/* Notes */}
            <div className="mt-6 space-y-3">
              <h3 className="font-semibold flex items-center gap-2"><MessageSquarePlus className="h-4 w-4" /> Collection notes</h3>
              {view.partyId ? (
                <div className="rounded-md border p-3 space-y-3 bg-muted/30">
                  <div className="space-y-1">
                    <Label htmlFor="cn-note">What did the {who} say?</Label>
                    <Textarea id="cn-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={`e.g. Called Mr Charles - will pay NSK/0431 on 17/11/26`} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="cn-date">Promised to pay on (optional)</Label>
                      <Input id="cn-date" type="date" value={promiseDate} onChange={(e) => setPromiseDate(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="cn-amount">Amount promised (optional)</Label>
                      <Input id="cn-amount" type="number" min="0" step="0.01" className="text-right" value={promiseAmount} onChange={(e) => setPromiseAmount(e.target.value)} />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" onClick={save} disabled={saving || !note.trim()}>
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save note
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Notes can't be kept for an unknown {who}.</p>
              )}

              {notes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No notes yet.</p>
              ) : (
                <ol className="space-y-2">
                  {notes.map((n) => {
                    const state = promiseState(n, asOf, view.overdue > 0)
                    return (
                      <li key={n.id} className="rounded-md border p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span>{stamp(n.created_at)}{n.created_by ? ` · ${n.created_by}` : ""}</span>
                          {state && (
                            <Badge variant="outline" className={PROMISE_META[state].className}>
                              <CalendarClock className="mr-1 h-3 w-3" />
                              {PROMISE_META[state].label} · {day(n.promise_date)}{n.promise_amount ? ` · ${money(n.promise_amount)}` : ""}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 whitespace-pre-wrap">{n.note}</p>
                        {n.promise_date && (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {n.outcome ? (
                              <>
                                <span className="text-xs text-muted-foreground">Marked {n.outcome}{n.outcome_by ? ` by ${n.outcome_by}` : ""} {stamp(n.outcome_at)}</span>
                                <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={marking === n.id} onClick={() => mark(n.id, null)}>Undo</Button>
                              </>
                            ) : (
                              <>
                                <Button size="sm" variant="outline" className="h-7 text-xs" disabled={marking === n.id} onClick={() => mark(n.id, "kept")}>Paid as promised</Button>
                                <Button size="sm" variant="outline" className="h-7 text-xs text-red-700" disabled={marking === n.id} onClick={() => mark(n.id, "broken")}>Didn't pay</Button>
                              </>
                            )}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ol>
              )}
            </div>

            {/* Invoices */}
            <div className="mt-6">
              <h3 className="font-semibold mb-2">Unpaid invoices</h3>
              <div className="rounded-md border divide-y text-sm">
                {view.invoices.map((inv, i) => (
                  <div key={inv.id} className="flex items-center gap-3 px-3 py-2">
                    <span className="w-6 text-center text-muted-foreground">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-mono">{inv.number}</p>
                      <p className="text-xs text-muted-foreground">{day(inv.invoiceDate)} · due {day(inv.dueDate)}{inv.daysOverdue ? ` · ${inv.daysOverdue} days overdue` : ""}</p>
                    </div>
                    <Badge variant="outline" className={`whitespace-nowrap ${inv.statusClass}`}>{inv.statusLabel}</Badge>
                    <span className="w-28 text-right tabular-nums font-semibold">{money(inv.balance)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
