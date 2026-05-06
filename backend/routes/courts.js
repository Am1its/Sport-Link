const express = require('express');
const axios = require('axios');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

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

// GET /api/courts/nearby
router.get('/nearby', async (req, res) => {
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

// GET /api/courts/photo?ref=<photoRef>&maxwidth=400  — proxy Google Places photo
router.get('/photo', async (req, res) => {
  const { ref, maxwidth = 800 } = req.query;
  if (!ref) return res.status(400).json({ success: false, message: 'ref is required' });

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
    return res.status(404).json({ success: false, message: 'No API key configured' });
  }

  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/place/photo', {
      params: { maxwidth, photoreference: ref, key: apiKey },
      responseType: 'stream',
    });
    res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    response.data.pipe(res);
  } catch (err) {
    console.error('Photo proxy error:', err.message);
    res.status(502).json({ success: false, message: 'Failed to fetch photo' });
  }
});

// GET /api/courts/:placeId  — court detail: Places info + SportLink reviews aggregate
router.get('/:placeId', authMiddleware, async (req, res) => {
  const { placeId } = req.params;
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  let placesData = null;

  if (apiKey && apiKey !== 'YOUR_API_KEY_HERE' && !placeId.startsWith('mock_')) {
    try {
      const { data } = await axios.get(
        'https://maps.googleapis.com/maps/api/place/details/json',
        {
          params: {
            place_id: placeId,
            fields: 'name,formatted_address,opening_hours,photos,rating,user_ratings_total,formatted_phone_number,website',
            key: apiKey,
          },
        }
      );
      if (data.status === 'OK') {
        const r = data.result;
        placesData = {
          name: r.name,
          address: r.formatted_address ?? null,
          phone: r.formatted_phone_number ?? null,
          website: r.website ?? null,
          google_rating: r.rating ?? null,
          google_rating_count: r.user_ratings_total ?? null,
          open_now: r.opening_hours?.open_now ?? null,
          weekday_hours: r.opening_hours?.weekday_text ?? [],
          photo_refs: (r.photos ?? []).slice(0, 6).map(p => p.photo_reference),
        };
      }
    } catch (err) {
      console.error('Places Details error:', err.message);
    }
  }

  try {
    const [[agg]] = await pool.execute(
      `SELECT COUNT(*) AS review_count, ROUND(AVG(rating), 1) AS avg_rating
       FROM CourtReviews WHERE place_id = ?`,
      [placeId]
    );

    const [reviews] = await pool.execute(
      `SELECT cr.id, cr.user_id, u.username, u.avatar, cr.rating, cr.comment, cr.created_at
       FROM CourtReviews cr
       JOIN Users u ON u.id = cr.user_id
       WHERE cr.place_id = ?
       ORDER BY cr.created_at DESC
       LIMIT 20`,
      [placeId]
    );

    res.json({
      success: true,
      places: placesData,
      review_count: Number(agg.review_count),
      avg_rating: agg.avg_rating ? Number(agg.avg_rating) : null,
      reviews,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/courts/:placeId/reviews
router.get('/:placeId/reviews', authMiddleware, async (req, res) => {
  const { placeId } = req.params;
  try {
    const [reviews] = await pool.execute(
      `SELECT cr.id, cr.user_id, u.username, u.avatar, cr.rating, cr.comment, cr.created_at
       FROM CourtReviews cr
       JOIN Users u ON u.id = cr.user_id
       WHERE cr.place_id = ?
       ORDER BY cr.created_at DESC`,
      [placeId]
    );
    res.json({ success: true, reviews });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/courts/:placeId/reviews  — submit or update own review
router.post('/:placeId/reviews', authMiddleware, async (req, res) => {
  const { placeId } = req.params;
  const { rating, comment } = req.body;
  const userId = req.user.id;

  if (!rating || rating < 1 || rating > 5)
    return res.status(400).json({ success: false, message: 'rating must be 1–5' });
  if (comment && comment.length > 500)
    return res.status(400).json({ success: false, message: 'comment max 500 chars' });

  try {
    await pool.execute(
      `INSERT INTO CourtReviews (place_id, user_id, rating, comment)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment)`,
      [placeId, userId, rating, comment?.trim() ?? null]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/courts/:placeId/reviews/:reviewId
router.delete('/:placeId/reviews/:reviewId', authMiddleware, async (req, res) => {
  const reviewId = parseInt(req.params.reviewId);
  const userId = req.user.id;

  try {
    const [[review]] = await pool.execute(
      'SELECT id FROM CourtReviews WHERE id = ? AND user_id = ?',
      [reviewId, userId]
    );
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });

    await pool.execute('DELETE FROM CourtReviews WHERE id = ?', [reviewId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
