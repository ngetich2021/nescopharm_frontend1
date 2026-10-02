// Mock chat data for development when API is down
export const mockConversations = [
  {
    id: "conv_1",
    customer_id: "cust_1",
    customer_name: "John Doe",
    customer_email: "john@example.com",
    customer_phone: "254727105158",
    whatsapp_id: "254727105158",
    platform_user_id: "254727105158",
    last_message: "Thank you for your help!",
    last_message_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
    unread_count: 2,
    status: "active",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
    updated_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: "conv_2",
    customer_id: "cust_2",
    customer_name: "Jane Smith",
    customer_email: "jane@example.com",
    customer_phone: "254712345678",
    whatsapp_id: "254712345678",
    platform_user_id: "254712345678",
    last_message: "When will my order arrive?",
    last_message_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    unread_count: 0,
    status: "active",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), // 2 days ago
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: "conv_3",
    customer_id: "cust_3",
    customer_name: "Mike Johnson",
    customer_email: "mike@example.com",
    customer_phone: "254798765432",
    whatsapp_id: "254798765432",
    platform_user_id: "254798765432",
    last_message: "Great service, highly recommend!",
    last_message_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
    unread_count: 1,
    status: "pending",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(), // 3 days ago
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
];

export const mockMessages = {
  conv_1: [
    {
      id: "msg_1",
      conversation_id: "conv_1",
      message: "Hi, I need help with my order",
      sender: "customer" as const,
      status: "read" as const,
      direction: "inbound" as const,
      type: "text" as const,
      created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1 hour ago
    },
    {
      id: "msg_2",
      conversation_id: "conv_1",
      message: "Hi! I'd be happy to help you with your order. Can you please provide your order number?",
      sender: "agent" as const,
      status: "read" as const,
      direction: "outbound" as const,
      type: "text" as const,
      created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45 minutes ago
    },
    {
      id: "msg_3",
      conversation_id: "conv_1",
      message: "Sure, it's ORD-12345",
      sender: "customer" as const,
      status: "read" as const,
      direction: "inbound" as const,
      type: "text" as const,
      created_at: new Date(Date.now() - 1000 * 60 * 40).toISOString(), // 40 minutes ago
    },
    {
      id: "msg_4",
      conversation_id: "conv_1",
      message: "Thank you for your help!",
      sender: "customer" as const,
      status: "delivered" as const,
      direction: "inbound" as const,
      type: "text" as const,
      created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
    },
  ],
  conv_2: [
    {
      id: "msg_5",
      conversation_id: "conv_2",
      message: "When will my order arrive?",
      sender: "customer" as const,
      status: "read" as const,
      direction: "inbound" as const,
      type: "text" as const,
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    },
  ],
  conv_3: [
    {
      id: "msg_6",
      conversation_id: "conv_3",
      message: "Great service, highly recommend!",
      sender: "customer" as const,
      status: "read" as const,
      direction: "inbound" as const,
      type: "text" as const,
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
    },
  ],
};

export const mockCustomerOptions = [
  { id: "cust_1", name: "John Doe", phone: "254727105158", email: "john@example.com" },
  { id: "cust_2", name: "Jane Smith", phone: "254712345678", email: "jane@example.com" },
  { id: "cust_3", name: "Mike Johnson", phone: "254798765432", email: "mike@example.com" },
  { id: "cust_4", name: "Sarah Wilson", phone: "254711111111", email: "sarah@example.com" },
  { id: "cust_5", name: "David Brown", phone: "254722222222", email: "david@example.com" },
];
