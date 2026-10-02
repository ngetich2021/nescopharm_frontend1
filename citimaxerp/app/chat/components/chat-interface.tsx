"use client";

import { useState, useEffect } from "react";
import { getConversations, getConversation, getCustomerByPhone } from "@/lib/chat-api";
import { ConversationList } from "./conversation-list";
import { MessageArea, Conversation, Message } from "./message-area";
import { CustomerSidebar } from "./customer-sidebar";
import { Menu, X, Loader2, PlusCircle, Wifi, WifiOff } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useRealTimeChat } from "@/hooks/useRealTimeChat";
import { useAuth } from "@/lib/auth-context";

// Use interfaces from message-area.tsx
interface CustomerOption {
  id: string;
  name: string;
  phone: string;
  email: string;
}

const API_BASE = "/api/chat";
function getAuthToken() {
  if (typeof window !== "undefined") {
    return localStorage.getItem("sanctum_token");
  }
  return null;
}


export function ChatInterface() {
  const { user } = useAuth();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [isConversationListVisible, setIsConversationListVisible] = useState(false);
  const [startModalOpen, setStartModalOpen] = useState(false);
  const [platform, setPlatform] = useState<string>("whatsapp");
  const [customerSearch, setCustomerSearch] = useState<string>("");
  const [customerOptions] = useState<CustomerOption[]>([]); // Will fetch from backend later
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use the enhanced real-time chat hook for notifications and real-time updates
  const {
    unreadCounts,
    isConnected,
    requestNotificationPermission
  } = useRealTimeChat(user?.company?.id, selectedConversation?.id);

  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission();
  }, [requestNotificationPermission]);

  // Fetch conversations from backend
  useEffect(() => {
    setLoading(true);
    setError(null);
    getConversations()
      .then((data: any) => {
        if (data.status === "success" && data.conversations?.data) {
          const mapped = data.conversations.data.map((conv: any) => ({
            id: conv.id,
            customer_id: conv.customer_id,
            customer_name: conv.customer_name,
            customer_email: conv.customer_email,
            customer_phone: conv.customer_phone,
            whatsapp_id: conv.platform_user_id || conv.whatsapp_id,
            last_message: conv.latest_message?.content || "",
            last_message_at: conv.last_message_at,
            unread_count: conv.unread_count,
            status: conv.status,
            created_at: conv.created_at,
            updated_at: conv.updated_at,
          }));
          setConversations(mapped);
          setSelectedConversation(mapped[0] || null);
        } else {
          setError(data.message || "Failed to load conversations");
        }
      })
      .catch((e: any) => {
        setError(e.message || "Failed to load conversations");
      })
      .finally(() => setLoading(false));
  }, []);

  // Handle selecting a conversation
  const handleSelectConversation = async (conversation: Conversation) => {
    setMessagesLoading(true);
    setMessagesError(null);
    try {
      // Fetch customer_id using phone and platform
      const phone = conversation.customer_phone || conversation.whatsapp_id;
      const platform = "whatsapp"; // or dynamic if needed
      const customerRes: any = await getCustomerByPhone(phone, platform);
      let updatedConversation = { ...conversation };
      if (customerRes.status === "success" && customerRes.customer?.id) {
        updatedConversation.customer_id = customerRes.customer.id;
      }
      setSelectedConversation(updatedConversation);
      // Mark conversation as read (set unread_count to 0)
      setConversations(prev => prev.map(c =>
        c.id === updatedConversation.id ? { ...c, unread_count: 0 } : c
      ));
      // Fetch messages
      const data: any = await getConversation(conversation.id);
      if (data.status === "success" && data.conversation?.messages) {
        const mapped = data.conversation.messages.map((msg: any) => ({
          id: msg.id,
          conversation_id: msg.conversation_id,
          message: msg.content,
          sender: msg.sender_type === "agent" ? "agent" : "customer",
          status: msg.status,
          direction: msg.direction,
          whatsapp_message_id: msg.platform_message_id,
          type: msg.message_type,
          media_id: msg.media_id,
          media_url: msg.media_url,
          created_at: msg.created_at,
        }));
        setMessages(mapped);
      } else {
        setMessagesError(data.message || "Failed to load messages");
        setMessages([]);
      }
    } catch (e: any) {
      setMessagesError(e.message || "Failed to load messages");
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  };

  // Handle sending a message
  const handleSendMessage = (content: string) => {
    if (!selectedConversation) return;
    const newMessage: Message = {
      id: `m${Date.now()}`,
      conversation_id: selectedConversation.id,
      message: content,
      sender: "agent",
      status: "sent",
      direction: "outbound",
      created_at: new Date().toISOString(),
      type: "text",
    };
    setMessages((prev: Message[]) => [...prev, newMessage]);
  };

  // Handle starting a new conversation
  const handleStartConversation = () => {
    if (!selectedCustomer) return;
    const newConv: Conversation = {
      id: `${Date.now()}`,
      customer_id: `c${Date.now()}`,
      customer_name: selectedCustomer.name,
      customer_email: selectedCustomer.email,
      customer_phone: selectedCustomer.phone,
      whatsapp_id: selectedCustomer.phone.replace("+", ""),
      last_message: "",
      last_message_at: new Date().toISOString(),
      unread_count: 0,
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setConversations((prev: Conversation[]) => [newConv, ...prev]);
    setSelectedConversation(newConv);
    setMessages([]);
    setStartModalOpen(false);
  };

  return (
    <div className="flex h-full bg-[--background]">
      {/* Conversation List */}
      <div
        className={`${isConversationListVisible ? "block" : "hidden"} md:block md:w-80 border-r border-gray-200 bg-white shadow-lg flex flex-col`}
        role="navigation"
        aria-label="Conversation list"
      >
        {/* Header + search */}
        <div>
          <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-[#ff3366] to-[#ff6666] flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white tracking-tight">Conversations</h2>
            <div className="flex items-center space-x-2">
              {isConnected ? (
                <div className="flex items-center space-x-1 text-white">
                  <Wifi className="h-4 w-4" />
                  <span className="text-xs">Live</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1 text-red-200">
                  <WifiOff className="h-4 w-4" />
                  <span className="text-xs">Offline</span>
                </div>
              )}
            </div>
          </div>
          <div className="px-4 pt-3 pb-2 bg-white border-b border-gray-200">
            <Input
              className="h-8 text-xs w-full border-gray-200 rounded-md px-2"
              placeholder="Search conversations..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              style={{ minWidth: 0 }}
            />
          </div>
        </div>
        {/* Start Conversation Modal */}
        <Dialog open={startModalOpen} onOpenChange={setStartModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Start New Conversation</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Platform</label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select platform" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="messenger">Messenger</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Customer</label>
                <Input
                  placeholder="Search customer..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                />
                <div className="max-h-32 overflow-y-auto mt-2 border rounded">
                  {customerOptions
                    .filter((c) => c.name.toLowerCase().includes(customerSearch.toLowerCase()))
                    .map((c) => (
                    <div
                      key={c.id}
                      className={`p-2 cursor-pointer hover:bg-blue-50 ${selectedCustomer?.id === c.id ? "bg-blue-100" : ""}`}
                      onClick={() => setSelectedCustomer(c)}
                    >
                      <div className="font-medium text-sm">{c.name}</div>
                      <div className="text-xs text-gray-500">{c.phone} {c.email}</div>
                    </div>
                  ))}
                  {customerOptions.length === 0 && <div className="p-2 text-xs text-gray-400">No customers found</div>}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleStartConversation} disabled={!selectedCustomer} className="bg-blue-600 hover:bg-blue-700 w-full">
                Start Conversation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Scrollable conversation list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-500">Loading conversations...</div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-red-500">{error}</div>
          ) : (
            <ConversationList
              conversations={conversations}
              presence={{}}
              onSelectConversation={handleSelectConversation}
              unreadCounts={unreadCounts}
            />
          )}
        </div>
        {/* Static footer for FAB, always bottom right */}
        <div className="flex-shrink-0 flex items-end justify-end p-4 border-t border-gray-200 bg-white">
          <button
            className="bg-[#ff3366] hover:bg-[#ff6666] text-white rounded-full shadow-lg w-12 h-12 flex items-center justify-center transition-colors duration-200 z-20"
            onClick={() => setStartModalOpen(true)}
            aria-label="Start Conversation"
          >
            <PlusCircle className="w-7 h-7" />
          </button>
        </div>
      </div>

      {/* Message Area */}
      <div className="flex-1 flex flex-col bg-[--background] min-h-0"> {/* Main chat area, no borders */}
        {selectedConversation ? (
          messagesLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : messagesError ? (
            <div className="flex-1 flex items-center justify-center text-red-500">{messagesError}</div>
          ) : (
            <MessageArea
              conversation={selectedConversation}
              presence={{}}
              messages={messages}
              setMessages={setMessages}
            />
          )
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-[#ff3366]/10 to-[#ff6666]/10">
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Select a conversation
              </h3>
              <p className="text-gray-500">
                Choose a conversation from the list to start messaging
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Mobile menu button */}
      <button
        className="md:hidden fixed bottom-4 right-4 z-50 cherry-red-bg text-white p-3 rounded-full shadow-lg border-2 border-white"
        onClick={() => setIsConversationListVisible(!isConversationListVisible)}
        aria-label={isConversationListVisible ? "Hide conversation list" : "Show conversation list"}
      >
        {isConversationListVisible ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>
    </div>
  );
}
