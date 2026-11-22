import { PaymentsTable } from "./payments-table"
import { PaymentsSummary } from "./payments-summary"
import { CollectionsTable } from "./collections-table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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

      <Tabs defaultValue="receipts" className="space-y-6">
        <TabsList>
          <TabsTrigger value="receipts">Receipts</TabsTrigger>
          <TabsTrigger value="collections">Collections</TabsTrigger>
        </TabsList>

        <TabsContent value="receipts" className="space-y-6">
          <PaymentsSummary />
          <PaymentsTable />
        </TabsContent>

        {/* Everything collected: receipts plus post-dated cheques still in hand. */}
        <TabsContent value="collections">
          <CollectionsTable />
        </TabsContent>
      </Tabs>
    </div>
  )
}
