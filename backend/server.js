const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
// const { v4: uuidv4 } = require('uuid'); // Optional: for more unique IDs

const app = express();
const PORT = process.env.PORT || 3001;

// Add CORS middleware
app.use((req, res, next) => {
  // Allow requests from any origin in development
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// --- Configuration for storage paths ---
// Use the existing storage directory at D:\BranchStorage
const STORAGE_DIR = "D:\\BranchStorage";
const USERS_DB_PATH = path.join(STORAGE_DIR, 'users.json');
const CONVERSATIONS_DB_PATH = path.join(STORAGE_DIR, 'conversations.json');
const MESSAGES_DB_PATH = path.join(STORAGE_DIR, 'messages.json');

// --- Helper function to ensure a file exists or create it with an empty array ---
function ensureDbFileExists(filePath) {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify([], null, 2));
    console.log(`Created DB file: ${filePath}`);
  }
}

// --- User DB Helpers (from previous phase) ---
function readUsers() {
  ensureDbFileExists(USERS_DB_PATH);
  try {
    const usersData = fs.readFileSync(USERS_DB_PATH);
    return JSON.parse(usersData.toString());
  } catch (error) { console.error(`Error reading ${USERS_DB_PATH}:`, error); return []; }
}
function writeUsers(usersArray) {
  try {
    fs.writeFileSync(USERS_DB_PATH, JSON.stringify(usersArray, null, 2));
  } catch (error) { console.error(`Error writing ${USERS_DB_PATH}:`, error); }
}

// --- Conversation DB Helpers ---
function readConversations() {
  ensureDbFileExists(CONVERSATIONS_DB_PATH);
  try {
    const convData = fs.readFileSync(CONVERSATIONS_DB_PATH);
    return JSON.parse(convData.toString());
  } catch (error) { console.error(`Error reading ${CONVERSATIONS_DB_PATH}:`, error); return []; }
}
function writeConversations(convArray) {
  try {
    fs.writeFileSync(CONVERSATIONS_DB_PATH, JSON.stringify(convArray, null, 2));
  } catch (error) { console.error(`Error writing ${CONVERSATIONS_DB_PATH}:`, error); }
}

// --- Message DB Helpers ---
function readMessages() {
  ensureDbFileExists(MESSAGES_DB_PATH);
  try {
    const msgData = fs.readFileSync(MESSAGES_DB_PATH);
    return JSON.parse(msgData.toString());
  } catch (error) { console.error(`Error reading ${MESSAGES_DB_PATH}:`, error); return []; }
}
function writeMessages(msgArray) {
  try {
    fs.writeFileSync(MESSAGES_DB_PATH, JSON.stringify(msgArray, null, 2));
  } catch (error) { console.error(`Error writing ${MESSAGES_DB_PATH}:`, error); }
}

// --- Simple ID Generation (for PoC) ---
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);
// If you installed uuid: const generateId = () => uuidv4()

// --- API Routes for Authentication ---

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  const users = readUsers();
  const existingUser = users.find(user => user.username === username);

  if (existingUser) {
    return res.status(409).json({ message: 'Username already exists.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10); // Hash the password
    const newUser = {
      id: String(users.length + 1), // Simple ID generation for PoC
      username,
      hashedPassword
    };
    users.push(newUser);
    writeUsers(users);
    console.log(`User registered: ${username}`);
    res.status(201).json({ message: 'User registered successfully!', userId: newUser.id });
  } catch (error) {
    console.error("Error during registration:", error);
    res.status(500).json({ message: 'Server error during registration.' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  const users = readUsers();
  const user = users.find(u => u.username === username);

  if (!user) {
    return res.status(401).json({ message: 'Invalid username or password.' });
  }

  try {
    const isMatch = await bcrypt.compare(password, user.hashedPassword);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    // For PoC, the token can be simple. In production, use JWTs (JSON Web Tokens).
    const pocToken = `poc-token-for-${user.id}-${Date.now()}`;
    console.log(`User logged in: ${username}`);
    res.status(200).json({ message: 'Login successful!', token: pocToken, userId: user.id });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ message: 'Server error during login.' });
  }
});


// POST /api/conversations: Create/find a conversation between two users.
// For PoC, assumes a 2-participant conversation.
// Expects body: { userId1: "id_of_logged_in_user", userId2: "id_of_other_user" }
app.post('/api/conversations', (req, res) => {
    const { userId1, userId2 } = req.body;
    if (!userId1 || !userId2) {
      return res.status(400).json({ message: "Both userId1 and userId2 are required." });
    }
  
    const conversations = readConversations();
    // Normalize participant order for consistent checking/finding
    const participants = [userId1, userId2].sort();
  
    let conversation = conversations.find(
      conv => conv.participants.length === 2 &&
              conv.participants.includes(userId1) &&
              conv.participants.includes(userId2)
    );
  
    if (conversation) {
      return res.status(200).json(conversation); // Found existing conversation
    } else {
      conversation = {
        id: generateId(), // `conv-${conversations.length + 1}` or use uuid
        participants: participants,
        createdAt: new Date().toISOString()
      };
      conversations.push(conversation);
      writeConversations(conversations);
      console.log(`Conversation created: ${conversation.id} between ${userId1} and ${userId2}`);
      return res.status(201).json(conversation);
    }
});
  
// POST /api/messages: Create a new message
// Expects body: { conversationId: "...", senderId: "...", textContent: "..." }
app.post('/api/messages', (req, res) => {
    const { conversationId, senderId, textContent } = req.body;
    if (!conversationId || !senderId || !textContent) {
      return res.status(400).json({ message: "conversationId, senderId, and textContent are required." });
    }
  
    // PoC: Basic check if conversation exists (optional, but good practice)
    const conversations = readConversations();
    if (!conversations.find(conv => conv.id === conversationId)) {
        return res.status(404).json({ message: "Conversation not found." });
    }
  
    const messages = readMessages();
    const newMessage = {
      id: generateId(), // `msg-${messages.length + 1}` or use uuid
      conversationId,
      senderId,
      textContent, // Will be replaced by videoUrl later
      timestamp: new Date().toISOString(),
      branchParentMessageId: null // Default for main timeline messages
    };
    messages.push(newMessage);
    writeMessages(messages);
    console.log(`Message sent in conv ${conversationId} by ${senderId}`);
    return res.status(201).json(newMessage);
});
  
// GET /api/conversations: Get conversations for the logged-in user.
// Expects query param: ?userId=some_user_id
app.get('/api/conversations', (req, res) => {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ message: "userId query parameter is required." });
    }
  
    const conversations = readConversations();
    const userConversations = conversations.filter(conv => conv.participants.includes(userId));
    res.status(200).json(userConversations);
});
  
// GET /api/conversations/:conversationId/messages: Get messages for a specific conversation.
app.get('/api/conversations/:conversationId/messages', (req, res) => {
    const { conversationId } = req.params;
    const messages = readMessages();
    const conversationMessages = messages
      .filter(msg => msg.conversationId === conversationId)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)); // Sort by time
  
    res.status(200).json(conversationMessages);
});
  
  
// --- Start the server ---
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend server is running on http://0.0.0.0:${PORT}`);
    console.log(`You can access it from other devices using your computer's IP address`);
    // Ensure all DB files exist
    ensureDbFileExists(USERS_DB_PATH);
    ensureDbFileExists(CONVERSATIONS_DB_PATH);
    ensureDbFileExists(MESSAGES_DB_PATH);
});