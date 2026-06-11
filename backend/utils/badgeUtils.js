const sendPushNotifications = require('./sendPushNotification');

const BADGE_DEFS = [
  { key: 'first_game',        label: '🏅 First Game',         check: (s) => s.total_games >= 1 },
  { key: 'game_5',            label: '⭐ 5 Games Played',      check: (s) => s.total_games >= 5 },
  { key: 'game_25',           label: '🔥 25 Games Played',     check: (s) => s.total_games >= 25 },
  { key: 'game_50',           label: '💎 50 Games Played',     check: (s) => s.total_games >= 50 },
  { key: 'host_5',            label: '🎯 5 Games Hosted',      check: (s) => s.games_hosted >= 5 },
  { key: 'host_25',           label: '🏆 25 Games Hosted',     check: (s) => s.games_hosted >= 25 },
  { key: 'streak_3',          label: '🔥 3 Game Streak',       check: (s) => s.longest_streak >= 3 },
  { key: 'streak_7',          label: '⚡ 7 Game Streak',       check: (s) => s.longest_streak >= 7 },
  { key: 'streak_30',         label: '🌟 30 Game Streak',      check: (s) => s.longest_streak >= 30 },
  { key: 'social_butterfly',  label: '🦋 Social Butterfly',   check: (s) => s.friend_count >= 10 },
];

// Award badges the user doesn't have yet. conn can be a pool or connection.
async function checkAndAwardBadges(userId, pool) {
  try {
    // Gather stats
    const [[stats]] = await pool.execute(`
      SELECT
        (SELECT COUNT(*) FROM Games WHERE host_id = ?)                              AS games_hosted,
        (SELECT COUNT(*) FROM GameParticipants WHERE user_id = ? AND status = 'joined') AS games_joined,
        (SELECT longest_streak FROM Users WHERE id = ?)                            AS longest_streak,
        (SELECT COUNT(*) FROM Friends WHERE (requester_id = ? OR addressee_id = ?) AND status = 'accepted') AS friend_count
    `, [userId, userId, userId, userId, userId]);

    stats.total_games = (stats.games_hosted || 0) + (stats.games_joined || 0);

    // Fetch already-earned badges
    const [earned] = await pool.execute(
      'SELECT badge_key FROM Badges WHERE user_id = ?', [userId]
    );
    const earnedSet = new Set(earned.map(r => r.badge_key));

    // Determine which new badges to award
    const newBadges = BADGE_DEFS.filter(b => !earnedSet.has(b.key) && b.check(stats));
    if (newBadges.length === 0) return;

    for (const badge of newBadges) {
      await pool.execute(
        'INSERT IGNORE INTO Badges (user_id, badge_key) VALUES (?, ?)',
        [userId, badge.key]
      );
    }

    // Send push notification for each new badge
    const [[user]] = await pool.execute('SELECT push_token FROM Users WHERE id = ?', [userId]);
    if (user?.push_token) {
      sendPushNotifications(newBadges.map(b => ({
        to: user.push_token,
        title: '🏅 New Badge Earned!',
        body: b.label,
        data: { screen: 'profile' },
      })));
    }
  } catch (err) {
    console.error('checkAndAwardBadges error:', err);
  }
}

module.exports = { checkAndAwardBadges };
