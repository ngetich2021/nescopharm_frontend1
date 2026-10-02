import React, { useState, useEffect } from 'react';
import { useRealTimeMessages } from '../hooks/useRealTimeMessages';

/**
 * Real-Time Connection Test Component
 * Use this component to test your real-time connection and see incoming messages
 */
const RealTimeTest = ({ companyId }) => {
  const [logs, setLogs] = useState([]);
  
  const { 
    messages, 
    conversations, 
    unreadCounts, 
    isConnected,
    requestNotificationPermission 
  } = useRealTimeMessages(companyId);

  // Add log entry
  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, message, type }]);
  };

  // Monitor connection status
  useEffect(() => {
    if (isConnected) {
      addLog('✅ Connected to real-time updates', 'success');
    } else {
      addLog('❌ Disconnected from real-time updates', 'error');
    }
  }, [isConnected]);

  // Monitor new messages
  useEffect(() => {
    if (messages.length > 0) {
      const latestMessage = messages[messages.length - 1];
      if (latestMessage.direction === 'inbound') {
        addLog(`📨 Customer message received: "${latestMessage.content}"`, 'message');
      }
    }
  }, [messages]);

  // Monitor conversation updates
  useEffect(() => {
    addLog(`💬 ${conversations.length} conversations loaded`, 'info');
  }, [conversations]);

  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission();
  }, [requestNotificationPermission]);

  const testWebhook = async () => {
    addLog('🧪 Testing webhook simulation...', 'info');
    
    try {
      const response = await fetch('http://localhost:8000/api/webhooks/meta/whatsapp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          object: "whatsapp_business_account",
          entry: [{
            changes: [{
              value: {
                metadata: { phone_number_id: "test_phone_number_id" },
                messages: [{
                  id: `wamid.test${Date.now()}`,
                  from: "1234567890",
                  text: { body: `Test message from customer - ${new Date().toLocaleTimeString()}` },
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  type: "text"
                }]
              }
            }]
          }]
        })
      });

      if (response.ok) {
        addLog('✅ Webhook test sent successfully', 'success');
      } else {
        addLog(`❌ Webhook test failed: ${response.status}`, 'error');
      }
    } catch (error) {
      addLog(`❌ Webhook test error: ${error.message}`, 'error');
    }
  };

  const clearLogs = () => setLogs([]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Real-Time Connection Test</h2>
        
        {/* Connection Status */}
        <div className="mb-6 p-4 rounded-lg border">
          <div className="flex items-center space-x-3">
            <div className={`w-4 h-4 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="font-medium">
              Connection Status: {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div className="mt-2 text-sm text-gray-600">
            Company ID: {companyId || 'Not set'}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{conversations.length}</div>
            <div className="text-sm text-blue-800">Conversations</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{messages.length}</div>
            <div className="text-sm text-green-800">Messages in Current Chat</div>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">
              {Object.values(unreadCounts).reduce((a, b) => a + b, 0)}
            </div>
            <div className="text-sm text-orange-800">Unread Messages</div>
          </div>
        </div>

        {/* Test Button */}
        <div className="mb-6">
          <button
            onClick={testWebhook}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 mr-3"
          >
            🧪 Test Webhook Simulation
          </button>
          <button
            onClick={clearLogs}
            className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
          >
            🗑️ Clear Logs
          </button>
        </div>

        {/* Activity Logs */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-medium mb-3">Activity Logs</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {logs.length === 0 ? (
              <div className="text-gray-500 text-sm">No activity yet...</div>
            ) : (
              logs.map((log, index) => (
                <div
                  key={index}
                  className={`text-sm p-2 rounded ${
                    log.type === 'success' ? 'bg-green-100 text-green-800' :
                    log.type === 'error' ? 'bg-red-100 text-red-800' :
                    log.type === 'message' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}
                >
                  <span className="font-mono text-xs">{log.timestamp}</span> - {log.message}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Messages */}
        {messages.length > 0 && (
          <div className="mt-6 bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium mb-3">Recent Messages</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {messages.slice(-5).map((message) => (
                <div
                  key={message.id}
                  className={`p-2 rounded text-sm ${
                    message.direction === 'inbound' 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-green-100 text-green-800'
                  }`}
                >
                  <div className="font-medium">
                    {message.direction === 'inbound' ? '📨 Customer' : '📤 Agent'}: {message.content}
                  </div>
                  <div className="text-xs opacity-70">
                    {new Date(message.created_at).toLocaleTimeString()} - Status: {message.status}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Conversations List */}
        {conversations.length > 0 && (
          <div className="mt-6 bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium mb-3">Active Conversations</h3>
            <div className="space-y-2">
              {conversations.slice(0, 5).map((conversation) => (
                <div key={conversation.id} className="flex justify-between items-center p-2 bg-white rounded border">
                  <div>
                    <div className="font-medium">{conversation.customer_name || conversation.customer_phone}</div>
                    <div className="text-sm text-gray-600">
                      {conversation.latest_message?.content || 'No messages yet'}
                    </div>
                  </div>
                  {unreadCounts[conversation.id] > 0 && (
                    <div className="bg-red-500 text-white text-xs rounded-full px-2 py-1">
                      {unreadCounts[conversation.id]}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RealTimeTest;
