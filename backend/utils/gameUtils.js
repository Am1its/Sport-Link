const pool = require('../db');

async function isUserInGame(gameId, userId) {
  const [[row]] = await pool.execute(
    `SELECT id FROM Games
     WHERE id = ? AND status = 'active'
       AND (host_id = ? OR EXISTS (
         SELECT 1 FROM GameParticipants WHERE game_id = ? AND user_id = ?
       ))`,
    [gameId, userId, gameId, userId]
  );
  return !!row;
}

module.exports = { isUserInGame };
