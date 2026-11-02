import apiCall from "./api"

export type PartyType = "customer" | "supplier"

export interface CollectionNote {
  id: string
  party_id: string
  invoice_id: string | null
  note: string
  promise_date: string | null
  promise_amount: number | null
  outcome: "kept" | "broken" | null
  outcome_at: string | null
  outcome_by: string | null
  created_at: string
  created_by: string | null
}

export const listCollectionNotes = (partyType: PartyType) =>
  apiCall<{ data: CollectionNote[] }>(`/finance/collection-notes?party_type=${partyType}`, "GET")

export const addCollectionNote = (body: {
  party_type: PartyType
  party_id: string
  invoice_id?: string | null
  note: string
  promise_date?: string | null
  promise_amount?: number | null
}) => apiCall<{ id: string; message: string }>("/finance/collection-notes", "POST", body)

export const setPromiseOutcome = (id: string, outcome: "kept" | "broken" | null) =>
  apiCall<{ message: string }>(`/finance/collection-notes/${id}`, "PATCH", { outcome })

export type PromiseState = "promised" | "missed" | "kept" | "broken"

/**
 * Where a promise stands on a given day: marked kept or broken, else "missed" once its date has
 * passed while the customer still owes overdue money (time to call again), else still "promised".
 */
export function promiseState(note: CollectionNote, asOf: string, stillOverdue: boolean): PromiseState | null {
  if (!note.promise_date) return null
  if (note.outcome) return note.outcome
  return note.promise_date < asOf && stillOverdue ? "missed" : "promised"
}

export const PROMISE_META: Record<PromiseState, { label: string; className: string }> = {
  promised: { label: "Promised", className: "bg-blue-100 text-blue-700 border-blue-200" },
  missed: { label: "Missed - call again", className: "bg-red-100 text-red-700 border-red-200" },
  kept: { label: "Kept", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  broken: { label: "Broken", className: "bg-red-100 text-red-700 border-red-200" },
}
