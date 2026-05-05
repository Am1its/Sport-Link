const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

const fetchUser = async (userId) => {
  const [[user]] = await pool.execute(
    `SELECT
       u.id,
       u.username,
       u.bio,
       u.avatar,
       (SELECT COUNT(*) FROM Games            WHERE host_id  = u.id) AS games_hosted,
       (SELECT COUNT(*) FROM GameParticipants WHERE user_id  = u.id) AS games_joined,
       COALESCE((
         SELECT SUM(CASE WHEN attended = 1 THEN 1 ELSE -1 END)
         FROM Ratings WHERE ratee_id = u.id
       ), 0) +
       COALESCE((
         SELECT SUM(
           CASE WHEN sportsmanship = 1 THEN 1 WHEN sportsmanship = 0 THEN -1 ELSE 0 END +
           CASE WHEN punctuality   = 1 THEN 1 WHEN punctuality   = 0 THEN -1 ELSE 0 END +
           CASE WHEN communication = 1 THEN 1 WHEN communication = 0 THEN -1 ELSE 0 END
         )
         FROM PeerRatings WHERE ratee_id = u.id
       ), 0) AS karma
     FROM Users u WHERE u.id = ?`,
    [userId]
  );
  return user;
};

// GET /api/users/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await fetchUser(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/users/avatars?ids=1,2,3
router.get('/avatars', authMiddleware, async (req, res) => {
  const ids = (req.query.ids || '').split(',').map(Number).filter(Boolean);
  if (ids.length === 0) return res.json({ success: true, avatars: [] });
  const placeholders = ids.map(() => '?').join(',');
  const [rows] = await pool.execute(
    `SELECT id, avatar FROM Users WHERE id IN (${placeholders})`, ids
  );
  res.json({ success: true, avatars: rows });
});

// GET /api/users/leaderboard — top 20 by karma
router.get('/leaderboard', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT
        u.id,
        u.username,
        u.avatar,
        (SELECT COUNT(*) FROM Games            WHERE host_id = u.id) AS games_hosted,
        (SELECT COUNT(*) FROM GameParticipants WHERE user_id = u.id) AS games_joined,
        COALESCE((
          SELECT SUM(CASE WHEN attended = 1 THEN 1 ELSE -1 END)
          FROM Ratings WHERE ratee_id = u.id
        ), 0) +
        COALESCE((
          SELECT SUM(
            CASE WHEN sportsmanship = 1 THEN 1 WHEN sportsmanship = 0 THEN -1 ELSE 0 END +
            CASE WHEN punctuality   = 1 THEN 1 WHEN punctuality   = 0 THEN -1 ELSE 0 END +
            CASE WHEN communication = 1 THEN 1 WHEN communication = 0 THEN -1 ELSE 0 END
          )
          FROM PeerRatings WHERE ratee_id = u.id
        ), 0) AS karma
      FROM Users u
      ORDER BY karma DESC
      LIMIT 20
    `);
    res.json({ success: true, leaderboard: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/users/me
router.put('/me', authMiddleware, async (req, res) => {
  const { username, bio, avatar } = req.body;
  const userId = req.user.id;

  try {
    if (username) {
      const [[taken]] = await pool.execute(
        'SELECT id FROM Users WHERE username = ? AND id != ?', [username, userId]
      );
      if (taken) return res.status(409).json({ success: false, message: 'Username already taken' });
    }

    await pool.execute(
      `UPDATE Users SET
         username = COALESCE(?, username),
         bio      = ?,
         avatar   = COALESCE(?, avatar)
       WHERE id = ?`,
      [username || null, bio !== undefined ? (bio || null) : null, avatar || null, userId]
    );

    const user = await fetchUser(userId);
    res.json({ success: true, user });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ success: false, message: 'Username already taken' });
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
