import { useEffect, useState, useCallback } from 'react';
import Pusher from 'pusher-js';

interface Message {
  id: string;
  content: string;
  direction: 'inbound' | 'outbound';
  sender_type: 'customer' | 'agent';
  sender_name?: string;
  message_type: 'text' | 'image' | 'audio' | 'video' | 'document';
  created_at: string;
  platform_message_id?: string;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  delivered_at?: string;
  read_at?: string;
}

interface Conversation {
  id: string;
  customer_id?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  whatsapp_id?: string;
  last_message?: string;
  last_message_at?: string;
  last_customer_message_at?: string;
  unread_count: number;
  status: string;
  created_at: string;
  updated_at: string;
  latest_message?: Message;
}

interface MessageReceivedEvent {
  message: Message;
  conversation_id: string;
  conversation: {
    id: string;
    last_message_at: string;
    last_customer_message_at: string;
    unread_count: number;
    status: string;
  };
}

interface MessageSentEvent {
  message: Message;
  conversation_id: string;
  conversation: {
    id: string;
    last_message_at: string;
  };
}

interface ConversationUpdatedEvent {
  conversation: Partial<Conversation>;
}

interface MessageStatusUpdatedEvent {
  message_id: string;
  new_status: string;
  delivered_at?: string;
  read_at?: string;
}

