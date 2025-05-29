import React, { useState, useEffect, useCallback } from 'react';
import VideoRecorder from './VideoRecorder';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';

function DashboardPage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null); // Store the whole conversation object
  const [messages, setMessages] = useState([]);
  // const [newMessageText, setNewMessageText] = useState('');
  const [newConversationUserId, setNewConversationUserId] = useState(''); // For starting new chats
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

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

  const handleVideoSend = async (videoBlob) => {
    if (!videoBlob || !selectedConversation || !userId) {
      setError("Cannot send video: missing video, conversation, or user ID.");
      return;
    }
    setStatusMessage('Sending video...');
    setError('');

    // The actual upload and message sending will be in the next backend step.
    // For now, let's just log it and prepare for that.
    console.log("Video Blob received in DashboardPage:", videoBlob);
    console.log("Blob size:", videoBlob.size, "Blob type:", videoBlob.type);
    
    // ---- THIS IS WHERE YOU'LL INTEGRATE THE UPLOAD (Phase 3, Backend part) ----
    // 1. Upload videoBlob to your backend (e.g., POST /api/upload/video)
    // 2. Get the videoURL/path back from the backend.
    // 3. Send message metadata to POST /api/messages with the videoURL.

    // For now, to simulate sending a message metadata entry (replace textContent with videoUrl later)
    try {
        const response = await fetch('https://localhost:3001/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                conversationId: selectedConversation.id,
                senderId: userId,
                // textContent: `Video recorded: ${videoBlob.type}, size: ${videoBlob.size} (placeholder)`, // Replace with videoUrl from backend
                textContent: `[Video placeholder: ${ (videoBlob.size / 1024).toFixed(2) } KB]`, // Placeholder for now
                // In next step, this will be videoUrl: "path/to/video_on_server.webm"
            }),
        });
        if (response.ok) {
            setStatusMessage('Video (placeholder) message sent!');
            fetchMessages(); // Re-fetch messages
        } else {
            const errorData = await response.json();
            throw new Error(errorData.message || "Failed to send video message metadata");
        }
    } catch (err) {
        console.error("Failed to send video message metadata:", err);
        setError(err.message);
        setStatusMessage('');
    }
    // --------------------------------------------------------------------------
  };

  const handleLogout = () => {
    localStorage.removeItem('branchUserToken');
    localStorage.removeItem('branchUserId');
    setUserId(null); setConversations([]); setSelectedConversation(null); setMessages([]);
    navigate('/login');
  };


  if (!userId) return <p>Loading user...</p>;

  return (
    <div style={{ display: 'flex', height: '90vh' }}>
      <div style={{ width: '30%', borderRight: '1px solid #ccc', padding: '10px', overflowY: 'auto' }}>
        {/* ... (conversation list and new conversation form - keep as is) ... */}
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
              style={{ /* ... styles ... */ }}
            >
              Chat with: {conv.participants.find(pId => pId !== userId) || '...'}
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
              {/* ... (message mapping - keep as is) ... */}
              {messages.length === 0 && <p>No messages yet. Send one!</p>}
              {messages.map((msg) => (
                <div key={msg.id} style={{ /* ... message styles ... */ }}>
                  {/* ... message content ... */}
                   <p style={{ margin: 0, fontSize: '0.8em', color: '#555' }}>Sender: {msg.senderId}</p>
                   <p style={{ margin: '2px 0' }}>{msg.textContent}</p> {/* Will show video later */}
                   <small style={{ fontSize: '0.7em', color: '#777' }}>{new Date(msg.timestamp).toLocaleTimeString()}</small>
                </div>
              ))}
            </div>
            
            {/* Replace text input with VideoRecorder */}
            <VideoRecorder onRecordingComplete={handleVideoSend} />
            {/* // Old text message form - remove or comment out
            <form onSubmit={handleSendMessage}>
              <input
                type="text"
                value={newMessageText}
                onChange={(e) => setNewMessageText(e.target.value)}
                // ...
              />
              <button type="submit">Send</button>
            </form> 
            */}
          </>
        ) : (
          <p>Select a conversation or start a new chat to record a video message.</p>
        )}
      </div>
      {statusMessage && <p style={{ color: 'green', clear: 'both', padding: '10px' }}>{statusMessage}</p>}
      {error && <p style={{ color: 'red', clear: 'both', padding: '10px' }}>Error: {error}</p>}
      <button onClick={handleLogout} style={{ position: 'absolute', top: '10px', right: '10px' }}>Logout</button>
    </div>
  );
}

export default DashboardPage;