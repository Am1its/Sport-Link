const jwt = require('jsonwebtoken');

function optionalUserId(req) {
  try {
    const raw = req.headers['authorization']?.split(' ')[1];
    return raw ? (jwt.verify(raw, process.env.JWT_SECRET)?.id ?? null) : null;
  } catch { return null; }
}

const toMapGame = (row) => ({
  id: row.id,
  place_id: `game_${row.id}`,
  title: row.title ?? null,
  name: row.title
    ? row.title
    : `${row.sport_type.charAt(0).toUpperCase() + row.sport_type.slice(1)} Community Game`,
  sport_type: row.sport_type,
  rating: row.level,
  vicinity: [
    row.location_desc,
    row.scheduled_time    ? `🕒 ${row.scheduled_time}`    : null,
    row.equipment_notes   ? `🎒 ${row.equipment_notes}`   : null,
  ].filter(Boolean).join(' | '),
  geometry: { location: { lat: parseFloat(row.latitude), lng: parseFloat(row.longitude) } },
  isLocalGame: true,
  level: row.level,
  max_players: row.max_players ?? null,
  participant_count: row.participant_count ?? 0,
  host_id: row.host_id,
  scheduled_time: row.scheduled_time,
  location_desc: row.location_desc,
  equipment_notes: row.equipment_notes ?? null,
  photo: row.photo ?? null,
  post_game_photo: row.post_game_photo ?? null,
  boosted_at: row.boosted_at ?? null,
  created_at: row.created_at,
  is_joined: row.is_joined != null ? Boolean(row.is_joined) : false,
  recurrence: row.recurrence ?? 'none',
  neighborhood: row.neighborhood ?? null,
  latitude: row.latitude != null ? parseFloat(row.latitude) : null,
  longitude: row.longitude != null ? parseFloat(row.longitude) : null,
});

module.exports = { optionalUserId, toMapGame };
