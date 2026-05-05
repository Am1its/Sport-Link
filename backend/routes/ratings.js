const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/ratings/game/:gameId
// Returns is_host and the players the requester can still rate
router.get('/game/:gameId', authMiddleware, async (req, res) => {
  const gameId = parseInt(req.params.gameId);
  const userId = req.user.id;

  try {
    const [[game]] = await pool.execute('SELECT host_id FROM Games WHERE id = ?', [gameId]);
    if (!game) return res.status(404).json({ success: false, message: 'Game not found' });

    const [[participation]] = await pool.execute(
      'SELECT id FROM GameParticipants WHERE game_id = ? AND user_id = ?',
      [gameId, userId]
    );
    if (game.host_id !== userId && !participation)
      return res.status(403).json({ success: false, message: 'You were not part of this game' });

    const isHost = game.host_id === userId;

    let players;

    if (isHost) {
      // Host sees players not yet attendance-marked
      [players] = await pool.execute(`
        SELECT u.id, u.username, u.avatar
        FROM GameParticipants gp
        JOIN Users u ON u.id = gp.user_id
        WHERE gp.game_id = ?
          AND NOT EXISTS (
            SELECT 1 FROM Ratings r
            WHERE r.game_id = ? AND r.rater_id = ? AND r.ratee_id = gp.user_id
          )
      `, [gameId, gameId, userId]);
    } else {
      // Non-host sees other players (host + participants) not yet peer-rated
      [players] = await pool.execute(`
        SELECT u.id, u.username, u.avatar
        FROM (
          SELECT host_id AS user_id FROM Games WHERE id = ?
          UNION
          SELECT user_id FROM GameParticipants WHERE game_id = ?
        ) combined
        JOIN Users u ON u.id = combined.user_id
        WHERE combined.user_id != ?
          AND NOT EXISTS (
            SELECT 1 FROM PeerRatings pr
            WHERE pr.game_id = ? AND pr.rater_id = ? AND pr.ratee_id = combined.user_id
          )
      `, [gameId, gameId, userId, gameId, userId]);
    }

    res.json({ success: true, is_host: isHost, players });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/ratings/batch — host marks attendance { game_id, ratings: [{ ratee_id, attended }] }
router.post('/batch', authMiddleware, async (req, res) => {
  const { game_id, ratings } = req.body;
  const userId = req.user.id;

  if (!game_id || !Array.isArray(ratings) || ratings.length === 0)
    return res.status(400).json({ success: false, message: 'game_id and ratings[] are required' });

  try {
    const [[game]] = await pool.execute('SELECT host_id FROM Games WHERE id = ?', [game_id]);
    if (!game) return res.status(404).json({ success: false, message: 'Game not found' });
    if (game.host_id !== userId)
      return res.status(403).json({ success: false, message: 'Only the host can mark attendance' });

    for (const { ratee_id, attended } of ratings) {
      if (ratee_id === userId) continue;
      await pool.execute(
        'INSERT IGNORE INTO Ratings (game_id, rater_id, ratee_id, attended) VALUES (?, ?, ?, ?)',
        [game_id, userId, ratee_id, attended ? 1 : 0]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/ratings/peer — players rate teammates by category
// Body: { game_id, ratings: [{ ratee_id, sportsmanship, punctuality, communication, skill }] }
router.post('/peer', authMiddleware, async (req, res) => {
  const { game_id, ratings } = req.body;
  const userId = req.user.id;

  if (!game_id || !Array.isArray(ratings) || ratings.length === 0)
    return res.status(400).json({ success: false, message: 'game_id and ratings[] are required' });

  try {
    const [[game]] = await pool.execute('SELECT host_id FROM Games WHERE id = ?', [game_id]);
    if (!game) return res.status(404).json({ success: false, message: 'Game not found' });

    const [[participation]] = await pool.execute(
      'SELECT id FROM GameParticipants WHERE game_id = ? AND user_id = ?',
      [game_id, userId]
    );
    if (!participation)
      return res.status(403).json({ success: false, message: 'You were not a participant in this game' });

    for (const { ratee_id, sportsmanship, punctuality, communication, skill } of ratings) {
      if (ratee_id === userId) continue;
      const skillVal = (skill >= 1 && skill <= 5) ? skill : null;
      await pool.execute(
        `INSERT IGNORE INTO PeerRatings (game_id, rater_id, ratee_id, sportsmanship, punctuality, communication, skill)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [game_id, userId, ratee_id,
          sportsmanship != null ? (sportsmanship ? 1 : 0) : null,
          punctuality   != null ? (punctuality   ? 1 : 0) : null,
          communication != null ? (communication ? 1 : 0) : null,
          skillVal,
        ]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
