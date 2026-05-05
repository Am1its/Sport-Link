const https = require('https');

/**
 * Send one or more Expo push notifications.
 * @param {Array<{to: string, title: string, body: string, data?: object}>} messages
 */
async function sendPushNotifications(messages) {
  const filtered = messages.filter(m => m.to && m.to.startsWith('ExponentPushToken['));
  if (filtered.length === 0) return;

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
