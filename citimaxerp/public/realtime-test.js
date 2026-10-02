// Real-Time Chat Test Console Commands
// Open your browser console and run these commands to test real-time functionality

console.log('🧪 Real-Time Chat Test Suite');

// Test 1: Check if Pusher is connected
const testPusherConnection = () => {
  console.log('📡 Testing Pusher Connection...');
  
  // Check if window.Pusher exists
  if (typeof window.Pusher !== 'undefined') {
    console.log('✅ Pusher library loaded');
  } else {
    console.log('❌ Pusher library not found');
    return;
  }
  
  // Check connection status in React DevTools or component state
  console.log('💡 Check the chat interface for connection status indicator');
  console.log('   - Look for "Live" (green) or "Offline" (red) status');
  console.log('   - Check browser console for "Real-time connected" message');
};

// Test 2: Check environment variables
const testEnvironment = () => {
  console.log('🔧 Testing Environment Configuration...');
  
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const pusherKey = process.env.NEXT_PUBLIC_PUSHER_APP_KEY;
  const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_APP_CLUSTER;
  
  console.log('Environment Variables:');
  console.log('  API URL:', apiUrl);
  console.log('  Pusher Key:', pusherKey ? '✅ Set' : '❌ Missing');
  console.log('  Pusher Cluster:', pusherCluster ? '✅ Set' : '❌ Missing');
  
  if (!apiUrl || !pusherKey || !pusherCluster) {
    console.error('❌ Missing required environment variables');
    return false;
  }
  
  console.log('✅ Environment configuration looks good');
  return true;
};

// Test 3: Check for WebSocket connection
const testWebSocketConnection = () => {
  console.log('🌐 Testing WebSocket Connection...');
  
  // Check for active WebSocket connections
  const websockets = performance.getEntriesByType('navigation')
    .concat(performance.getEntriesByType('resource'))
    .filter(entry => entry.name.includes('ws://') || entry.name.includes('wss://'));
    
  console.log('WebSocket connections found:', websockets.length);
  
  // Check Network tab for WebSocket connections
  console.log('💡 Manual check: Open DevTools > Network tab > WS filter');
  console.log('   - Look for active Pusher WebSocket connections');
  console.log('   - Status should show "101 Switching Protocols"');
};

// Test 4: Simulate real-time message (client-side)
const simulateRealtimeMessage = () => {
  console.log('📨 Simulating Real-Time Message...');
  
  // Create a test message object
  const testMessage = {
    id: `test_${Date.now()}`,
    content: `🧪 Test message at ${new Date().toLocaleTimeString()}`,
    direction: 'inbound',
    sender_type: 'customer',
    sender_name: 'Test Customer',
    message_type: 'text',
    created_at: new Date().toISOString(),
    platform_message_id: `wamid.test_${Date.now()}`
  };
  
  const testConversation = {
    id: 'test_conversation',
    last_message_at: new Date().toISOString(),
    last_customer_message_at: new Date().toISOString(),
    unread_count: 1,
    status: 'active'
  };
  
  console.log('Test message structure:', testMessage);
  console.log('💡 This simulates the structure your backend should broadcast');
  
  // Check if notification permission is granted
  if ('Notification' in window) {
    console.log('🔔 Notification permission:', Notification.permission);
    if (Notification.permission === 'granted') {
      new Notification('🧪 Test Notification', {
        body: 'Real-time messaging test notification',
        icon: '/favicon.ico'
      });
    }
  }
};

// Test 5: Check local storage for auth token
const testAuthentication = () => {
  console.log('🔐 Testing Authentication...');
  
  const token = localStorage.getItem('sanctum_token');
  console.log('Auth token:', token ? '✅ Found' : '❌ Missing');
  
  if (token) {
    console.log('Token length:', token.length);
    console.log('Token preview:', token.substring(0, 20) + '...');
  } else {
    console.warn('❌ No auth token found. Real-time authentication may fail.');
  }
};

// Run all tests
const runAllTests = () => {
  console.log('🚀 Running Complete Real-Time Test Suite...\n');
  
  testEnvironment();
  console.log('\n');
  
  testAuthentication();
  console.log('\n');
  
  testPusherConnection();
  console.log('\n');
  
  testWebSocketConnection();
  console.log('\n');
  
  simulateRealtimeMessage();
  console.log('\n');
  
  console.log('🎯 Manual Tests to Perform:');
  console.log('1. Open chat interface and check connection status indicator');
  console.log('2. Open multiple browser tabs with chat interface');
  console.log('3. Send a message in one tab, verify it appears in other tabs');
  console.log('4. Check browser notifications work');
  console.log('5. Check console for real-time event logs');
  console.log('\n✅ Test suite complete!');
};

// Auto-run tests
runAllTests();

// Export functions for manual testing
window.realtimeTests = {
  testEnvironment,
  testAuthentication,
  testPusherConnection,
  testWebSocketConnection,
  simulateRealtimeMessage,
  runAllTests
};
