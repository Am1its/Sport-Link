# Changelog

All notable changes to SportLink are documented here, ordered from most recent to oldest.

---

## [Sprint 6] — May 2026 — Code Quality & Architecture Hardening

### Backend — Security & Reliability
**`backend/server.js`**
- Added `express-rate-limit`: 10 requests/min on `/api/auth` (brute-force protection), 300 requests/min on all other routes.
- `remindersSent` changed from a `Set` to a `Map<gameId, timestamp>` — stale entries (older than 2 hours) are pruned at the top of every `sendGameReminders()` poll, preventing unbounded memory growth across long server uptimes.

**`backend/migrations/010_indexes.sql`** — new migration
- 9 indexes on high-traffic columns: `GameParticipants(game_id)`, `GameParticipants(user_id)`, `Messages(game_id)`, `Messages(game_id, created_at)`, `Ratings(ratee_id)`, `PeerRatings(ratee_id)`, `Games(status)`, `Games(host_id)`, `Friends(addressee_id, status)`.
- Uses `ADD INDEX IF NOT EXISTS` for safe re-run.

### Backend — Bug Fixes
**`backend/routes/users.js`**
- Fixed bio data-loss bug: `PUT /api/users/me` now builds the `SET` clause dynamically — only fields explicitly present in the request body are included. Previously a missing `bio` field would COALESCE to NULL and silently overwrite stored bios.
- Added `username.trim()` validation and try/catch to `/api/users/avatars`.

**`backend/routes/games.js`**
- Fixed race condition in `POST /api/games/:id/join`: the capacity check and participant insert now run inside a MySQL transaction with `SELECT … FOR UPDATE` row locking, preventing two simultaneous requests from both passing the check.
- `invited_friends` IDs are now verified against the `Friends` table before batch-inserting into `GameParticipants` — previously any user ID could be invited.
- `DELETE /api/games/:id` (cancel) now sends a push notification to all participants informing them the game was cancelled.
- Host occupies a slot for capacity: capacity full check is `count >= max_players - 1`; display count is `participant_count + 1`.

**`backend/routes/ratings.js`**
- `POST /api/ratings/batch` and `POST /api/ratings/peer` now use a single batch `INSERT` with dynamic value placeholders instead of sequential `await pool.execute()` in a for-loop.

**`backend/routes/chats.js`**
- `GET /api/chats` replaced 4 correlated subqueries with a single derived-table `LEFT JOIN` (aggregates max message ID per game first, then joins once).
- `GET /:gameId/messages` now `JOIN`s `Users` to return the current username — fixes stale-username-in-chat bug where a renamed user's old name could persist from the JWT.
- `POST /:gameId/messages` fetches the current username from DB before inserting (same fix for the stored `username` column).
- Added 1000-character content length check (400 response if exceeded).

### Frontend — Architecture
**`frontend/utils/api.ts`** — new utility
- Centralized `apiFetch` wrapper: injects `Authorization` header from token, auto-adds `Content-Type: application/json` when a body is present.
- `UnauthorizedError` class thrown on any 401 response.
- `setUnauthorizedHandler(fn)` — registers a global callback invoked on 401 (wired to `logout` in `_layout.tsx`).

**`frontend/utils/avatar.ts`** — new utility
- `AVATAR_PALETTE` and `getAvatarColor(name)` extracted as a single source of truth (was duplicated in 7 screens).

**`frontend/utils/time.ts`** — new utility
- `isPastGame`, `formatTime`, `formatChatTimestamp` extracted (was duplicated or inlined per screen).

**`frontend/constants/sports.ts`** — new file
- `SPORT_COLORS`, `SPORT_ICONS`, `SPORT_FILTER_ITEMS` extracted (was duplicated across map, discover, games, and chat screens).

**`frontend/.env`** / **`frontend/constants/api.ts`**
- `API_BASE` now reads from `EXPO_PUBLIC_API_URL` env var (Expo SDK 49+ pattern); falls back to `localhost:3000`.
- `.env` added to `.gitignore`.

**`frontend/app/_layout.tsx`**
- `AppServices` component wires `setUnauthorizedHandler(logout)` on mount so any 401 from any screen triggers a clean logout — no more silent failures.

### Frontend — Screen Migrations
All screens migrated from raw `fetch()` + hardcoded `API_BASE` to `apiFetch`; all catch blocks handle `UnauthorizedError`:
- `game-chat.tsx` — `sendMessage` uses `apiFetch`; `maxLength={1000}` added to the message TextInput.
- `modal.tsx` — `useGlobalSearchParams` → `useLocalSearchParams`; all fetches use `apiFetch`.
- `rate-players.tsx` — `useGlobalSearchParams` → `useLocalSearchParams`; all fetches use `apiFetch`.
- `profile.tsx` — bio fallback replaced: no longer shows fake "Living and breathing sports"; shows italic "No bio yet" when bio is empty.
- `friends.tsx`, `leaderboard.tsx`, `player-profile.tsx`, `onboarding.tsx` — local avatar palette removed; imported from `utils/avatar`.
- `(tabs)/_layout.tsx`, `(tabs)/index.tsx`, `login.tsx`, `register.tsx` — migrated to `apiFetch`.

