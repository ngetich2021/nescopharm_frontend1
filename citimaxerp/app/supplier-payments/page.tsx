import { SupplierPaymentsTable } from "./components/supplier-payments-table"
import { SupplierPaymentsSummary } from "./components/supplier-payments-summary"

export const metadata = {
  title: "Payments | Citimax - Enterprise Resource Management",
  description: "Manage and track payments to suppliers",
}

export default function SupplierPaymentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Supplier Payments</h1>
        <p className="text-muted-foreground">Track and manage payments to your suppliers.</p>
      </div>

      <SupplierPaymentsSummary />
      
      <SupplierPaymentsTable />
    </div>
  )
}
