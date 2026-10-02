import { redirect } from "next/navigation"

export const metadata = {
  title: "Customer Profile | Citimax",
  description: "View and manage customer information",
}

// This standalone page rendered an older, incomplete customer editor
// (no individual/company distinction, no credit-appraisal fields) that
// predates the sheet-based CustomerProfileModal/EditCustomerModal the
// Customers list now uses. Nothing in the app links here anymore, but the
// route stayed reachable directly and would show stale/partial data if
// anyone landed on it - redirect to the real, fully-featured customer list.
export default async function CustomerProfilePage() {
  redirect("/customers")
}
