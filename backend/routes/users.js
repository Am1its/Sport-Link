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
  try {
    const ids = (req.query.ids || '').split(',').map(Number).filter(Boolean);
    if (ids.length === 0) return res.json({ success: true, avatars: [] });
    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await pool.execute(
      `SELECT id, avatar FROM Users WHERE id IN (${placeholders})`, ids
    );
    res.json({ success: true, avatars: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
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

// PUT /api/users/me — only updates fields that are explicitly provided
router.put('/me', authMiddleware, async (req, res) => {
  const { username, bio, avatar, onboarding_complete } = req.body;
  const userId = req.user.id;

  try {
    if (username !== undefined) {
      if (!username.trim()) return res.status(400).json({ success: false, message: 'Username cannot be empty' });
      const [[taken]] = await pool.execute(
        'SELECT id FROM Users WHERE username = ? AND id != ?', [username.trim(), userId]
      );
      if (taken) return res.status(409).json({ success: false, message: 'Username already taken' });
    }

    // Build the SET clause dynamically — only touch fields that were sent
    const setClauses = [];
    const values = [];

    if (username !== undefined) {
      setClauses.push('username = ?');
      values.push(username.trim());
    }
    if (bio !== undefined) {
      setClauses.push('bio = ?');
      values.push(bio || null);
    }
    if (avatar !== undefined) {
      setClauses.push('avatar = ?');
      values.push(avatar || null);
    }
    if (onboarding_complete !== undefined) {
      setClauses.push('onboarding_complete = ?');
      values.push(onboarding_complete ? 1 : 0);
    }

    if (setClauses.length > 0) {
      values.push(userId);
      await pool.execute(
        `UPDATE Users SET ${setClauses.join(', ')} WHERE id = ?`,
        values
      );
    }

    const user = await fetchUser(userId);
    res.json({ success: true, user });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ success: false, message: 'Username already taken' });
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/users/search?q= — find users by username prefix (for friend requests)
router.get('/search', authMiddleware, async (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.json({ success: true, users: [] });
  try {
    const [rows] = await pool.execute(
      `SELECT id, username, avatar FROM Users
       WHERE username LIKE ? AND id != ?
       LIMIT 20`,
      [`${q}%`, req.user.id]
    );
    res.json({ success: true, users: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/users/push-token — save or clear Expo push token
router.put('/push-token', authMiddleware, async (req, res) => {
  const { push_token } = req.body;
  try {
    await pool.execute('UPDATE Users SET push_token = ? WHERE id = ?', [push_token || null, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/users/:id — public profile (registered last to avoid shadowing /me /avatars /leaderboard)
router.get('/:id', authMiddleware, async (req, res) => {
  const targetId = parseInt(req.params.id);
  if (isNaN(targetId)) return res.status(400).json({ success: false, message: 'Invalid user id' });
  try {
    const user = await fetchUser(targetId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const { avatar, username, bio, karma, games_hosted, games_joined } = user;
    res.json({ success: true, user: { id: targetId, username, bio, avatar, karma, games_hosted, games_joined } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
