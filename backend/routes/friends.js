const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');
const sendPushNotifications = require('../utils/sendPushNotification');
const { KARMA_SQL } = require('../utils/karmaSQL');

const router = express.Router();

// GET /api/friends — accepted friends list
router.get('/', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  try {
    const [rows] = await pool.execute(`
      SELECT
        f.id AS friendship_id,
        u.id, u.username, u.avatar,
        ${KARMA_SQL} AS karma
      FROM Friends f
      JOIN Users u ON u.id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END
      WHERE (f.requester_id = ? OR f.addressee_id = ?) AND f.status = 'accepted'
        AND u.id NOT IN (SELECT blocked_id FROM BlockedUsers WHERE blocker_id = ?)
        AND u.id NOT IN (SELECT blocker_id FROM BlockedUsers WHERE blocked_id = ?)
      ORDER BY u.username ASC
    `, [userId, userId, userId, userId, userId]);
    res.json({ success: true, friends: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/friends/requests — incoming pending requests
router.get('/requests', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  try {
    const [rows] = await pool.execute(`
      SELECT f.id AS friendship_id, u.id, u.username, u.avatar, f.created_at
      FROM Friends f
      JOIN Users u ON u.id = f.requester_id
      WHERE f.addressee_id = ? AND f.status = 'pending'
        AND u.id NOT IN (SELECT blocked_id FROM BlockedUsers WHERE blocker_id = ?)
        AND u.id NOT IN (SELECT blocker_id FROM BlockedUsers WHERE blocked_id = ?)
      ORDER BY f.created_at DESC
    `, [userId, userId, userId]);
    res.json({ success: true, requests: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/friends — send a friend request
router.post('/', authMiddleware, async (req, res) => {
  const requesterId = req.user.id;
  const { addressee_id } = req.body;
  if (!addressee_id) return res.status(400).json({ success: false, message: 'addressee_id is required' });
  if (addressee_id === requesterId) return res.status(400).json({ success: false, message: 'Cannot friend yourself' });

  try {
    // Check if any relationship already exists (either direction)
    const [[existing]] = await pool.execute(`
      SELECT id, status FROM Friends
      WHERE (requester_id=? AND addressee_id=?) OR (requester_id=? AND addressee_id=?)
    `, [requesterId, addressee_id, addressee_id, requesterId]);

    if (existing) {
      const msg = existing.status === 'accepted' ? 'Already friends' : 'Request already sent';
      return res.status(409).json({ success: false, message: msg });
    }

    await pool.execute(
      'INSERT INTO Friends (requester_id, addressee_id) VALUES (?, ?)',
      [requesterId, addressee_id]
    );

    // Notify the addressee
    const [[addressee]] = await pool.execute('SELECT push_token, username FROM Users WHERE id = ?', [addressee_id]);
    const [[requester]] = await pool.execute('SELECT username FROM Users WHERE id = ?', [requesterId]);
    if (addressee?.push_token) {
      sendPushNotifications([{
        to: addressee.push_token,
        title: '👋 New friend request!',
        body: `${requester.username} wants to be your friend.`,
        data: { screen: 'friends' },
      }]);
    }

    res.status(201).json({ success: true });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ success: false, message: 'Request already sent' });
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/friends/:id/accept — accept a pending request
router.put('/:id/accept', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const friendshipId = parseInt(req.params.id);
  try {
    const [[row]] = await pool.execute(
      "SELECT * FROM Friends WHERE id = ? AND addressee_id = ? AND status = 'pending'",
      [friendshipId, userId]
    );
    if (!row) return res.status(404).json({ success: false, message: 'Request not found' });

    await pool.execute("UPDATE Friends SET status = 'accepted' WHERE id = ?", [friendshipId]);

    // Notify the original requester
    const [[requester]] = await pool.execute('SELECT push_token FROM Users WHERE id = ?', [row.requester_id]);
    const [[accepter]]  = await pool.execute('SELECT username FROM Users WHERE id = ?', [userId]);
    if (requester?.push_token) {
      sendPushNotifications([{
        to: requester.push_token,
        title: '🤝 Friend request accepted!',
        body: `${accepter.username} accepted your friend request.`,
        data: { screen: 'friends' },
      }]);
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/friends/:id — remove friend or reject/cancel request
router.delete('/:id', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const friendshipId = parseInt(req.params.id);
  try {
    const [[row]] = await pool.execute(
      'SELECT * FROM Friends WHERE id = ? AND (requester_id = ? OR addressee_id = ?)',
      [friendshipId, userId, userId]
    );
    if (!row) return res.status(404).json({ success: false, message: 'Friendship not found' });

    await pool.execute('DELETE FROM Friends WHERE id = ?', [friendshipId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
