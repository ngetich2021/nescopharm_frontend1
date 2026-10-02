import Pusher from "pusher-js";

const PUSHER_KEY = process.env.NEXT_PUBLIC_PUSHER_APP_KEY || "your-pusher-key";
const PUSHER_CLUSTER = process.env.NEXT_PUBLIC_PUSHER_APP_CLUSTER || "mt1";
const PUSHER_HOST = process.env.NEXT_PUBLIC_PUSHER_HOST;
const PUSHER_PORT = process.env.NEXT_PUBLIC_PUSHER_PORT;
const PUSHER_SCHEME = process.env.NEXT_PUBLIC_PUSHER_SCHEME || "https";

// Configure Pusher
const pusherConfig: any = {
  cluster: PUSHER_CLUSTER,
  encrypted: true,
};

// Add custom host if provided (for local development)
if (PUSHER_HOST) {
  pusherConfig.host = PUSHER_HOST;
  pusherConfig.port = PUSHER_PORT || 443;
  pusherConfig.scheme = PUSHER_SCHEME;
}

export class SocketService {
  private pusher: Pusher | null = null;
  private channels: Map<string, any> = new Map();
  private static instance: SocketService;

  static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  connect(token?: string): void {
    if (this.pusher) return;

    this.pusher = new Pusher(PUSHER_KEY, {
      ...pusherConfig,
      auth: {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    });

    this.pusher.connection.bind("connected", () => {
      console.log("Connected to Pusher");
    });

    this.pusher.connection.bind("disconnected", () => {
      console.log("Disconnected from Pusher");
    });
  }

  disconnect(): void {
    if (this.pusher) {
      this.pusher.disconnect();
      this.pusher = null;
      this.channels.clear();
    }
  }

  // Subscribe to a private channel for conversation updates
  joinConversation(conversationId: string): void {
    if (!this.pusher) return;

    const channelName = `private-conversation.${conversationId}`;
    const channel = this.pusher.subscribe(channelName);
    this.channels.set(conversationId, channel);
  }

  leaveConversation(conversationId: string): void {
    const channel = this.channels.get(conversationId);
    if (channel) {
      this.pusher?.unsubscribe(`private-conversation.${conversationId}`);
      this.channels.delete(conversationId);
    }
  }

  // Listen for new messages
  onNewMessage(callback: (message: any) => void): void {
    this.channels.forEach((channel, conversationId) => {
      channel.bind("new-message", callback);
    });
  }

  // Listen for message status updates
  onMessageStatusUpdate(callback: (update: { messageId: string; status: string }) => void): void {
    this.channels.forEach((channel, conversationId) => {
      channel.bind("message-status-update", callback);
    });
  }

  // Listen for conversation updates
  onConversationUpdate(callback: (conversation: any) => void): void {
    this.channels.forEach((channel, conversationId) => {
      channel.bind("conversation-update", callback);
    });
  }

  // Listen for typing indicators
  onTyping(callback: (data: { conversationId: string; userId: string; isTyping: boolean }) => void): void {
    this.channels.forEach((channel, conversationId) => {
      channel.bind("typing", callback);
    });
  }

  // Send typing indicator
  sendTyping(conversationId: string, isTyping: boolean): void {
    const channel = this.channels.get(conversationId);
    if (channel) {
      channel.trigger("client-typing", { isTyping });
    }
  }

  // Listen for presence updates
  onPresence(callback: (presence: Record<string, any>) => void): void {
    if (!this.pusher) return;

    const presenceChannel = this.pusher.subscribe("presence-chat");
    presenceChannel.bind("pusher:subscription_succeeded", (members: any) => {
      callback(members);
    });

    presenceChannel.bind("pusher:member_added", (member: any) => {
      callback({ [member.id]: member.info });
    });

    presenceChannel.bind("pusher:member_removed", (member: any) => {
      callback({ [member.id]: null });
    });
  }

  getPresence(): void {
    // Presence is handled automatically by Pusher
    console.log("Getting presence...");
  }

  // Remove event listeners
  off(event: string): void {
    this.channels.forEach((channel, conversationId) => {
      channel.unbind(event);
    });
  }
}

// Legacy Socket.IO implementation (commented out for reference)
/*
import { io, Socket } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "ws://localhost:8000";

export class SocketService {
  private socket: Socket | null = null;
  private static instance: SocketService;

  static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  connect(token?: string): void {
    if (this.socket) return;
    this.socket = io(SOCKET_URL, {
      auth: token ? { token } : undefined,
      transports: ["websocket"],
    });
    this.socket.on("connect", () => {
      // Optionally: console.log("Connected to chat server");
    });
    this.socket.on("disconnect", () => {
      // Optionally: console.log("Disconnected from chat server");
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  onNewMessage(callback: (message: any) => void): void {
    this.socket?.on("new_message", callback);
  }

  onMessageStatusUpdate(callback: (update: { messageId: string; status: string }) => void): void {
    this.socket?.on("message_status_update", callback);
  }

  onConversationUpdate(callback: (conversation: any) => void): void {
    this.socket?.on("conversation_update", callback);
  }

  joinConversation(conversationId: string): void {
    this.socket?.emit("join_conversation", conversationId);
  }

  leaveConversation(conversationId: string): void {
    this.socket?.emit("leave_conversation", conversationId);
  }

  onTyping(callback: (data: { conversationId: string; userId: string; isTyping: boolean }) => void): void {
    this.socket?.on("typing", callback);
  }

  sendTyping(conversationId: string, isTyping: boolean): void {
    this.socket?.emit("typing", { conversationId, isTyping });
  }

  onPresence(callback: (presence: Record<string, any>) => void): void {
    this.socket?.on("presence", callback);
  }

  getPresence(): void {
    this.socket?.emit("get_presence");
  }

  off(event: string): void {
    this.socket?.off(event);
  }
}
*/ 