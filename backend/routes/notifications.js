const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/notifications — unread count + recent 50 notifications
router.get('/', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  try {
    const [countRes, listRes] = await Promise.all([
      pool.execute(
        'SELECT COUNT(*) AS unread_count FROM Notifications WHERE user_id = ? AND is_read = FALSE',
        [userId]
      ),
      pool.execute(
        `SELECT id, title, body, data, is_read, created_at
         FROM Notifications
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT 50`,
        [userId]
      ),
    ]);
    const unread_count = countRes[0][0].unread_count;
    const rows = listRes[0];
    res.json({ success: true, notifications: rows, unread_count: Number(unread_count) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/notifications/:id/read — mark one as read
router.put('/:id/read', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const notifId = parseInt(req.params.id);
  try {
    await pool.execute(
      'UPDATE Notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
      [notifId, userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/notifications/read-all — mark all as read
router.put('/read-all', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  try {
    await pool.execute(
      'UPDATE Notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE',
      [userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
