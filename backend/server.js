require('dotenv').config();
const http = require('http');
const express = require('express');
const { Server: IOServer } = require('socket.io');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');

const pool                 = require('./db');
const sendPushNotifications = require('./utils/sendPushNotification');
const { isUserInGame }     = require('./utils/gameUtils');

const authRoutes          = require('./routes/auth');
const gamesRoutes         = require('./routes/games');
const chatsRoutes         = require('./routes/chats');
const usersRoutes         = require('./routes/users');
const ratingsRoutes       = require('./routes/ratings');
const friendsRoutes       = require('./routes/friends');
const notificationsRoutes = require('./routes/notifications');
const courtsRoutes        = require('./routes/courts');
const dmRoutes            = require('./routes/dm');
const activityRoutes      = require('./routes/activity');

const _corsEnv = process.env.CORS_ORIGIN?.trim();
const ALLOWED_ORIGINS = _corsEnv
  ? _corsEnv.split(',').map(o => o.trim()).filter(Boolean)
  : '*';

const app = express();
const httpServer = http.createServer(app);
const io = new IOServer(httpServer, { cors: { origin: ALLOWED_ORIGINS } });
app.set('io', io);

app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json({ limit: '10mb' }));

// Strict rate limit for auth endpoints (brute-force protection)
app.use('/api/auth', rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests — please try again later.' },
}));

// General rate limit for all other routes
app.use(rateLimit({
  windowMs: 60_000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests — please try again later.' },
}));

const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'SportLink API is running!' });
});

// --- Game share landing page (Open Graph social preview + deep link) ---
const SPORT_LABELS = {
  basketball: 'Basketball', football: 'Football', tennis: 'Tennis',
  volleyball: 'Volleyball', yoga: 'Yoga', gym: 'Gym',
  studio: 'Studio', footvolley: 'Footvolley', swimming: 'Swimming',
};
const SPORT_EMOJI = {
  basketball: '🏀', football: '⚽', tennis: '🎾',
  volleyball: '🏐', yoga: '🧘', gym: '💪',
  studio: '💃', footvolley: '🏐', swimming: '🏊',
};

app.get('/game/:id', async (req, res) => {
  const gameId = parseInt(req.params.id);
  if (isNaN(gameId)) return res.status(404).send('Not found');

  try {
    const [[game]] = await pool.execute(
      `SELECT g.id, g.sport_type, g.title, g.location_desc, g.scheduled_time,
              g.level, g.max_players, u.username AS host_username,
              COUNT(gp.user_id) AS participant_count
       FROM Games g
       JOIN Users u ON u.id = g.host_id
       LEFT JOIN GameParticipants gp ON gp.game_id = g.id
       WHERE g.id = ? AND g.status = 'active'
       GROUP BY g.id`,
      [gameId]
    );

    const BASE_URL = process.env.PUBLIC_URL || `https://sport-link-production.up.railway.app`;
    const deepLink = `sportlink://game/${gameId}`;
    const pageUrl  = `${BASE_URL}/game/${gameId}`;

    if (!game) {
      return res.status(404).send(buildLandingHtml({
        title: 'Game not found — SportLink',
        description: 'This game may have been cancelled or completed.',
        deepLink, pageUrl, game: null,
      }));
    }

    const sport  = SPORT_LABELS[game.sport_type] ?? game.sport_type;
    const emoji  = SPORT_EMOJI[game.sport_type]  ?? '🏅';
    const title  = game.title || `${sport} Game`;
    const ogTitle = `${emoji} ${title} — SportLink`;
    const parts  = [];
    if (game.scheduled_time) parts.push(`🕒 ${game.scheduled_time}`);
    if (game.location_desc)  parts.push(`📍 ${game.location_desc}`);
    parts.push(`Hosted by ${game.host_username}`);
    const description = parts.join('  ·  ');

    res.send(buildLandingHtml({ title: ogTitle, description, deepLink, pageUrl, game, sport, emoji }));
  } catch (err) {
    console.error('Landing page error:', err.message);
    res.status(500).send('Server error');
  }
});

