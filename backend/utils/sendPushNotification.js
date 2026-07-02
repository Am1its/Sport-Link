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
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', async () => {
        await clearDeadTokens(pushable, body);
        resolve();
      });
    });
    req.on('error', (err) => {
      console.error('Push notification error:', err);
      resolve();
    });
    req.write(payload);
    req.end();
  });
}

/**
 * Parses the Expo push ticket response and clears push_token for any user whose
 * token Expo has already flagged as DeviceNotRegistered, so we stop pushing dead tokens.
 * Ticket order in the response always matches the request order (Expo API guarantee).
 * @param {Array<{user_id: number, to: string}>} pushable
 * @param {string} responseBody
 */
async function clearDeadTokens(pushable, responseBody) {
  let parsed;
  try {
    parsed = JSON.parse(responseBody);
  } catch {
    return; // Not JSON (network/proxy error page, etc.) — nothing to parse
  }

  const tickets = parsed?.data;
  if (!Array.isArray(tickets) || tickets.length !== pushable.length) return;

  const deadUserIds = tickets
    .map((ticket, i) => (
      ticket?.status === 'error' && ticket?.details?.error === 'DeviceNotRegistered'
        ? pushable[i].user_id
        : null
    ))
    .filter(Boolean);

  if (deadUserIds.length === 0) return;

  try {
    const placeholders = deadUserIds.map(() => '?').join(',');
    await pool.execute(`UPDATE Users SET push_token = NULL WHERE id IN (${placeholders})`, deadUserIds);
  } catch (err) {
    console.error('Clear dead push token error:', err.message);
  }
}

module.exports = sendPushNotifications;
