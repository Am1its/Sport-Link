/**
 * Auto-complete stale games.
 * Transitions active games to 'completed' AUTO_COMPLETE_HOURS after scheduled_time
 * (default 3h). Also nudges host + participants to submit ratings,
 * updates player streaks, and spawns next occurrence for recurring games.
 */

/**
 * @param {import('mysql2/promise').Pool} pool
 * @param {Function} sendPushNotifications
 * @param {Function} checkAndAwardBadges
 */
const { ISRAEL_NOW_SQL } = require('../utils/israelTime');

function startAutoComplete(pool, sendPushNotifications, checkAndAwardBadges) {
  async function autoCompleteGames() {
    const hours = parseInt(process.env.AUTO_COMPLETE_HOURS ?? '3', 10) || 3;
    try {
      const [games] = await pool.execute(`
        SELECT id, title, sport_type, host_id, recurrence, scheduled_time,
               latitude, longitude, location_desc, equipment_notes, max_players, level, photo,
               parent_game_id
        FROM Games
        WHERE status = 'active'
          AND STR_TO_DATE(scheduled_time, '%Y-%m-%d %H:%i') <= DATE_SUB(${ISRAEL_NOW_SQL}, INTERVAL ? HOUR)
      `, [hours]);

      for (const game of games) {
        const [result] = await pool.execute(
          "UPDATE Games SET status = 'completed' WHERE id = ? AND status = 'active'",
          [game.id]
        );
        if (result.affectedRows === 0) continue; // Already changed by host

        const sportLabel = game.sport_type.charAt(0).toUpperCase() + game.sport_type.slice(1);
        const gameTitle  = game.title || `${sportLabel} Game`;
        console.log(`✅ Auto-completed game ${game.id} (${gameTitle})`);

        // Spawn next occurrence for recurring games (only for root games — parent_game_id IS NULL)
        if (game.recurrence && game.recurrence !== 'none' && game.scheduled_time) {
          try {
            if (game.parent_game_id == null) {
              const days = game.recurrence === 'weekly' ? 7 : 14;
              // Parse YYYY-MM-DD HH:MM format
              const [datePart, timePart] = game.scheduled_time.split(' ');
              const [y, mo, d] = datePart.split('-').map(Number);
              const [h, m] = (timePart ?? '00:00').split(':').map(Number);
              const next = new Date(y, mo - 1, d + days, h, m);
              const pad  = n => String(n).padStart(2, '0');
              const nextTime = `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())} ${pad(next.getHours())}:${pad(next.getMinutes())}`;

              const [newGame] = await pool.execute(
                `INSERT INTO Games (host_id, sport_type, level, latitude, longitude, location_desc, scheduled_time,
                                    equipment_notes, max_players, title, photo, recurrence, parent_game_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [game.host_id, game.sport_type, game.level, game.latitude, game.longitude,
                 game.location_desc, nextTime, game.equipment_notes, game.max_players,
                 game.title, game.photo, game.recurrence, game.id]
              );
              console.log(`🔁 Spawned recurring game ${newGame.insertId} (next ${game.recurrence} → ${nextTime})`);

              // Notify host about the next occurrence
              const [[hostRow]] = await pool.execute('SELECT push_token FROM Users WHERE id = ?', [game.host_id]);
              if (hostRow?.push_token) {
                sendPushNotifications([{
                  to: hostRow.push_token,
                  title: '🔁 Recurring game scheduled!',
                  body: `Your ${gameTitle} has been rescheduled for ${nextTime}.`,
                  data: { gameId: newGame.insertId },
                }]);
              }
            }
          } catch (recurErr) {
            console.error(`Recurring game spawn error for game ${game.id}:`, recurErr.message);
          }
        }

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

        if (tokens.length > 0) {
          await sendPushNotifications(tokens.map(to => ({
            to,
            title: '🏅 Rate your teammates!',
            body:  `${gameTitle} has ended. How did everyone do?`,
            data:  { gameId: game.id },
          })));
        }

        // Update streaks + check badges for all participants
        try {
          const [participants] = await pool.execute(`
            SELECT user_id FROM GameParticipants WHERE game_id = ? AND status = 'joined'
            UNION SELECT ? AS user_id
          `, [game.id, game.host_id]);

          for (const { user_id } of participants) {
            const [[u]] = await pool.execute(
              'SELECT current_streak, longest_streak, last_game_date FROM Users WHERE id = ?', [user_id]
            );
            if (!u) continue;

            const lastDate = u.last_game_date ? new Date(u.last_game_date) : null;
            const now = new Date();
            const daysSinceLast = lastDate
              ? Math.floor((now - lastDate) / 86400000)
              : 999;

            // Only increment streak once per day; skip if already updated today
            if (daysSinceLast === 0) continue;
            const newStreak = daysSinceLast <= 8 ? (u.current_streak || 0) + 1 : 1;
            const newLongest = Math.max(newStreak, u.longest_streak || 0);

            await pool.execute(
              'UPDATE Users SET current_streak = ?, longest_streak = ?, last_game_date = CURDATE() WHERE id = ?',
              [newStreak, newLongest, user_id]
            );

            await checkAndAwardBadges(user_id, pool);
          }
        } catch (streakErr) {
          console.error(`Streak update error for game ${game.id}:`, streakErr.message);
        }
      }
    } catch (err) {
      console.error('Auto-complete games error:', err.message);
    }
  }

  setInterval(autoCompleteGames, 5 * 60_000);
}

module.exports = { startAutoComplete };
