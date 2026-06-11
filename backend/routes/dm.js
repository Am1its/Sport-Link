const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authMiddleware);

// Fetches a single DM message with game details computed from `viewerId`'s perspective.
const fetchMsg = async (msgId, viewerId) => {
  const [[msg]] = await pool.execute(`
    SELECT
      dm.id, dm.sender_id, dm.receiver_id, dm.content, dm.type,
      dm.event_id, dm.is_read, dm.created_at,
      g.title          AS game_title,
      g.sport_type     AS game_sport,
      g.scheduled_time AS game_time,
      g.location_desc  AS game_location,
      g.max_players    AS game_max_players,
      g.status         AS game_status,
      (SELECT COUNT(*) FROM GameParticipants WHERE game_id = g.id) AS game_current_players,
      CAST(EXISTS(SELECT 1 FROM GameParticipants WHERE game_id = g.id AND user_id = ?) AS UNSIGNED) AS game_joined,
      CAST((g.host_id = ?) AS UNSIGNED) AS game_is_host
    FROM DirectMessages dm
    LEFT JOIN Games g ON dm.event_id = g.id AND dm.type = 'event'
    WHERE dm.id = ?
  `, [viewerId, viewerId, msgId]);
  return msg;
};

// GET /api/dm — list all DM conversations with last message + unread count
router.get('/', async (req, res) => {
  const userId = req.user.id;
  try {
    const [convs] = await pool.execute(`
      SELECT
        u.id, u.username, u.avatar,
        d.content    AS last_content,
        d.type       AS last_type,
        d.event_id   AS last_event_id,
        d.sender_id  AS last_sender_id,
        d.created_at AS last_time,
        (
          SELECT COUNT(*) FROM DirectMessages
          WHERE receiver_id = ? AND sender_id = u.id AND is_read = 0
        ) AS unread_count
      FROM (
        SELECT
          CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END AS other_id,
          MAX(id) AS last_id
        FROM DirectMessages
        WHERE sender_id = ? OR receiver_id = ?
        GROUP BY other_id
      ) conv
      JOIN DirectMessages d ON d.id = conv.last_id
      JOIN Users u ON u.id = conv.other_id
      WHERE u.id NOT IN (SELECT blocked_id FROM BlockedUsers WHERE blocker_id = ?)
        AND u.id NOT IN (SELECT blocker_id FROM BlockedUsers WHERE blocked_id = ?)
      ORDER BY d.created_at DESC
    `, [userId, userId, userId, userId, userId, userId]);

    res.json({ success: true, conversations: convs });
  } catch (err) {
    console.error('DM list error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/dm/:userId — fetch messages (viewer's perspective) + auto-mark received as read
router.get('/:userId', async (req, res) => {
  const me = req.user.id;
  const other = parseInt(req.params.userId);
  if (isNaN(other)) return res.status(400).json({ success: false, message: 'Invalid userId' });

  try {
    await pool.execute(
      'UPDATE DirectMessages SET is_read = 1 WHERE receiver_id = ? AND sender_id = ? AND is_read = 0',
      [me, other]
    );

    const [messages] = await pool.execute(`
      SELECT
        dm.id, dm.sender_id, dm.receiver_id, dm.content, dm.type,
        dm.event_id, dm.is_read, dm.created_at,
        g.title          AS game_title,
        g.sport_type     AS game_sport,
        g.scheduled_time AS game_time,
        g.location_desc  AS game_location,
        g.max_players    AS game_max_players,
        g.status         AS game_status,
        (SELECT COUNT(*) FROM GameParticipants WHERE game_id = g.id) AS game_current_players,
        CAST(EXISTS(SELECT 1 FROM GameParticipants WHERE game_id = g.id AND user_id = ?) AS UNSIGNED) AS game_joined,
        CAST((g.host_id = ?) AS UNSIGNED) AS game_is_host
      FROM DirectMessages dm
      LEFT JOIN Games g ON dm.event_id = g.id AND dm.type = 'event'
      WHERE (dm.sender_id = ? AND dm.receiver_id = ?)
         OR (dm.sender_id = ? AND dm.receiver_id = ?)
      ORDER BY dm.created_at ASC
      LIMIT 100
    `, [me, me, me, other, other, me]);

    res.json({ success: true, messages });
  } catch (err) {
    console.error('DM fetch error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/dm/:userId — send a text or event message
router.post('/:userId', async (req, res) => {
  const me = req.user.id;
  const other = parseInt(req.params.userId);
  if (isNaN(other)) return res.status(400).json({ success: false, message: 'Invalid userId' });
  if (me === other) return res.status(400).json({ success: false, message: 'Cannot message yourself' });

  const { content, type = 'text', event_id } = req.body;
  if (type === 'text' && !content?.trim())
    return res.status(400).json({ success: false, message: 'content required' });
  if (type === 'text' && content && content.trim().length > 1000)
    return res.status(400).json({ success: false, message: 'Message too long (max 1000 characters)' });
  if (type === 'event' && !event_id)
    return res.status(400).json({ success: false, message: 'event_id required' });

  try {
    const [[receiver]] = await pool.execute('SELECT id FROM Users WHERE id = ?', [other]);
    if (!receiver) return res.status(404).json({ success: false, message: 'User not found' });

    const [result] = await pool.execute(
      'INSERT INTO DirectMessages (sender_id, receiver_id, content, type, event_id) VALUES (?, ?, ?, ?, ?)',
      [me, other, type === 'text' ? content.trim() : null, type, event_id || null]
    );

    // Fetch from each party's perspective in parallel
    const [msgForSender, msgForReceiver] = await Promise.all([
      fetchMsg(result.insertId, me),
      fetchMsg(result.insertId, other),
    ]);

    const io = req.app.get('io');
    if (io) io.to(`user_${other}`).emit('new_dm', msgForReceiver);

    res.status(201).json({ success: true, message: msgForSender });
  } catch (err) {
    console.error('DM send error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/dm/:userId/read — mark all messages from that user as read
router.put('/:userId/read', async (req, res) => {
  const me = req.user.id;
  const other = parseInt(req.params.userId);
  if (isNaN(other)) return res.status(400).json({ success: false, message: 'Invalid userId' });

  try {
    await pool.execute(
      'UPDATE DirectMessages SET is_read = 1 WHERE receiver_id = ? AND sender_id = ? AND is_read = 0',
      [me, other]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('DM read error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
