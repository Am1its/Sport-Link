const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const router = express.Router();

const signToken = (user) =>
  jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '7d' });

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

    const match = await bcrypt.compare(password, dbUser.password_hash);
    if (!match) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const user = {
      id: dbUser.id,
      username: dbUser.username,
      onboarding_complete: !!dbUser.onboarding_complete,
    };
    res.json({ success: true, token: signToken(user), user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
