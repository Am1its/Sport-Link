const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const pool = require('../db');

const router = express.Router();

const signToken = (user) =>
  jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '90d' });

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ success: false, message: 'All fields are required' });

  try {
    const password_hash = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      'INSERT INTO Users (username, email, password_hash, onboarding_complete) VALUES (?, ?, ?, FALSE)',
      [username, email, password_hash]
    );
    const user = { id: result.insertId, username, onboarding_complete: false };
    res.status(201).json({ success: true, token: signToken(user), user });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ success: false, message: 'Username or email already taken' });
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ success: false, message: 'Email and password are required' });

  try {
    const [rows] = await pool.execute('SELECT * FROM Users WHERE email = ?', [email]);
    const dbUser = rows[0];
    if (!dbUser) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    if (!dbUser.password_hash)
      return res.status(401).json({ success: false, message: 'This account uses Google sign-in' });

    const match = await bcrypt.compare(password, dbUser.password_hash);
    if (!match) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const user = { id: dbUser.id, username: dbUser.username, onboarding_complete: !!dbUser.onboarding_complete };
    res.json({ success: true, token: signToken(user), user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/auth/google  — { access_token }
// The PKCE code exchange is done on the client via expo-auth-session/exchangeCodeAsync;
// the backend receives the resulting access_token and validates it with Google.
router.post('/google', async (req, res) => {
  const { access_token } = req.body;
  if (!access_token)
    return res.status(400).json({ success: false, message: 'access_token is required' });

  try {
    // Fetch profile using access token
    const { data: profile } = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const { sub: googleId, email, name, picture } = profile;
    if (!email) return res.status(400).json({ success: false, message: 'Could not retrieve email from Google' });

    // Find existing user by google_id or email
    const [rows] = await pool.execute(
      'SELECT * FROM Users WHERE google_id = ? OR email = ? LIMIT 1',
      [googleId, email]
    );
    let dbUser = rows[0];

    if (dbUser) {
      // Link google_id if signing in via email match for first time
      if (!dbUser.google_id) {
        await pool.execute('UPDATE Users SET google_id = ? WHERE id = ?', [googleId, dbUser.id]);
      }
    } else {
      // New user — derive a clean username from their Google name
      let baseUsername = (name || email.split('@')[0])
        .replace(/[^a-zA-Z0-9_]/g, '')
        .toLowerCase()
        .slice(0, 20) || 'player';

      // Ensure username uniqueness
      let username = baseUsername;
      let suffix = 1;
      while (true) {
        const [existing] = await pool.execute('SELECT id FROM Users WHERE username = ?', [username]);
        if (!existing[0]) break;
        username = `${baseUsername}${suffix++}`;
      }

      const [result] = await pool.execute(
        'INSERT INTO Users (username, email, google_id, onboarding_complete) VALUES (?, ?, ?, FALSE)',
        [username, email, googleId]
      );
      dbUser = { id: result.insertId, username, onboarding_complete: false };
    }

    const user = { id: dbUser.id, username: dbUser.username, onboarding_complete: !!dbUser.onboarding_complete };
    res.json({ success: true, token: signToken(user), user });
  } catch (err) {
    console.error('Google auth error:', err.message, JSON.stringify(err.response?.data));
    res.status(500).json({ success: false, message: 'Google sign-in failed' });
  }
});

module.exports = router;
