const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const http = require('http');
const cors = require('cors')
const multer = require('multer')
// const { v4: uuidv4 } = require('uuid'); // Optional: for more unique IDs

const app = express();
const HTTP_PORT = process.env.HTTP_PORT || 3001;

app.use(cors())

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Add CORS middleware
app.use((req, res, next) => {
  // Allow requests from both HTTP and HTTPS origins
  const allowedOrigins = [
    'http://localhost:3000',
    'https://localhost:3000',
    'http://localhost:3444',
    'https://localhost:3444',
    'http://192.168.1.71:3000',
    'https://192.168.1.71:3000',
    'http://192.168.1.71:3444',
    'https://192.168.1.71:3444'
  ];
  
  const origin = req.headers.origin;
  console.log('Request origin:', origin);
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
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
const VIDEOS_UPLOAD_DIR = path.join(STORAGE_DIR, 'videos');
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

// --- Multer Storage Configuration ---
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, VIDEOS_UPLOAD_DIR); // Save files to the 'videos' subfolder
  },
  filename: function (req, file, cb) {
    // Create a unique filename (e.g., timestamp-originalfilename or use uuid)
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    // const fileExtension = path.extname(file.originalname); // .webm, .mp4 etc.
    // For PoC, let's assume webm from MediaRecorder. Adjust if needed.
    // The mime type from the frontend blob will be more reliable.
    let fileExtension = '.webm'; // Default
    if (file.mimetype === 'video/mp4') {
        fileExtension = '.mp4';
    } else if (file.mimetype === 'video/webm') {
        fileExtension = '.webm';
    } // Add more types if necessary
    cb(null, file.fieldname + '-' + uniqueSuffix + fileExtension);
  }
});

const upload = multer({ storage: storage });

// --- Static Serving of Uploaded Videos ---
// This makes files in VIDEOS_UPLOAD_DIR accessible via '/videos' URL path
// e.g., http://localhost:3001/videos/video-12345.webm
// OR (if using proxy) https://<your-pc-ip>:<proxy-port>/videos/video-12345.webm
app.use('/videos', express.static(VIDEOS_UPLOAD_DIR));

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

// --- NEW API Route for Video Upload ---
// POST /api/upload/video
app.post('/api/upload/video', upload.single('video'), (req, res) => {
  // 'video' should be the name attribute of the file input field in the form,
  // or the key used when appending to FormData on the frontend.
  if (!req.file) {
    return res.status(400).json({ message: 'No video file uploaded.' });
  }

  // Construct the URL to access the video.
  // This URL will be relative to your backend's address.
  // If frontend is on https://<ip>:3000 and backend proxy is on https://<ip>:3443,
  // then the full URL would be https://<ip>:3443/videos/filename.webm
  // If backend (Node.js directly) is on http://<ip>:3001,
  // then full URL is http://<ip>:3001/videos/filename.webm
  const videoUrl = `/videos/${req.file.filename}`; // Relative path for serving

  console.log('Video uploaded:', req.file.filename, 'Accessible at:', videoUrl);
  res.status(200).json({ 
    message: 'Video uploaded successfully!', 
    videoUrl: videoUrl, // Send back the relative URL
    filename: req.file.filename 
  });
});
  
// --- MODIFIED API Route for Sending Messages ---
// POST /api/messages: Create a new message (now can include videoUrl)
app.post('/api/messages', (req, res) => {
  // Expects body: { conversationId, senderId, textContent (optional), videoUrl (optional) }
  const { conversationId, senderId, textContent, videoUrl } = req.body;

  if (!conversationId || !senderId) {
    return res.status(400).json({ message: "conversationId and senderId are required." });
  }
  if (!textContent && !videoUrl) {
    return res.status(400).json({ message: "Message must have textContent or videoUrl." });
  }

  // PoC: Basic check if conversation exists
  const conversations = readConversations(); // Assuming readConversations is defined
  if (!conversations.find(conv => conv.id === conversationId)) {
      return res.status(404).json({ message: "Conversation not found." });
  }

  const messages = readMessages(); // Assuming readMessages is defined
  const newMessage = {
    id: Date.now().toString(36) + Math.random().toString(36).substring(2), // Simple ID
    conversationId,
    senderId,
    textContent: textContent || null, // Store null if no text
    videoUrl: videoUrl || null,     // Store null if no video
    timestamp: new Date().toISOString(),
    branchParentMessageId: null 
  };
  messages.push(newMessage);
  writeMessages(messages); // Assuming writeMessages is defined
  console.log(`Message (content type: ${videoUrl ? 'video' : 'text'}) sent in conv ${conversationId} by ${senderId}`);
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
  
  
// --- Start the servers ---
// Create HTTP server
const httpServer = http.createServer(app);
httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`HTTP server running on http://0.0.0.0:${HTTP_PORT}`);
    console.log(`HTTPS server will be available through local-ssl-proxy on port 3443`);
    console.log('Server is listening on all network interfaces');
    // Ensure all DB files exist
    ensureDbFileExists(USERS_DB_PATH);
    ensureDbFileExists(CONVERSATIONS_DB_PATH);
    ensureDbFileExists(MESSAGES_DB_PATH);
});