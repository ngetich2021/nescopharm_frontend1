import { PaymentsTable } from "./payments-table"
import { PaymentsSummary } from "./payments-summary"

export const metadata = {
  title: "Receipts | Citimax - Enterprise Resource Management",
  description: "Manage and track your receipts from orders",
}

export default function PaymentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Receipt Management</h1>
        <p className="text-muted-foreground">Track, manage, and analyze your order receipts in one place.</p>
      </div>

      <PaymentsSummary />
      
      <PaymentsTable />
    </div>
  )
}
