import type { Ticket, User } from "@/types/tickets"

export const users: User[] = [
  {
    id: "1",
    name: "Matilda Cieri",
    avatar: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-Ctc1T3wH8eohx9FtEtJIdNiHyQFH6h.png",
  },
  {
    id: "2",
    name: "Kimberly Mastrangelo",
    avatar: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-Ctc1T3wH8eohx9FtEtJIdNiHyQFH6h.png",
  },
  {
    id: "3",
    name: "Kathy Pacheco",
    avatar: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-Ctc1T3wH8eohx9FtEtJIdNiHyQFH6h.png",
  },
  {
    id: "4",
    name: "Dennis Callis",
    avatar: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-Ctc1T3wH8eohx9FtEtJIdNiHyQFH6h.png",
  },
  {
    id: "5",
    name: "Alex Buckmaster",
    avatar: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-Ctc1T3wH8eohx9FtEtJIdNiHyQFH6h.png",
  },
]

export const tickets: Ticket[] = [
  {
    id: "1",
    title: "Received defecting product",
    sender: users[0],
    receivedAt: "26min ago",
    status: "Not yet responded",
    priority: "Urgent",
    category: "Problem",
    group: "Billing",
    tags: ["Billing", "Product", "Payment"],
    ticketNumber: "#12",
  },
  {
    id: "2",
    title: "Why am I unable to place an order?",
    sender: users[1],
    receivedAt: "26min ago",
    status: "Not yet responded",
    priority: "High",
    category: "Problem",
    tags: ["Order", "Technical"],
    ticketNumber: "#13",
  },
  {
    id: "3",
    title: "Can I change or modify orders that are already placed?",
    sender: users[2],
    receivedAt: "26min ago",
    respondedAt: "23 min ago",
    status: "Responded",
    priority: "Medium",
    category: "Problem",
    tags: ["Order", "Support"],
    ticketNumber: "#14",
  },
]