export const useRealTimeChat = (companyId?: string, conversationId?: string) => {
  const [pusher, setPusher] = useState<Pusher | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [isConnected, setIsConnected] = useState(false);

  // Initialize Pusher (enhance current setup)
  useEffect(() => {
    if (!companyId) return;

    const pusherInstance = new Pusher(process.env.NEXT_PUBLIC_PUSHER_APP_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_APP_CLUSTER!,
      forceTLS: true,
      authEndpoint: `${process.env.NEXT_PUBLIC_API_URL}/broadcasting/auth`,
      auth: {
        headers: {
          // Use your actual token storage key
          Authorization: `Bearer ${localStorage.getItem('sanctum_token')}`,
        },
      },
    });

    setPusher(pusherInstance);

    // Connection status monitoring
    pusherInstance.connection.bind('connected', () => {
      console.log('✅ Real-time connected');
      setIsConnected(true);
    });

    pusherInstance.connection.bind('disconnected', () => {
      console.log('❌ Real-time disconnected');
      setIsConnected(false);
    });

    pusherInstance.connection.bind('error', (error: any) => {
      console.error('❌ Pusher connection error:', error);
      setIsConnected(false);
    });

    return () => {
      pusherInstance.disconnect();
    };
  }, [companyId]);

  // Subscribe to company-wide channel for customer messages
  useEffect(() => {
    if (!pusher || !companyId) return;

    // Use exact channel name from backend
    const channelName = `private-company.${companyId}.conversations`;
    console.log('🔗 Subscribing to:', channelName);
    
    const channel = pusher.subscribe(channelName);

    // Handle subscription success
    channel.bind('pusher:subscription_succeeded', () => {
      console.log('✅ Successfully subscribed to company channel');
    });

    // Handle subscription error
    channel.bind('pusher:subscription_error', (error: any) => {
      console.error('❌ Subscription error:', error);
    });

    // 🎯 KEY EVENT: Customer message received
    channel.bind('message.received', (data: MessageReceivedEvent) => {
      console.log('📨 Customer message received:', data);
      
      const { message, conversation_id, conversation } = data;

      // Update conversations list
      setConversations(prev => {
        const existingIndex = prev.findIndex(conv => conv.id === conversation_id);
        
        if (existingIndex >= 0) {
          // Update existing conversation
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            last_message_at: conversation.last_message_at,
            last_customer_message_at: conversation.last_customer_message_at,
            unread_count: conversation.unread_count,
            latest_message: message,
            last_message: message.content
          };
          
          // Move to top of list
          const [updatedConv] = updated.splice(existingIndex, 1);
          return [updatedConv, ...updated];
        } else {
          // New conversation - fetch full details
          fetchConversationDetails(conversation_id);
          return prev;
        }
      });

      // Update unread counts
      setUnreadCounts(prev => ({
        ...prev,
        [conversation_id]: conversation.unread_count
      }));

      // If viewing this conversation, add message to chat
      if (conversationId === conversation_id) {
        setMessages(prev => {
          // Prevent duplicates
          if (prev.find(msg => msg.id === message.id)) {
            return prev;
          }
          return [...prev, message];
        });
        
        // Clear unread count for current conversation
        setUnreadCounts(prev => ({
          ...prev,
          [conversation_id]: 0
        }));
      } else {
        // Show notification for messages in other conversations
        showNotification(message);
      }
    });

    // Agent message sent by other agents
    channel.bind('message.sent', (data: MessageSentEvent) => {
      console.log('📤 Agent message from another agent:', data);
      
      const { message, conversation_id, conversation } = data;

      // Update conversations list
      setConversations(prev => {
        const existingIndex = prev.findIndex(conv => conv.id === conversation_id);
        
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            last_message_at: conversation.last_message_at,
            latest_message: message,
            last_message: message.content
          };
          
          // Move to top if not current conversation
          if (conversationId !== conversation_id) {
            const [updatedConv] = updated.splice(existingIndex, 1);
            return [updatedConv, ...updated];
          }
          
          return updated;
        }
        return prev;
      });

      // Add to messages if viewing this conversation
      if (conversationId === conversation_id) {
        setMessages(prev => {
          if (prev.find(msg => msg.id === message.id)) {
            return prev;
          }
          return [...prev, message];
        });
      }
    });

    // Conversation updates (status changes, assignments)
    channel.bind('conversation.updated', (data: ConversationUpdatedEvent) => {
      console.log('🔄 Conversation updated:', data);
      
      setConversations(prev => prev.map(conv => 
        conv.id === data.conversation.id 
          ? { ...conv, ...data.conversation }
          : conv
      ));
    });

    return () => {
      console.log('🔌 Unsubscribing from company channel');
      pusher.unsubscribe(channelName);
    };
  }, [pusher, companyId, conversationId]);

  // Subscribe to conversation-specific channel for message status updates
  useEffect(() => {
    if (!pusher || !conversationId) return;

    const channelName = `private-conversation.${conversationId}`;
    console.log('🔗 Subscribing to conversation channel:', channelName);
    
    const channel = pusher.subscribe(channelName);

    // Message status updates (sent, delivered, read)
    channel.bind('message.status.updated', (data: MessageStatusUpdatedEvent) => {
      console.log('📊 Message status updated:', data);
      
      setMessages(prev => prev.map(msg => 
        msg.id === data.message_id 
          ? {
              ...msg,
              status: data.new_status as any,
              delivered_at: data.delivered_at,
              read_at: data.read_at
            }
          : msg
      ));
    });

    return () => {
      pusher.unsubscribe(channelName);
    };
  }, [pusher, conversationId]);

  // Fetch conversation details for new conversations
  const fetchConversationDetails = useCallback(async (convId: string) => {
    try {
      const token = localStorage.getItem('sanctum_token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chat/conversations/${convId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success') {
          setConversations(prev => {
            const exists = prev.find(conv => conv.id === convId);
            if (!exists) {
              return [data.conversation, ...prev];
            }
            return prev;
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch conversation details:', error);
    }
  }, []);

  // Show notification for new messages
  const showNotification = useCallback((message: Message) => {
    // Browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`New message from ${message.sender_name || 'Customer'}`, {
        body: message.content,
        icon: '/favicon.ico',
        tag: `message-${message.id}`,
        requireInteraction: false,
      });
    }
    
    // Sound notification
    try {
      const audio = new Audio('/notification.mp3');
      audio.volume = 0.5; // 50% volume
      audio.play().catch(e => console.log('Could not play notification sound'));
    } catch (e) {
      // Ignore audio errors
    }
  }, []);

  // Request notification permission
  const requestNotificationPermission = useCallback(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log('Notification permission:', permission);
      });
    }
  }, []);

  // Helper functions for message management
  const addMessage = useCallback((message: Message) => {
    setMessages(prev => [...prev, message]);
  }, []);

  const removeMessage = useCallback((messageId: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== messageId));
  }, []);

  const updateMessageStatus = useCallback((messageId: string, status: string) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, status: status as any } : msg
    ));
  }, []);

  return {
    // Data
    messages,
    conversations,
    unreadCounts,
    isConnected,
    
    // Actions
    setMessages,
    setConversations,
    addMessage,
    removeMessage,
    updateMessageStatus,
    requestNotificationPermission,
  };
};
