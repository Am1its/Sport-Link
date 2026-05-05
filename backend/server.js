require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const authRoutes    = require('./routes/auth');
const gamesRoutes   = require('./routes/games');
const chatsRoutes   = require('./routes/chats');
const usersRoutes   = require('./routes/users');
const ratingsRoutes = require('./routes/ratings');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'SportLink API is running!' });
});

const detectSportType = (name = '') => {
  const n = name.toLowerCase();
  if (n.match(/basket|כדורסל/))               return 'basketball';
  if (n.match(/tennis|טניס/))                 return 'tennis';
  if (n.match(/volley|כדורעף/))               return 'volleyball';
  if (n.match(/football|soccer|כדורגל|כדור-גל/)) return 'football';
  return null;
};

const MOCK_COURTS = [
  { place_id: 'mock_sportek_01',  name: 'ספורטק תל אביב - מגרשי כדורסל',  sport_type: 'basketball', geometry: { location: { lat: 32.09668, lng: 34.78685 } }, vicinity: 'שדרות רוקח, תל אביב-יפו',              rating: 4.6 },
  { place_id: 'mock_charles_02', name: "פארק צ'ארלס קלור - מתחם כושר",    sport_type: 'tennis',     geometry: { location: { lat: 32.06450, lng: 34.76120 } }, vicinity: "פרופ' יחזקאל קויפמן, תל אביב-יפו",   rating: 4.8 },
  { place_id: 'mock_gordon_03',  name: 'מגרשי כדורעף חופים - חוף גורדון', sport_type: 'volleyball', geometry: { location: { lat: 32.08370, lng: 34.76810 } }, vicinity: 'חוף גורדון, תל אביב-יפו',             rating: 4.7 },
];

app.get('/api/courts/nearby', async (req, res) => {
  const { lat, lng, radius = 3000 } = req.query;
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  // Fall back to mock data when no API key or location is provided
  if (!apiKey || apiKey === 'YOUR_API_KEY_HERE' || !lat || !lng) {
    console.log('📍 Serving mock courts (no API key or location)');
    return res.json({ success: true, source: 'mock', courts: MOCK_COURTS });
  }

  try {
    // Two parallel searches: Hebrew "מגרש" catches Israeli courts, English "sport court" catches the rest
    const [hebrewRes, englishRes] = await Promise.all([
      axios.get('https://maps.googleapis.com/maps/api/place/nearbysearch/json', {
        params: { location: `${lat},${lng}`, radius, keyword: 'מגרש', key: apiKey },
      }),
      axios.get('https://maps.googleapis.com/maps/api/place/nearbysearch/json', {
        params: { location: `${lat},${lng}`, radius, keyword: 'sport court', key: apiKey },
      }),
    ]);

    const seen = new Set();
    const courts = [...hebrewRes.data.results, ...englishRes.data.results]
      .filter((p) => {
        if (seen.has(p.place_id)) return false;
        seen.add(p.place_id);
        return true;
      })
      .map((p) => ({
        place_id: p.place_id,
        name: p.name,
        sport_type: detectSportType(p.name),
        geometry: { location: { lat: p.geometry.location.lat, lng: p.geometry.location.lng } },
        vicinity: p.vicinity,
        rating: p.rating ?? 0,
      }));

    console.log(`📍 Found ${courts.length} courts near (${lat}, ${lng})`);
    res.json({ success: true, source: 'Google Places', courts });
  } catch (err) {
    console.error('Google Places error:', err.message);
    res.json({ success: true, source: 'mock (fallback)', courts: MOCK_COURTS });
  }
});

app.use('/api/auth',    authRoutes);
app.use('/api/games',   gamesRoutes);
app.use('/api/chats',   chatsRoutes);
app.use('/api/users',   usersRoutes);
app.use('/api/ratings', ratingsRoutes);

app.listen(PORT, () => {
  console.log(`🚀 SportLink Backend running on http://localhost:${PORT}`);
});
