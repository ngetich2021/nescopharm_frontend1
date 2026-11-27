import apiCall from "./api"

// Monthly Depreciation Journal (DEP/YYYY/MM) - the accountant's workbook as a screen:
// Control (checks), Journal Voucher, Class Summary, Monthly Calc, FS Impact, Posting Log, GL reconciliation.

export interface DepCheck { key: string; label: string; ok: boolean; result: string }

export interface DepAccount { code: string; name: string; id: string | null; exists: boolean }

export interface DepMapping {
  class: string
  class_code: string
  expense: DepAccount
  accumulated: DepAccount
  cost: DepAccount
}

export interface DepLine {
  line: number
  class: string
  class_code: string
  account_id: string | null
  account_code: string
  account_name: string
  account_exists: boolean
  side: "Dr" | "Cr"
  debit: number
  credit: number
  narration: string
}

export interface DepClass {
  class: string
  class_code: string | null
  mapped: boolean
  assets: number
  cost: number
  opening: number
  charge: number
  closing: number
  nbv: number
  min_life: number | null
  max_life: number | null
}

export interface DepAsset {
  sno: number
  id: string
  asset_code: string | null
  name: string
  category: string
  start_date: string | null
  cost: number
  depreciable_amount: number
  life_months: number
  disposal_date: string | null
  months_opening: number
  months_closing: number
  opening: number
  charge: number
  closing: number
  nbv: number
  status: string
  asset_status: string | null
}

export interface DepRun {
  id: string
  reference: string
  status: "posted" | "reversed"
  posting_date: string | null
  total_charge: number
  entry_number: string | null
  journal_entry_id: string | null
  prepared_by: string | null
  reviewed_by: string | null
  posted_at: string | null
  reversed_at: string | null
  reversed_by: string | null
  reversal_reason: string | null
}

export interface DepLogRow {
  period_end: string
  period: string
  reference: string
  charge: number
  closing: number
  status: "posted" | "not_posted" | "nothing"
  run: DepRun | null
  differs: boolean
  reversals: number
  month_ended: boolean
}

export interface DepReconRow {
  class: string
  register_cost: number
  gl_cost: number
  register_accumulated: number
  gl_accumulated: number
  difference: number
}

export interface DepreciationJournal {
  period_end: string
  period: string
  opening_date: string
  reference: string
  posting_date: string
  narration: string
  currency: string
  source: string
  status: "READY TO POST" | "POSTED" | "DO NOT POST - FIX CHECKS" | "NOTHING TO POST"
  can_post: boolean
  can_post_permission: boolean
  earlier_not_posted: string[]
  checks: DepCheck[]
  mapping: DepMapping[]
  accounts_ready: boolean
  lines: DepLine[]
  total_debit: number
  total_credit: number
  classes: DepClass[]
  totals: { cost: number; opening: number; charge: number; closing: number; nbv: number; asset_charge: number }
  assets: DepAsset[]
  posted: DepRun | null
  history: DepRun[]
  log: DepLogRow[]
  reconciliation: {
    basis: "opening" | "closing"
    rows: DepReconRow[]
    totals: Omit<DepReconRow, "class">
    group_balance: number
  }
}

type Res<T> = { status: string; message?: string; data: T }

/** month = "2026-11" (any date in the month works too). */
export async function fetchDepreciationJournal(month: string): Promise<DepreciationJournal> {
  const res = await apiCall<Res<DepreciationJournal>>(`/depreciation-journal?month=${encodeURIComponent(month)}`, "GET")
  if (res.status !== "success") throw new Error(res.message || "Could not load the depreciation journal")
  return res.data
}

export async function setupDepreciationAccounts(): Promise<string> {
  const res = await apiCall<Res<{ code: string; name: string }[]>>("/depreciation-journal/accounts", "POST", {})
  if (res.status !== "success") throw new Error(res.message || "Could not add the accounts")
  return res.message || "Accounts ready"
}

export async function postDepreciationJournal(month: string, reviewedBy?: string, postingDate?: string): Promise<string> {
  const res = await apiCall<Res<unknown>>("/depreciation-journal/post", "POST", { month, reviewed_by: reviewedBy || null, posting_date: postingDate || null })
  if (res.status !== "success") throw new Error(res.message || "Could not post the journal")
  return res.message || "Posted"
}

export async function postMissingDepreciation(upTo: string, reviewedBy?: string): Promise<string> {
  const res = await apiCall<Res<unknown>>("/depreciation-journal/post-missing", "POST", { up_to: upTo, reviewed_by: reviewedBy || null })
  if (res.status !== "success") throw new Error(res.message || "Could not post the months")
  return res.message || "Posted"
}

export async function reverseDepreciationJournal(runId: string, reason: string): Promise<string> {
  const res = await apiCall<Res<unknown>>(`/depreciation-journal/${runId}/reverse`, "POST", { reason })
  if (res.status !== "success") throw new Error(res.message || "Could not reverse the journal")
  return res.message || "Reversed"
}
