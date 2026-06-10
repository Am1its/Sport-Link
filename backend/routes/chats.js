const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');
const { isUserInGame } = require('../utils/gameUtils');

const router = express.Router();

// GET /api/chats — all game chats the user is in
// Uses a single derived-table JOIN for last message instead of 4 correlated subqueries
router.get('/', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  try {
    const [rows] = await pool.execute(
      `SELECT
         g.id,
         g.sport_type,
         g.host_id,
         g.location_desc,
         g.scheduled_time,
         lm.content    AS last_message,
         lm.username   AS last_sender,
         lm.created_at AS last_message_at
       FROM Games g
       LEFT JOIN (
         SELECT m.*
         FROM Messages m
         INNER JOIN (
           SELECT game_id, MAX(id) AS max_id FROM Messages GROUP BY game_id
         ) latest ON m.id = latest.max_id
       ) lm ON lm.game_id = g.id
       WHERE g.status = 'active'
         AND (g.host_id = ? OR EXISTS (
           SELECT 1 FROM GameParticipants WHERE game_id = g.id AND user_id = ?
         ))
       ORDER BY COALESCE(lm.created_at, g.created_at) DESC`,
      [userId, userId]
    );
    res.json({ success: true, chats: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/chats/:gameId/messages
router.get('/:gameId/messages', authMiddleware, async (req, res) => {
  const gameId = parseInt(req.params.gameId);
  const userId = req.user.id;

  if (!(await isUserInGame(gameId, userId)))
    return res.status(403).json({ success: false, message: 'You are not part of this game' });

  try {
    const [messages] = await pool.execute(
      `SELECT m.id, m.user_id, u.username, m.content, m.created_at
       FROM Messages m
       JOIN Users u ON u.id = m.user_id
       WHERE m.game_id = ? ORDER BY m.created_at ASC LIMIT 100`,
      [gameId]
    );
    res.json({ success: true, messages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/chats/:gameId/messages
router.post('/:gameId/messages', authMiddleware, async (req, res) => {
  const gameId = parseInt(req.params.gameId);
  const userId = req.user.id;
  const { content } = req.body;

  if (!content?.trim())
    return res.status(400).json({ success: false, message: 'Message cannot be empty' });
  if (content.trim().length > 1000)
    return res.status(400).json({ success: false, message: 'Message too long (max 1000 characters)' });

  if (!(await isUserInGame(gameId, userId)))
    return res.status(403).json({ success: false, message: 'You are not part of this game' });

  try {
    // Fetch current username from DB so it stays accurate after renames
    const [[currentUser]] = await pool.execute('SELECT username FROM Users WHERE id = ?', [userId]);
    const [result] = await pool.execute(
      'INSERT INTO Messages (game_id, user_id, username, content) VALUES (?, ?, ?, ?)',
      [gameId, userId, currentUser.username, content.trim()]
    );
    const [[msg]] = await pool.execute(
      `SELECT m.id, m.user_id, u.username, m.content, m.created_at
       FROM Messages m JOIN Users u ON u.id = m.user_id WHERE m.id = ?`,
      [result.insertId]
    );
    res.status(201).json({ success: true, message: msg });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
