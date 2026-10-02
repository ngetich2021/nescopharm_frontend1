"use client";

import { useState, useEffect } from "react";
import apiCall from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, MessageCircle, Phone, Mail } from "lucide-react";
import type { Conversation } from "./message-area";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { ChevronDown } from "lucide-react";

interface ConversationListProps {
  conversations: Conversation[];
  selectedConversation?: Conversation | null;
  onSelectConversation: (conversation: Conversation) => void;
  presence: Record<string, boolean>;
  unreadCounts?: Record<string, number>;
}

export function ConversationList({
  conversations,
  selectedConversation,
  onSelectConversation,
  presence,
  unreadCounts = {},
}: ConversationListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("recent");
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    let filtered = conversations.filter((conv) =>
      conv.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.customer_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.customer_phone?.includes(searchTerm)
    );
    if (statusFilter !== "all") {
      filtered = filtered.filter((conv) => conv.status?.toLowerCase() === statusFilter);
    }
    // Sorting
    if (sortBy === "recent") {
      filtered = filtered.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
    } else if (sortBy === "unread") {
      filtered = filtered.sort((a, b) => (b.unread_count || 0) - (a.unread_count || 0));
    } else if (sortBy === "az") {
      filtered = filtered.sort((a, b) => (a.customer_name || "").localeCompare(b.customer_name || ""));
    }
    setFilteredConversations(filtered);
  }, [conversations, searchTerm, statusFilter, sortBy]);

  const formatLastMessageTime = (timestamp: string, showTimeIfToday = false) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (showTimeIfToday && isToday) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    if (diffInHours < 1) {
      return "Just now";
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else if (diffInHours < 168) {
      // Show day of week
      return date.toLocaleDateString(undefined, { weekday: "long" });
    } else {
      return date.toLocaleDateString();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return "bg-green-500";
      case "pending":
        return "bg-yellow-500";
      case "closed":
        return "bg-gray-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="flex flex-col h-full" role="region" aria-label="Conversations">
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {searchTerm ? "No conversations found" : "No conversations yet"}
          </div>
        ) :
          filteredConversations.map((conversation, idx) => (
            <div
              key={conversation.id}
              className={`p-3 cursor-pointer transition-colors flex items-center justify-between gap-2 ${
                selectedConversation?.id === conversation.id
                  ? "bg-blue-50 border border-blue-200"
                  : "hover:bg-gray-50"
              } border-b border-gray-200 last:border-b-0`}
              onClick={() => onSelectConversation(conversation)}
              role="option"
              aria-selected={selectedConversation?.id === conversation.id}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  onSelectConversation(conversation);
                }
                // Arrow key navigation
                if (e.key === "ArrowDown") {
                  const next = document.querySelectorAll('[role="option"]')[idx + 1] as HTMLElement;
                  if (next) next.focus();
                }
                if (e.key === "ArrowUp") {
                  const prev = document.querySelectorAll('[role="option"]')[idx - 1] as HTMLElement;
                  if (prev) prev.focus();
                }
              }}
            >
              {/* Left: Avatar and text */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <Avatar className="h-12 w-12">
                  <AvatarImage src="" alt={conversation.customer_name} />
                  <AvatarFallback>
                    {(() => {
                      const words = (conversation.customer_name || "").split(" ").filter(Boolean);
                      if (words.length === 0) return "?";
                      if (words.length === 1) return words[0][0].toUpperCase();
                      return (words[0][0] + words[1][0]).toUpperCase();
                    })()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0">
                  <span className="font-light text-base truncate">
                    {conversation.customer_name || conversation.customer_phone || "Unknown"}
                  </span>
                  {conversation.last_message && (
                    <span className="text-gray-500 text-sm truncate max-w-[180px]">
                      {conversation.last_message}
                    </span>
                  )}
                </div>
              </div>
              {/* Right: Date/time and unread badge */}
              <div className="flex flex-col items-end justify-between h-full min-w-[56px]">
                <span className={`text-xs font-medium ${(unreadCounts[conversation.id] || conversation.unread_count) > 0 ? "text-[#e30040]" : "text-gray-400"}`}>
                  {formatLastMessageTime(conversation.last_message_at, true)}
                </span>
                {(unreadCounts[conversation.id] || conversation.unread_count || 0) > 0 && (
                  <span className="inline-flex items-center justify-center mt-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-[#e30040] text-white min-w-[24px] min-h-[24px]">
                    {unreadCounts[conversation.id] || conversation.unread_count}
                  </span>
                )}
              </div>
            </div>
          ))
        }
      </div>
    </div>
  );
}
