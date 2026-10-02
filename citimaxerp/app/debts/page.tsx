import { Suspense } from "react"
import { getDebts, getDebtSummary } from "@/lib/debts"
import { DebtsSummary } from "./debts-summary"
import { DebtsTable } from "./debts-table"
import { DebtsTableSkeleton } from "./debts-table-skeleton"

// Force dynamic rendering to avoid authentication issues during build
export const dynamic = 'force-dynamic'

async function DebtsContent() {
  const [debts, summary] = await Promise.all([getDebts(), getDebtSummary()])

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Debt Management</h2>
      </div>
      <div className="space-y-6">
        <DebtsSummary summary={summary} />
        <DebtsTable debts={debts} />
      </div>
    </div>
  )
}

export default function DebtsPage() {
  return (
    <Suspense fallback={<DebtsTableSkeleton />}>
      <DebtsContent />
    </Suspense>
  )
}
