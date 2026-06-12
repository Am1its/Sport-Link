const jwt = require('jsonwebtoken');
const { SOCKET_EVENTS } = require('../constants/socketEvents');
const { isUserInGame }  = require('../utils/gameUtils');

/**
 * Registers all socket.io middleware and connection handlers.
 * @param {import('socket.io').Server} io
 * @param {import('mysql2/promise').Pool} pool
 */
function registerSockets(io, pool) {

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

    // DM typing indicator — route to receiver's personal room
    socket.on(SOCKET_EVENTS.DM_TYPING, ({ to }) => {
      const receiverId = parseInt(to);
      if (!isNaN(receiverId) && receiverId !== socket.user.id) {
        io.to(`user_${receiverId}`).emit(SOCKET_EVENTS.DM_TYPING, { from: socket.user.id });
      }
    });
  });
}

module.exports = { registerSockets };