---

## [Sprint 5] — May 2026 — Game-Start Reminder Notifications

### Game-Start Reminders
**Backend (`backend/server.js`)**
- `setInterval` running every 60 seconds calls `sendGameReminders()` — no external cron library needed.
- Queries `Games` for active games whose `scheduled_time` falls in the 25–35 minute window from now (`STR_TO_DATE` + `DATE_ADD`), giving a 10-minute detection band to survive missed polls.
- Collects push tokens for the host and all `GameParticipants` in a single `UNION` query.
- Sends a "⏰ Game starting soon!" push notification with the game title and a 30-minute countdown.
- An in-memory `remindersSent` Set ensures each game is notified exactly once per server lifecycle, even across multiple polling intervals.

---

## [Sprint 4] — May 2026 — Onboarding, Social System, Game Enhancements & Map Redesign

### Onboarding Flow
**Database (`backend/migrations/008_sprint4_schema.sql`)**
- Added `onboarding_complete BOOLEAN DEFAULT FALSE` to `Users`; backfilled to `TRUE` for all existing accounts so existing users skip onboarding.

**Backend (`backend/routes/auth.js`)**
- `POST /api/auth/register` — now sets `onboarding_complete = FALSE` for new users and returns it in the user object.
- `POST /api/auth/login` — fetches and returns `onboarding_complete` so the client can gate routing on first launch.

**Backend (`backend/routes/users.js`)**
- `PUT /api/users/me` — accepts `onboarding_complete` flag; uses `COALESCE(?, onboarding_complete)` so the field is only updated when explicitly provided.

**Frontend (`frontend/context/AuthContext.tsx`)**
- `User` type extended with `onboarding_complete: boolean`.
- Added `setOnboardingComplete()` helper: updates `AsyncStorage` and React state atomically.

**Frontend (`frontend/app/index.tsx`)**
- Routing gate: unauthenticated → `/login`; authenticated but `!onboarding_complete` → `/onboarding`; otherwise → `/(tabs)`.

**Frontend (`frontend/app/_layout.tsx`)**
- Registered `<Stack.Screen name="onboarding" />`.

**Frontend (`frontend/app/onboarding.tsx`)** — new screen
- 3-step wizard: **Avatar** → **Bio** → **Sports**.
- Animated progress dots (active dot widens to 22 px).
- Step 1: opens `expo-image-picker` for avatar; skippable.
- Step 2: multi-line bio textarea with 120-char limit and live counter; skippable.
- Step 3: 8-sport grid (2-column tiles) with multi-select and checkmarks; skippable.
- On finish: `PUT /api/users/me` with `{ avatar, bio, onboarding_complete: true }`, then calls `setOnboardingComplete()`, then navigates to `/(tabs)`.

---

### Social System — Friends
**Database (`backend/migrations/009_friends.sql`)**
- New `Friends` table: `(id, requester_id, addressee_id, status ENUM('pending','accepted'), created_at)`. Unique on `(requester_id, addressee_id)`.

**Backend (`backend/routes/friends.js`)** — new route file
- `GET /api/friends` — accepted friends; resolves the "other" user from both directions using `CASE WHEN`.
- `GET /api/friends/requests` — incoming pending requests where `addressee_id = userId`.
- `POST /api/friends` — send request; checks both `(A→B)` and `(B→A)` before inserting; sends push notification to addressee.
- `PUT /api/friends/:id/accept` — verifies `addressee_id` matches caller; sends push notification to requester.
- `DELETE /api/friends/:id` — verifies caller is requester or addressee.

**Backend (`backend/routes/users.js`)**
- `GET /api/users/search?q=` — username prefix search (min 2 chars, excludes self, LIMIT 20). Registered before `/:id` to avoid route shadowing.

**Backend (`backend/server.js`)**
- Registered `/api/friends` route.

**Frontend (`frontend/app/friends.tsx`)** — new screen
- 3-tab UI: **Friends** / **Requests** / **Search**.
- Friends tab: tappable rows, remove button with confirmation alert, pull-to-refresh.
- Requests tab: accept (green checkmark) + decline (red outlined) buttons per request, pull-to-refresh.
- Search tab: live search with 2-char minimum; shows "Friends" or "Sent" badge for existing connections; add-friend button for others.
- Tracks `pendingSentIds` Set for optimistic sent state.

**Frontend (`frontend/app/(tabs)/profile.tsx`)**
- Added **Friends** entry (people icon, blue tint) to the Community menu section, navigating to `/friends`.

---

### Game Enhancements — Title Field
**Database (`backend/migrations/008_sprint4_schema.sql`)**
- Added `title VARCHAR(100) DEFAULT NULL` to `Games`.

**Backend (`backend/routes/games.js`)**
- `GET /api/games` and `GET /api/games/mine` — include `title` in response.
- `POST /api/games` — accepts optional `title`; also accepts `invited_friends: number[]` — batch-inserts them as `GameParticipants` via `INSERT IGNORE` and sends push notifications.
- `PUT /api/games/:id` — accepts optional `title` update.

