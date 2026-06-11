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
const { checkAndAwardBadges } = require('./utils/badgeUtils');

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
const geocodeRoutes       = require('./routes/geocode');

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

// Escape user-controlled strings before interpolating into HTML
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

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

  const safeTitle       = escapeHtml(game?.title || (sport + ' Game'));
  const safeLocation    = escapeHtml(game?.location_desc);
  const safeHost        = escapeHtml(game?.host_username);
  const safeOgTitle     = escapeHtml(title);
  const safeDescription = escapeHtml(description);

  const gameBlock = game ? `
    <div class="game-card">
      <div class="sport-badge">${emoji} ${escapeHtml(sport ?? '')}</div>
      <h1 class="game-title">${safeTitle}</h1>
      ${game.scheduled_time ? `<div class="meta"><span class="meta-icon">🕒</span> ${escapeHtml(game.scheduled_time)}</div>` : ''}
      ${safeLocation ? `<div class="meta"><span class="meta-icon">📍</span> ${safeLocation}</div>` : ''}
      <div class="meta"><span class="meta-icon">👤</span> Hosted by <strong>${safeHost}</strong></div>
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
  <title>${safeOgTitle}</title>

  <!-- Open Graph -->
  <meta property="og:title"       content="${safeOgTitle}" />
  <meta property="og:description" content="${safeDescription}" />
  <meta property="og:url"         content="${escapeHtml(pageUrl)}" />
  <meta property="og:type"        content="website" />
  <meta property="og:site_name"   content="SportLink" />

  <!-- Twitter Card -->
  <meta name="twitter:card"        content="summary" />
  <meta name="twitter:title"       content="${safeOgTitle}" />
  <meta name="twitter:description" content="${safeDescription}" />

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
      ? `<img class="avatar" src="data:image/jpeg;base64,${user.avatar}" alt="${escapeHtml(user.username)}" />`
      : `<div class="avatar avatar-fallback">${escapeHtml(user.username.charAt(0).toUpperCase())}</div>`;

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
  <title>${escapeHtml(ogTitle)}</title>
  <meta property="og:title"       content="${escapeHtml(ogTitle)}" />
  <meta property="og:description" content="${escapeHtml(ogDesc)}" />
  <meta property="og:url"         content="${escapeHtml(pageUrl)}" />
  <meta property="og:type"        content="website" />
  <meta property="og:site_name"   content="SportLink" />
  <meta name="twitter:card"        content="summary" />
  <meta name="twitter:title"       content="${escapeHtml(ogTitle)}" />
  <meta name="twitter:description" content="${escapeHtml(ogDesc)}" />
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
    <div class="username">${escapeHtml(user.username)}</div>
    ${user.bio ? `<div class="bio">"${escapeHtml(user.bio)}"</div>` : ''}
    <div class="headline">${sportEmoji} invited you to play ${escapeHtml(SPORT_LABELS[user.top_sport] ?? 'sports')} on SportLink!</div>
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

// --- Privacy Policy ---
app.get('/privacy', (req, res) => {
  const updated = 'June 11, 2026';
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Privacy Policy — SportLink</title>
  <style>
    body { max-width: 720px; margin: 0 auto; padding: 40px 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #1C1C1E; color: #FFFFFF; line-height: 1.7; }
    h1 { font-size: 28px; font-weight: 900; color: #0FEA95; margin-bottom: 4px; }
    h2 { font-size: 18px; font-weight: 800; color: #FFFFFF; margin: 32px 0 10px; }
    p, li { font-size: 15px; color: #AEAEB2; }
    ul { padding-left: 20px; }
    a { color: #0FEA95; }
    .updated { font-size: 13px; color: #636366; margin-bottom: 32px; }
  </style>
</head>
<body>
  <h1>SportLink Privacy Policy</h1>
  <p class="updated">Last updated: ${updated}</p>

  <h2>1. Information We Collect</h2>
  <p>We collect the following information when you use SportLink:</p>
  <ul>
    <li><strong>Account information:</strong> username, email address, and optionally a bio and profile photo.</li>
    <li><strong>Location data:</strong> your device location (when you grant permission) to show nearby courts and games. We do not store your location history.</li>
    <li><strong>Game activity:</strong> games you create, join, and messages you send in game chats.</li>
    <li><strong>Device information:</strong> Expo push token for sending notifications about your games.</li>
    <li><strong>Google Sign-In:</strong> if you use Google Sign-In, we receive your name, email, and Google profile photo.</li>
  </ul>

  <h2>2. How We Use Your Information</h2>
  <ul>
    <li>To provide core app features: finding games, joining courts, real-time chat, and ratings.</li>
    <li>To send push notifications about game activity, friend requests, and post-game ratings.</li>
    <li>To calculate and display your karma score based on game participation and peer ratings.</li>
    <li>To improve the app and fix bugs using aggregated, anonymized usage data via Sentry error monitoring.</li>
  </ul>

  <h2>3. Data Sharing</h2>
  <p>We do not sell your personal data. We share data only with:</p>
  <ul>
    <li><strong>Other SportLink users:</strong> your username, avatar, bio, sport preferences, and karma are visible to other users on your public profile.</li>
    <li><strong>Google:</strong> if you use Google Sign-In (governed by Google's Privacy Policy).</li>
    <li><strong>Expo (push notifications):</strong> your push token is sent to Expo's push notification service to deliver notifications.</li>
    <li><strong>Sentry:</strong> error reports and crash logs are sent to Sentry for debugging (no personal data is intentionally included).</li>
    <li><strong>Railway:</strong> our hosting provider stores your data on their servers in the EU/US.</li>
  </ul>

  <h2>4. Data Retention</h2>
  <p>Your data is retained as long as your account is active. You may contact us to delete your account and all associated data.</p>

  <h2>5. Your Rights</h2>
  <p>You have the right to access, correct, or delete your personal data. Contact us at <a href="mailto:oran2107@gmail.com">oran2107@gmail.com</a>.</p>

  <h2>6. Children</h2>
  <p>SportLink is not intended for users under 13. We do not knowingly collect data from children under 13.</p>

  <h2>7. Changes to This Policy</h2>
  <p>We may update this policy. Continued use of the app after changes constitutes acceptance of the updated policy.</p>

  <h2>8. Contact</h2>
  <p>Questions? Email us at <a href="mailto:oran2107@gmail.com">oran2107@gmail.com</a>.</p>
</body>
</html>`);
});

