const express = require('express');
const pool = require('../db');

const router = express.Router();

const SPORT_EMOJIS = {
  basketball: '🏀', tennis: '🎾', volleyball: '🏐', football: '⚽',
  yoga: '🧘', gym: '💪', studio: '🎵', footvolley: '🤾', swimming: '🏊',
};

function renderPage({ title, description, image, url, deepLink, ctaText }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(title)}</title>
  <meta property="og:title" content="${escHtml(title)}" />
  <meta property="og:description" content="${escHtml(description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escHtml(url)}" />
  ${image ? `<meta property="og:image" content="${escHtml(image)}" />` : ''}
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${escHtml(title)}" />
  <meta name="twitter:description" content="${escHtml(description)}" />
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#1C1C1E;color:#F2F2F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px}
    .card{background:#2C2C2E;border-radius:20px;padding:32px 28px;max-width:420px;width:100%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.4)}
    .logo{font-size:13px;font-weight:800;color:#0FEA95;letter-spacing:2px;text-transform:uppercase;margin-bottom:24px}
    .emoji{font-size:56px;margin-bottom:16px}
    h1{font-size:22px;font-weight:900;color:#F2F2F7;margin-bottom:8px;line-height:1.3}
    p{font-size:15px;color:#8E8E93;line-height:1.5;margin-bottom:28px}
    .cta{display:inline-block;background:#0FEA95;color:#1C1C1E;font-weight:900;font-size:16px;padding:16px 32px;border-radius:50px;text-decoration:none;box-shadow:0 4px 20px rgba(15,234,149,0.4)}
    .cta:hover{opacity:0.9}
    .sub{margin-top:16px;font-size:12px;color:#48484A}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">SportLink</div>
    <div class="emoji">${escHtml(image ? '' : '🏅')}</div>
    <h1>${escHtml(title)}</h1>
    <p>${escHtml(description)}</p>
    <a href="${escHtml(deepLink)}" class="cta">${escHtml(ctaText)}</a>
    <div class="sub">Opens in the SportLink app</div>
  </div>
  <script>
    // Auto-redirect to deep link on mobile
    const ua = navigator.userAgent || '';
    const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
    if (isMobile) {
      window.location.href = "${escHtml(deepLink)}";
    }
  </script>
</body>
</html>`;
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatGameTime(t) {
  if (!t) return '';
  const [datePart, timePart] = t.split(' ');
  if (!datePart) return t;
  const [, month, day] = datePart.split('-');
  if (!timePart) return `${day}/${month}`;
  const [hour, min] = timePart.split(':');
  const h = parseInt(hour, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${day}/${month} at ${h12}:${min} ${ampm}`;
}

// GET /share/game/:id
router.get('/game/:id', async (req, res) => {
  const gameId = parseInt(req.params.id);
  if (isNaN(gameId)) return res.status(404).send('Not found');
  try {
    const [[game]] = await pool.execute(
      `SELECT g.id, g.title, g.sport_type, g.scheduled_time, g.location_desc,
              g.max_players, g.status, u.username AS host_name,
              (SELECT COUNT(*) FROM GameParticipants WHERE game_id = g.id) AS current_players
       FROM Games g JOIN Users u ON u.id = g.host_id
       WHERE g.id = ?`,
      [gameId]
    );
    if (!game) return res.status(404).send('Game not found');

    const emoji = SPORT_EMOJIS[game.sport_type] ?? '🏅';
    const sport = game.sport_type ? game.sport_type.charAt(0).toUpperCase() + game.sport_type.slice(1) : 'Game';
    const gameTitle = game.title || `${sport} Game`;
    const spots = game.max_players - game.current_players;
    const spotsText = spots > 0 ? `${spots} spot${spots !== 1 ? 's' : ''} left` : 'Full';
    const when = formatGameTime(game.scheduled_time);
    const where = game.location_desc || '';

    const description = [
      `Hosted by ${game.host_name}`,
      when,
      where,
      `${game.current_players}/${game.max_players} players · ${spotsText}`,
    ].filter(Boolean).join(' · ');

    const BASE = process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : 'https://sport-link-production.up.railway.app';

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderPage({
      title: `${emoji} ${gameTitle}`,
      description,
      image: null,
      url: `${BASE}/share/game/${gameId}`,
      deepLink: `sportlink://game/${gameId}`,
      ctaText: game.status === 'active' ? 'Join This Game' : 'View Game',
    }));
  } catch (err) {
    console.error('share/game error:', err);
    res.status(500).send('Server error');
  }
});

// GET /share/court/:placeId
router.get('/court/:placeId', async (req, res) => {
  const { placeId } = req.params;
  try {
    const [[agg]] = await pool.execute(
      'SELECT COUNT(*) AS review_count, AVG(rating) AS avg_rating FROM CourtReviews WHERE place_id = ?',
      [placeId]
    );

    const BASE = process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : 'https://sport-link-production.up.railway.app';

    const reviewCount = Number(agg.review_count);
    const avgRating = agg.avg_rating ? Number(agg.avg_rating).toFixed(1) : null;
    const description = reviewCount > 0
      ? `${avgRating} ⭐ · ${reviewCount} community review${reviewCount !== 1 ? 's' : ''} on SportLink`
      : 'View this court on SportLink and leave a review.';

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderPage({
      title: '🏟️ Court on SportLink',
      description,
      image: null,
      url: `${BASE}/share/court/${placeId}`,
      deepLink: `sportlink://court-detail?placeId=${encodeURIComponent(placeId)}`,
      ctaText: 'Open in SportLink',
    }));
  } catch (err) {
    console.error('share/court error:', err);
    res.status(500).send('Server error');
  }
});

module.exports = router;