**Frontend (`frontend/app/modal.tsx`)**
- Title input added at the top of the form (optional, max 100 chars).
- Sports row expanded to all 8 sports.
- **Invite Friends** section (create mode only): fetches `/api/friends`, renders tappable chips with avatar and name; selected friends get a green border/bg + checkmark. Shows "X friend(s) will be added automatically" note.
- On submit: includes `title` and `invited_friends` array in POST/PUT body.

**Frontend (`frontend/app/(tabs)/discover.tsx`)**
- `Game` type extended with `title: string | null`.
- Game title displayed above `location_desc` on cards when present.

**Frontend (`frontend/app/(tabs)/games.tsx`)**
- `Game` type extended with `title: string | null`.
- Game title shown on card; `existingTitle` passed to modal for editing.

---

### New Sport Types (yoga, footvolley, studio, gym)
**Database (`backend/migrations/008_sprint4_schema.sql`)**
- `sport_type` ENUM extended: added `yoga`, `footvolley`, `studio`, `gym`.

**Frontend (all tabs and screens)**
- `SPORT_COLORS`, `SPORT_ICONS`, and `SPORT_FILTERS` expanded across `discover.tsx`, `games.tsx`, `chat.tsx`, and `index.tsx` for the 4 new sports.
- `sport-preferences.tsx` — toggle grid now includes all 8 sports.

---

### Map Marker Redesign & Enhanced Courts API
**Backend (`backend/server.js`)**
- `GET /api/courts/nearby` — now fires 4 parallel Google Places queries (Hebrew "מגרש", English "sport court", `type=gym`, keyword `"yoga studio dance"`) and deduplicates by `place_id`.
- `classifyVenueType()` helper: classifies each result as `'court' | 'gym' | 'studio' | 'facility'` from `place.types` and `place.name`.
- `detectSportType()` extended with patterns for yoga, gym, and studio.
- Mock fallback data includes gym and yoga studio entries.

**Frontend (`frontend/app/(tabs)/index.tsx`)**
- `MapItem` type extended with `venue_type?: 'court' | 'gym' | 'studio' | 'facility'`.
- Court markers now differ by venue type:
  - **Outdoor courts**: white background, dashed border (hollow/open feel).
  - **Indoor facilities (gym/studio)**: tinted background (`color + '33'`), solid border.
  - Both types use `color + '88'` for the pointer chevron.
- `SPORT_FILTERS` expanded to include all 8 sports with emoji labels.

---

## [Sprint 3.2] — May 2026 — Push Notifications, Map Clustering & UX Polish

### Push Notifications
**Database (`backend/migrations/007_add_push_token.sql`)**
- Added `push_token VARCHAR(200)` column to `Users` for storing Expo push tokens.

**Backend (`backend/utils/sendPushNotification.js`)** — new utility
- Sends one or more messages to Expo's push API (`exp.host/--/api/v2/push/send`) over native HTTPS — no server SDK required.
- Filters out non-Expo tokens before sending.

**Backend (`backend/routes/users.js`)**
- `PUT /api/users/push-token` — new endpoint; saves or clears the authenticated user's push token.

**Backend (`backend/routes/games.js`)**
- `POST /api/games/:id/join` — after a successful join, fetches the host's push token and fires a "🏅 New player joined!" notification.

**Frontend (`frontend/utils/registerPushToken.ts`)** — new utility
- Requests notification permission, retrieves `ExponentPushToken[...]` via `expo-notifications`, and POSTs it to the backend.
- Passes `projectId` from `expo-constants` if available; silently no-ops in Expo Go (not supported since SDK 53).

**Frontend (`frontend/app/_layout.tsx`)**
- Added `PushTokenRegistrar` component inside `AuthProvider`; re-registers the push token whenever the auth token changes (i.e., on login).

---

### Map Clustering
**Frontend (`frontend/app/(tabs)/index.tsx`)**
- Custom grid-based clustering algorithm (`clusterGames`) — no external library.
- At low zoom (`latitudeDelta ≥ 0.03`), nearby game markers are grouped into a grid cell of size `latitudeDelta / 5`; each cell is represented by a single green circle marker showing the count.
- Tapping a cluster animates the map to zoom in 3× on that cluster (`animateToRegion`), revealing individual markers.
- Courts are never clustered (they are already spread across the city).
- `onRegionChangeComplete` tracks the live `latitudeDelta` so clustering updates on pan/zoom.

---

### Discover Screen Polish
**Frontend (`frontend/app/(tabs)/discover.tsx`)**
- Urgency badge ("Only X spot(s) left!") appears in amber on game cards when ≤ 2 spots remain; player count text also turns amber.
- Equipment notes shown below the meta row with a bag icon when present.
- Pull-to-refresh (green tint) on the game list.

---

### Games Tab (My Schedule) Polish
**Frontend (`frontend/app/(tabs)/games.tsx`)**
- **Chat** button added to every active game card (host and participant) — taps directly into the game's chat screen.
- Pull-to-refresh on the games list.

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
