const express = require('express');
const router = express.Router();
const pool = require('../../db');
const authMiddleware = require('../../middleware/authMiddleware');
const sendPushNotifications = require('../../utils/sendPushNotification');

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

// POST /api/games/:id/boost — host only; one-time push to nearby players of same sport
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

    const [[{ count }]] = await pool.execute(
      "SELECT COUNT(*) AS count FROM GameParticipants WHERE game_id = ? AND status = 'joined'", [gameId]
    );
    if (game.max_players && count >= game.max_players - 1)
      return res.status(400).json({ success: false, message: 'Game is full' });

    await pool.execute('UPDATE Games SET boosted_at = NOW() WHERE id = ?', [gameId]);

    if (game.latitude && game.longitude) {
      const [targets] = await pool.execute(`
        SELECT DISTINCT u.id, u.push_token
        FROM SportPreferences sp
        JOIN Users u ON u.id = sp.user_id
        WHERE sp.sport_type = ?
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
          user_id: t.id,
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

module.exports = router;
