import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';

function DashboardPage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null); // Store the whole conversation object
  const [messages, setMessages] = useState([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [newConversationUserId, setNewConversationUserId] = useState(''); // For starting new chats
  const [error, setError] = useState('');

  // Check auth and get userId on mount
  useEffect(() => {
    const token = localStorage.getItem('branchUserToken');
    const storedUserId = localStorage.getItem('branchUserId');
    if (!token || !storedUserId) {
      navigate('/login');
    } else {
      setUserId(storedUserId);
    }
  }, [navigate]);

  // Fetch conversations when userId is set
  const fetchConversations = useCallback(async () => {
    if (!userId) return;
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/conversations?userId=${userId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setConversations(data);
    } catch (e) {
      console.error("Failed to fetch conversations:", e);
      setError("Could not load conversations.");
    }
  }, [userId]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Fetch messages when a conversation is selected
  const fetchMessages = useCallback(async () => {
    if (!selectedConversation) {
      setMessages([]);
      return;
    }
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/conversations/${selectedConversation.id}/messages`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setMessages(data);
    } catch (e) {
      console.error("Failed to fetch messages:", e);
      setError(`Could not load messages for conversation ${selectedConversation.id}.`);
    }
  }, [selectedConversation]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);


  const handleSelectConversation = (conversation) => {
    setSelectedConversation(conversation);
    // Messages will be fetched by the useEffect hook watching selectedConversation
  };

  const handleStartNewConversation = async (e) => {
    e.preventDefault();
    if (!newConversationUserId.trim() || !userId) {
      setError("Please enter a User ID to start a conversation.");
      return;
    }
    if (newConversationUserId.trim() === userId) {
      setError("You cannot start a conversation with yourself.");
      return;
    }
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId1: userId, userId2: newConversationUserId.trim() }),
      });
      const newConv = await response.json();
      if (response.ok) {
        setNewConversationUserId(''); // Clear input
        // Add to conversations list if not already there or select it
        if (!conversations.find(c => c.id === newConv.id)) {
          setConversations(prev => [...prev, newConv]);
        }
        setSelectedConversation(newConv);
        fetchConversations(); // Re-fetch all conversations to update list
      } else {
        throw new Error(newConv.message || "Failed to start conversation");
      }
    } catch (err) {
      console.error("Failed to start new conversation:", err);
      setError(err.message);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessageText.trim() || !selectedConversation || !userId) return;
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          senderId: userId,
          textContent: newMessageText,
        }),
      });
      if (response.ok) {
        setNewMessageText(''); // Clear input
        fetchMessages(); // Re-fetch messages for selected conversation (basic real-time feel)
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to send message");
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      setError(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('branchUserToken');
    localStorage.removeItem('branchUserId');
    setUserId(null);
    setConversations([]);
    setSelectedConversation(null);
    setMessages([]);
    navigate('/login');
  };

  if (!userId) {
    return <p>Loading user...</p>; // Or a spinner
  }

  return (
    <div style={{ display: 'flex', height: '90vh' }}>
      <div style={{ width: '30%', borderRight: '1px solid #ccc', padding: '10px', overflowY: 'auto' }}>
        <h2>Conversations</h2>
        <form onSubmit={handleStartNewConversation} style={{ marginBottom: '10px' }}>
          <input
            type="text"
            value={newConversationUserId}
            onChange={(e) => setNewConversationUserId(e.target.value)}
            placeholder="Enter User ID to chat"
            style={{ marginRight: '5px' }}
          />
          <button type="submit">New Chat</button>
        </form>
        {conversations.length === 0 && <p>No conversations yet. Start a new one!</p>}
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {conversations.map((conv) => (
            <li
              key={conv.id}
              onClick={() => handleSelectConversation(conv)}
              style={{
                padding: '10px',
                cursor: 'pointer',
                backgroundColor: selectedConversation?.id === conv.id ? '#e0e0e0' : 'transparent',
              }}
            >
              {/* For PoC, just show other participant IDs. Enhance later. */}
              Chat with: {conv.participants.find(pId => pId !== userId) || 'Group/Self (adjust logic)'}
              <br />
              <small>ID: {conv.id}</small>
            </li>
          ))}
        </ul>
      </div>

      <div style={{ width: '70%', padding: '10px', display: 'flex', flexDirection: 'column' }}>
        {selectedConversation ? (
          <>
            <h3>Messages with {selectedConversation.participants.find(pId => pId !== userId) || '...'} (Conv ID: {selectedConversation.id})</h3>
            <div style={{ flexGrow: 1, border: '1px solid #eee', marginBottom: '10px', padding: '5px', overflowY: 'auto' }}>
              {messages.length === 0 && <p>No messages yet. Send one!</p>}
              {messages.map((msg) => (
                <div key={msg.id} style={{ marginBottom: '5px', textAlign: msg.senderId === userId ? 'right' : 'left' }}>
                  <div style={{
                      display: 'inline-block',
                      padding: '8px 12px',
                      borderRadius: '10px',
                      backgroundColor: msg.senderId === userId ? '#dcf8c6' : '#f0f0f0',
                  }}>
                    <p style={{ margin: 0, fontSize: '0.8em', color: '#555' }}>
                      Sender: {msg.senderId}
                    </p>
                    <p style={{ margin: '2px 0' }}>{msg.textContent}</p>
                    <small style={{ fontSize: '0.7em', color: '#777' }}>
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </small>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={handleSendMessage}>
              <input
                type="text"
                value={newMessageText}
                onChange={(e) => setNewMessageText(e.target.value)}
                placeholder="Type your message"
                style={{ width: '80%', marginRight: '5px', padding: '8px' }}
              />
              <button type="submit" style={{ padding: '8px 15px' }}>Send</button>
            </form>
          </>
        ) : (
          <p>Select a conversation to see messages or start a new chat.</p>
        )}
      </div>
      {error && <p style={{ color: 'red', clear: 'both', padding: '10px' }}>Error: {error}</p>}
      <button onClick={handleLogout} style={{ position: 'absolute', top: '10px', right: '10px' }}>Logout</button>
    </div>
  );
}

export default DashboardPage;