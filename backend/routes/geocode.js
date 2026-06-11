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
      const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
        params: { latlng: `${lat},${lng}`, key: API_KEY, language: 'en' },
      });
      const result = response.data.results?.[0];
      if (!result) return res.json({ success: true, neighborhood: null });

      const comps = result.address_components ?? [];
      const neighborhood =
        comps.find(c => c.types.includes('neighborhood'))?.long_name ||
        comps.find(c => c.types.includes('sublocality_level_1'))?.long_name ||
        comps.find(c => c.types.includes('sublocality'))?.long_name ||
        null;
      return res.json({ success: true, neighborhood });
    }

    const term = typeof q === 'string' ? q.trim() : '';
    if (term.length < 2) return res.json({ success: true, results: [] });

    const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: { address: term, key: API_KEY, language: 'en', region: 'il' },
    });

    const results = (response.data.results ?? []).slice(0, 5).map(r => ({
      name: r.formatted_address,
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
