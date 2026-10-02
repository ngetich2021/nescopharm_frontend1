"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X } from "lucide-react";
import { MessageList } from "./message-list";
import { CustomerSidebar } from "./customer-sidebar";
import { MessageComposer } from "./message-composer";
import { ImagePreview } from "@/lib/imagePreview";
import { Mail, Phone, Building2 } from "lucide-react";

export interface Conversation {
  last_message_at: string;
  unread_count: number;
  id: string;
  customer_id: string;
  whatsapp_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  status: string;
  created_at: string;
  updated_at: string;
  last_message?: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  message: string;
  sender: "agent" | "customer";
  status: "pending" | "sent" | "delivered" | "read" | "failed";
  direction: "inbound" | "outbound";
  whatsapp_message_id?: string;
  type: "text" | "image" | "video" | "audio" | "document";
  media_id?: string;
  media_url?: string;
  created_at: string;
}

interface MessageAreaProps {
  conversation: Conversation | null;
  presence: Record<string, boolean>;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

export function MessageArea({ conversation, presence, messages, setMessages }: MessageAreaProps) {
  const [imagePreview, setImagePreview] = useState<{
    images: { url: string; caption?: string }[];
    currentIndex: number;
  } | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isTyping, setIsTyping] = useState(false);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Only auto-scroll to bottom on initial load or when a new message is sent by the user
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      scrollToBottom();
      isInitialMount.current = false;
    } else if (messages.length > 0 && messages[messages.length - 1].sender === "agent") {
      // Auto-scroll when the agent sends a new message
      scrollToBottom();
    }
  }, [messages]);

  useEffect(() => {
    messages.forEach(async (message) => {
      if (message.type !== "text" && message.media_id && !message.media_url) {
        const mediaUrl = await fetchMedia(message.media_id);
        if (mediaUrl) {
          setMessages((prevMessages) =>
              prevMessages.map((m) =>
                  m.id === message.id ? { ...m, media_url: mediaUrl } : m
              )
          );
        }
      }
    });
  }, [messages]);

  // Get all media messages for navigation
  const mediaMessages = messages.filter(
      (m) => m.type === "image" && m.media_url
  );

  const openImagePreview = (imageUrl: string) => {
    const currentIndex = mediaMessages.findIndex(
        (m) => m.media_url === imageUrl
    );

    setImagePreview({
      images: mediaMessages.map((m) => ({
        url: m.media_url!,
        caption: m.message,
      })),
      currentIndex,
    });
  };

  const fetchMedia = useCallback(async (mediaId: string) => {
    try {
      const response = await fetch(`/api/whatsapp/media/${mediaId}`, {
        method: "GET",
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch media: ${response.statusText}`);
      }
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error("Error fetching media:", error);
      return null;
    }
  }, []);

  // Removed unused fetchMessages function

  if (!conversation) {
    return (
        <div className="flex-grow flex items-center justify-center">
          <p className="text-gray-500">Select a conversation to start chatting</p>
        </div>
    );
  }

  return (
      <div className="flex-grow flex flex-col h-full">
        <div className="p-4 border-b flex flex-col gap-2 md:flex-row md:items-center md:gap-6 h-auto md:h-20">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <h2 className="font-semibold truncate text-lg md:text-xl">{conversation?.customer_name}</h2>
            {conversation && (
              <span className="flex items-center ml-2">
                <span className={`w-2 h-2 rounded-full mr-1 ${presence[conversation.customer_id] ? "bg-green-500" : "bg-gray-400"}`}></span>
                <span className={`text-xs ${presence[conversation.customer_id] ? "text-green-600" : "text-gray-400"}`}>{presence[conversation.customer_id] ? "Online" : "Offline"}</span>
              </span>
            )}
          </div>
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 text-xs text-gray-700">
            <div className="flex items-center gap-1 truncate">
              <Mail className="h-4 w-4 text-[#075E54]" />
              <span className="truncate">{conversation?.customer_email}</span>
            </div>
            <div className="flex items-center gap-1 truncate">
              <Phone className="h-4 w-4 text-[#075E54]" />
              <span className="truncate">{conversation?.customer_phone || conversation?.whatsapp_id}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-row flex-grow h-full overflow-hidden">
          <div className="flex flex-col flex-grow overflow-y-auto">
            <MessageList
                messages={messages}
                openImagePreview={openImagePreview}
                onReply={setReplyTo}
            />
            {/* Auto-scroll target */}
            <div ref={messagesEndRef} />
            {/* Typing indicator */}
            {isTyping && (
              <div className="flex items-center space-x-2 p-3 text-gray-500">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-sm">Customer is typing...</span>
              </div>
            )}
            {/* Reply bar above composer */}
            {replyTo && (
              <div className="flex items-center bg-gray-100 border-l-4 border-blue-400 px-3 py-2 mb-2 rounded text-sm text-gray-700">
                <span className="truncate flex-1">Replying to: {replyTo.message?.slice(0, 60) || "Message"}</span>
                <button className="ml-2 p-1 hover:bg-gray-200 rounded" onClick={() => setReplyTo(null)} title="Cancel reply">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            )}
            <MessageComposer
                conversation={conversation}
                setMessages={setMessages}
                replyTo={replyTo}
                onSent={() => {
                  if (replyTo) setReplyTo(null);
                }}
            />
          </div>
          <div className="hidden lg:block w-80 border-l bg-white h-full overflow-y-auto">
            <CustomerSidebar conversation={conversation} />
          </div>
        </div>
        {/* Image preview modal */}
        {imagePreview && (
            <ImagePreview
                images={imagePreview.images}
                currentIndex={imagePreview.currentIndex}
                onClose={() => setImagePreview(null)}
                onNext={() =>
                    setImagePreview((prev) => ({
                      ...prev!,
                      currentIndex: Math.min(
                          prev!.currentIndex + 1,
                          prev!.images.length - 1
                      ),
                    }))
                }
                onPrev={() =>
                    setImagePreview((prev) => ({
                      ...prev!,
                      currentIndex: Math.max(prev!.currentIndex - 1, 0),
                    }))
                }
            />
        )}
      </div>
  );
}
