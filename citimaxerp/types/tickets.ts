export interface User {
  id: string
  name: string
  avatar?: string
}

export interface Ticket {
  id: string
  title: string
  sender: User
  assignee?: User
  receivedAt: string
  respondedAt?: string
  status: "Not yet responded" | "Responded" | "Closed"
  priority: "Urgent" | "High" | "Medium" | "Low"
  category: "Problem" | "Billing" | "Technical" | "Other"
  group?: "Billing" | "Support" | "Sales"
  tags: string[]
  ticketNumber: string
}

export interface TicketFilter {
  search?: string
  owner?: string[]
  contactName?: string[]
  status?: string
  priority?: string
  createdTime?: string
  closedAt?: string
  resolutionDueBy?: string
  firstResolutionDueBy?: string
  nextResponseDueBy?: string
}
