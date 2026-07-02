const https = require('https');
const pool = require('../db');

/**
 * Persist a notification for every message with a `user_id`, and send an Expo push
 * for the subset that also have a valid `to` push token. These two channels are
 * intentionally independent — a user without (or who declined) push notifications
 * still gets the notification in their in-app inbox.
 * @param {Array<{user_id: number, to?: string|null, title: string, body: string, data?: object}>} messages
 */
async function sendPushNotifications(messages) {
  const withUser = messages.filter(m => m.user_id);
  if (withUser.length === 0) return;

  // Always persist to the in-app inbox, regardless of push-token availability
  try {
    const insertPlaceholders = withUser.map(() => '(?, ?, ?, ?)').join(', ');
    const insertValues = withUser.flatMap(m => [m.user_id, m.title, m.body, m.data ? JSON.stringify(m.data) : null]);
    await pool.execute(
      `INSERT INTO Notifications (user_id, title, body, data) VALUES ${insertPlaceholders}`,
      insertValues
    );
  } catch (err) {
    console.error('Notification DB persist error:', err.message);
  }

  // Only send to Expo for entries with a valid token
  const pushable = withUser.filter(m => m.to && m.to.startsWith('ExponentPushToken['));
  if (pushable.length === 0) return;

  const payload = JSON.stringify(pushable.map(({ to, title, body, data }) => ({ to, title, body, data })));
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
