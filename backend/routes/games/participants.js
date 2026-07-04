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

    // attendance_rate = % of past rated games this user actually showed up to (host-submitted
    // Ratings.attended); a reliability signal so the host can judge who they're playing with.
    // NULL when the user has no rated games yet (distinct from a 0% rate).
    const attendanceRateExpr = `(
      SELECT CASE WHEN COUNT(*) = 0 THEN NULL
             ELSE ROUND(100 * SUM(CASE WHEN attended = 1 THEN 1 ELSE 0 END) / COUNT(*))
        END
      FROM Ratings WHERE ratee_id = u.id
    )`;

    const [rows] = await pool.execute(`
      SELECT u.id, u.username, u.avatar,
             'host'  AS role,
             1       AS is_host,
             NULL    AS status,
             NULL    AS waitlist_position,
             0       AS checked_in,
             ${attendanceRateExpr} AS attendance_rate
      FROM Users u WHERE u.id = ?
      UNION ALL
      SELECT u.id, u.username, u.avatar,
             'player' AS role,
             0        AS is_host,
             gp.status,
             gp.waitlist_position,
             (gp.checked_in_at IS NOT NULL) AS checked_in,
             ${attendanceRateExpr} AS attendance_rate
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

    const [[blocked]] = await conn.execute(
      `SELECT 1 FROM BlockedUsers
       WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)
       LIMIT 1`,
      [userId, game.host_id, game.host_id, userId]
    );
    if (blocked) {
      await conn.rollback();
      return res.status(403).json({ success: false, message: 'Blocked' });
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
    if (!waitlisted) {
      sendPushNotifications([{
        user_id: game.host_id,
        to: hostRow?.push_token ?? null,
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

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[game]] = await conn.execute(
      "SELECT host_id FROM Games WHERE id = ? AND status = 'active' FOR UPDATE", [gameId]
    );
    if (!game) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Game not found' });
    }
    if (game.host_id === userId) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'The host cannot leave — delete the game instead' });
    }

    const [[participation]] = await conn.execute(
      'SELECT id, status FROM GameParticipants WHERE game_id = ? AND user_id = ?', [gameId, userId]
    );
    if (!participation) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'You are not in this game' });
    }

    await conn.execute('DELETE FROM GameParticipants WHERE game_id = ? AND user_id = ?', [gameId, userId]);

    // Promote the first waitlisted player when a joined slot opens
    let promoted = null;
    if (participation.status === 'joined') {
      const [[next]] = await conn.execute(
        "SELECT gp.id, gp.user_id, u.push_token FROM GameParticipants gp JOIN Users u ON u.id = gp.user_id WHERE gp.game_id = ? AND gp.status = 'waitlist' ORDER BY gp.waitlist_position ASC LIMIT 1",
        [gameId]
      );
      if (next) {
        await conn.execute(
          "UPDATE GameParticipants SET status = 'joined', waitlist_position = NULL WHERE id = ?",
          [next.id]
        );
        promoted = next;
      }
    }

    await conn.commit();

    // Send push notification outside the transaction
    if (promoted) {
      const [[g]] = await pool.execute('SELECT title, sport_type FROM Games WHERE id = ?', [gameId]);
      sendPushNotifications([{
        user_id: promoted.user_id,
        to: promoted.push_token,
        title: '🎉 You\'re in!',
        body: `A spot opened in ${g?.title || g?.sport_type || 'a game'}. You're now joined!`,
        data: { gameId },
      }]);
    }

    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    conn.release();
  }
});

// DELETE /api/games/:id/participants/:userId — host only; removes a player before the game
// (e.g. a no-show or problem player). Promotes the first waitlisted player, same as a normal leave.
router.delete('/:id/participants/:userId', authMiddleware, async (req, res) => {
  const gameId = parseInt(req.params.id);
  const targetUserId = parseInt(req.params.userId);
  const hostId = req.user.id;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[game]] = await conn.execute(
      "SELECT host_id, title, sport_type FROM Games WHERE id = ? AND status = 'active' FOR UPDATE", [gameId]
    );
    if (!game) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Game not found' });
    }
    if (game.host_id !== hostId) {
      await conn.rollback();
      return res.status(403).json({ success: false, message: 'Only the host can remove players' });
    }
    if (targetUserId === hostId) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'The host cannot remove themselves' });
    }

    const [[participation]] = await conn.execute(
      'SELECT id, status FROM GameParticipants WHERE game_id = ? AND user_id = ?', [gameId, targetUserId]
    );
    if (!participation) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Player is not in this game' });
    }

    await conn.execute('DELETE FROM GameParticipants WHERE game_id = ? AND user_id = ?', [gameId, targetUserId]);

    // Promote the first waitlisted player when a joined slot opens
    let promoted = null;
    if (participation.status === 'joined') {
      const [[next]] = await conn.execute(
        "SELECT gp.id, gp.user_id, u.push_token FROM GameParticipants gp JOIN Users u ON u.id = gp.user_id WHERE gp.game_id = ? AND gp.status = 'waitlist' ORDER BY gp.waitlist_position ASC LIMIT 1",
        [gameId]
      );
      if (next) {
        await conn.execute(
          "UPDATE GameParticipants SET status = 'joined', waitlist_position = NULL WHERE id = ?",
          [next.id]
        );
        promoted = next;
      }
    }

    await conn.commit();

    // Notify the removed player and any promoted waitlist player, outside the transaction
    const gameLabel = game.title || `${game.sport_type} game`;
    const [[removedUser]] = await pool.execute('SELECT push_token FROM Users WHERE id = ?', [targetUserId]);
    sendPushNotifications([{
      user_id: targetUserId,
      to: removedUser?.push_token ?? null,
      title: 'Removed from a game',
      body: `The host removed you from ${gameLabel}.`,
      data: { screen: 'games' },
    }]);
    if (promoted) {
      sendPushNotifications([{
        user_id: promoted.user_id,
        to: promoted.push_token,
        title: '🎉 You\'re in!',
        body: `A spot opened in ${gameLabel}. You're now joined!`,
        data: { gameId },
      }]);
    }

    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    conn.release();
  }
});

module.exports = router;
