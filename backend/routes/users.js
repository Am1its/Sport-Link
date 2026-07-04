const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');
const { KARMA_SQL } = require('../utils/karmaSQL');
const { isValidUsername } = require('../utils/validators');

const router = express.Router();

// community_skill is the average PeerRatings.skill for this user within this sport
// (peer-submitted, anonymous), shown alongside the self-reported skill_level. Requires
// at least 3 ratings before surfacing — otherwise a couple of ratings could be
// misleadingly precise or easily gamed.
const fetchSportPreferences = async (userId) => {
  const [rows] = await pool.execute(
    `SELECT sp.sport_type, sp.skill_level, sp.is_favorite,
            cs.community_skill, cs.rating_count AS community_rating_count
     FROM SportPreferences sp
     LEFT JOIN (
       SELECT g.sport_type, pr.ratee_id,
              ROUND(AVG(pr.skill), 1) AS community_skill,
              COUNT(*) AS rating_count
       FROM PeerRatings pr
       JOIN Games g ON g.id = pr.game_id
       WHERE pr.ratee_id = ? AND pr.skill IS NOT NULL
       GROUP BY g.sport_type, pr.ratee_id
       HAVING COUNT(*) >= 3
     ) cs ON cs.sport_type = sp.sport_type
     WHERE sp.user_id = ?
     ORDER BY sp.is_favorite DESC, sp.sport_type ASC`,
    [userId, userId]
  );
  return rows.map(r => ({
    ...r,
    community_skill: r.community_skill != null ? Number(r.community_skill) : null,
  }));
};

const fetchUser = async (userId) => {
  const [[user]] = await pool.execute(
    `SELECT
       u.id,
       u.username,
       u.bio,
       u.avatar,
       u.current_streak,
       u.longest_streak,
       (SELECT COUNT(*) FROM Games WHERE host_id = u.id AND status != 'cancelled') AS games_hosted,
       (
         SELECT COUNT(*) FROM GameParticipants gp2
         JOIN Games g2 ON g2.id = gp2.game_id
         WHERE gp2.user_id = u.id AND gp2.status = 'joined' AND g2.status != 'cancelled'
       ) AS games_joined,
       ${KARMA_SQL} AS karma,
       (
         SELECT sport_type FROM (
           SELECT sport_type FROM Games WHERE host_id = u.id AND status != 'cancelled'
           UNION ALL
           SELECT g3.sport_type FROM Games g3
           JOIN GameParticipants gp3 ON gp3.game_id = g3.id
           WHERE gp3.user_id = u.id AND gp3.status = 'joined' AND g3.status != 'cancelled'
         ) ts GROUP BY sport_type ORDER BY COUNT(*) DESC LIMIT 1
       ) AS top_sport
     FROM Users u WHERE u.id = ?`,
    [userId]
  );
  return user;
};

const fetchBadges = async (userId) => {
  const [rows] = await pool.execute(
    'SELECT badge_key, earned_at FROM Badges WHERE user_id = ? ORDER BY earned_at ASC',
    [userId]
  );
  return rows;
};

// GET /api/users/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const [user, sport_preferences, badges] = await Promise.all([
      fetchUser(req.user.id),
      fetchSportPreferences(req.user.id),
      fetchBadges(req.user.id),
    ]);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user: { ...user, sport_preferences, badges } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/users/avatars?ids=1,2,3
