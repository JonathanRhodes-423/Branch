const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs'); // For password hashing
const cors = require('cors'); // Add CORS middleware

const app = express();
const PORT = process.env.PORT || 3001; // Or your preferred port

// Enable CORS for all routes with specific options
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware to parse JSON request bodies
app.use(express.json());

// Add a root route handler
app.get('/', (req, res) => {
  res.json({ message: 'Branch API is running' });
});

// Add debug logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// --- Configuration for users.json ---
// Store users.json in the backend directory
const USERS_DB_PATH = path.join(__dirname, 'users.json');

// Helper function to read users from users.json
function readUsers() {
  try {
    if (!fs.existsSync(USERS_DB_PATH)) {
      // If the file doesn't exist, create it with an empty array
      fs.writeFileSync(USERS_DB_PATH, JSON.stringify([], null, 2));
      return [];
    }
    const usersData = fs.readFileSync(USERS_DB_PATH);
    return JSON.parse(usersData.toString());
  } catch (error) {
    console.error("Error reading users DB:", error);
    return []; // Return empty or handle error appropriately
  }
}

// Helper function to write users to users.json
function writeUsers(usersArray) {
  try {
    fs.writeFileSync(USERS_DB_PATH, JSON.stringify(usersArray, null, 2));
  } catch (error) {
    console.error("Error writing to users DB:", error);
  }
}

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


// --- Start the server ---
// (This part should already be in your server.js from Step 1)
app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
  // Ensure users.json exists or is created
  if (!fs.existsSync(USERS_DB_PATH)) {
    console.log(`Creating users database at: ${USERS_DB_PATH}`);
    writeUsers([]);
  } else {
    console.log(`Using users database at: ${USERS_DB_PATH}`);
  }
});