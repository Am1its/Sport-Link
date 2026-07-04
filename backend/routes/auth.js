const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');
const { isValidEmail, isValidUsername, isValidPassword } = require('../utils/validators');

const router = express.Router();

const signToken = (user) =>
  jwt.sign(
    { id: user.id, username: user.username, token_version: user.token_version ?? 0 },
    process.env.JWT_SECRET,
    { expiresIn: '90d' }
  );

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ success: false, message: 'All fields are required' });
  if (!isValidUsername(username))
    return res.status(400).json({ success: false, message: 'Username must be 3-30 characters (letters, numbers, underscore, period only)' });
  if (!isValidEmail(email))
    return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
  if (!isValidPassword(password))
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });

  const cleanUsername = username.trim();
  const cleanEmail = email.trim();

  try {
    const password_hash = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      'INSERT INTO Users (username, email, password_hash, onboarding_complete) VALUES (?, ?, ?, FALSE)',
      [cleanUsername, cleanEmail, password_hash]
    );
    const user = { id: result.insertId, username: cleanUsername, onboarding_complete: false };
    res.status(201).json({ success: true, token: signToken({ ...user, token_version: 0 }), user });
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
    res.json({ success: true, token: signToken({ ...user, token_version: dbUser.token_version }), user });
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

      // Ensure username uniqueness by retrying on a duplicate-key error rather than a
      // check-then-insert loop, which races under concurrent signups with the same name.
      let username = baseUsername;
      let suffix = 1;
      let result;
      for (let attempt = 0; attempt < 20; attempt++) {
        try {
          [result] = await pool.execute(
            'INSERT INTO Users (username, email, google_id, onboarding_complete) VALUES (?, ?, ?, FALSE)',
            [username, email, googleId]
          );
          break;
        } catch (err) {
          if (err.code === 'ER_DUP_ENTRY' && err.sqlMessage?.toLowerCase().includes("key 'users.username'")) {
            username = `${baseUsername}${suffix++}`;
            continue;
          }
          throw err;
        }
      }
      if (!result) throw new Error('Could not generate a unique username after 20 attempts');
      dbUser = { id: result.insertId, username, onboarding_complete: false };
    }

    const user = { id: dbUser.id, username: dbUser.username, onboarding_complete: !!dbUser.onboarding_complete };
    res.json({ success: true, token: signToken({ ...user, token_version: dbUser.token_version ?? 0 }), user });
  } catch (err) {
    console.error('Google auth error:', err.message, JSON.stringify(err.response?.data));
    res.status(500).json({ success: false, message: 'Google sign-in failed' });
  }
});

// POST /api/auth/logout-all — invalidate every previously-issued token for this user
// (including the one used for this request) by bumping token_version.
router.post('/logout-all', authMiddleware, async (req, res) => {
  try {
    await pool.execute('UPDATE Users SET token_version = token_version + 1 WHERE id = ?', [req.user.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
