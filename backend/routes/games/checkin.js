const express = require('express');
const router = express.Router();
const pool = require('../../db');
const authMiddleware = require('../../middleware/authMiddleware');

// POST /api/games/:id/checkin — participant or host marks themselves checked in;
// enforces a 30-minute window around scheduled_time
router.post('/:id/checkin', authMiddleware, async (req, res) => {
  const gameId = parseInt(req.params.id);
  const userId = req.user.id;
  try {
    const [[game]] = await pool.execute(
      "SELECT host_id, scheduled_time FROM Games WHERE id = ? AND status = 'active'", [gameId]
    );
    if (!game) return res.status(404).json({ success: false, message: 'Game not found' });

    const isHost = game.host_id === userId;
    if (!isHost) {
      const [[part]] = await pool.execute(
        "SELECT id FROM GameParticipants WHERE game_id = ? AND user_id = ? AND status = 'joined'", [gameId, userId]
      );
      if (!part) return res.status(403).json({ success: false, message: 'Not a participant' });
    }

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

module.exports = router;
