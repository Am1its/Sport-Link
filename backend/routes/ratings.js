const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/ratings/game/:gameId/results — specific route must be registered before /:gameId
router.get('/game/:gameId/results', authMiddleware, async (req, res) => {
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

    let can_view = false;
    if (isHost) {
      const [[{ unrated }]] = await pool.execute(`
        SELECT COUNT(*) AS unrated
        FROM GameParticipants gp
        WHERE gp.game_id = ?
          AND NOT EXISTS (
            SELECT 1 FROM Ratings r WHERE r.game_id = ? AND r.rater_id = ? AND r.ratee_id = gp.user_id
          )
      `, [gameId, gameId, userId]);
      can_view = Number(unrated) === 0;
    } else {
      const [[{ unrated }]] = await pool.execute(`
        SELECT COUNT(*) AS unrated
        FROM (
          SELECT ? AS user_id
          UNION
          SELECT user_id FROM GameParticipants WHERE game_id = ?
        ) others
        WHERE others.user_id != ?
          AND NOT EXISTS (
            SELECT 1 FROM PeerRatings pr WHERE pr.game_id = ? AND pr.rater_id = ? AND pr.ratee_id = others.user_id
          )
      `, [game.host_id, gameId, userId, gameId, userId]);
      can_view = Number(unrated) === 0;
    }

    if (!can_view) {
      return res.json({ success: true, can_view: false, results: [] });
    }

    const [results] = await pool.execute(`
      SELECT
        u.id,
        u.username,
        u.avatar,
        r.attended,
        COUNT(DISTINCT pr.rater_id)        AS peer_count,
        ROUND(AVG(pr.sportsmanship) * 100) AS sportsmanship_pct,
        ROUND(AVG(pr.punctuality)   * 100) AS punctuality_pct,
        ROUND(AVG(pr.communication) * 100) AS communication_pct,
        ROUND(AVG(pr.skill), 1)            AS skill_avg
      FROM (
        SELECT ? AS user_id
        UNION
        SELECT user_id FROM GameParticipants WHERE game_id = ?
      ) participants
      JOIN Users u ON u.id = participants.user_id
      LEFT JOIN Ratings     r  ON r.game_id  = ? AND r.ratee_id  = u.id
      LEFT JOIN PeerRatings pr ON pr.game_id = ? AND pr.ratee_id = u.id
      GROUP BY u.id, u.username, u.avatar, r.attended
      ORDER BY r.attended DESC, u.username ASC
    `, [game.host_id, gameId, gameId, gameId]);

    res.json({ success: true, can_view: true, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/ratings/game/:gameId
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

    const rows = ratings
      .filter(r => r.ratee_id !== userId)
      .map(r => [game_id, userId, r.ratee_id, r.attended ? 1 : 0]);

    if (rows.length > 0) {
      const placeholders = rows.map(() => '(?, ?, ?, ?)').join(', ');
      await pool.execute(
        `INSERT IGNORE INTO Ratings (game_id, rater_id, ratee_id, attended) VALUES ${placeholders}`,
        rows.flat()
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/ratings/peer — players rate teammates by category
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

    const rows = ratings
      .filter(r => r.ratee_id !== userId)
      .map(r => {
        const skillVal = (r.skill >= 1 && r.skill <= 5) ? r.skill : null;
        return [
          game_id, userId, r.ratee_id,
          r.sportsmanship != null ? (r.sportsmanship ? 1 : 0) : null,
          r.punctuality   != null ? (r.punctuality   ? 1 : 0) : null,
          r.communication != null ? (r.communication ? 1 : 0) : null,
          skillVal,
        ];
      });

    if (rows.length > 0) {
      const placeholders = rows.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
      await pool.execute(
        `INSERT IGNORE INTO PeerRatings
           (game_id, rater_id, ratee_id, sportsmanship, punctuality, communication, skill)
         VALUES ${placeholders}`,
        rows.flat()
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