function buildLandingHtml({ title, description, deepLink, pageUrl, game, sport, emoji }) {
  const bgColor   = '#1C1C1E';
  const accent    = '#0FEA95';
  const surface   = '#2C2C2E';
  const textColor = '#FFFFFF';
  const subColor  = '#AEAEB2';

  const gameBlock = game ? `
    <div class="game-card">
      <div class="sport-badge">${emoji} ${sport ?? ''}</div>
      <h1 class="game-title">${game.title || (sport + ' Game')}</h1>
      ${game.scheduled_time ? `<div class="meta"><span class="meta-icon">🕒</span> ${game.scheduled_time}</div>` : ''}
      ${game.location_desc  ? `<div class="meta"><span class="meta-icon">📍</span> ${game.location_desc}</div>` : ''}
      <div class="meta"><span class="meta-icon">👤</span> Hosted by <strong>${game.host_username}</strong></div>
      ${game.max_players
        ? `<div class="meta"><span class="meta-icon">👥</span> ${game.participant_count + 1} / ${game.max_players} players</div>`
        : ''}
      <div class="meta"><span class="meta-icon">⚡</span> Level ${game.level} / 5</div>
    </div>` : `<p style="color:${subColor};text-align:center;margin:2rem 0">Game not found or no longer active.</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>

  <!-- Open Graph -->
  <meta property="og:title"       content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url"         content="${pageUrl}" />
  <meta property="og:type"        content="website" />
  <meta property="og:site_name"   content="SportLink" />

  <!-- Twitter Card -->
  <meta name="twitter:card"        content="summary" />
  <meta name="twitter:title"       content="${title}" />
  <meta name="twitter:description" content="${description}" />

  <!-- iOS deep link -->
  <meta name="apple-itunes-app" content="app-id=PLACEHOLDER, app-argument=${deepLink}" />

  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: ${bgColor}; color: ${textColor}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; }
    .logo { font-size: 28px; font-weight: 900; letter-spacing: -1px; margin-bottom: 32px; }
    .logo span { color: ${accent}; }
    .game-card { background: ${surface}; border-radius: 20px; padding: 24px; width: 100%; max-width: 400px; margin-bottom: 28px; }
    .sport-badge { display: inline-block; font-size: 13px; font-weight: 700; color: ${accent}; letter-spacing: 0.5px; margin-bottom: 10px; }
    .game-title { font-size: 22px; font-weight: 900; color: ${textColor}; margin-bottom: 16px; line-height: 1.3; }
    .meta { display: flex; align-items: flex-start; gap: 8px; font-size: 14px; color: ${subColor}; margin-bottom: 8px; }
    .meta-icon { flex-shrink: 0; }
    .meta strong { color: ${textColor}; }
    .open-btn { display: block; width: 100%; max-width: 400px; background: ${accent}; color: #000; font-size: 16px; font-weight: 800; text-align: center; padding: 16px; border-radius: 100px; text-decoration: none; margin-bottom: 14px; }
    .open-btn:hover { opacity: 0.9; }
    .sub { font-size: 13px; color: ${subColor}; text-align: center; }
  </style>

  <script>
    // Auto-open deep link when page loads on mobile
    window.addEventListener('load', function() {
      const ua = navigator.userAgent;
      if (/iPhone|iPad|iPod|Android/.test(ua)) {
        window.location.href = '${deepLink}';
      }
    });
  </script>
</head>
<body>
  <div class="logo">Sport<span>Link</span></div>
  ${gameBlock}
  <a class="open-btn" href="${deepLink}">Open in SportLink</a>
  <p class="sub">Don't have SportLink yet? Download it from the App Store.</p>
</body>
</html>`;
}

