import { ExpensesClient } from "./expenses-client"
import { PermissionGuard } from "@/components/PermissionGuard"

export const metadata = {
  title: "Expenses | Cherry CRM",
  description: "Manage your business expenses",
}

export default function ExpensesPage() {
  return (
    <PermissionGuard permissions={["can_view_expenses_menu", "can_manage_system", "can_manage_company"]}>
      <ExpensesClient />
    </PermissionGuard>
  )
}