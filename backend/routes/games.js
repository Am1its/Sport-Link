const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

const toMapGame = (row) => ({
  id: row.id,
  place_id: `game_${row.id}`,
  name: `${row.sport_type.charAt(0).toUpperCase() + row.sport_type.slice(1)} Community Game`,
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
  created_at: row.created_at,
});

// GET /api/games — public
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT g.*, COUNT(gp.user_id) AS participant_count
      FROM Games g
      LEFT JOIN GameParticipants gp ON gp.game_id = g.id
      WHERE g.status = 'active'
        AND (
          g.scheduled_time IS NULL
          OR STR_TO_DATE(g.scheduled_time, '%Y-%m-%d %H:%i') IS NULL
          OR STR_TO_DATE(g.scheduled_time, '%Y-%m-%d %H:%i') > NOW()
        )
      GROUP BY g.id
      ORDER BY g.created_at DESC
    `);
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
      WHERE g.status = 'active'
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
    }));
    res.json({ success: true, games });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/games/:id/join — requires auth
router.post('/:id/join', authMiddleware, async (req, res) => {
  const gameId = parseInt(req.params.id);
  const userId = req.user.id;

  try {
    const [[game]] = await pool.execute(
      "SELECT * FROM Games WHERE id = ? AND status = 'active'", [gameId]
    );
    if (!game) return res.status(404).json({ success: false, message: 'Game not found' });
    if (game.host_id === userId)
      return res.status(400).json({ success: false, message: 'You are the host of this game' });

    const [[already]] = await pool.execute(
      'SELECT id FROM GameParticipants WHERE game_id = ? AND user_id = ?', [gameId, userId]
    );
    if (already) return res.status(400).json({ success: false, message: 'You already joined this game' });

    if (game.max_players) {
      const [[{ count }]] = await pool.execute(
        'SELECT COUNT(*) AS count FROM GameParticipants WHERE game_id = ?', [gameId]
      );
      if (count >= game.max_players)
        return res.status(400).json({ success: false, message: 'This game is full' });
    }

    await pool.execute('INSERT INTO GameParticipants (game_id, user_id) VALUES (?, ?)', [gameId, userId]);
    const [[{ count: newCount }]] = await pool.execute(
      'SELECT COUNT(*) AS count FROM GameParticipants WHERE game_id = ?', [gameId]
    );
    res.json({ success: true, participant_count: newCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/games/:id — host only, cancels the game
router.delete('/:id', authMiddleware, async (req, res) => {
  const gameId = parseInt(req.params.id);
  const userId = req.user.id;
  try {
    const [[game]] = await pool.execute(
      "SELECT host_id FROM Games WHERE id = ? AND status = 'active'", [gameId]
    );
    if (!game) return res.status(404).json({ success: false, message: 'Game not found' });
    if (game.host_id !== userId)
      return res.status(403).json({ success: false, message: 'Only the host can delete this game' });

    await pool.execute("UPDATE Games SET status = 'cancelled' WHERE id = ?", [gameId]);
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
  const { sport_type, level, location_desc, scheduled_time, equipment_notes, max_players } = req.body;

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
         max_players     = ?
       WHERE id = ?`,
      [
        sport_type || game.sport_type,
        level      || game.level,
        location_desc   !== undefined ? (location_desc   || null) : game.location_desc,
        scheduled_time  !== undefined ? (scheduled_time  || null) : game.scheduled_time,
        equipment_notes !== undefined ? (equipment_notes || null) : game.equipment_notes,
        max_players     !== undefined && max_players !== '' ? parseInt(max_players) : (max_players === '' ? null : game.max_players),
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
  const { sport_type, level, latitude, longitude, location_desc, scheduled_time, equipment_notes, max_players } = req.body;
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
      `INSERT INTO Games (host_id, sport_type, level, latitude, longitude, location_desc, scheduled_time, equipment_notes, max_players)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, sport_type, level, latitude, longitude, location_desc || null, scheduled_time || null, equipment_notes || null, max_players || null]
    );
    const [[row]] = await pool.execute(
      'SELECT g.*, 0 AS participant_count FROM Games g WHERE g.id = ?', [result.insertId]
    );
    res.status(201).json({ success: true, game: toMapGame(row) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