// --- Invite / referral landing page ---
app.get('/invite/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId);
  if (isNaN(userId)) return res.status(404).send('Not found');

  try {
    const [[user]] = await pool.execute(
      `SELECT u.username, u.bio, u.avatar,
              (SELECT sport_type FROM GameParticipants gp
               JOIN Games g ON g.id = gp.game_id
               WHERE gp.user_id = u.id
               GROUP BY g.sport_type ORDER BY COUNT(*) DESC LIMIT 1) AS top_sport
       FROM Users u WHERE u.id = ?`,
      [userId]
    );

    const BASE_URL = process.env.PUBLIC_URL || 'https://sport-link-production.up.railway.app';
    const deepLink = `sportlink://invite/${userId}`;
    const pageUrl  = `${BASE_URL}/invite/${userId}`;

    if (!user) return res.status(404).send('User not found');

    const sportEmoji = SPORT_EMOJI[user.top_sport] ?? '🏅';
    const ogTitle = `${user.username} invited you to SportLink ${sportEmoji}`;
    const ogDesc  = user.bio
      ? `"${user.bio}" — Join SportLink and play ${SPORT_LABELS[user.top_sport] ?? 'sports'} together!`
      : `Join SportLink and play ${SPORT_LABELS[user.top_sport] ?? 'sports'} together!`;

    const avatarHtml = user.avatar
      ? `<img class="avatar" src="data:image/jpeg;base64,${user.avatar}" alt="${user.username}" />`
      : `<div class="avatar avatar-fallback">${user.username.charAt(0).toUpperCase()}</div>`;

    const bgColor  = '#1C1C1E';
    const accent   = '#0FEA95';
    const surface  = '#2C2C2E';
    const textClr  = '#FFFFFF';
    const subColor = '#AEAEB2';

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${ogTitle}</title>
  <meta property="og:title"       content="${ogTitle}" />
  <meta property="og:description" content="${ogDesc}" />
  <meta property="og:url"         content="${pageUrl}" />
  <meta property="og:type"        content="website" />
  <meta property="og:site_name"   content="SportLink" />
  <meta name="twitter:card"        content="summary" />
  <meta name="twitter:title"       content="${ogTitle}" />
  <meta name="twitter:description" content="${ogDesc}" />
  <meta name="apple-itunes-app"   content="app-id=PLACEHOLDER, app-argument=${deepLink}" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: ${bgColor}; color: ${textClr}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; }
    .logo { font-size: 28px; font-weight: 900; letter-spacing: -1px; margin-bottom: 32px; }
    .logo span { color: ${accent}; }
    .card { background: ${surface}; border-radius: 20px; padding: 28px 24px; width: 100%; max-width: 400px; display: flex; flex-direction: column; align-items: center; gap: 12px; margin-bottom: 24px; }
    .avatar { width: 80px; height: 80px; border-radius: 40px; object-fit: cover; border: 3px solid ${accent}; }
    .avatar-fallback { width: 80px; height: 80px; border-radius: 40px; border: 3px solid ${accent}; display: flex; align-items: center; justify-content: center; font-size: 32px; font-weight: 900; background: ${accent}22; color: ${accent}; }
    .username { font-size: 22px; font-weight: 900; color: ${textClr}; }
    .bio { font-size: 14px; color: ${subColor}; text-align: center; line-height: 1.5; }
    .headline { font-size: 15px; color: ${subColor}; text-align: center; }
    .open-btn { display: block; width: 100%; max-width: 400px; background: ${accent}; color: #000; font-size: 16px; font-weight: 800; text-align: center; padding: 16px; border-radius: 100px; text-decoration: none; margin-bottom: 14px; }
    .sub { font-size: 13px; color: ${subColor}; text-align: center; }
  </style>
  <script>
    window.addEventListener('load', function() {
      if (/iPhone|iPad|iPod|Android/.test(navigator.userAgent)) {
        window.location.href = '${deepLink}';
      }
    });
  </script>
</head>
<body>
  <div class="logo">Sport<span>Link</span></div>
  <div class="card">
    ${avatarHtml}
    <div class="username">${user.username}</div>
    ${user.bio ? `<div class="bio">"${user.bio}"</div>` : ''}
    <div class="headline">${sportEmoji} invited you to play ${SPORT_LABELS[user.top_sport] ?? 'sports'} on SportLink!</div>
  </div>
  <a class="open-btn" href="${deepLink}">Open in SportLink</a>
  <p class="sub">Don't have SportLink? Download from the App Store.</p>
</body>
</html>`);
  } catch (err) {
    console.error('Invite landing error:', err.message);
    res.status(500).send('Server error');
  }
});

app.use('/api/auth',          authRoutes);
app.use('/api/games',         gamesRoutes);
app.use('/api/chats',         chatsRoutes);
app.use('/api/users',         usersRoutes);
app.use('/api/ratings',       ratingsRoutes);
app.use('/api/friends',       friendsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/courts',        courtsRoutes);
app.use('/api/dm',            dmRoutes);
app.use('/api/activity',      activityRoutes);

httpServer.listen(PORT, () => {
  console.log(`🚀 SportLink Backend running on http://localhost:${PORT}`);
});

