"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea" // Import Textarea from shadcn/ui

interface CustomerChatsProps {
  customerId: string
}

interface Chat {
  id: string
  channel: string
  messages: { content: string; sender: string; timestamp: string }[]
  status: string
}

export function CustomerChats({ customerId }: CustomerChatsProps) {
  const [chats, setChats] = useState<Chat[]>([])
  const [loading, setLoading] = useState(true)
  const [messageContent, setMessageContent] = useState("")

  useEffect(() => {
    async function fetchChats() {
      setLoading(true)
      // Simulate fetching chat data without Supabase
      console.log(`[CustomerChats] Fetching chat history for customer ID: ${customerId}. API endpoint needed.`)

      // Mock data for demonstration
      const mockChats: Chat[] = [
        {
          id: "chat_123",
          channel: "WhatsApp",
          messages: [
            { content: "Hello, I need help with my order.", sender: "customer", timestamp: "2024-06-15T10:00:00Z" },
            { content: "Sure, what is your order number?", sender: "agent", timestamp: "2024-06-15T10:05:00Z" },
            { content: "It's #ORD-7890.", sender: "customer", timestamp: "2024-06-15T10:10:00Z" },
          ],
          status: "Active",
        },
        {
          id: "chat_456",
          channel: "SMS",
          messages: [
            { content: "Is my delivery on its way?", sender: "customer", timestamp: "2024-06-14T14:30:00Z" },
            { content: "Yes, it's expected within the next hour.", sender: "agent", timestamp: "2024-06-14T14:35:00Z" },
          ],
          status: "Closed",
        },
      ]

      setChats(mockChats)
      setLoading(false)
    }

    if (customerId) {
      fetchChats()
    }
  }, [customerId])

  const handleSendMessage = () => {
    if (messageContent.trim()) {
      console.log(
        `[CustomerChats] Sending message: "${messageContent}" for customer ID: ${customerId}. API endpoint needed.`,
      )
      // Simulate sending message
      // In a real application, you would call an API here
      setMessageContent("") // Clear the input
    }
  }

  if (loading) {
    return <p>Loading chats...</p>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chat History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {chats.length === 0 ? (
            <p className="text-muted-foreground">No chat history found for this customer.</p>
          ) : (
            chats.map((chat) => (
              <div key={chat.id} className="flex flex-col border-b pb-6 last:border-0">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">Conversation ID: {chat.id}</h3>
                    <Badge
                      variant="secondary"
                      className={chat.status === "Active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}
                    >
                      {chat.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">Channel: {chat.channel}</p>
                </div>
                <div className="space-y-4 mt-4">
                  {chat.messages.map(
                    (message: { content: string; sender: string; timestamp: string }, index: number) => (
                      <div
                        key={index}
                        className={`flex ${message.sender === "customer" ? "justify-start" : "justify-end"}`}
                      >
                        <div
                          className={`max-w-xs p-3 rounded-lg ${
                            message.sender === "customer" ? "bg-gray-100 text-gray-800" : "bg-blue-500 text-white"
                          }`}
                        >
                          <p className="text-sm">{message.content}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(message.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>
            ))
          )}
          <div className="mt-4 space-y-2">
            <Textarea
              className="w-full border rounded-md p-2 text-sm"
              placeholder="Type your message..."
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
            />
            <Button variant="default" size="sm" className="self-end" onClick={handleSendMessage}>
              Send
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
