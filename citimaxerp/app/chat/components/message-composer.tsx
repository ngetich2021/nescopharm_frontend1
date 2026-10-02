"use client";

import { useState, useRef, useEffect } from "react";
import { startOrContinueConversation } from "@/lib/chat-api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Paperclip, Send, Smile, Image, File, Video, Mic } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import EmojiPicker from "emoji-picker-react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { AttachmentPreview } from "./attachment-preview";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface Conversation {
  id: string;
  customer_id: string;
  whatsapp_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
}

interface Message {
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

interface MessageComposerProps {
  conversation: Conversation;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  replyTo?: Message | null;
  onSent?: () => void;
}

export function MessageComposer({ conversation, setMessages, replyTo, onSent }: MessageComposerProps) {
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const socketService = useWebSocket();
  const [otherTyping, setOtherTyping] = useState(false);
  const [attachment, setAttachment] = useState<{
    file: File | null;
    type: "image" | "video" | "audio" | "document" | null;
    previewUrl: string | null;
    progress: number;
    error: string | null;
  }>({ file: null, type: null, previewUrl: null, progress: 0, error: null });
  const { toast } = useToast();

  // Template message state
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [templateParams, setTemplateParams] = useState<{ [key: string]: string }>({});
  const [isSendingTemplate, setIsSendingTemplate] = useState(false);

  // Example static templates (replace with API fetch if needed)
  const templates = [
    {
      name: "order_confirmation",
      label: "Order Confirmation",
      language: "en_US",
      params: ["order_id", "customer_name"],
    },
    {
      name: "payment_reminder",
      label: "Payment Reminder",
      language: "en_US",
      params: ["due_date", "amount"],
    },
  ];

  const handleOpenTemplateModal = () => {
    setSelectedTemplate("");
    setTemplateParams({});
    setTemplateModalOpen(true);
  };

  const handleSelectTemplate = (templateName: string) => {
    setSelectedTemplate(templateName);
    const template = templates.find((t) => t.name === templateName);
    if (template) {
      const paramsObj: { [key: string]: string } = {};
      template.params.forEach((p) => (paramsObj[p] = ""));
      setTemplateParams(paramsObj);
    }
  };

  const handleTemplateParamChange = (param: string, value: string) => {
    setTemplateParams((prev) => ({ ...prev, [param]: value }));
  };

  const handleSendTemplate = async () => {
    if (!selectedTemplate) return;
    const template = templates.find((t) => t.name === selectedTemplate);
    if (!template) return;
    setIsSendingTemplate(true);
    try {
      const payload = {
        customer_id: conversation.customer_id,
        platform: "whatsapp", // or dynamic
        message: {
          message_type: "template",
          template_id: selectedTemplate,
          template_variables: templateParams,
        },
      };
      const result = await startOrContinueConversation(payload);
      if (result && (result as any).data) {
        setMessages((prev) => [...prev, (result as any).data]);
        toast({ title: "Template sent", description: "Template message sent successfully." });
        setTemplateModalOpen(false);
      } else {
        toast({ title: "Error", description: "Failed to send template message.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to send template message.", variant: "destructive" });
    } finally {
      setIsSendingTemplate(false);
    }
  };

  // Send typing events
  useEffect(() => {
    if (!conversation) return;
    let typingTimeout: NodeJS.Timeout | null = null;
    if (isTyping) {
      socketService.sendTyping(conversation.id, true);
      // Stop typing after 2s of inactivity
      typingTimeout = setTimeout(() => {
        setIsTyping(false);
        socketService.sendTyping(conversation.id, false);
      }, 2000);
    } else {
      socketService.sendTyping(conversation.id, false);
    }
    return () => {
      if (typingTimeout) clearTimeout(typingTimeout);
    };
  }, [isTyping, conversation, socketService]);

  // Listen for typing events from others
  useEffect(() => {
    if (!conversation) return;
    const handleTyping = (data: { conversationId: string; userId: string; isTyping: boolean }) => {
      // Only show if it's this conversation and not the current user
      if (data.conversationId === conversation.id && data.isTyping) {
        setOtherTyping(true);
        // Hide after 2s
        setTimeout(() => setOtherTyping(false), 2000);
      }
    };
    socketService.onTyping(handleTyping);
    return () => {
      socketService.off("typing");
    };
  }, [conversation, socketService]);

  // Handle file selection and preview
  const handleAttachmentSelect = (file: File, type: "image" | "video" | "audio" | "document") => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setAttachment({
        file,
        type,
        previewUrl: e.target?.result as string,
        progress: 0,
        error: null,
      });
    };
    if (type === "image" || type === "video") {
      reader.readAsDataURL(file);
    } else {
      setAttachment({ file, type, previewUrl: null, progress: 0, error: null });
    }
  };

  // Remove/cancel attachment
  const removeAttachment = () => {
    setAttachment({ file: null, type: null, previewUrl: null, progress: 0, error: null });
  };

  // Enhanced file upload with progress and error
  const handleFileUpload = async (file: File) => {
    if (!file || isSending) return;
    const type = file.type.startsWith("image/")
      ? "image"
      : file.type.startsWith("video/")
      ? "video"
      : file.type.startsWith("audio/")
      ? "audio"
      : "document";
    handleAttachmentSelect(file, type);
  };