// --- socket.io chat ---
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('No token'));
  try {
    socket.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  // Join personal room for real-time DMs
  socket.join(`user_${socket.user.id}`);

  socket.on('join_game', async (gameId) => {
    const id = parseInt(gameId);
    if (isNaN(id)) return;
    if (!(await isUserInGame(id, socket.user.id))) return;
    socket.join(`game_${id}`);
  });

  socket.on('send_message', async ({ gameId, content }) => {
    const id = parseInt(gameId);
    if (!content?.trim() || content.trim().length > 1000 || isNaN(id)) return;
    if (!(await isUserInGame(id, socket.user.id))) return;

    try {
      const [[currentUser]] = await pool.execute('SELECT username FROM Users WHERE id = ?', [socket.user.id]);
      const [result] = await pool.execute(
        'INSERT INTO Messages (game_id, user_id, username, content) VALUES (?, ?, ?, ?)',
        [id, socket.user.id, currentUser.username, content.trim()]
      );
      const [[msg]] = await pool.execute(
        `SELECT m.id, m.user_id, u.username, m.content, m.created_at
         FROM Messages m JOIN Users u ON u.id = m.user_id WHERE m.id = ?`,
        [result.insertId]
      );
      io.to(`game_${id}`).emit('new_message', msg);
    } catch (err) {
      console.error('Socket send_message error:', err.message);
    }
  });
});

// --- Game-start reminder notifications ---
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
            BETWEEN DATE_ADD(NOW(), INTERVAL 25 MINUTE)
              AND   DATE_ADD(NOW(), INTERVAL 35 MINUTE)
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

// --- Auto-complete stale games ---
// Transitions active games to 'completed' AUTO_COMPLETE_HOURS after scheduled_time
// (default 3h). Also nudges host + participants to submit ratings.
async function autoCompleteGames() {
  const hours = parseInt(process.env.AUTO_COMPLETE_HOURS ?? '3', 10) || 3;
  try {
    const [games] = await pool.execute(`
      SELECT id, title, sport_type, host_id, recurrence, scheduled_time,
             latitude, longitude, location_desc, equipment_notes, max_players, level, photo
      FROM Games
      WHERE status = 'active'
        AND STR_TO_DATE(scheduled_time, '%Y-%m-%d %H:%i') <= DATE_SUB(NOW(), INTERVAL ? HOUR)
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
          const [[rootCheck]] = await pool.execute(
            'SELECT parent_game_id FROM Games WHERE id = ?', [game.id]
          );
          if (rootCheck && rootCheck.parent_game_id == null) {
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
      if (tokens.length === 0) continue;

      await sendPushNotifications(tokens.map(to => ({
        to,
        title: '🏅 Rate your teammates!',
        body:  `${gameTitle} has ended. How did everyone do?`,
        data:  { gameId: game.id },
      })));
    }
  } catch (err) {
    console.error('Auto-complete games error:', err.message);
  }
}

setInterval(autoCompleteGames, 5 * 60_000);
