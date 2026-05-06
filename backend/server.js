require('dotenv').config();
const http = require('http');
const express = require('express');
const { Server: IOServer } = require('socket.io');
const cors = require('cors');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');

const pool                 = require('./db');
const sendPushNotifications = require('./utils/sendPushNotification');

const authRoutes          = require('./routes/auth');
const gamesRoutes         = require('./routes/games');
const chatsRoutes         = require('./routes/chats');
const usersRoutes         = require('./routes/users');
const ratingsRoutes       = require('./routes/ratings');
const friendsRoutes       = require('./routes/friends');
const notificationsRoutes = require('./routes/notifications');

const app = express();
const httpServer = http.createServer(app);
const io = new IOServer(httpServer, { cors: { origin: '*' } });

app.use(cors());
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

const detectSportType = (name = '') => {
  const n = name.toLowerCase();
  if (n.match(/basket|כדורסל/))                  return 'basketball';
  if (n.match(/tennis|טניס/))                    return 'tennis';
  if (n.match(/volley|כדורעף/))                  return 'volleyball';
  if (n.match(/football|soccer|כדורגל|כדור-גל/)) return 'football';
  if (n.match(/yoga|יוגה/))                      return 'yoga';
  if (n.match(/gym|fitness|כושר|חדר כושר/))      return 'gym';
  if (n.match(/studio|סטודיו/))                  return 'studio';
  return null;
};

const classifyVenueType = (place) => {
  const types = place.types || [];
  const name  = (place.name || '').toLowerCase();
  if (types.includes('gym') || name.match(/gym|fitness|כושר/))          return 'gym';
  if (name.match(/studio|yoga|pilates|dance|סטודיו|יוגה/))              return 'studio';
  if (types.includes('stadium') || types.includes('sports_complex'))    return 'facility';
  return 'court';
};

const MOCK_COURTS = [
  { place_id: 'mock_sportek_01',  name: 'ספורטק תל אביב - מגרשי כדורסל',  sport_type: 'basketball', venue_type: 'court',   geometry: { location: { lat: 32.09668, lng: 34.78685 } }, vicinity: 'שדרות רוקח, תל אביב-יפו',              rating: 4.6 },
  { place_id: 'mock_charles_02', name: "פארק צ'ארלס קלור - מגרשי טניס",   sport_type: 'tennis',     venue_type: 'court',   geometry: { location: { lat: 32.06450, lng: 34.76120 } }, vicinity: "פרופ' יחזקאל קויפמן, תל אביב-יפו",   rating: 4.8 },
  { place_id: 'mock_gordon_03',  name: 'מגרשי כדורעף חופים - חוף גורדון', sport_type: 'volleyball', venue_type: 'court',   geometry: { location: { lat: 32.08370, lng: 34.76810 } }, vicinity: 'חוף גורדון, תל אביב-יפו',             rating: 4.7 },
  { place_id: 'mock_gym_04',     name: 'Holmes Place Tel Aviv',             sport_type: 'gym',        venue_type: 'gym',     geometry: { location: { lat: 32.07200, lng: 34.77500 } }, vicinity: 'דיזנגוף, תל אביב-יפו',               rating: 4.4 },
  { place_id: 'mock_yoga_05',    name: 'Yoga Studio Florentin',             sport_type: 'yoga',       venue_type: 'studio',  geometry: { location: { lat: 32.05900, lng: 34.77100 } }, vicinity: 'פלורנטין, תל אביב-יפו',              rating: 4.9 },
];

app.get('/api/courts/nearby', async (req, res) => {
  const { lat, lng, radius = 3000 } = req.query;
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey || apiKey === 'YOUR_API_KEY_HERE' || !lat || !lng) {
    console.log('📍 Serving mock courts (no API key or location)');
    return res.json({ success: true, source: 'mock', courts: MOCK_COURTS });
  }

  try {
    const [hebrewRes, englishRes, gymRes, studioRes] = await Promise.all([
      axios.get('https://maps.googleapis.com/maps/api/place/nearbysearch/json', {
        params: { location: `${lat},${lng}`, radius, keyword: 'מגרש', key: apiKey },
      }),
      axios.get('https://maps.googleapis.com/maps/api/place/nearbysearch/json', {
        params: { location: `${lat},${lng}`, radius, keyword: 'sport court', key: apiKey },
      }),
      axios.get('https://maps.googleapis.com/maps/api/place/nearbysearch/json', {
        params: { location: `${lat},${lng}`, radius, type: 'gym', key: apiKey },
      }),
      axios.get('https://maps.googleapis.com/maps/api/place/nearbysearch/json', {
        params: { location: `${lat},${lng}`, radius, keyword: 'yoga studio dance', key: apiKey },
      }),
    ]);

    const seen = new Set();
    const courts = [
      ...hebrewRes.data.results,
      ...englishRes.data.results,
      ...gymRes.data.results,
      ...studioRes.data.results,
    ]
      .filter((p) => {
        if (seen.has(p.place_id)) return false;
        seen.add(p.place_id);
        return true;
      })
      .map((p) => ({
        place_id:   p.place_id,
        name:       p.name,
        sport_type: detectSportType(p.name),
        venue_type: classifyVenueType(p),
        geometry:   { location: { lat: p.geometry.location.lat, lng: p.geometry.location.lng } },
        vicinity:   p.vicinity,
        rating:     p.rating ?? 0,
      }));

    console.log(`📍 Found ${courts.length} venues near (${lat}, ${lng})`);
    res.json({ success: true, source: 'Google Places', courts });
  } catch (err) {
    console.error('Google Places error:', err.message);
    res.json({ success: true, source: 'mock (fallback)', courts: MOCK_COURTS });
  }
});

app.use('/api/auth',          authRoutes);
app.use('/api/games',         gamesRoutes);
app.use('/api/chats',         chatsRoutes);
app.use('/api/users',         usersRoutes);
app.use('/api/ratings',       ratingsRoutes);
app.use('/api/friends',       friendsRoutes);
app.use('/api/notifications', notificationsRoutes);

httpServer.listen(PORT, () => {
  console.log(`🚀 SportLink Backend running on http://localhost:${PORT}`);
});

// --- socket.io chat ---
const isUserInGame = async (gameId, userId) => {
  const [[row]] = await pool.execute(
    `SELECT id FROM Games
     WHERE id = ? AND status = 'active'
       AND (host_id = ? OR EXISTS (
         SELECT 1 FROM GameParticipants WHERE game_id = ? AND user_id = ?
       ))`,
    [gameId, userId, gameId, userId]
  );
  return !!row;
};

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
// Maps gameId → timestamp when reminder was sent. Pruned after 2 hours.
const remindersSent = new Map();

async function sendGameReminders() {
  try {
    // Prune stale entries (games that started more than 2 hours ago)
    const TWO_HOURS = 2 * 60 * 60 * 1000;
    for (const [id, ts] of remindersSent) {
      if (Date.now() - ts > TWO_HOURS) remindersSent.delete(id);
    }

    // Find active games starting in the next 25–35 minutes.
    const [games] = await pool.execute(`
      SELECT id, title, sport_type, host_id
      FROM Games
      WHERE status = 'active'
        AND STR_TO_DATE(scheduled_time, '%Y-%m-%d %H:%i')
            BETWEEN DATE_ADD(NOW(), INTERVAL 25 MINUTE)
              AND   DATE_ADD(NOW(), INTERVAL 35 MINUTE)
    `);

    for (const game of games) {
      if (remindersSent.has(game.id)) continue;

      // Collect push tokens for host + all participants in one query.
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
      remindersSent.set(game.id, Date.now());
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
