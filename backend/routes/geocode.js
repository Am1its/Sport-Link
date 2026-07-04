const express = require('express');
const axios   = require('axios');

const router  = express.Router();
const API_KEY = process.env.GOOGLE_PLACES_API_KEY;

// GET /api/geocode?q=<address>          — forward geocoding: address → [{name, lat, lng}]
// GET /api/geocode?reverse=1&lat=&lng=  — reverse geocoding: lat/lng → neighborhood name
router.get('/', async (req, res) => {
  if (!API_KEY) return res.json({ success: true, results: [], neighborhood: null });

  const { q, reverse, lat, lng } = req.query;

  try {
    if (reverse === '1' && lat && lng) {
      // The Geocoding API is not enabled on this project's key (CLAUDE.md rule 14) —
      // approximate a "neighborhood" from the nearest Places result's vicinity string
      // (e.g. "Ben Saruq Street 13, Tel Aviv-Yafo" -> "Ben Saruq Street 13") instead.
      const response = await axios.get('https://maps.googleapis.com/maps/api/place/nearbysearch/json', {
        params: { location: `${lat},${lng}`, radius: 300, key: API_KEY, language: 'en' },
      });
      const result = (response.data.results ?? []).find(r =>
        r.vicinity && !(r.types || []).every(t => t === 'locality' || t === 'political')
      );
      if (!result) return res.json({ success: true, neighborhood: null });

      const segments = result.vicinity.split(',').map(s => s.trim()).filter(Boolean);
      const neighborhood = segments.length > 1 ? segments.slice(0, -1).join(', ') : segments[0] || null;
      return res.json({ success: true, neighborhood });
    }

    const term = typeof q === 'string' ? q.trim() : '';
    if (term.length < 2) return res.json({ success: true, results: [] });

    const response = await axios.get('https://maps.googleapis.com/maps/api/place/textsearch/json', {
      params: { query: term, key: API_KEY, language: 'en', region: 'il' },
    });

    const results = (response.data.results ?? []).slice(0, 5).map(r => ({
      name: r.formatted_address || r.name,
      lat:  r.geometry.location.lat,
      lng:  r.geometry.location.lng,
    }));

    res.json({ success: true, results });
  } catch (err) {
    console.error('Geocode error:', err.message);
    res.json({ success: true, results: [], neighborhood: null });
  }
});

module.exports = router;
