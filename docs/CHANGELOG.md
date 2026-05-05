# Changelog

All notable changes to SportLink are documented here, ordered from most recent to oldest.

---

## [Sprint 3.1] — May 2026 — Ratings v2, Avatars, Leaderboard & Profile Polish

### Peer Ratings System (host attendance + player category ratings)
**Database**
- `backend/migrations/005_add_peer_ratings.sql` — new `PeerRatings` table: `(game_id, rater_id, ratee_id, sportsmanship TINYINT 0/1, punctuality TINYINT 0/1, communication TINYINT 0/1, skill TINYINT 1-5, created_at)`. Unique on `(game_id, rater_id, ratee_id)`.
- `backend/migrations/006_add_skill_rating.sql` — `ALTER TABLE PeerRatings ADD COLUMN skill TINYINT` (added after initial table creation).

**Backend (`backend/routes/ratings.js`)** — full rewrite
- `GET /api/ratings/game/:gameId` now returns `is_host` flag and filters the player list differently per role: host gets participants not yet attendance-marked; non-host players get peers not yet peer-rated.
- `POST /api/ratings/batch` — restricted to **host only**; marks attendance (Arrived / No-Show) for each participant.
- `POST /api/ratings/peer` — **new endpoint** for non-host participants; accepts `{ game_id, ratings: [{ ratee_id, sportsmanship, punctuality, communication, skill }] }`.

**Backend (`backend/routes/users.js`)**
- Karma formula updated to include PeerRatings: attendance karma (±1 per Ratings row) + category karma (±1 per thumbs up/down for sportsmanship, punctuality, communication).

**Frontend (`frontend/app/rate-players.tsx`)** — full rewrite
- **Host view**: shows Arrived / No-Show buttons per player with a "Pending" badge until chosen. Blocks submission until all players are marked.
- **Player view**: thumbs up/down for Sportsmanship, Punctuality, Communication; 1–5 star selector for Skill Level. Defaults to positive/3 stars.
- Correct avatar (real photo or colored initial letter) shown per player.
- Success/empty states are role-aware ("Attendance Saved" vs "Ratings Submitted").

---

### Avatar System
**Database (`backend/migrations/004_add_user_profile.sql`)**
- Added `bio VARCHAR(200)` and `avatar MEDIUMTEXT` (base64) columns to `Users`.

**Backend (`backend/routes/users.js`)**
- `PUT /api/users/me` — updates username, bio, and avatar (base64); checks username uniqueness.
- `GET /api/users/avatars?ids=1,2,3` — new endpoint; returns `[{ id, avatar }]` for a set of user IDs (used for efficient chat avatar caching — fetched once per user, never re-fetched on polls).

**Backend (`backend/routes/ratings.js`)**
- `GET /api/ratings/game/:gameId` now returns `avatar` field on each player.

**Backend (`backend/server.js`)**
- Increased Express body-parser limit to `10mb` to support base64 avatar uploads.

**Frontend (`frontend/app/(tabs)/profile.tsx`)** — avatar + full edit mode
- Tapping the avatar in edit mode opens `expo-image-picker` (square crop, quality 0.35, base64 output).
- Real avatar image rendered where available; falls back to deterministic colored initial letter.
- Inline edit mode for username and bio with Save / Cancel buttons.

**Frontend (`frontend/app/game-chat.tsx`)**
- Avatars shown for all participants including own messages (own avatar appears on the right side).
- Avatar cache keyed by user ID; a `seenUserIds` ref prevents re-fetching on each 3-second poll.
- Layout: other users show `[avatar] [senderName + bubble + timestamp]`; own messages show `[bubble + timestamp] [avatar]`.

---

### Leaderboard
**Backend (`backend/routes/users.js`)**
- `GET /api/users/leaderboard` — computes full karma on the fly for all users and returns the top 20 with `username`, `avatar`, `karma`, `games_hosted`, `games_joined`.

**Frontend (`frontend/app/leaderboard.tsx`)** — new screen
- Podium section for ranks 1–3: 🥇🥈🥉 medals, gold/silver/bronze platform blocks, larger center avatar for 1st place.
- Ranked list for positions 4–20 with avatar, username, game count, and karma score.
- Current user's row highlighted in green with a "You" badge.
- Accessible from Profile → Community → Leaderboard.

---

### Game Management (host controls)
**Backend (`backend/routes/games.js`)**
- `PUT /api/games/:id` — host-only edit; validates level, max_players, and future date.
- `DELETE /api/games/:id` — host-only cancel (sets `status = 'cancelled'`).
- `DELETE /api/games/:id/leave` — participant-only leave.
- `GET /api/games` — now filters out past games using `STR_TO_DATE(scheduled_time, '%Y-%m-%d %H:%i') > NOW()`.

**Frontend (`frontend/app/(tabs)/games.tsx`)**
- Upcoming / History sections with section headers.
- Host upcoming games: Edit (navigates to `modal.tsx` in edit mode) + Delete (confirmation alert) buttons.
- Joined upcoming games: Leave Game (confirmation alert) button.

**Frontend (`frontend/app/modal.tsx`)** — full rewrite
- Replaced free-text datetime input with native `@react-native-community/datetimepicker` (date picker + time picker).
- Israel timezone fix: formats using `getFullYear()/getMonth()/getDate()/getHours()/getMinutes()` — never `toISOString()`.
- Dual-mode: **create** (POST with lat/lng) vs **edit** (PUT, no lat/lng; pre-fills existing values).

