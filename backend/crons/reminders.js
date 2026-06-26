/**
 * Game-start reminder notifications.
 * Sends a push notification ~30 minutes before each game's scheduled_time.
 * Uses reminder_sent_at column for idempotency (survives restarts / rolling deploys).
 */

/**
 * @param {import('mysql2/promise').Pool} pool
 * @param {Function} sendPushNotifications
 */
const { ISRAEL_NOW_SQL } = require('../utils/israelTime');

function startReminders(pool, sendPushNotifications) {
  async function sendGameReminders() {
    try {
      // Only games whose reminder has never been sent (reminder_sent_at IS NULL).
      // Survives server restarts — no more in-memory dedup.
      const [games] = await pool.execute(`
        SELECT id, title, sport_type, host_id
        FROM Games
        WHERE status = 'active'
          AND reminder_sent_at IS NULL
          AND STR_TO_DATE(scheduled_time, '%Y-%m-%d %H:%i')
              BETWEEN DATE_ADD(${ISRAEL_NOW_SQL}, INTERVAL 25 MINUTE)
                AND   DATE_ADD(${ISRAEL_NOW_SQL}, INTERVAL 35 MINUTE)
      `);

      for (const game of games) {
        // Atomic claim — prevents double-fire on rolling deploys / multiple processes.
        const [claim] = await pool.execute(
          'UPDATE Games SET reminder_sent_at = NOW() WHERE id = ? AND reminder_sent_at IS NULL',
          [game.id]
        );
        if (claim.affectedRows === 0) continue;

        const [rows] = await pool.execute(`
          SELECT u.push_token
          FROM Users u
          WHERE u.id = ? AND u.push_token IS NOT NULL
          UNION
          SELECT u.push_token
          FROM GameParticipants gp
          JOIN Users u ON u.id = gp.user_id
          WHERE gp.game_id = ? AND u.push_token IS NOT NULL
        `, [game.host_id, game.id]);

        const tokens = rows.map(r => r.push_token).filter(Boolean);
        if (tokens.length === 0) continue;

        const sportLabel = game.sport_type.charAt(0).toUpperCase() + game.sport_type.slice(1);
        const gameTitle  = game.title || `${sportLabel} Game`;
        await sendPushNotifications(tokens.map(to => ({
          to,
          title: '⏰ Game starting soon!',
          body:  `${gameTitle} starts in ~30 minutes. Get ready!`,
          data:  { gameId: game.id },
        })));
        console.log(`🔔 Sent reminders for game ${game.id} (${gameTitle}) to ${tokens.length} player(s)`);
      }
    } catch (err) {
      console.error('Game reminder error:', err.message);
    }
  }

  setInterval(sendGameReminders, 60_000);
}

module.exports = { startReminders };
