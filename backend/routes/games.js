const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');
const sendPushNotifications = require('../utils/sendPushNotification');

const router = express.Router();

// Decode JWT from Authorization header without requiring it.
// Returns the user id, or null if missing/invalid/expired.
function optionalUserId(req) {
  try {
    const raw = req.headers['authorization']?.split(' ')[1];
    return raw ? (jwt.verify(raw, process.env.JWT_SECRET)?.id ?? null) : null;
  } catch { return null; }
}

const toMapGame = (row) => ({
  id: row.id,
  place_id: `game_${row.id}`,
  title: row.title ?? null,
  name: row.title
    ? row.title
    : `${row.sport_type.charAt(0).toUpperCase() + row.sport_type.slice(1)} Community Game`,
  sport_type: row.sport_type,
  rating: row.level,
  vicinity: [
    row.location_desc,
    row.scheduled_time    ? `🕒 ${row.scheduled_time}`    : null,
    row.equipment_notes   ? `🎒 ${row.equipment_notes}`   : null,
  ].filter(Boolean).join(' | '),
  geometry: { location: { lat: parseFloat(row.latitude), lng: parseFloat(row.longitude) } },
  isLocalGame: true,
  level: row.level,
  max_players: row.max_players ?? null,
  participant_count: row.participant_count ?? 0,
  host_id: row.host_id,
  scheduled_time: row.scheduled_time,
  location_desc: row.location_desc,
  equipment_notes: row.equipment_notes ?? null,
  photo: row.photo ?? null,
  post_game_photo: row.post_game_photo ?? null,
  boosted_at: row.boosted_at ?? null,
  created_at: row.created_at,
  is_joined: row.is_joined != null ? Boolean(row.is_joined) : false,
  recurrence: row.recurrence ?? 'none',
  neighborhood: row.neighborhood ?? null,
  latitude: row.latitude != null ? parseFloat(row.latitude) : null,
  longitude: row.longitude != null ? parseFloat(row.longitude) : null,
});