---

### Court-based Game Creation
**Frontend (`frontend/app/(tabs)/index.tsx`)**
- FAB now opens an add menu with two options: **Drop Pin** (existing tap-to-place) and **Choose Court** (new).
- Choose Court opens a bottom sheet listing all nearby courts; tapping one navigates to game creation with that court's name pre-filled as `location_desc`.

---

### Profile Settings Screens
**Frontend (`frontend/app/sport-preferences.tsx`)** — new screen
- Toggle switches per sport (Basketball, Tennis, Volleyball, Football).
- Skill level chip selector (Beginner → Pro).
- Preferences persisted in `AsyncStorage`.

**Frontend (`frontend/app/notifications-settings.tsx`)** — new screen
- Toggle switches for: Game Reminders, New Players Join, Chat Messages, Ratings Received.
- Settings persisted in `AsyncStorage`.

**Frontend (`frontend/app/(tabs)/profile.tsx`)**
- Profile menu split into **Community** (Leaderboard) and **Account** (Sport Preferences, Notifications, Sign Out) sections.
- Removed duplicate "Edit Profile" menu item (Edit button under bio is the primary entry point).

---

## [Sprint 3] — May 2026 — QA, Karma & UI Polish

### QA & Edge Cases
**Backend (`backend/routes/games.js`)**
- `POST /api/games`: reject `scheduled_time` that parses as a past datetime (400)
- `POST /api/games`: reject `max_players` < 2 (400)
- `POST /api/games`: reject `level` outside 1–5 (400)

**Frontend (`frontend/app/modal.tsx`)**
- Updated time field placeholder to `YYYY-MM-DD HH:MM` format
- Client-side guard: alerts user if scheduled time is invalid or in the past before submitting
- Client-side guard: alerts user if max players < 2

**Frontend (`frontend/app/(tabs)/index.tsx`)**
- Map BottomCard now shows a red "Full" badge instead of an active "Join Game" button when a game has reached capacity (parity with the Discover screen)

---

### Trust & Reliability — Karma & Ratings
**Database (`backend/migrations/003_add_ratings.sql`)**
- New `Ratings` table: `(id, game_id, rater_id, ratee_id, attended BOOL, created_at)`
- Unique constraint on `(game_id, rater_id, ratee_id)` prevents double-voting

**Backend (`backend/routes/ratings.js`)**
- `GET /api/ratings/game/:gameId` — returns players the requester hasn't rated yet in a given game (includes host + participants, excludes self and already-rated)
- `POST /api/ratings/batch` — accepts `{ game_id, ratings: [{ratee_id, attended}] }` and bulk-inserts ratings; uses `INSERT IGNORE` for idempotency

**Backend (`backend/routes/users.js`)**
- `GET /api/users/me` now returns `karma`: computed as `SUM(CASE WHEN attended=1 THEN 1 ELSE -1 END)` across all ratings received

**Backend (`backend/server.js`)**
- Registered `/api/ratings` route

**Frontend (`frontend/app/rate-players.tsx`)** — new screen
- Lists all co-players a user hasn't rated yet for a given game
- Each player has a "Showed Up" (green) / "No-Show" (red) toggle, defaulting to Showed Up
- Single "Submit Ratings" call via `POST /api/ratings/batch`
- Empty state when all players are already rated; success state after submission

**Frontend (`frontend/app/(tabs)/games.tsx`)**
- Added `isPastGame()` helper that safely parses `scheduled_time` as a Date
- Past games show a green "Rate Players" button that navigates to the rate-players screen

**Frontend (`frontend/app/(tabs)/profile.tsx`)**
- Profile now displays Karma as a stat (see UI section below)

---

### UI/UX Polish
**Frontend (`frontend/app/(tabs)/discover.tsx` & `frontend/app/(tabs)/index.tsx`)**
- Join Game button now animates with a spring scale (0.93 → 1.0 with bounce) on press
- `expo-haptics`: light impact on press, success notification on a successful join

**Frontend (`frontend/app/(tabs)/profile.tsx`)** — full redesign
- **Avatar**: initial letter in a colored circle; color deterministically chosen from an 8-color palette by username — no generic icon
- **Header**: two translucent accent circles create visual depth without an external gradient library
- **Stats**: replaced the cramped 3-box row with a 2×2 card grid (Total Games, Hosted, Joined, Karma), each card with an icon and value in a matching accent color
- **Karma coloring**: green for positive, red for negative, gray for zero
- **Menu**: each item has a color-coded icon badge; cleaner border radii and section label

---

## [Sprint 2] — May 2026 — Full Prototype

- Complete end-to-end prototype: auth flow, real map with Google Places, game creation, joining, real-time chat (3-second polling), discover screen, and profile
- MySQL/MariaDB database with raw SQL (no ORM)
- REST API: `/api/auth`, `/api/games`, `/api/chats`, `/api/courts`, `/api/users`
- JWT authentication stored in AsyncStorage
- Custom map markers, filter chips (All / Community Games / Courts), and bottom info cards

---

## [Sprint 1] — March–April 2026 — Proof of Concept

- Interactive map with mock court data
- Basic authentication screens (login / register)
- Project architecture and tech stack validated