// --- Terms of Service ---
app.get('/terms', (req, res) => {
  const updated = 'June 11, 2026';
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Terms of Service — SportLink</title>
  <style>
    body { max-width: 720px; margin: 0 auto; padding: 40px 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #1C1C1E; color: #FFFFFF; line-height: 1.7; }
    h1 { font-size: 28px; font-weight: 900; color: #0FEA95; margin-bottom: 4px; }
    h2 { font-size: 18px; font-weight: 800; color: #FFFFFF; margin: 32px 0 10px; }
    p, li { font-size: 15px; color: #AEAEB2; }
    ul { padding-left: 20px; }
    a { color: #0FEA95; }
    .updated { font-size: 13px; color: #636366; margin-bottom: 32px; }
  </style>
</head>
<body>
  <h1>SportLink Terms of Service</h1>
  <p class="updated">Last updated: ${updated}</p>

  <h2>1. Acceptance</h2>
  <p>By using SportLink you agree to these Terms. If you do not agree, do not use the app.</p>

  <h2>2. Use of the Service</h2>
  <ul>
    <li>You must be at least 13 years old to use SportLink.</li>
    <li>You are responsible for all activity under your account.</li>
    <li>You may not use SportLink for any unlawful purpose or to harass other users.</li>
    <li>You may not impersonate other people or post false information.</li>
  </ul>

  <h2>3. User Content</h2>
  <p>You retain ownership of content you post (profile photos, game details, chat messages). By posting, you grant SportLink a non-exclusive, royalty-free license to display that content within the app. You are solely responsible for your content.</p>

  <h2>4. Community Standards</h2>
  <p>SportLink is a sports community. Treat other users with respect. We may suspend or terminate accounts that violate these standards, including harassment, hate speech, or spamming.</p>

  <h2>5. Ratings and Karma</h2>
  <p>The karma system reflects community feedback. We do not guarantee the accuracy of karma scores and are not liable for any reputational effect.</p>

  <h2>6. Disclaimer</h2>
  <p>SportLink is provided "as is" without warranties of any kind. We are not responsible for in-person meetings arranged through the app. Participate in games at your own risk.</p>

  <h2>7. Limitation of Liability</h2>
  <p>To the fullest extent permitted by law, SportLink is not liable for any indirect, incidental, or consequential damages arising from your use of the app.</p>

  <h2>8. Changes</h2>
  <p>We may modify these Terms at any time. Continued use after changes constitutes acceptance.</p>

  <h2>9. Contact</h2>
  <p>Questions? Email <a href="mailto:oran2107@gmail.com">oran2107@gmail.com</a>.</p>
</body>
</html>`);
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
app.use('/api/geocode',       geocodeRoutes);

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

  // DM typing indicator — route to receiver's personal room
  socket.on('dm_typing', ({ to }) => {
    const receiverId = parseInt(to);
    if (!isNaN(receiverId) && receiverId !== socket.user.id) {
      io.to(`user_${receiverId}`).emit('dm_typing', { from: socket.user.id });
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
             latitude, longitude, location_desc, equipment_notes, max_players, level, photo,
             parent_game_id
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
