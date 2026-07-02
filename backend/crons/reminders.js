/**
 * Game-start reminder notifications.
 * Sends a push notification ~30 minutes before each game's scheduled_time.
 * Uses reminder_sent_at column for idempotency (survives restarts / rolling deploys).
 */

/**
 * @param {import('mysql2/promise').Pool} pool
 * @param {Function} sendPushNotifications
 */
const { israelNowString } = require('../utils/israelTime');

function startReminders(pool, sendPushNotifications) {
  async function sendGameReminders() {
    try {
      // Only games whose reminder has never been sent (reminder_sent_at IS NULL).
      // Survives server restarts — no more in-memory dedup.
      const nowStr = israelNowString();
      const [games] = await pool.execute(`
        SELECT id, title, sport_type, host_id
        FROM Games
        WHERE status = 'active'
          AND reminder_sent_at IS NULL
          AND STR_TO_DATE(scheduled_time, '%Y-%m-%d %H:%i')
              BETWEEN DATE_ADD(STR_TO_DATE(?, '%Y-%m-%d %H:%i:%s'), INTERVAL 25 MINUTE)
                AND   DATE_ADD(STR_TO_DATE(?, '%Y-%m-%d %H:%i:%s'), INTERVAL 35 MINUTE)
      `, [nowStr, nowStr]);

      for (const game of games) {
        // Atomic claim — prevents double-fire on rolling deploys / multiple processes.
        const [claim] = await pool.execute(
          'UPDATE Games SET reminder_sent_at = NOW() WHERE id = ? AND reminder_sent_at IS NULL',
          [game.id]
        );
        if (claim.affectedRows === 0) continue;

        const [rows] = await pool.execute(`
          SELECT u.id, u.push_token
          FROM Users u
          WHERE u.id = ?
          UNION
          SELECT u.id, u.push_token
          FROM GameParticipants gp
          JOIN Users u ON u.id = gp.user_id
          WHERE gp.game_id = ?
        `, [game.host_id, game.id]);

        if (rows.length === 0) continue;

        const sportLabel = game.sport_type.charAt(0).toUpperCase() + game.sport_type.slice(1);
        const gameTitle  = game.title || `${sportLabel} Game`;
        await sendPushNotifications(rows.map(r => ({
          user_id: r.id,
          to: r.push_token,
          title: '⏰ Game starting soon!',
          body:  `${gameTitle} starts in ~30 minutes. Get ready!`,
          data:  { gameId: game.id },
        })));
        console.log(`🔔 Sent reminders for game ${game.id} (${gameTitle}) to ${rows.length} player(s)`);
      }
    } catch (err) {
      console.error('Game reminder error:', err.message);
    }
  }

  setInterval(sendGameReminders, 60_000);
}

module.exports = { startReminders };
