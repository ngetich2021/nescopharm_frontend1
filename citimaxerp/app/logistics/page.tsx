import { Suspense } from "react"
import { LogisticsTable } from "./logistics-table"
import { LogisticsSummary } from "./logistics-summary"

export const metadata = {
  title: "Logistics | Citimax - Enterprise Resource Management",
  description: "Manage and track your logistics",
}

export default function LogisticsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Logistics Management</h1>
        <p className="text-muted-foreground">Track, manage, and analyze your deliveries in one place.</p>
      </div>

      <Suspense fallback={<div>Loading logistics metrics...</div>}>
        <LogisticsSummary />
      </Suspense>

      <Suspense fallback={<div>Loading logistics...</div>}>
        <LogisticsTable />
      </Suspense>
    </div>
  )
}
