const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Check if a user is in a game (host or participant)
const isUserInGame = async (gameId, userId) => {
  const [[row]] = await pool.execute(
    `SELECT id FROM Games
     WHERE id = ? AND status = 'active'
       AND (host_id = ? OR EXISTS (
         SELECT 1 FROM GameParticipants WHERE game_id = ? AND user_id = ?
       ))`,
    [gameId, userId, gameId, userId]
  );
  return !!row;
};

// GET /api/chats — all game chats the user is in
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
         (SELECT content    FROM Messages WHERE game_id = g.id ORDER BY created_at DESC LIMIT 1) AS last_message,
         (SELECT username   FROM Messages WHERE game_id = g.id ORDER BY created_at DESC LIMIT 1) AS last_sender,
         (SELECT created_at FROM Messages WHERE game_id = g.id ORDER BY created_at DESC LIMIT 1) AS last_message_at
       FROM Games g
       WHERE g.status = 'active'
         AND (g.host_id = ? OR EXISTS (
           SELECT 1 FROM GameParticipants WHERE game_id = g.id AND user_id = ?
         ))
       ORDER BY COALESCE(
         (SELECT created_at FROM Messages WHERE game_id = g.id ORDER BY created_at DESC LIMIT 1),
         g.created_at
       ) DESC`,
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
      `SELECT id, user_id, username, content, created_at
       FROM Messages WHERE game_id = ? ORDER BY created_at ASC LIMIT 100`,
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

  if (!(await isUserInGame(gameId, userId)))
    return res.status(403).json({ success: false, message: 'You are not part of this game' });

  try {
    const [result] = await pool.execute(
      'INSERT INTO Messages (game_id, user_id, username, content) VALUES (?, ?, ?, ?)',
      [gameId, userId, req.user.username, content.trim()]
    );
    const [[msg]] = await pool.execute('SELECT * FROM Messages WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, message: msg });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
