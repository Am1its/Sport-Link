const express = require('express');
const router = express.Router();
const pool = require('../../db');
const authMiddleware = require('../../middleware/authMiddleware');
const sendPushNotifications = require('../../utils/sendPushNotification');

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

// POST /api/games/:id/join — requires auth; transaction + FOR UPDATE prevents race-condition over-fill
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

// DELETE /api/games/:id/leave — participant only; promotes first waitlisted player on leave
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

    // Promote the first waitlisted player when a joined slot opens
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

module.exports = router;