router.get('/avatars', authMiddleware, async (req, res) => {
  try {
    const ids = (req.query.ids || '').split(',').map(Number).filter(Boolean).slice(0, 50);
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

// The karma subqueries scan Ratings/PeerRatings per user on every request. Block lists are
// per-viewer, so instead of re-running the full scan per request, cache a larger unfiltered
// pool (top 100 by karma) for a few minutes and apply each viewer's block filter in JS.
const LEADERBOARD_CACHE_MS  = 5 * 60 * 1000;
const LEADERBOARD_POOL_SIZE = 100;
let leaderboardCache = { data: null, expiresAt: 0 };

const getLeaderboardPool = async () => {
  if (leaderboardCache.data && Date.now() < leaderboardCache.expiresAt) return leaderboardCache.data;
  const [rows] = await pool.execute(`
    SELECT
      u.id,
      u.username,
      u.avatar,
      (SELECT COUNT(*) FROM Games WHERE host_id = u.id AND status != 'cancelled') AS games_hosted,
      (
        SELECT COUNT(*) FROM GameParticipants gp
        JOIN Games g ON g.id = gp.game_id
        WHERE gp.user_id = u.id AND gp.status = 'joined' AND g.status != 'cancelled'
      ) AS games_joined,
      ${KARMA_SQL} AS karma
    FROM Users u
    ORDER BY karma DESC
    LIMIT ${LEADERBOARD_POOL_SIZE}
  `);
  leaderboardCache = { data: rows, expiresAt: Date.now() + LEADERBOARD_CACHE_MS };
  return rows;
};

// GET /api/users/leaderboard — top 20 by karma (excludes blocked users)
router.get('/leaderboard', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  try {
    const pool_ = await getLeaderboardPool();
    const [blockRows] = await pool.execute(
      'SELECT blocker_id, blocked_id FROM BlockedUsers WHERE blocker_id = ? OR blocked_id = ?',
      [userId, userId]
    );
    const blockedIds = new Set();
    blockRows.forEach(r => {
      blockedIds.add(r.blocker_id === userId ? r.blocked_id : r.blocker_id);
    });
    const leaderboard = pool_.filter(r => !blockedIds.has(r.id)).slice(0, 20);
    res.json({ success: true, leaderboard });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/users/blocked — list blocked users
router.get('/blocked', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  try {
    const [rows] = await pool.execute(
      `SELECT u.id, u.username, u.avatar
       FROM BlockedUsers b
       JOIN Users u ON u.id = b.blocked_id
       WHERE b.blocker_id = ?
       ORDER BY b.created_at DESC`,
      [userId]
    );
    res.json({ success: true, blocked: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/users/:id/block — block a user
router.post('/:id/block', authMiddleware, async (req, res) => {
  const blockerId = req.user.id;
  const blockedId = parseInt(req.params.id);
  if (isNaN(blockedId) || blockedId === blockerId)
    return res.status(400).json({ success: false, message: 'Invalid user id' });
  try {
    await pool.execute(
      'INSERT IGNORE INTO BlockedUsers (blocker_id, blocked_id) VALUES (?, ?)',
      [blockerId, blockedId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/users/:id/block — unblock a user
router.delete('/:id/block', authMiddleware, async (req, res) => {
  const blockerId = req.user.id;
  const blockedId = parseInt(req.params.id);
  if (isNaN(blockedId))
    return res.status(400).json({ success: false, message: 'Invalid user id' });
  try {
    await pool.execute(
      'DELETE FROM BlockedUsers WHERE blocker_id = ? AND blocked_id = ?',
      [blockerId, blockedId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/users/:id/report — report a user
router.post('/:id/report', authMiddleware, async (req, res) => {
  const reporterId = req.user.id;
  const reportedId = parseInt(req.params.id);
  const { reason, context } = req.body;
  if (isNaN(reportedId) || reportedId === reporterId)
    return res.status(400).json({ success: false, message: 'Invalid user id' });
  const validReasons = ['spam', 'harassment', 'inappropriate', 'other'];
  if (!validReasons.includes(reason))
    return res.status(400).json({ success: false, message: 'Invalid reason' });
  if (context && context.length > 500)
    return res.status(400).json({ success: false, message: 'context max 500 chars' });
  try {
    await pool.execute(
      'INSERT INTO Reports (reporter_id, reported_id, reason, context) VALUES (?, ?, ?, ?)',
      [reporterId, reportedId, reason, context?.trim() ?? null]
    );
    res.json({ success: true });
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
    if (bio !== undefined && bio && bio.length > 200)
      return res.status(400).json({ success: false, message: 'bio must be 200 characters or less' });
    if (username !== undefined) {
      if (!isValidUsername(username))
        return res.status(400).json({ success: false, message: 'Username must be 3-30 characters (letters, numbers, underscore, period only)' });
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

// DELETE /api/users/me — permanently delete the current user's account.
// Every FK referencing Users(id) is ON DELETE CASCADE, so this transitively removes
// all games hosted, participations, messages, ratings, friends, DMs, reviews, etc.
router.delete('/me', authMiddleware, async (req, res) => {
  try {
    const [result] = await pool.execute('DELETE FROM Users WHERE id = ?', [req.user.id]);
    if (result.affectedRows === 0)
      return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/users/search?q= — find users by username prefix (for friend requests)
router.get('/search', authMiddleware, async (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.json({ success: true, users: [] });
  try {
    const userId = req.user.id;
    const [rows] = await pool.execute(
      `SELECT id, username, avatar FROM Users
       WHERE username LIKE ? AND id != ?
         AND id NOT IN (SELECT blocked_id FROM BlockedUsers WHERE blocker_id = ?)
         AND id NOT IN (SELECT blocker_id FROM BlockedUsers WHERE blocked_id = ?)
       LIMIT 20`,
      [`${q}%`, userId, userId, userId]
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

// GET /api/users/sport-preferences — current user's per-sport prefs
router.get('/sport-preferences', authMiddleware, async (req, res) => {
  try {
    const prefs = await fetchSportPreferences(req.user.id);
    res.json({ success: true, sport_preferences: prefs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/users/sport-preferences — upsert array of { sport_type, skill_level, is_favorite }
router.put('/sport-preferences', authMiddleware, async (req, res) => {
  const { preferences } = req.body; // [{ sport_type, skill_level, is_favorite }]
  const userId = req.user.id;
  if (!Array.isArray(preferences)) return res.status(400).json({ success: false, message: 'preferences must be an array' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // Delete all existing prefs for this user then re-insert
    await conn.execute('DELETE FROM SportPreferences WHERE user_id = ?', [userId]);
    for (const pref of preferences) {
      const { sport_type, skill_level, is_favorite } = pref;
      if (!sport_type || skill_level == null) continue;
      await conn.execute(
        'INSERT INTO SportPreferences (user_id, sport_type, skill_level, is_favorite) VALUES (?, ?, ?, ?)',
        [userId, sport_type, skill_level, is_favorite ? 1 : 0]
      );
    }
    await conn.commit();
    const prefs = await fetchSportPreferences(userId);
    res.json({ success: true, sport_preferences: prefs });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    conn.release();
  }
});

// GET /api/users/suggestions?lat=&lng=&sport= — player matching
router.get('/suggestions', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const lat    = parseFloat(req.query.lat);
  const lng    = parseFloat(req.query.lng);
  const sport  = req.query.sport?.trim() || null;
  const hasLocation = !isNaN(lat) && !isNaN(lng);

  try {
    // Check if current user has sport preferences
    const [[{ prefCount }]] = await pool.execute(
      'SELECT COUNT(*) AS prefCount FROM SportPreferences WHERE user_id = ?',
      [userId]
    );

    let rows;

    if (Number(prefCount) === 0 && !sport) {
      // Fallback: no preferences — return karma-ranked non-friends
      const locationClause = hasLocation
        ? `AND EXISTS (
             SELECT 1 FROM (
               SELECT latitude, longitude FROM Games WHERE host_id = u.id
               UNION ALL
               SELECT g2.latitude, g2.longitude FROM Games g2
               JOIN GameParticipants gp2 ON gp2.game_id = g2.id AND gp2.user_id = u.id
             ) coords
             WHERE (6371 * acos(GREATEST(-1, LEAST(1,
               cos(radians(${lat})) * cos(radians(coords.latitude)) *
               cos(radians(coords.longitude) - radians(${lng})) +
               sin(radians(${lat})) * sin(radians(coords.latitude))
             )))) <= 20
           )`
        : '';
      [rows] = await pool.execute(`
        SELECT
          u.id, u.username, u.avatar,
          0 AS shared_count, '' AS shared_sports,
          ${KARMA_SQL} AS karma,
          (
            SELECT sport_type FROM (
              SELECT sport_type FROM Games WHERE host_id = u.id
              UNION ALL
              SELECT g2.sport_type FROM Games g2
              JOIN GameParticipants gp2 ON gp2.game_id = g2.id AND gp2.user_id = u.id
            ) ts GROUP BY sport_type ORDER BY COUNT(*) DESC LIMIT 1
          ) AS top_sport,
          (
            SELECT COUNT(DISTINCT g.id) FROM Games g
            WHERE g.status = 'completed'
              AND (g.host_id = u.id OR EXISTS (SELECT 1 FROM GameParticipants WHERE game_id = g.id AND user_id = u.id))
              AND (g.host_id = ? OR EXISTS (SELECT 1 FROM GameParticipants WHERE game_id = g.id AND user_id = ?))
          ) AS shared_game_count
        FROM Users u
        WHERE u.id != ?
          AND NOT EXISTS (
            SELECT 1 FROM Friends
            WHERE (requester_id=? AND addressee_id=u.id) OR (requester_id=u.id AND addressee_id=?)
          )
          AND u.id NOT IN (SELECT blocked_id FROM BlockedUsers WHERE blocker_id = ?)
          AND u.id NOT IN (SELECT blocker_id FROM BlockedUsers WHERE blocked_id = ?)
          ${locationClause}
        ORDER BY shared_game_count DESC, karma DESC
        LIMIT 20
      `, [userId, userId, userId, userId, userId, userId, userId]);
    } else {
      // Match by shared sport preferences (or specific sport filter)
      const sportJoinClause = sport
        ? `INNER JOIN SportPreferences sp_match ON sp_match.user_id = u.id AND sp_match.sport_type = ?`
        : `INNER JOIN SportPreferences sp_match ON sp_match.user_id = u.id
             AND sp_match.sport_type IN (SELECT sport_type FROM SportPreferences WHERE user_id = ?)`;

      const locationClause = hasLocation
        ? `AND EXISTS (
             SELECT 1 FROM (
               SELECT latitude, longitude FROM Games WHERE host_id = u.id
               UNION ALL
               SELECT g2.latitude, g2.longitude FROM Games g2
               JOIN GameParticipants gp2 ON gp2.game_id = g2.id AND gp2.user_id = u.id
             ) coords
             WHERE (6371 * acos(GREATEST(-1, LEAST(1,
               cos(radians(${lat})) * cos(radians(coords.latitude)) *
               cos(radians(coords.longitude) - radians(${lng})) +
               sin(radians(${lat})) * sin(radians(coords.latitude))
             )))) <= 20
           )`
        : '';

      const param1 = sport ? sport : userId;
      [rows] = await pool.execute(`
        SELECT
          u.id, u.username, u.avatar,
          COUNT(DISTINCT sp_match.sport_type) AS shared_count,
          GROUP_CONCAT(DISTINCT sp_match.sport_type ORDER BY sp_match.sport_type SEPARATOR ',') AS shared_sports,
          ${KARMA_SQL} AS karma,
          (
            SELECT sport_type FROM (
              SELECT sport_type FROM Games WHERE host_id = u.id
              UNION ALL
              SELECT g2.sport_type FROM Games g2
              JOIN GameParticipants gp2 ON gp2.game_id = g2.id AND gp2.user_id = u.id
            ) ts GROUP BY sport_type ORDER BY COUNT(*) DESC LIMIT 1
          ) AS top_sport,
          (
            SELECT COUNT(DISTINCT g.id) FROM Games g
            WHERE g.status = 'completed'
              AND (g.host_id = u.id OR EXISTS (SELECT 1 FROM GameParticipants WHERE game_id = g.id AND user_id = u.id))
              AND (g.host_id = ? OR EXISTS (SELECT 1 FROM GameParticipants WHERE game_id = g.id AND user_id = ?))
          ) AS shared_game_count
        FROM Users u
        ${sportJoinClause}
        WHERE u.id != ?
          AND NOT EXISTS (
            SELECT 1 FROM Friends
            WHERE (requester_id=? AND addressee_id=u.id) OR (requester_id=u.id AND addressee_id=?)
          )
          AND u.id NOT IN (SELECT blocked_id FROM BlockedUsers WHERE blocker_id = ?)
          AND u.id NOT IN (SELECT blocker_id FROM BlockedUsers WHERE blocked_id = ?)
          ${locationClause}
        GROUP BY u.id, u.username, u.avatar
        ORDER BY shared_count DESC, shared_game_count DESC, karma DESC
        LIMIT 20
      `, [param1, userId, userId, userId, userId, userId, userId, userId]);
    }

    const enriched = rows.map(r => ({
      ...r,
      shared_sports: r.shared_sports ? r.shared_sports.split(',') : [],
      karma: Number(r.karma),
      shared_count: Number(r.shared_count),
      shared_game_count: Number(r.shared_game_count ?? 0),
      top_sport: r.top_sport ?? null,
    }));

    res.json({ success: true, suggestions: enriched });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/users/:id — public profile (registered last to avoid shadowing /me /avatars /leaderboard)
router.get('/:id', authMiddleware, async (req, res) => {
  const targetId = parseInt(req.params.id);
  const viewerId = req.user.id;
  if (isNaN(targetId)) return res.status(400).json({ success: false, message: 'Invalid user id' });
  try {
    const [user, sport_preferences, badges] = await Promise.all([
      fetchUser(targetId),
      fetchSportPreferences(targetId),
      fetchBadges(targetId),
    ]);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const { avatar, username, bio, karma, games_hosted, games_joined, top_sport, current_streak, longest_streak } = user;

    // Determine friendship status between viewer and target
    let friendship_status = 'none';
    let friendship_id = null;
    if (viewerId !== targetId) {
      const [[row]] = await pool.execute(
        'SELECT id, requester_id, status FROM Friends WHERE (requester_id=? AND addressee_id=?) OR (requester_id=? AND addressee_id=?)',
        [viewerId, targetId, targetId, viewerId]
      );
      if (row) {
        friendship_id = row.id;
        if (row.status === 'accepted') {
          friendship_status = 'friends';
        } else if (row.requester_id === viewerId) {
          friendship_status = 'pending_sent';
        } else {
          friendship_status = 'pending_received';
        }
      }
    }

    res.json({ success: true, user: { id: targetId, username, bio, avatar, karma, games_hosted, games_joined, top_sport: top_sport ?? null, current_streak, longest_streak, sport_preferences, badges, friendship_status, friendship_id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