// GET /api/games — public; optional ?lat=&lng=&radius_km=&q= for distance + text filter
// Authenticated: sorted by sport preference match + skill proximity.
// Unauthenticated: sorted by created_at DESC.
// ?q= uses FULLTEXT (words ≥ 3 chars) or LIKE fallback for shorter terms.
router.get('/', async (req, res) => {
  const { lat, lng, radius_km, q, date_from, date_to, neighborhood } = req.query;
  const useRadius       = lat && lng && radius_km;
  const searchTerm      = typeof q === 'string' ? q.trim() : '';
  const useSearch       = searchTerm.length >= 2;
  const useDateFilter   = date_from && date_to;
  const useNeighborhood = typeof neighborhood === 'string' && neighborhood.trim().length > 0;

  const userId = optionalUserId(req);

  try {
    const haversineExpr = `(6371 * ACOS(
      COS(RADIANS(?)) * COS(RADIANS(g.latitude)) *
      COS(RADIANS(g.longitude) - RADIANS(?)) +
      SIN(RADIANS(?)) * SIN(RADIANS(g.latitude))
    ))`;

    // Param order follows the position of ? in the SQL string:
    // 1. userId for is_joined EXISTS (if authed)
    // 2. lat, lng, lat for haversine (if radius)
    // 3. userId for SportPreferences JOIN (if authed)
    // 4. userId x2 for block filter WHERE subqueries (if authed)
    // 5. search term (if q) — FULLTEXT or two LIKE params
    // 6. date_from, date_to (if date filter)
    // 7. neighborhood (if neighborhood filter)
    // 8. radius_km for HAVING (if radius)
    const params = [];
    if (userId) params.push(userId);
    if (useRadius) params.push(parseFloat(lat), parseFloat(lng), parseFloat(lat));
    if (userId) params.push(userId);
    if (userId) params.push(userId, userId);
    if (useSearch) {
      if (searchTerm.length >= 3) {
        const booleanQuery = searchTerm.split(/\s+/).filter(Boolean).map(w => `+${w}*`).join(' ');
        params.push(booleanQuery);
      } else {
        params.push(`%${searchTerm}%`, `%${searchTerm}%`);
      }
    }
    if (useDateFilter) params.push(date_from, date_to);
    if (useNeighborhood) params.push(neighborhood.trim());
    if (useRadius) params.push(parseFloat(radius_km));

    const searchClause = !useSearch ? '' : searchTerm.length >= 3
      ? 'AND MATCH(g.title, g.location_desc) AGAINST (? IN BOOLEAN MODE)'
      : 'AND (g.title LIKE ? OR g.location_desc LIKE ?)';

    const dateClause = useDateFilter
      ? "AND DATE(STR_TO_DATE(g.scheduled_time, '%Y-%m-%d %H:%i')) BETWEEN ? AND ?"
      : '';

    const neighborhoodClause = useNeighborhood ? 'AND g.neighborhood = ?' : '';

    const [rows] = await pool.execute(`
      SELECT g.*, COUNT(CASE WHEN COALESCE(gp.status, 'joined') = 'joined' THEN gp.user_id END) AS participant_count
        ${userId ? ', CAST(EXISTS(SELECT 1 FROM GameParticipants WHERE game_id = g.id AND user_id = ?) AS UNSIGNED) AS is_joined' : ''}
        ${useRadius ? `, ${haversineExpr} AS distance_km` : ''}
      FROM Games g
      LEFT JOIN GameParticipants gp ON gp.game_id = g.id
      ${userId ? 'LEFT JOIN SportPreferences sp ON sp.user_id = ? AND sp.sport_type = g.sport_type' : ''}
      WHERE g.status = 'active'
        AND (
          g.scheduled_time IS NULL
          OR STR_TO_DATE(g.scheduled_time, '%Y-%m-%d %H:%i') IS NULL
          OR STR_TO_DATE(g.scheduled_time, '%Y-%m-%d %H:%i') > DATE_SUB(NOW(), INTERVAL 3 HOUR)
        )
        ${userId ? `AND g.host_id NOT IN (SELECT blocked_id FROM BlockedUsers WHERE blocker_id = ?)
        AND g.host_id NOT IN (SELECT blocker_id FROM BlockedUsers WHERE blocked_id = ?)` : ''}
        ${searchClause}
        ${dateClause}
        ${neighborhoodClause}
      GROUP BY g.id
      ${useRadius ? 'HAVING distance_km <= ?' : ''}
      ORDER BY
        ${userId ? `
          CASE WHEN MAX(sp.sport_type) IS NOT NULL THEN 1 ELSE 0 END DESC,
          MAX(COALESCE(sp.is_favorite, 0)) DESC,
          ABS(g.level - COALESCE(MAX(sp.skill_level), 3)) ASC,
          STR_TO_DATE(g.scheduled_time, '%Y-%m-%d %H:%i') ASC
        ` : 'g.created_at DESC'}
    `, params);

    res.json({ success: true, games: rows.map(toMapGame) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/games/mine — requires auth
router.get('/mine', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  try {
    const [rows] = await pool.execute(`
      SELECT g.*,
        COUNT(CASE WHEN COALESCE(gp.status, 'joined') = 'joined' THEN gp.user_id END) AS participant_count,
        (g.host_id = ?)            AS is_host,
        (SELECT status FROM GameParticipants WHERE game_id = g.id AND user_id = ?)            AS participant_status,
        (SELECT waitlist_position FROM GameParticipants WHERE game_id = g.id AND user_id = ?) AS waitlist_position,
        CAST(COALESCE((SELECT 1 FROM GameParticipants WHERE game_id = g.id AND user_id = ? AND checked_in_at IS NOT NULL), 0) AS UNSIGNED) AS checked_in
      FROM Games g
      LEFT JOIN GameParticipants gp ON gp.game_id = g.id
      WHERE g.status IN ('active', 'completed')
        AND (
          g.host_id = ?
          OR EXISTS (SELECT 1 FROM GameParticipants WHERE game_id = g.id AND user_id = ?)
        )
      GROUP BY g.id
      ORDER BY g.created_at DESC
    `, [userId, userId, userId, userId, userId, userId]);

    const games = rows.map((row) => ({
      ...toMapGame(row),
      is_host: !!row.is_host,
      status: row.status,
      participant_status: row.participant_status ?? null,
      waitlist_position: row.waitlist_position ?? null,
      checked_in: !!row.checked_in,
    }));
    res.json({ success: true, games });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/games/:id — single game detail (auth-optional: includes is_joined if authed)
router.get('/:id', async (req, res) => {
  const gameId = parseInt(req.params.id);
  if (isNaN(gameId)) return res.status(400).json({ success: false, message: 'Invalid game id' });

  const userId = optionalUserId(req);

  try {
    const params = [];
    if (userId) params.push(userId);
    params.push(gameId);

    const [[row]] = await pool.execute(`
      SELECT g.*, COUNT(gp.user_id) AS participant_count,
        u.username AS host_username
        ${userId ? ', CAST(EXISTS(SELECT 1 FROM GameParticipants WHERE game_id = g.id AND user_id = ?) AS UNSIGNED) AS is_joined' : ''}
      FROM Games g
      LEFT JOIN GameParticipants gp ON gp.game_id = g.id
      JOIN Users u ON u.id = g.host_id
      WHERE g.id = ?
      GROUP BY g.id
    `, params);

    if (!row) return res.status(404).json({ success: false, message: 'Game not found' });
    res.json({ success: true, game: { ...toMapGame(row), host_username: row.host_username, status: row.status } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/games/:id/complete — host closes the game
router.post('/:id/complete', authMiddleware, async (req, res) => {
  const gameId = parseInt(req.params.id);
  const userId = req.user.id;
  try {
    const [[game]] = await pool.execute(
      "SELECT host_id FROM Games WHERE id = ? AND status = 'active'", [gameId]
    );
    if (!game) return res.status(404).json({ success: false, message: 'Game not found or already closed' });
    if (game.host_id !== userId)
      return res.status(403).json({ success: false, message: 'Only the host can close this game' });

    await pool.execute("UPDATE Games SET status = 'completed' WHERE id = ?", [gameId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/games/:id/join — requires auth
// Uses a transaction + FOR UPDATE to prevent race-condition over-fill
router.post('/:id/join', authMiddleware, async (req, res) => {
  const gameId = parseInt(req.params.id);
  const userId = req.user.id;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[game]] = await conn.execute(
      "SELECT * FROM Games WHERE id = ? AND status = 'active' FOR UPDATE", [gameId]
    );
    if (!game) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Game not found' });
    }
    if (game.host_id === userId) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'You are the host of this game' });
    }

    const [[already]] = await conn.execute(
      'SELECT id FROM GameParticipants WHERE game_id = ? AND user_id = ?', [gameId, userId]
    );
    if (already) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'You already joined this game' });
    }

    let waitlisted = false;
    let waitlistPosition = null;

    if (game.max_players) {
      const [[{ count }]] = await conn.execute(
        "SELECT COUNT(*) AS count FROM GameParticipants WHERE game_id = ? AND status = 'joined'", [gameId]
      );
      // Host occupies one slot; participants fill the remaining max_players - 1 spots
      if (count >= game.max_players - 1) {
        // Game is full — add to waitlist
        const [[{ maxPos }]] = await conn.execute(
          'SELECT COALESCE(MAX(waitlist_position), 0) AS maxPos FROM GameParticipants WHERE game_id = ?', [gameId]
        );
        waitlistPosition = maxPos + 1;
        waitlisted = true;
      }
    }

    if (waitlisted) {
      await conn.execute(
        "INSERT INTO GameParticipants (game_id, user_id, status, waitlist_position) VALUES (?, ?, 'waitlist', ?)",
        [gameId, userId, waitlistPosition]
      );
    } else {
      await conn.execute('INSERT INTO GameParticipants (game_id, user_id) VALUES (?, ?)', [gameId, userId]);
    }

    const [[{ count: newCount }]] = await conn.execute(
      "SELECT COUNT(*) AS count FROM GameParticipants WHERE game_id = ? AND status = 'joined'", [gameId]
    );
    await conn.commit();

    // Notify the host (outside transaction)
    const [[joiner]]  = await pool.execute('SELECT username FROM Users WHERE id = ?', [userId]);
    const [[hostRow]] = await pool.execute('SELECT push_token FROM Users WHERE id = ?', [game.host_id]);
    if (!waitlisted && hostRow?.push_token) {
      sendPushNotifications([{
        to: hostRow.push_token,
        title: '🏅 New player joined!',
        body: `${joiner.username} joined your ${game.sport_type} game.`,
        data: { gameId },
      }]);
    }

    res.json({ success: true, participant_count: newCount, waitlisted, waitlist_position: waitlistPosition });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    conn.release();
  }
});

// GET /api/games/:id/participants — host + joined players with avatars
router.get('/:id/participants', authMiddleware, async (req, res) => {
  const gameId = parseInt(req.params.id);
  try {
    const [[game]] = await pool.execute('SELECT host_id FROM Games WHERE id = ?', [gameId]);
    if (!game) return res.status(404).json({ success: false, message: 'Game not found' });

    const [rows] = await pool.execute(`
      SELECT u.id, u.username, u.avatar,
             'host'  AS role,
             1       AS is_host,
             NULL    AS status,
             NULL    AS waitlist_position,
             0       AS checked_in
      FROM Users u WHERE u.id = ?
      UNION ALL
      SELECT u.id, u.username, u.avatar,
             'player' AS role,
             0        AS is_host,
             gp.status,
             gp.waitlist_position,
             (gp.checked_in_at IS NOT NULL) AS checked_in
      FROM GameParticipants gp JOIN Users u ON u.id = gp.user_id
      WHERE gp.game_id = ?
      ORDER BY is_host DESC, role ASC
    `, [game.host_id, gameId]);

    res.json({ success: true, participants: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/games/:id — host only, cancels the game and notifies participants
router.delete('/:id', authMiddleware, async (req, res) => {
  const gameId = parseInt(req.params.id);
  const userId = req.user.id;
  try {
    const [[game]] = await pool.execute(
      "SELECT * FROM Games WHERE id = ? AND status = 'active'", [gameId]
    );
    if (!game) return res.status(404).json({ success: false, message: 'Game not found' });
    if (game.host_id !== userId)
      return res.status(403).json({ success: false, message: 'Only the host can delete this game' });

    // Collect participant push tokens before cancelling
    const [participantRows] = await pool.execute(`
      SELECT u.push_token
      FROM GameParticipants gp
      JOIN Users u ON u.id = gp.user_id
      WHERE gp.game_id = ? AND u.push_token IS NOT NULL
    `, [gameId]);

    await pool.execute("UPDATE Games SET status = 'cancelled' WHERE id = ?", [gameId]);

    if (participantRows.length > 0) {
      const [[host]] = await pool.execute('SELECT username FROM Users WHERE id = ?', [userId]);
      sendPushNotifications(participantRows.map(r => ({
        to: r.push_token,
        title: '❌ Game cancelled',
        body: `${host.username}'s ${game.sport_type} game has been cancelled.`,
        data: { screen: 'games' },
      })));
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/games/:id/leave — participant only
router.delete('/:id/leave', authMiddleware, async (req, res) => {
  const gameId = parseInt(req.params.id);
  const userId = req.user.id;
  try {
    const [[game]] = await pool.execute(
      "SELECT host_id FROM Games WHERE id = ? AND status = 'active'", [gameId]
    );
    if (!game) return res.status(404).json({ success: false, message: 'Game not found' });
    if (game.host_id === userId)
      return res.status(400).json({ success: false, message: 'The host cannot leave — delete the game instead' });

    const [[participation]] = await pool.execute(
      'SELECT id, status FROM GameParticipants WHERE game_id = ? AND user_id = ?', [gameId, userId]
    );
    if (!participation)
      return res.status(400).json({ success: false, message: 'You are not in this game' });

    await pool.execute('DELETE FROM GameParticipants WHERE game_id = ? AND user_id = ?', [gameId, userId]);

    // If the leaver was a joined (not waitlisted) player, promote the first waitlisted player
    if (participation.status === 'joined') {
      const [[next]] = await pool.execute(
        "SELECT gp.id, gp.user_id, u.push_token FROM GameParticipants gp JOIN Users u ON u.id = gp.user_id WHERE gp.game_id = ? AND gp.status = 'waitlist' ORDER BY gp.waitlist_position ASC LIMIT 1",
        [gameId]
      );
      if (next) {
        await pool.execute(
          "UPDATE GameParticipants SET status = 'joined', waitlist_position = NULL WHERE id = ?",
          [next.id]
        );
        if (next.push_token) {
          const [[g]] = await pool.execute('SELECT title, sport_type FROM Games WHERE id = ?', [gameId]);
          sendPushNotifications([{
            to: next.push_token,
            title: '🎉 You\'re in!',
            body: `A spot opened in ${g?.title || g?.sport_type || 'a game'}. You're now joined!`,
            data: { gameId },
          }]);
        }
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/games/:id/checkin — participant or host marks themselves as checked in
router.post('/:id/checkin', authMiddleware, async (req, res) => {
  const gameId = parseInt(req.params.id);
  const userId = req.user.id;
  try {
    const [[game]] = await pool.execute(
      "SELECT host_id, scheduled_time FROM Games WHERE id = ? AND status = 'active'", [gameId]
    );
    if (!game) return res.status(404).json({ success: false, message: 'Game not found' });

    // Verify caller is host or participant
    const isHost = game.host_id === userId;
    if (!isHost) {
      const [[part]] = await pool.execute(
        "SELECT id FROM GameParticipants WHERE game_id = ? AND user_id = ? AND status = 'joined'", [gameId, userId]
      );
      if (!part) return res.status(403).json({ success: false, message: 'Not a participant' });
    }

    // Enforce 30-min window around scheduled_time
    if (game.scheduled_time) {
      const scheduled = new Date(game.scheduled_time.replace(' ', 'T') + ':00');
      const now = new Date();
      const diff = (now - scheduled) / 60000; // minutes
      if (diff < -30 || diff > 30) {
        return res.status(400).json({ success: false, message: 'Check-in only available within 30 minutes of game time' });
      }
    }

    if (!isHost) {
      await pool.execute(
        'UPDATE GameParticipants SET checked_in_at = NOW() WHERE game_id = ? AND user_id = ?',
        [gameId, userId]
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/games/:id/boost — host only, one-time push to nearby sport players
router.post('/:id/boost', authMiddleware, async (req, res) => {
  const gameId = parseInt(req.params.id);
  const userId = req.user.id;
  try {
    const [[game]] = await pool.execute(
      "SELECT * FROM Games WHERE id = ? AND status = 'active'", [gameId]
    );
    if (!game) return res.status(404).json({ success: false, message: 'Game not found' });
    if (game.host_id !== userId)
      return res.status(403).json({ success: false, message: 'Only the host can boost this game' });
    if (game.boosted_at)
      return res.status(409).json({ success: false, message: 'Already boosted' });

    // Check there is at least 1 open spot
    const [[{ count }]] = await pool.execute(
      "SELECT COUNT(*) AS count FROM GameParticipants WHERE game_id = ? AND status = 'joined'", [gameId]
    );
    if (game.max_players && count >= game.max_players - 1)
      return res.status(400).json({ success: false, message: 'Game is full' });

    await pool.execute('UPDATE Games SET boosted_at = NOW() WHERE id = ?', [gameId]);

    // Find nearby players who play this sport (within 20 km using game coords)
    if (game.latitude && game.longitude) {
      const [targets] = await pool.execute(`
        SELECT DISTINCT u.push_token
        FROM SportPreferences sp
        JOIN Users u ON u.id = sp.user_id
        WHERE sp.sport_type = ?
          AND u.push_token IS NOT NULL
          AND u.id != ?
          AND u.id NOT IN (SELECT user_id FROM GameParticipants WHERE game_id = ?)
          AND (
            6371 * ACOS(GREATEST(-1, LEAST(1,
              COS(RADIANS(?)) * COS(RADIANS(
                COALESCE(
                  (SELECT latitude FROM Games WHERE host_id = u.id ORDER BY created_at DESC LIMIT 1),
                  ?
                )
              )) *
              COS(RADIANS(
                COALESCE(
                  (SELECT longitude FROM Games WHERE host_id = u.id ORDER BY created_at DESC LIMIT 1),
                  ?
                )
              ) - RADIANS(?)) +
              SIN(RADIANS(?)) * SIN(RADIANS(
                COALESCE(
                  (SELECT latitude FROM Games WHERE host_id = u.id ORDER BY created_at DESC LIMIT 1),
                  ?
                )
              ))
            ))) <= 20
          )
        LIMIT 50
      `, [game.sport_type, userId, gameId,
          game.latitude, game.latitude, game.longitude, game.longitude,
          game.latitude, game.latitude]);

      if (targets.length > 0) {
        const label = game.title || game.location_desc || game.sport_type;
        sendPushNotifications(targets.map(t => ({
          to: t.push_token,
          title: `🔥 ${game.sport_type.charAt(0).toUpperCase() + game.sport_type.slice(1)} game near you!`,
          body: `A game needs one more player: ${label}`,
          data: { gameId },
        })));
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/games/:id/post-photo — participant or host adds a post-game photo
router.put('/:id/post-photo', authMiddleware, async (req, res) => {
  const gameId = parseInt(req.params.id);
  const userId = req.user.id;
  const { photo } = req.body;
  if (!photo) return res.status(400).json({ success: false, message: 'photo is required' });
  try {
    const [[game]] = await pool.execute(
      "SELECT host_id, status FROM Games WHERE id = ?", [gameId]
    );
    if (!game) return res.status(404).json({ success: false, message: 'Game not found' });
    if (game.status !== 'completed')
      return res.status(400).json({ success: false, message: 'Game must be completed first' });

    const isHost = game.host_id === userId;
    if (!isHost) {
      const [[part]] = await pool.execute(
        'SELECT id FROM GameParticipants WHERE game_id = ? AND user_id = ?', [gameId, userId]
      );
      if (!part) return res.status(403).json({ success: false, message: 'Not a participant' });
    }

    await pool.execute('UPDATE Games SET post_game_photo = ? WHERE id = ?', [photo, gameId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/games/:id — host only
router.put('/:id', authMiddleware, async (req, res) => {
  const gameId = parseInt(req.params.id);
  const userId = req.user.id;
  const { sport_type, level, location_desc, scheduled_time, equipment_notes, max_players, title, photo, neighborhood } = req.body;

  try {
    const [[game]] = await pool.execute(
      "SELECT * FROM Games WHERE id = ? AND status = 'active'", [gameId]
    );
    if (!game) return res.status(404).json({ success: false, message: 'Game not found' });
    if (game.host_id !== userId)
      return res.status(403).json({ success: false, message: 'Only the host can edit this game' });

    if (level != null) {
      const levelNum = parseInt(level);
      if (isNaN(levelNum) || levelNum < 1 || levelNum > 5)
        return res.status(400).json({ success: false, message: 'level must be between 1 and 5' });
    }
    if (max_players != null && max_players !== '') {
      const mp = parseInt(max_players);
      if (isNaN(mp) || mp < 2)
        return res.status(400).json({ success: false, message: 'max_players must be at least 2' });
    }
    if (title && title.length > 100)
      return res.status(400).json({ success: false, message: 'title must be 100 characters or less' });
    if (location_desc && location_desc.length > 200)
      return res.status(400).json({ success: false, message: 'location_desc must be 200 characters or less' });
    if (scheduled_time) {
      const parsed = new Date(scheduled_time);
      if (!isNaN(parsed.getTime()) && parsed <= new Date())
        return res.status(400).json({ success: false, message: 'scheduled_time must be in the future' });
    }

    await pool.execute(
      `UPDATE Games SET
         sport_type      = ?,
         level           = ?,
         location_desc   = ?,
         scheduled_time  = ?,
         equipment_notes = ?,
         max_players     = ?,
         title           = ?,
         photo           = ?,
         neighborhood    = ?
       WHERE id = ?`,
      [
        sport_type || game.sport_type,
        level      || game.level,
        location_desc   !== undefined ? (location_desc   || null) : game.location_desc,
        scheduled_time  !== undefined ? (scheduled_time  || null) : game.scheduled_time,
        equipment_notes !== undefined ? (equipment_notes || null) : game.equipment_notes,
        max_players     !== undefined && max_players !== '' ? parseInt(max_players) : (max_players === '' ? null : game.max_players),
        title           !== undefined ? (title || null) : game.title,
        photo           !== undefined ? (photo || null) : game.photo,
        neighborhood    !== undefined ? (neighborhood || null) : game.neighborhood,
        gameId,
      ]
    );

    const [[row]] = await pool.execute(
      `SELECT g.*, COUNT(gp.user_id) AS participant_count
       FROM Games g LEFT JOIN GameParticipants gp ON gp.game_id = g.id
       WHERE g.id = ? GROUP BY g.id`,
      [gameId]
    );
    res.json({ success: true, game: toMapGame(row) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/games — requires auth
router.post('/', authMiddleware, async (req, res) => {
  const { sport_type, level, latitude, longitude, location_desc, scheduled_time, equipment_notes, max_players, title, invited_friends, photo, recurrence, neighborhood } = req.body;
  if (!sport_type || !level || latitude == null || longitude == null)
    return res.status(400).json({ success: false, message: 'sport_type, level, latitude, longitude are required' });

  const validRecurrences = ['none', 'weekly', 'biweekly'];
  const recurrenceVal = validRecurrences.includes(recurrence) ? recurrence : 'none';

  const levelNum = parseInt(level);
  if (isNaN(levelNum) || levelNum < 1 || levelNum > 5)
    return res.status(400).json({ success: false, message: 'level must be between 1 and 5' });

  if (max_players != null) {
    const mp = parseInt(max_players);
    if (isNaN(mp) || mp < 2)
      return res.status(400).json({ success: false, message: 'max_players must be at least 2' });
  }

  if (title && title.length > 100)
    return res.status(400).json({ success: false, message: 'title must be 100 characters or less' });
  if (location_desc && location_desc.length > 200)
    return res.status(400).json({ success: false, message: 'location_desc must be 200 characters or less' });

  if (scheduled_time) {
    const parsed = new Date(scheduled_time);
    if (!isNaN(parsed.getTime()) && parsed <= new Date())
      return res.status(400).json({ success: false, message: 'scheduled_time must be in the future' });
  }

  try {
    const [result] = await pool.execute(
      `INSERT INTO Games (host_id, sport_type, level, latitude, longitude, location_desc, scheduled_time, equipment_notes, max_players, title, photo, recurrence, neighborhood)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, sport_type, level, latitude, longitude, location_desc || null, scheduled_time || null, equipment_notes || null, max_players || null, title || null, photo || null, recurrenceVal, neighborhood || null]
    );
    const gameId = result.insertId;

    // Pre-add invited friends as participants — verify they are actual accepted friends first
    const rawFriends = Array.isArray(invited_friends)
      ? invited_friends.map(Number).filter(id => !isNaN(id) && id !== req.user.id)
      : [];

    let verifiedFriends = [];
    if (rawFriends.length > 0) {
      const placeholders = rawFriends.map(() => '?').join(',');
      const [verifiedRows] = await pool.execute(`
        SELECT CASE WHEN requester_id = ? THEN addressee_id ELSE requester_id END AS friend_id
        FROM Friends
        WHERE status = 'accepted'
          AND (
            (requester_id = ? AND addressee_id IN (${placeholders}))
            OR (addressee_id = ? AND requester_id IN (${placeholders}))
          )
      `, [req.user.id, req.user.id, ...rawFriends, req.user.id, ...rawFriends]);

      const verifiedIds = new Set(verifiedRows.map(r => r.friend_id));
      verifiedFriends = rawFriends.filter(id => verifiedIds.has(id));
    }

    if (verifiedFriends.length > 0) {
      const placeholders = verifiedFriends.map(() => '(?, ?)').join(', ');
      const values = verifiedFriends.flatMap(fId => [gameId, fId]);
      await pool.execute(
        `INSERT IGNORE INTO GameParticipants (game_id, user_id) VALUES ${placeholders}`, values
      );

      const [[host]] = await pool.execute('SELECT username FROM Users WHERE id = ?', [req.user.id]);
      const friendPlaceholders = verifiedFriends.map(() => '?').join(',');
      const [friendRows] = await pool.execute(
        `SELECT push_token FROM Users WHERE id IN (${friendPlaceholders})`, verifiedFriends
      );
      const notifications = friendRows
        .filter(r => r.push_token)
        .map(r => ({
          to: r.push_token,
          title: "🏅 You've been added to a game!",
          body: `${host.username} added you to a ${sport_type} game.`,
          data: { gameId },
        }));
      if (notifications.length) sendPushNotifications(notifications);
    }

    const [[row]] = await pool.execute(
      `SELECT g.*, COUNT(gp.user_id) AS participant_count
       FROM Games g LEFT JOIN GameParticipants gp ON gp.game_id = g.id
       WHERE g.id = ? GROUP BY g.id`,
      [gameId]
    );
    res.status(201).json({ success: true, game: toMapGame(row) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