  // Send message or attachment
  const handleSendMessage = async () => {
    if (attachment.file) {
      setIsSending(true);
      setAttachment((a) => ({ ...a, progress: 10, error: null }));
      if (onSent) onSent(); // Clear reply bar immediately
      try {
        const tempId = `temp-${Date.now()}`;
        const optimisticMessage: Message = {
          id: tempId,
          conversation_id: conversation.id,
          message: message || "[Attachment]",
          sender: "agent",
          status: "pending",
          direction: "outbound",
          type: attachment.type || "document",
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, optimisticMessage]);
        const payload: any = {
          customer_id: conversation.customer_id,
          platform: "whatsapp",
          message: {
            message_type: attachment.type,
            media_file: attachment.file,
            caption: message || undefined,
            ...(replyTo ? { reply_to_message_id: replyTo.id } : {}),
          },
        };
        const result = await startOrContinueConversation(payload);
        if (result && (result as any).data) {
          const backendMsg = (result as any).data;
          const mappedMsg = {
            ...backendMsg,
            message: backendMsg.content || backendMsg.message || "",
          };
          setMessages((prev) => {
            const idx = prev.findIndex((msg) => msg.id === tempId);
            if (idx !== -1) {
              return [
                ...prev.slice(0, idx),
                mappedMsg,
                ...prev.slice(idx + 1),
              ];
            } else {
              return [...prev, mappedMsg];
            }
          });
          setAttachment({ file: null, type: null, previewUrl: null, progress: 0, error: null });
        } else {
          setAttachment((a) => ({ ...a, error: "Upload failed" }));
        }
      } catch (error: any) {
        setAttachment((a) => ({ ...a, error: error?.message || "Upload failed" }));
        setMessages((prev) => prev.filter((msg) => !msg.id.startsWith("temp-")));
      } finally {
        setIsSending(false);
      }
      return;
    }
    if (!message.trim() || isSending) return;

    setIsSending(true);
    const messageText = message.trim();
    setMessage("");
    if (onSent) onSent(); // Clear reply bar immediately

    try {
      // Create optimistic message with a temp ID
      const tempId = `temp-${Date.now()}`;
      const optimisticMessage: Message = {
        id: tempId,
        conversation_id: conversation.id,
        message: messageText,
        sender: "agent",
        status: "pending",
        direction: "outbound",
        type: "text",
        created_at: new Date().toISOString(),
        ...(replyTo ? { replyTo: { id: replyTo.id, text: replyTo.message } } : {}),
      };

      setMessages((prev) => [...prev, optimisticMessage]);

      // Send message to API
      const payload = {
        customer_id: conversation.customer_id,
        platform: "whatsapp",
        message: {
          message_type: "text",
          content: messageText,
          ...(replyTo ? { reply_to_message_id: replyTo.id } : {}),
        },
      };
      const result = await startOrContinueConversation(payload);
      if (result && (result as any).data) {
        const backendMsg = (result as any).data;
        const mappedMsg = {
          ...backendMsg,
          message: backendMsg.content || backendMsg.message || "",
        };
        setMessages((prev) => {
          const idx = prev.findIndex((msg) => msg.id === tempId);
          if (idx !== -1) {
            return [
              ...prev.slice(0, idx),
              mappedMsg,
              ...prev.slice(idx + 1),
            ];
          } else {
            return [...prev, mappedMsg];
          }
        });
      }
    } catch (error) {
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((msg) => !msg.id.startsWith("temp-")));
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleEmojiSelect = (emojiData: any) => {
    setMessage((prev) => prev + emojiData.emoji);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    setIsTyping(true);
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  return (
    <div className="border-t border-gray-200 shadow-sm p-4 bg-white">
      {/* Template Message Modal */}
      <Dialog open={templateModalOpen} onOpenChange={setTemplateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Template Message</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={selectedTemplate} onValueChange={handleSelectTemplate}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.name} value={t.name}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTemplate && (
              <div className="space-y-2">
                {templates
                  .find((t) => t.name === selectedTemplate)
                  ?.params.map((param) => (
                    <Input
                      key={param}
                      placeholder={param.replace(/_/g, " ")}
                      value={templateParams[param] || ""}
                      onChange={(e) => handleTemplateParamChange(param, e.target.value)}
                    />
                  ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={handleSendTemplate}
              disabled={!selectedTemplate || isSendingTemplate}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSendingTemplate ? "Sending..." : "Send Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {attachment.file && (
        <div className="mb-2">
          <AttachmentPreview attachment={attachment} removeAttachment={removeAttachment} />
          {attachment.progress > 0 && attachment.progress < 100 && (
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${attachment.progress}%` }}
              />
            </div>
          )}
          {attachment.error && (
            <div className="text-xs text-red-500 mt-1">{attachment.error}</div>
          )}
        </div>
      )}
      <div className="flex items-end space-x-2">
        {/* File upload button */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="p-2">
              <Paperclip className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2">
            <div className="space-y-2">
              <label className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded cursor-pointer">
                <Image className="h-4 w-4" />
                <span className="text-sm">Image</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />
              </label>
              <label className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded cursor-pointer">
                <Video className="h-4 w-4" />
                <span className="text-sm">Video</span>
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />
              </label>
              <label className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded cursor-pointer">
                <File className="h-4 w-4" />
                <span className="text-sm">Document</span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />
              </label>
            </div>
          </PopoverContent>
        </Popover>

        {/* Emoji picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="p-2">
              <Smile className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <EmojiPicker onEmojiClick={handleEmojiSelect} />
          </PopoverContent>
        </Popover>

        {/* Message input */}
        <div className="flex-1">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="min-h-[40px] max-h-[120px] resize-none"
            rows={1}
          />
        </div>

        {/* Send button */}
        <Button
          onClick={handleSendMessage}
          disabled={!message.trim() || isSending}
          size="sm"
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Send className="h-4 w-4" />
        </Button>
        {/* Template message button */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleOpenTemplateModal}
          className="ml-2"
        >
          Send Template
        </Button>
      </div>

      {/* Typing indicator */}
      {otherTyping && (
        <div className="text-xs text-gray-500 mt-2">
          {conversation.customer_name} is typing...
        </div>
      )}
    </div>
  );
} 