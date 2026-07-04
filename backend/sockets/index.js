const jwt = require('jsonwebtoken');
const { SOCKET_EVENTS } = require('../constants/socketEvents');
const { isUserInGame }  = require('../utils/gameUtils');

/**
 * Registers all socket.io middleware and connection handlers.
 * @param {import('socket.io').Server} io
 * @param {import('mysql2/promise').Pool} pool
 */
function registerSockets(io, pool) {

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('No token'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const [[row]] = await pool.execute('SELECT token_version FROM Users WHERE id = ?', [decoded.id]);
      if (!row || row.token_version !== (decoded.token_version ?? 0)) {
        return next(new Error('Invalid token'));
      }
      socket.user = decoded;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    // Join personal room for real-time DMs
    socket.join(`user_${socket.user.id}`);

    socket.on(SOCKET_EVENTS.JOIN_GAME, async (gameId) => {
      const id = parseInt(gameId);
      if (isNaN(id)) return;
      if (!(await isUserInGame(id, socket.user.id))) return;
      socket.join(`game_${id}`);
    });

    socket.on(SOCKET_EVENTS.SEND_MESSAGE, async ({ gameId, content }) => {
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
        io.to(`game_${id}`).emit(SOCKET_EVENTS.NEW_MESSAGE, msg);
      } catch (err) {
        console.error('Socket send_message error:', err.message);
      }
    });

    // Game chat typing indicator — broadcast to everyone else in the game room
    socket.on(SOCKET_EVENTS.GAME_TYPING, async (gameId) => {
      const id = parseInt(gameId);
      if (isNaN(id)) return;
      if (!(await isUserInGame(id, socket.user.id))) return;
      socket.to(`game_${id}`).emit(SOCKET_EVENTS.GAME_TYPING, { from: socket.user.id });
    });

    // DM typing indicator — route to receiver's personal room, unless mutually blocked.
    // Block status is cached per-socket (cleared on reconnect) since typing fires per keystroke.
    socket.on(SOCKET_EVENTS.DM_TYPING, async ({ to }) => {
      const receiverId = parseInt(to);
      if (isNaN(receiverId) || receiverId === socket.user.id) return;

      if (!socket.blockCheckCache) socket.blockCheckCache = new Map();
      let blocked = socket.blockCheckCache.get(receiverId);
      if (blocked === undefined) {
        const [[row]] = await pool.execute(
          `SELECT 1 FROM BlockedUsers WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?) LIMIT 1`,
          [socket.user.id, receiverId, receiverId, socket.user.id]
        );
        blocked = !!row;
        socket.blockCheckCache.set(receiverId, blocked);
      }
      if (blocked) return;

      io.to(`user_${receiverId}`).emit(SOCKET_EVENTS.DM_TYPING, { from: socket.user.id });
    });
  });
}

module.exports = { registerSockets };
