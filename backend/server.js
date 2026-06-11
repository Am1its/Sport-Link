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

const app = express();
const httpServer = http.createServer(app);
const io = new IOServer(httpServer, { cors: { origin: '*' } });
app.set('io', io);

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

app.use('/api/auth',          authRoutes);
app.use('/api/games',         gamesRoutes);
app.use('/api/chats',         chatsRoutes);
app.use('/api/users',         usersRoutes);
app.use('/api/ratings',       ratingsRoutes);
app.use('/api/friends',       friendsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/courts',        courtsRoutes);
app.use('/api/dm',            dmRoutes);

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
      // Mark first to prevent double-fire if the loop takes > 1 minute.
      await pool.execute('UPDATE Games SET reminder_sent_at = NOW() WHERE id = ?', [game.id]);

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
