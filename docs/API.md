# SportLink API Reference

Base URL: `https://sport-link-production.up.railway.app`  
All `/api/*` routes require `Authorization: Bearer <JWT>` unless marked **public** or **auth-optional**.

---

## Auth — `/api/auth`

### `POST /api/auth/register`
Create a new account.  
Body: `{ username, email, password }`  
Returns: `{ token, user }`

### `POST /api/auth/login`
Email + password login.  
Body: `{ email, password }`  
Returns: `{ token, user }`

### `POST /api/auth/google`
Google OAuth login/register via PKCE.  
Body: `{ access_token }` (Google OAuth access token from `exchangeCodeAsync`)  
Returns: `{ token, user }`. New users have `onboarding_complete: false`.

---

## Games — `/api/games`

### `GET /api/games?lat=&lng=&radius_km=&q=` — auth-optional
All upcoming active games. Params:
- `lat`, `lng` — Haversine center
- `radius_km` — filter (optional)
- `q` — full-text search on `title` + `location_desc` (≥2 chars, FULLTEXT for ≥3)

Each game includes `is_joined: boolean` (false for unauthenticated).

### `GET /api/games/mine`
Games where the caller is host or participant (includes past games).

### `POST /api/games`
Create a game.  
Body: `{ sport_type, level, latitude, longitude, location_desc, scheduled_time, equipment_notes?, photo?, max_players?, title?, recurrence?, invited_friends? }`  
`recurrence` must be `'none' | 'weekly' | 'biweekly'`.

### `PUT /api/games/:id`
Edit a game (host only). Same fields as POST except no lat/lng.

### `DELETE /api/games/:id`
Cancel a game (host only). Sets `status='cancelled'`, notifies participants.

### `POST /api/games/:id/join`
Join a game (transaction + SELECT FOR UPDATE).

### `DELETE /api/games/:id/leave`
Leave a game (participant only).

### `GET /api/games/:id/participants`
List all participants. Returns `[{ id, username, avatar, is_host }]`.

---

## Chats — `/api/chats`

### `GET /api/chats`
User's game chats with last message preview.

### `GET /api/chats/:gameId/messages?before=<id>&limit=<n>`
Paginated messages. Returns up to `limit` (max 50) messages before `before` ID, ordered DESC (newest first). Default limit: 30.

### `POST /api/chats/:gameId/messages`
Post a message. Body: `{ content }`.

---

## Users — `/api/users`

### `GET /api/users/me`
Current user's full profile: `{ id, username, bio, avatar, games_hosted, games_joined, karma, top_sport, sport_preferences }`.

### `PUT /api/users/me`
Update profile. Body (all optional): `{ username, bio, avatar, onboarding_complete }`. Dynamic SET.

### `GET /api/users/search?q=`
Username prefix search (min 2 chars), excludes self. Returns `[{ id, username, avatar }]`.

### `GET /api/users/avatars?ids=1,2,3`
Batch avatar fetch. Returns `[{ id, avatar }]`.

### `GET /api/users/leaderboard`
Top 20 users by karma.

### `PUT /api/users/push-token`
Save or clear Expo push token. Body: `{ push_token }`.

### `GET /api/users/sport-preferences`
Current user's sport preferences array.

### `PUT /api/users/sport-preferences`
Upsert preferences. Body: `{ preferences: [{ sport_type, skill_level, is_favorite }] }`. Delete-all + re-insert in transaction.

### `GET /api/users/suggestions?lat=&lng=&sport=`
Player matching. Returns suggested non-friends ranked by `shared_count DESC, shared_game_count DESC, karma DESC`. `shared_game_count` = completed games together.

### `GET /api/users/:id`
Public profile. Returns `{ ..., friendship_status, friendship_id }`.

---

## Friends — `/api/friends`

### `GET /api/friends`
Accepted friends list with karma.

### `GET /api/friends/requests`
Incoming pending requests.

### `POST /api/friends`
Send friend request. Body: `{ addressee_id }`. Sends push notification.

### `PUT /api/friends/:id/accept`
Accept request by Friends row id. Sends push notification to requester.

### `DELETE /api/friends/:id`
Remove friend or reject/cancel request.

---

## Courts — `/api/courts`

### `GET /api/courts/nearby?lat=&lng=&radius=`
Nearby courts via Google Places (6 parallel queries — Hebrew/English court keywords, gym, yoga/studio, padel, swimming pools) or mock fallback. `detectSportType()` classifies each result into one of the 12 sports by name pattern; note the footvolley check must run before the football check since Hebrew footvolley names ("כדורגל חוף") contain the football substring.

### `GET /api/courts/photo?ref=<photoRef>&maxwidth=600`
Proxy for Google Places photos. Streams image with 24h cache header.

