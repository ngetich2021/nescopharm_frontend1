import { useEffect, useState, useCallback } from 'react';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

// Initialize Echo instance
let echo = null;

const initializeEcho = () => {
  if (!echo) {
    window.Pusher = Pusher;
    
    echo = new Echo({
      broadcaster: 'pusher',
      key: process.env.NEXT_PUBLIC_PUSHER_APP_KEY,
      cluster: process.env.NEXT_PUBLIC_PUSHER_APP_CLUSTER,
      forceTLS: true,
      auth: {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
      },
    });
  }
  return echo;
};

/**
 * React Hook for Real-Time Customer Messages
 * 
 * Usage:
 * const { messages, conversations, addMessage, isConnected } = useRealTimeMessages(companyId, conversationId);
 */
export const useRealTimeMessages = (companyId, conversationId = null) => {
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [isConnected, setIsConnected] = useState(false);

  // Initialize Echo
  useEffect(() => {
    if (companyId) {
      initializeEcho();
    }
  }, [companyId]);

  // Listen for company-wide updates (customer messages)
  useEffect(() => {
    if (!companyId || !echo) return;

    console.log('🔗 Connecting to company channel for real-time updates...');
    
    const channel = echo.private(`company.${companyId}.conversations`);

    // Connection events
    channel.subscribed(() => {
      console.log('✅ Connected to real-time updates');
      setIsConnected(true);
    });

    channel.error((error) => {
      console.error('❌ Real-time connection error:', error);
      setIsConnected(false);
    });

    // 🎯 CUSTOMER MESSAGE RECEIVED - Main event for real-time updates
    channel.listen('.message.received', (event) => {
      console.log('📨 New customer message received:', event);
      
      const { message, conversation_id, conversation } = event;

      // Update conversation list with new message info
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
            latest_message: message
          };
          
          // Move to top of list
          const [updatedConv] = updated.splice(existingIndex, 1);
          return [updatedConv, ...updated];
        } else {
          // New conversation - might need to fetch full details
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
          // Avoid duplicates
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
    channel.listen('.message.sent', (event) => {
      console.log('📤 Agent message from another agent:', event);
      
      const { message, conversation_id, conversation } = event;

      // Update conversation list
      setConversations(prev => {
        const existingIndex = prev.findIndex(conv => conv.id === conversation_id);
        
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            last_message_at: conversation.last_message_at,
            latest_message: message
          };
          
          // Move to top if it's not the current conversation
          if (conversationId !== conversation_id) {
            const [updatedConv] = updated.splice(existingIndex, 1);
            return [updatedConv, ...updated];
          }
          
          return updated;
        }
        return prev;
      });

      // If viewing this conversation, add message to chat
      if (conversationId === conversation_id) {
        setMessages(prev => {
          if (prev.find(msg => msg.id === message.id)) {
            return prev;
          }
          return [...prev, message];
        });
      }
    });

    // Conversation updates (status, assignment changes)
    channel.listen('.conversation.updated', (event) => {
      console.log('🔄 Conversation updated:', event);
      
      setConversations(prev => prev.map(conv => 
        conv.id === event.conversation.id 
          ? { ...conv, ...event.conversation }
          : conv
      ));
    });

    return () => {
      console.log('🔌 Disconnecting from real-time updates');
      echo.leave(`company.${companyId}.conversations`);
      setIsConnected(false);
    };
  }, [companyId, conversationId]);

  // Listen for message status updates in current conversation
  useEffect(() => {
    if (!conversationId || !echo) return;

    console.log('🔗 Listening for message status updates...');
    
    const channel = echo.private(`conversation.${conversationId}`);

    // Message status updates (sent, delivered, read)
    channel.listen('.message.status.updated', (event) => {
      console.log('📊 Message status updated:', event);
      
      setMessages(prev => prev.map(msg => 
        msg.id === event.message_id 
          ? {
              ...msg,
              status: event.new_status,
              delivered_at: event.delivered_at,
              read_at: event.read_at
            }
          : msg
      ));
    });

    return () => {
      echo.leave(`conversation.${conversationId}`);
    };
  }, [conversationId]);

  // Fetch conversation details for new conversations
  const fetchConversationDetails = useCallback(async (convId) => {
    try {
      const token = localStorage.getItem('auth_token');
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
  const showNotification = useCallback((message) => {
    // Browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`New message from ${message.sender_name || 'Customer'}`, {
        body: message.content,
        icon: '/favicon.ico',
        tag: `message-${message.id}`,
      });
    }
    
    // Play notification sound
    try {
      const audio = new Audio('/notification.mp3');
      audio.play().catch(e => console.log('Could not play notification sound'));
    } catch (e) {
      // Ignore audio errors
    }
  }, []);

  // Request notification permission
  const requestNotificationPermission = useCallback(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Manually add message (for optimistic updates)
  const addMessage = useCallback((message) => {
    setMessages(prev => [...prev, message]);
  }, []);

  // Remove message (for failed sends)
  const removeMessage = useCallback((messageId) => {
    setMessages(prev => prev.filter(msg => msg.id !== messageId));
  }, []);

  // Update message status
  const updateMessageStatus = useCallback((messageId, status) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, status } : msg
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
