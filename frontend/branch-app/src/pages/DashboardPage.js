import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import VideoRecorder from '../pages/VideoRecorder'; // Ensure this path is correct

// IMPORTANT: Replace with your actual PC's local IP address and the correct backend port.
// Option 1: If your local-ssl-proxy is correctly exposing your backend on an HTTPS port (e.g., 3445)
// const API_BASE_URL = 'https://<YOUR_PC_IP_ADDRESS>:3445'; // e.g., 'https://192.168.1.100:3445'

// Option 2: If you are directly hitting your Node.js HTTP backend (e.g., on port 3443)
// This will cause mixed content if your frontend is HTTPS, but might be used for simpler PoC testing of backend logic.
const API_BASE_URL = 'https://192.168.1.71:3443'; // e.g., 'http://192.168.1.100:3443'
// Choose ONE of the above and replace placeholders.

function DashboardPage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newConversationUserId, setNewConversationUserId] = useState('');
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('branchUserToken');
    const storedUserId = localStorage.getItem('branchUserId');
    if (!token || !storedUserId) {
      navigate('/login');
    } else {
      console.log("DashboardPage: User authenticated, userId:", storedUserId);
      setUserId(storedUserId);
    }
  }, [navigate]);

  const fetchConversations = useCallback(async () => {
    if (!userId) return;
    console.log("DashboardPage: Fetching conversations for userId:", userId);
    setError('');
    setStatusMessage('Loading conversations...');
    try {
      const response = await fetch(`${API_BASE_URL}/api/conversations?userId=${userId}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})); // Try to parse error, default if not JSON
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setConversations(data);
      setStatusMessage('');
    } catch (e) {
      console.error("Failed to fetch conversations:", e);
      setError(`Could not load conversations: ${e.message}`);
      setStatusMessage('');
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchConversations();
    }
  }, [userId, fetchConversations]);

  const fetchMessages = useCallback(async () => {
    if (!selectedConversation) {
      console.log("DashboardPage: No selected conversation, clearing messages.");
      setMessages([]);
      return;
    }
    console.log("DashboardPage: Fetching messages for conversationId:", selectedConversation.id);
    setError('');
    setStatusMessage(`Loading messages for chat with ${selectedConversation.participants.find(pId => pId !== userId) || '...'}...`);
    try {
      const response = await fetch(`${API_BASE_URL}/api/conversations/${selectedConversation.id}/messages`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setMessages(data);
      setStatusMessage('');
    } catch (e) {
      console.error("Failed to fetch messages:", e);
      setError(`Could not load messages: ${e.message}`);
      setStatusMessage('');
    }
  }, [selectedConversation, userId]); // Added userId as it's used in participants.find for status

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages();
    } else {
      setMessages([]); // Clear messages if no conversation is selected
    }
  }, [selectedConversation, fetchMessages]);

  const handleSelectConversation = (conversation) => {
    console.log("DashboardPage: Conversation selected:", conversation);
    setSelectedConversation(conversation);
    // Messages will be fetched by the useEffect hook watching selectedConversation
  };

  const handleStartNewConversation = async (e) => {
    e.preventDefault();
    console.log("handleStartNewConversation called");
    console.log("Current userId (self):", userId);
    console.log("Attempting to chat with userId:", newConversationUserId);

    if (!newConversationUserId.trim() || !userId) {
      setError("Please enter a User ID to start a conversation.");
      console.log("Exited: newConversationUserId or userId is missing.");
      return;
    }
    if (newConversationUserId.trim() === userId) {
      setError("You cannot start a conversation with yourself.");
      console.log("Exited: Attempting to chat with self.");
      return;
    }
    setError('');
    setStatusMessage('Starting conversation...');
    console.log("Proceeding to API call to start/find conversation...");

    try {
      const response = await fetch(`${API_BASE_URL}/api/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId1: userId, userId2: newConversationUserId.trim() }),
      });

      console.log("API call for new conversation made. Response status:", response.status);
      const newConv = await response.json();
      console.log("API response data for new conversation:", newConv);

      if (response.ok) {
        setNewConversationUserId('');
        setStatusMessage(`Conversation with ${newConversationUserId.trim()} started/found.`);
        console.log("Conversation successfully started/found. New/Existing Conv:", newConv);
        
        setConversations(prevConvs => {
          const existing = prevConvs.find(c => c.id === newConv.id);
          if (existing) return prevConvs.map(c => c.id === newConv.id ? newConv : c); // Update if existing
          return [...prevConvs, newConv];
        });
        setSelectedConversation(newConv);
        // fetchConversations(); // Optionally re-fetch all if optimistic update is not enough
      } else {
        throw new Error(newConv.message || `Server error: ${response.status}`);
      }
    } catch (err) {
      console.error("Failed to start new conversation (inside catch):", err);
      setError(err.message || "An unknown error occurred while starting conversation.");
      setStatusMessage('');
    }
  };

  const handleVideoSend = async (videoBlob) => {
    if (!videoBlob || !selectedConversation || !userId) {
      setError("Cannot send video: missing video, selected conversation, or user ID.");
      setStatusMessage('');
      return;
    }
    setStatusMessage('Uploading video...');
    setError('');

    const formData = new FormData();
    formData.append('video', videoBlob, `video-${Date.now()}.webm`); // Key 'video' must match multer on backend

    try {
      // 1. Upload the video file
      const uploadResponse = await fetch(`${API_BASE_URL}/api/upload/video`, {
        method: 'POST',
        body: formData, // Don't set Content-Type header manually for FormData
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({ message: "Video upload failed, couldn't parse error."}));
        throw new Error(errorData.message || `Video upload failed: ${uploadResponse.status}`);
      }

      const uploadResult = await uploadResponse.json();
      const { videoUrl } = uploadResult; // This is the relative URL from the backend, e.g., /videos/filename.webm

      console.log("Video uploaded, server path:", videoUrl);
      setStatusMessage('Video uploaded! Sending message...');

      // 2. Send the message metadata with the videoUrl
      const messageResponse = await fetch(`${API_BASE_URL}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          senderId: userId,
          videoUrl: videoUrl, // Use the URL from the upload response
          textContent: null, // Or add a caption input later
        }),
      });

      if (!messageResponse.ok) {
        const errorData = await messageResponse.json().catch(() => ({ message: "Sending message metadata failed, couldn't parse error."}));
        throw new Error(errorData.message || `Sending message metadata failed: ${messageResponse.status}`);
      }

      setStatusMessage('Video message sent!');
      fetchMessages(); // Re-fetch messages to show the new video message
    } catch (err) {
      console.error("Error in handleVideoSend:", err);
      setError(err.message || "An error occurred while sending the video.");
      setStatusMessage('');
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

  console.log("DashboardPage rendering. userId:", userId, "selectedConversation:", selectedConversation);

  if (!userId) {
    return <p>Loading user data...</p>;
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 20px)', margin: '10px' }}>
      <div style={{ width: '30%', borderRight: '1px solid #ccc', padding: '10px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <h2>Conversations</h2>
        <form onSubmit={handleStartNewConversation} style={{ marginBottom: '10px', display: 'flex' }}>
          <input
            type="text"
            value={newConversationUserId}
            onChange={(e) => setNewConversationUserId(e.target.value)}
            placeholder="Enter User ID to chat"
            style={{ marginRight: '5px', flexGrow: 1, padding: '8px' }}
          />
          <button type="submit" style={{ padding: '8px 10px' }}>New Chat</button>
        </form>
        <div style={{ flexGrow: 1, overflowY: 'auto' }}>
          {conversations.length === 0 && !statusMessage.includes('Loading') && <p>No conversations yet. Start a new one!</p>}
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {conversations.map((conv) => (
              <li
                key={conv.id}
                onClick={() => handleSelectConversation(conv)}
                style={{
                  padding: '10px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #eee',
                  backgroundColor: selectedConversation?.id === conv.id ? '#e0e0e0' : 'transparent',
                }}
              >
                Chat with: {conv.participants.filter(pId => pId !== userId).join(', ') || 'Yourself (or unknown participant)'}
                <br />
                <small>ID: {conv.id.substring(0, 8)}...</small>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div style={{ width: '70%', padding: '10px', display: 'flex', flexDirection: 'column', marginLeft: '10px' }}>
        {selectedConversation ? (
          <>
            <h3>
              Chat with {selectedConversation.participants.filter(pId => pId !== userId).join(', ') || '...'}
              {/* <small style={{fontSize: '0.7em', marginLeft: '10px'}}>(Conv ID: {selectedConversation.id.substring(0,8)}...)</small> */}
            </h3>
            <div style={{ flexGrow: 1, border: '1px solid #eee', marginBottom: '10px', padding: '10px', overflowY: 'auto', display: 'flex', flexDirection: 'column-reverse' }}>
              {/* Messages will appear here, reversed for chat flow */}
              {messages.length === 0 && !statusMessage.includes('Loading') && <p style={{textAlign: 'center', color: '#777'}}>No messages yet. Send one!</p>}
              {[...messages].reverse().map((msg) => ( // Reverse for display
                <div key={msg.id} style={{ 
                    marginBottom: '10px', 
                    alignSelf: msg.senderId === userId ? 'flex-end' : 'flex-start' 
                }}>
                  <div style={{
                      display: 'inline-block',
                      padding: '8px 12px',
                      borderRadius: '18px',
                      backgroundColor: msg.senderId === userId ? '#dcf8c6' : '#f0f0f0',
                      maxWidth: '70%',
                      wordWrap: 'break-word'
                  }}>
                    <p style={{ margin: 0, fontSize: '0.8em', color: '#555', fontWeight: msg.senderId === userId ? 'bold': 'normal' }}>
                      Sender: {msg.senderId === userId ? 'You' : `User ${msg.senderId}`}
                    </p>
                    {msg.textContent && <p style={{ margin: '4px 0' }}>{msg.textContent}</p>}
        
                    {msg.videoUrl && (
                      <video 
                        src={`${API_BASE_URL}${msg.videoUrl}`} // Crucial: Prepend API_BASE_URL
                        controls 
                        style={{ maxWidth: '100%', width: '280px', maxHeight: '200px', marginTop: '5px', borderRadius: '10px' }}
                        onError={(e) => console.error('Video Error:', e.target.error, 'for URL:', e.target.src)}
                      >
                        Your browser does not support the video tag.
                      </video>
                    )}
                    <small style={{ fontSize: '0.7em', color: '#777', display: 'block', textAlign: 'right' }}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </small>
                  </div>
                </div>
              ))}
            </div>
            
            <VideoRecorder onRecordingComplete={handleVideoSend} /> 
            {console.log("DashboardPage: Rendering VideoRecorder because selectedConversation exists.")}
          </>
        ) : (
          <div style={{flexGrow:1, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <p style={{color: '#777'}}>Select a conversation or start a new chat to begin messaging.</p>
            {console.log("DashboardPage: NOT Rendering VideoRecorder because selectedConversation is null/falsy.")}
          </div>
        )}
      </div>
      {(statusMessage && !error) && <p style={{ color: 'green', position: 'fixed', bottom: '10px', left: '10px', background: '#f0fff0', padding: '10px', borderRadius: '5px', border: '1px solid green' }}>{statusMessage}</p>}
      {error && <p style={{ color: 'red', position: 'fixed', bottom: '10px', left: '10px', background: '#fff0f0', padding: '10px', borderRadius: '5px', border: '1px solid red' }}>Error: {error}</p>}
      <button onClick={handleLogout} style={{ position: 'fixed', top: '10px', right: '10px', padding: '8px 15px' }}>Logout</button>
    </div>
  );
}

export default DashboardPage;