### `GET /api/courts/:placeId`
Court detail: Google Places info + SportLink aggregate + reviews.  
Returns: `{ places, review_count, avg_rating, reviews, claimed_by, is_manager }`.  
`claimed_by`: `{ id, username, avatar } | null`. `is_manager`: boolean.

### `GET /api/courts/:placeId/reviews`
Full review list (includes `owner_response`, `owner_response_at`).

### `POST /api/courts/:placeId/reviews`
Submit or update own review. Body: `{ rating (1–5), comment? }`. One per user per court.

### `DELETE /api/courts/:placeId/reviews/:reviewId`
Delete own review.

### `PUT /api/courts/:placeId/reviews/:reviewId/response`
Manager adds/updates response. Body: `{ response }`. Guards: caller must be court manager.

### `DELETE /api/courts/:placeId/reviews/:reviewId/response`
Manager removes their response.

### `POST /api/courts/:placeId/claim`
Claim court as manager (first-come, one per court). Returns 409 if already claimed.

### `DELETE /api/courts/:placeId/claim`
Release claim (manager only).

---

## Ratings — `/api/ratings`

### `GET /api/ratings/game/:gameId/results`
Returns `{ can_view, results }`. `can_view: false` if caller has unrated players. Results: per-player `{ attended, peer_count, sportsmanship_pct, punctuality_pct, communication_pct, skill_avg }`. Anonymous.

### `GET /api/ratings/game/:gameId`
Returns `{ is_host, players }` — still-unrated players for the caller.

### `POST /api/ratings/batch`
Host submits attendance. Body: `{ game_id, ratings: [{ ratee_id, attended }] }`.

### `POST /api/ratings/peer`
Non-host submits peer ratings. Body: `{ game_id, ratings: [{ ratee_id, sportsmanship, punctuality, communication, skill }] }`.

---

## Notifications — `/api/notifications`

### `GET /api/notifications`
Returns `{ notifications, unread_count }`. Last 50.

### `PUT /api/notifications/:id/read`
Mark single notification read.

### `PUT /api/notifications/read-all`
Mark all notifications read.

---

## Direct Messages — `/api/dm`

### `GET /api/dm`
DM conversation list: `[{ id, username, avatar, last_content, last_type, last_event_id, last_sender_id, last_time, unread_count }]`.

### `GET /api/dm/:userId`
Fetch up to 100 messages with that user (ASC). Auto-marks received messages as read.

### `POST /api/dm/:userId`
Send message. Body: `{ content, type?, event_id? }`. `type='event'` requires `event_id`. Emits `new_dm` socket event to receiver's `user_${id}` room.

### `PUT /api/dm/:userId/read`
Mark all messages from that user as read.

---

## Activity — `/api/activity`

### `GET /api/activity`
Friend activity feed. Returns last 50 events from friends: `[{ type: 'joined'|'created', actor_id, actor_username, actor_avatar, game_id, game_title, game_sport_type, game_location_desc, happened_at }]`.

---

## Public Pages (HTML)

| Route | Description |
|---|---|
| `GET /game/:id` | Game share landing page with OG meta + `sportlink://game/:id` deep link |
| `GET /invite/:userId` | User invite landing page with `sportlink://invite/:userId` deep link |
| `GET /privacy` | Privacy policy |
| `GET /terms` | Terms of service |
| `GET /health` | `{ status: 'OK' }` |

---

## Socket.io Events

Connect with `{ auth: { token } }`.

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `join_game` | `gameId` | Join room `game_${id}` (validates participation) |
| `send_message` | `{ gameId, content }` | Send chat message; broadcasts `new_message` to room |

### Server → Client

| Event | Payload | Sent to |
|---|---|---|
| `new_message` | `{ id, user_id, username, content, created_at, avatar }` | Room `game_${gameId}` |
| `new_dm` | `{ id, sender_id, receiver_id, content, type, event_id, is_read, created_at, ... }` | Room `user_${receiverId}` |

On connection, each user is automatically joined to their personal room `user_${id}`.

---

## Karma Calculation

```sql
-- From utils/karmaSQL.js (KARMA_SQL constant)
(
  SELECT COALESCE(SUM(CASE WHEN attended = 1 THEN 1 ELSE -1 END), 0)
  FROM Ratings WHERE ratee_id = u.id
)
+ (
  SELECT COALESCE(SUM(sportsmanship + punctuality + communication + (skill >= 3)), 0)
  FROM PeerRatings WHERE ratee_id = u.id
)
```

Host rates attendance (+1 / -1). Peers rate sportsmanship, punctuality, communication (thumb up = +1) and skill ≥ 3 = +1.

---

## Rate Limits

| Scope | Limit |
|---|---|
| `/api/auth/*` | 10 requests / 60s |
| All other `/api/*` | 300 requests / 60s |
