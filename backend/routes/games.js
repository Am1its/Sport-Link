const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');
const sendPushNotifications = require('../utils/sendPushNotification');

const router = express.Router();

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
  created_at: row.created_at,
  is_joined: row.is_joined != null ? Boolean(row.is_joined) : false,
});

// GET /api/games — public; optional ?lat=&lng=&radius_km= for distance filter
// If a valid JWT is present, is_joined is included per game.
router.get('/', async (req, res) => {
  const { lat, lng, radius_km } = req.query;
  const useRadius = lat && lng && radius_km;

  // Optionally decode userId from Bearer token if present
  let userId = null;
  try {
    const header = req.headers['authorization'];
    const raw = header && header.split(' ')[1];
    if (raw) userId = jwt.verify(raw, process.env.JWT_SECRET)?.id ?? null;
  } catch { /* invalid/expired token — treat as unauthenticated */ }

  try {
    // Haversine SELECT expression — params: lat, lng, lat
    const haversineExpr = `(6371 * ACOS(
      COS(RADIANS(?)) * COS(RADIANS(g.latitude)) *
      COS(RADIANS(g.longitude) - RADIANS(?)) +
      SIN(RADIANS(?)) * SIN(RADIANS(g.latitude))
    ))`;

    // Build params: [userId?] + [lat, lng, lat, radius_km (if radius)]
    const params = [];
    if (userId) params.push(userId);
    if (useRadius) params.push(parseFloat(lat), parseFloat(lng), parseFloat(lat), parseFloat(radius_km));

    const [rows] = await pool.execute(`
      SELECT g.*, COUNT(gp.user_id) AS participant_count
        ${userId ? ', CAST(EXISTS(SELECT 1 FROM GameParticipants WHERE game_id = g.id AND user_id = ?) AS UNSIGNED) AS is_joined' : ''}
        ${useRadius ? `, ${haversineExpr} AS distance_km` : ''}
      FROM Games g
      LEFT JOIN GameParticipants gp ON gp.game_id = g.id
      WHERE g.status = 'active'
        AND (
          g.scheduled_time IS NULL
          OR STR_TO_DATE(g.scheduled_time, '%Y-%m-%d %H:%i') IS NULL
          OR STR_TO_DATE(g.scheduled_time, '%Y-%m-%d %H:%i') > NOW()
        )
      GROUP BY g.id
      ${useRadius ? 'HAVING distance_km <= ?' : ''}
      ORDER BY g.created_at DESC
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
        COUNT(gp.user_id)          AS participant_count,
        (g.host_id = ?)            AS is_host
      FROM Games g
      LEFT JOIN GameParticipants gp ON gp.game_id = g.id
      WHERE g.status IN ('active', 'completed')
        AND (
          g.host_id = ?
          OR EXISTS (SELECT 1 FROM GameParticipants WHERE game_id = g.id AND user_id = ?)
        )
      GROUP BY g.id
      ORDER BY g.created_at DESC
    `, [userId, userId, userId]);

    const games = rows.map((row) => ({
      ...toMapGame(row),
      is_host: !!row.is_host,
      status: row.status,
    }));
    res.json({ success: true, games });
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

    if (game.max_players) {
      const [[{ count }]] = await conn.execute(
        'SELECT COUNT(*) AS count FROM GameParticipants WHERE game_id = ?', [gameId]
      );
      // Host occupies one slot; participants fill the remaining max_players - 1 spots
      if (count >= game.max_players - 1) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'This game is full' });
      }
    }

    await conn.execute('INSERT INTO GameParticipants (game_id, user_id) VALUES (?, ?)', [gameId, userId]);
    const [[{ count: newCount }]] = await conn.execute(
      'SELECT COUNT(*) AS count FROM GameParticipants WHERE game_id = ?', [gameId]
    );
    await conn.commit();

    // Notify the host (outside transaction)
    const [[joiner]]  = await pool.execute('SELECT username FROM Users WHERE id = ?', [userId]);
    const [[hostRow]] = await pool.execute('SELECT push_token FROM Users WHERE id = ?', [game.host_id]);
    if (hostRow?.push_token) {
      sendPushNotifications([{
        to: hostRow.push_token,
        title: '🏅 New player joined!',
        body: `${joiner.username} joined your ${game.sport_type} game.`,
        data: { gameId },
      }]);
    }

    res.json({ success: true, participant_count: newCount });
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
      SELECT u.id, u.username, u.avatar, 'host' AS role
      FROM Users u WHERE u.id = ?
      UNION ALL
      SELECT u.id, u.username, u.avatar, 'player' AS role
      FROM GameParticipants gp JOIN Users u ON u.id = gp.user_id
      WHERE gp.game_id = ?
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
      'SELECT id FROM GameParticipants WHERE game_id = ? AND user_id = ?', [gameId, userId]
    );
    if (!participation)
      return res.status(400).json({ success: false, message: 'You are not in this game' });

    await pool.execute('DELETE FROM GameParticipants WHERE game_id = ? AND user_id = ?', [gameId, userId]);
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
  const { sport_type, level, location_desc, scheduled_time, equipment_notes, max_players, title, photo } = req.body;

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
         photo           = ?
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
  const { sport_type, level, latitude, longitude, location_desc, scheduled_time, equipment_notes, max_players, title, invited_friends, photo } = req.body;
  if (!sport_type || !level || latitude == null || longitude == null)
    return res.status(400).json({ success: false, message: 'sport_type, level, latitude, longitude are required' });

  const levelNum = parseInt(level);
  if (isNaN(levelNum) || levelNum < 1 || levelNum > 5)
    return res.status(400).json({ success: false, message: 'level must be between 1 and 5' });

  if (max_players != null) {
    const mp = parseInt(max_players);
    if (isNaN(mp) || mp < 2)
      return res.status(400).json({ success: false, message: 'max_players must be at least 2' });
  }

  if (scheduled_time) {
    const parsed = new Date(scheduled_time);
    if (!isNaN(parsed.getTime()) && parsed <= new Date())
      return res.status(400).json({ success: false, message: 'scheduled_time must be in the future' });
  }

  try {
    const [result] = await pool.execute(
      `INSERT INTO Games (host_id, sport_type, level, latitude, longitude, location_desc, scheduled_time, equipment_notes, max_players, title, photo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, sport_type, level, latitude, longitude, location_desc || null, scheduled_time || null, equipment_notes || null, max_players || null, title || null, photo || null]
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
