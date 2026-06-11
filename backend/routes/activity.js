const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/activity
// Returns last 50 activity events from friends:
//   'joined' — a friend joined an active game
//   'created' — a friend created an active game
router.get('/', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  try {
    const [rows] = await pool.execute(`
      (
        SELECT
          'joined'            AS type,
          u.id                AS actor_id,
          u.username          AS actor_username,
          u.avatar            AS actor_avatar,
          g.id                AS game_id,
          g.sport_type,
          g.title,
          g.location_desc,
          g.latitude,
          g.longitude,
          g.scheduled_time,
          gp.joined_at        AS happened_at
        FROM GameParticipants gp
        JOIN Games g  ON g.id  = gp.game_id   AND g.status = 'active'
        JOIN Users u  ON u.id  = gp.user_id
        JOIN Friends f ON (
          (f.requester_id = ? AND f.addressee_id = gp.user_id) OR
          (f.addressee_id = ? AND f.requester_id = gp.user_id)
        ) AND f.status = 'accepted'
        WHERE gp.user_id != ?
          AND u.id NOT IN (SELECT blocked_id FROM BlockedUsers WHERE blocker_id = ?)
          AND u.id NOT IN (SELECT blocker_id FROM BlockedUsers WHERE blocked_id = ?)
      )
      UNION ALL
      (
        SELECT
          'created'           AS type,
          u.id                AS actor_id,
          u.username          AS actor_username,
          u.avatar            AS actor_avatar,
          g.id                AS game_id,
          g.sport_type,
          g.title,
          g.location_desc,
          g.latitude,
          g.longitude,
          g.scheduled_time,
          g.created_at        AS happened_at
        FROM Games g
        JOIN Users u  ON u.id  = g.host_id
        JOIN Friends f ON (
          (f.requester_id = ? AND f.addressee_id = g.host_id) OR
          (f.addressee_id = ? AND f.requester_id = g.host_id)
        ) AND f.status = 'accepted'
        WHERE g.status = 'active' AND g.host_id != ?
          AND u.id NOT IN (SELECT blocked_id FROM BlockedUsers WHERE blocker_id = ?)
          AND u.id NOT IN (SELECT blocker_id FROM BlockedUsers WHERE blocked_id = ?)
      )
      ORDER BY happened_at DESC
      LIMIT 50
    `, [userId, userId, userId, userId, userId, userId, userId, userId, userId, userId]);

    res.json({ success: true, activities: rows });
  } catch (err) {
    console.error('Activity feed error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
