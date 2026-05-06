const https = require('https');
const pool = require('../db');

/**
 * Send one or more Expo push notifications and persist them in the Notifications table.
 * @param {Array<{to: string, title: string, body: string, data?: object}>} messages
 */
async function sendPushNotifications(messages) {
  const filtered = messages.filter(m => m.to && m.to.startsWith('ExponentPushToken['));
  if (filtered.length === 0) return;

  // Persist to DB: look up user_id for each push token
  try {
    const tokens = [...new Set(filtered.map(m => m.to))];
    const placeholders = tokens.map(() => '?').join(',');
    const [rows] = await pool.execute(
      `SELECT id, push_token FROM Users WHERE push_token IN (${placeholders})`,
      tokens
    );
    const tokenToUserId = {};
    rows.forEach(r => { tokenToUserId[r.push_token] = r.id; });

    const inserts = filtered
      .map(m => ({ userId: tokenToUserId[m.to], title: m.title, body: m.body, data: m.data ?? null }))
      .filter(m => m.userId);

    if (inserts.length > 0) {
      const insertPlaceholders = inserts.map(() => '(?, ?, ?, ?)').join(', ');
      const insertValues = inserts.flatMap(m => [m.userId, m.title, m.body, m.data ? JSON.stringify(m.data) : null]);
      await pool.execute(
        `INSERT INTO Notifications (user_id, title, body, data) VALUES ${insertPlaceholders}`,
        insertValues
      );
    }
  } catch (err) {
    console.error('Notification DB persist error:', err.message);
  }

  const payload = JSON.stringify(filtered);
  const options = {
    hostname: 'exp.host',
    path: '/--/api/v2/push/send',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip, deflate',
    },
  };

  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      res.on('data', () => {});
      res.on('end', resolve);
    });
    req.on('error', (err) => console.error('Push notification error:', err));
    req.write(payload);
    req.end();
  });
}

module.exports = sendPushNotifications;
