export interface User {
  id: string
  name: string
  phone: string
  email: string
  avatar?: string
  status: "Active User" | "Offline" | "Away"
  dateCreated: string
  tags?: string[]
  notes?: string[]
}

export interface Message {
  id: string
  senderId: string
  content: string
  timestamp: string
  type: "text" | "image" | "video" | "file" | "voice" | "sticker"
  attachments?: {
    name: string
    size: string
    type: string
    url: string
  }[]
  status: "sent" | "delivered" | "read"
  reactions?: {
    userId: string
    emoji: string
  }[]
}

export interface ChatConversation {
  id: string
  user: User
  messages: Message[]
  lastMessage?: Message
  channel: "WhatsApp" | "Facebook" | "Messenger" | "TikTok" | "Email" | "Instagram"
  unreadCount: number
  isTyping: boolean
}

export interface QuickReply {
  id: string
  content: string
}

export interface ChatTemplate {
  id: string
  name: string
  content: string
}

export interface ScheduledMessage {
  id: string
  content: string
  scheduledTime: string
  conversationId: string
}

export interface Note {
  id: string
  content: string
  date: string
}

export interface Order {
  id: string
  date: string
  total: number
  status: string
}

export interface WhatsAppMessage extends Message {
  whatsapp_message_id?: string
}

export interface WhatsAppConversation extends ChatConversation {
  whatsapp_id: string
}
