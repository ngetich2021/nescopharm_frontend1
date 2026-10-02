export function getInvoiceStatusLabel(status: string): string {
  switch (status?.toLowerCase()) {
    case 'draft':
      return 'Pending'
    case 'partially_paid':
      return 'Partial'
    case 'paid':
      return 'Paid'
    case 'sent':
      return 'Sent'
    case 'viewed':
      return 'Viewed'
    case 'overdue':
      return 'Overdue'
    case 'cancelled':
      return 'Cancelled'
    default:
      return status
  }
}

export function getInvoiceStatusColor(status: string): string {
  switch (status?.toLowerCase()) {
    case 'draft':
      return 'bg-amber-100 text-amber-800'
    case 'sent':
      return 'bg-blue-100 text-blue-800'
    case 'viewed':
      return 'bg-purple-100 text-purple-800'
    case 'paid':
      return 'bg-green-100 text-green-800'
    case 'partially_paid':
      return 'bg-yellow-100 text-yellow-800'
    case 'overdue':
      return 'bg-red-100 text-red-800'
    case 'cancelled':
      return 'bg-gray-100 text-gray-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}
