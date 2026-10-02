import { PermissionGuard } from "@/components/PermissionGuard"

export const dynamic = "force-dynamic"

export default function SerialNumbersLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <PermissionGuard permissions={["can_view_serial_numbers_menu", "can_manage_system", "can_manage_company"]}>
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
        {children}
      </div>
    </PermissionGuard>
  )
}