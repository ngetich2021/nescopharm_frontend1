"use client";

import { FileText, Check, CheckCheck, CornerUpLeft } from "lucide-react";
import type { Message } from "./message-area";
import { useEffect, useRef } from "react";

interface MessageListProps {
    messages: Message[];
    openImagePreview: (imageUrl: string) => void;
    onReply?: (message: Message) => void;
}

// Simple emoji conversion (for demo)
function renderEmojis(text: string) {
  return text.replace(/:([a-z0-9_+-]+):/gi, (match, p1) => {
    try {
      // Only works for a few common emoji shortcodes
      const emojiMap: Record<string, string> = {
        smile: "😊",
        heart: "❤️",
        thumbsup: "👍",
        fire: "🔥",
        clap: "👏",
        cry: "😢",
        grin: "😁",
        ok: "👌",
        pray: "🙏",
        star: "⭐",
      };
      return emojiMap[p1] || match;
    } catch {
      return match;
    }
  });
}

export function MessageList({ messages, openImagePreview, onReply }: MessageListProps) {
    const MessageStatus = ({
                               status,
                           }: {
        status: "sent" | "delivered" | "read" | "pending" | "failed";
    }) => {
        if (status === "sent") return <Check className="h-3 w-3 text-gray-400" />;
        if (status === "delivered")
            return <CheckCheck className="h-3 w-3 text-gray-400" />;
        if (status === "read")
            return <CheckCheck className="h-3 w-3 text-blue-500" />;
        if (status === "pending")
            return <Check className="h-3 w-3 animate-pulse text-gray-400" />;
        if (status === "failed") return <Check className="h-3 w-3 text-red-500" />;
        return null;
    };

    // Ref for the container to scroll to bottom
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
    }, [messages]);

    return (
      <div ref={containerRef} className="flex-grow overflow-y-auto p-4 bg-gray-50">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`mb-2 flex ${
              message.direction === "inbound" ? "justify-start" : "justify-end"
            } animate-fade-in`}
          >
            <div
              className={`flex flex-col max-w-[80%] space-y-1 ${
                message.direction === "inbound" ? "items-start" : "items-end"
              }`}
            >
              {/* Reply icon below the message bubble */}
              {onReply && (
                <div className={`flex ${message.direction === "inbound" ? "justify-start" : "justify-end"} mt-1`}>
                  <button
                    className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                    title="Reply"
                    onClick={() => onReply(message)}
                  >
                    <CornerUpLeft className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              )}
              {/* Quoted reply preview above the message bubble */}
              {('replyTo' in message) && (message as any).replyTo && (
                <div className="mb-1 ml-2 mr-2 px-3 py-1 rounded bg-gray-100 border-l-4 border-blue-400 text-xs text-gray-700 max-w-full truncate">
                  {(message as any).replyTo.text || "Message"}
                </div>
              )}
              <div
                className={`p-3 rounded-2xl ${
                  message.direction === "inbound"
                    ? "bg-white text-gray-900 border border-gray-200"
                    : "bg-[#075E54] text-white"
                } shadow-sm transition-all duration-150 max-w-[480px] md:max-w-[70vw] break-words break-all overflow-x-auto`}
                style={{ wordBreak: 'break-word', maxWidth: '480px' }}
              >
                {/* Media previews */}
                {message.type === "image" && message.media_url && (
                  <div
                    className="mb-2 cursor-pointer"
                    onClick={() => openImagePreview(message.media_url!)}
                  >
                    <img
                      src={message.media_url}
                      alt="Attachment"
                      className="max-w-full max-h-64 rounded-lg hover:opacity-90 transition-opacity"
                    />
                  </div>
                )}
                {message.type === "video" && message.media_url && (
                  <div className="mb-2">
                    <video
                      src={message.media_url}
                      controls
                      className="max-w-full max-h-64 rounded"
                    />
                  </div>
                )}
                {message.type === "document" && message.media_url && (
                  <div className="mb-2">
                    <a
                      href={message.media_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline flex items-center"
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Download Document
                    </a>
                  </div>
                )}

                {message.message && (
                  <div className="whitespace-pre-wrap break-words break-all">
                    {renderEmojis(message.message)}
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-1 mt-1">
                <span className="text-xs text-gray-500">
                  {new Date(message.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                {message.direction === "outbound" && (
                  <MessageStatus status={message.status} />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
}

// Animation for message entry
// Add this to your global CSS or Tailwind config if not present
// .animate-fade-in { animation: fadeIn 0.2s ease; }
// @keyframes fadeIn { from { opacity: 0; transform: translateY(10px);} to { opacity: 1; transform: none; } }
