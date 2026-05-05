const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/users/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const [[user]] = await pool.execute(
      `SELECT
         u.id,
         u.username,
         (SELECT COUNT(*) FROM Games             WHERE host_id  = u.id) AS games_hosted,
         (SELECT COUNT(*) FROM GameParticipants  WHERE user_id  = u.id) AS games_joined,
         COALESCE((
           SELECT SUM(CASE WHEN attended = 1 THEN 1 ELSE -1 END)
           FROM Ratings WHERE ratee_id = u.id
         ), 0) AS karma
       FROM Users u WHERE u.id = ?`,
      [req.user.id]
    );
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
