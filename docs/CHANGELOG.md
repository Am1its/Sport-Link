# Changelog

All notable changes to SportLink are documented here, ordered from most recent to oldest.

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
