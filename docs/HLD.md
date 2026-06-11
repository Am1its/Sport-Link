# High-Level Design (HLD) - SportLink

> **Note:** This technical design is derived from the User Personas and Stories defined in [Product Definitions](PRODUCT_DEFINITIONS.md). The architecture is optimized for location-based discovery (Persona: "Newcomer") and real-time event management (Persona: "Organizer").
>
> **Status:** Reflects the live production system as of Sprint 13 (June 2026).

---

## 1. System Architecture

The system follows a **Client-Server** architecture with a persistent WebSocket layer for real-time chat.

```
📱 React Native (Expo)
        │
        ├── REST (HTTP/JSON)  ──────────► Node.js / Express
        │                                       │
        └── WebSocket (socket.io) ──────────────┤
                                                │
                                         MySQL / MariaDB
                                                │
                                    Google Places API (courts)
                                    Expo Push API (notifications)
```

### Key Technology Choices

| Concern | Choice | Why |
| :--- | :--- | :--- |
| Mobile | React Native + Expo | Cross-platform; fast iteration; Expo SDK for location/notifications/image |
| Routing | Expo Router (file-based) | Co-locates screen with URL; native stack transitions |
| Backend | Node.js + Express | Lightweight; async I/O for concurrent join requests; easy socket.io integration |
| Real-time | socket.io v4 | Runs on same port as REST; JWT auth on handshake; room-per-game broadcast |
| Database | MySQL / MariaDB | Relational integrity for participants/ratings; raw SQL via `mysql2/promise` pool |
| Auth | JWT (90-day expiry) | Stateless; `AsyncStorage` persistence; auto-logout on 401 via global handler |
| Push | Expo Push API | Native token registration; backend sends via `https` to `exp.host` |
| Maps | `react-native-maps` + Google Places | Native map rendering; 4-query parallel court discovery |

---

## 2. Database Design (ERD)

```
Users ──────────────────────────────────────────────────────────┐
  │                                                             │
  ├── hosts ──────► Games ◄──── GameParticipants ◄─── Users     │
  │                  │                                          │
  │              Messages                                       │
  │                                                             │
  ├── Ratings (host marks attendance)                           │
  ├── PeerRatings (participants rate each other)                │
  ├── Friends (requester_id / addressee_id, status)             │
  └── Notifications (persisted push payloads)                   │
                                                                │
Users ──────────────────────────────────────────────────────────┘
```

### Tables

| Table | Primary Key | Notable Columns |
| :--- | :--- | :--- |
| `Users` | `id` | `avatar MEDIUMTEXT`, `push_token`, `onboarding_complete`, `google_id` |
| `Games` | `id` | `sport_type ENUM(9)`, `level 1-5`, `photo MEDIUMTEXT`, `status ENUM(3)`, `title VARCHAR(100)` |
| `GameParticipants` | `id` | Unique `(game_id, user_id)` |
| `Messages` | `id` | `username` denormalized for display stability |
| `Ratings` | `id` | `attended BOOL`; unique `(game_id, rater_id, ratee_id)` |
| `PeerRatings` | `id` | `sportsmanship/punctuality/communication TINYINT 0/1`, `skill 1-5` |
| `Friends` | `id` | `status ENUM('pending','accepted')`; unique `(requester_id, addressee_id)` |
| `Notifications` | `id` | `data JSON`, `is_read BOOL`; indexed on `user_id` |
| `CourtReviews` | `id` | `place_id VARCHAR(200)`, `rating TINYINT 1-5`; unique `(place_id, user_id)` |
| `SportPreferences` | `id` | `sport_type`, `skill_level TINYINT 1-5`, `is_favorite BOOL`; unique `(user_id, sport_type)` |
| `DirectMessages` | `id` | `type ENUM(text/event)`, `event_id FK → Games`, `is_read BOOL`; indexed on sender+receiver |

### Karma (computed, never stored)
```sql
COALESCE(SUM(CASE WHEN attended=1 THEN 1 ELSE -1 END) FROM Ratings, 0)
+
COALESCE(SUM(
  CASE WHEN sportsmanship=1 THEN 1 WHEN sportsmanship=0 THEN -1 ELSE 0 END +
  CASE WHEN punctuality=1   THEN 1 WHEN punctuality=0   THEN -1 ELSE 0 END +
  CASE WHEN communication=1 THEN 1 WHEN communication=0 THEN -1 ELSE 0 END
) FROM PeerRatings, 0)
```

---

## 3. API Surface

### REST (prefix `/api`)

| Route group | Key endpoints |
| :--- | :--- |
| `/auth` | `POST /register`, `POST /login` |
| `/courts` | `GET /nearby?lat=&lng=` |
| `/games` | `GET /?radius_km=`, `POST /`, `PUT /:id`, `DELETE /:id`, `POST /:id/join`, `DELETE /:id/leave` |
| `/chats` | `GET /`, `GET /:gameId/messages`, `POST /:gameId/messages` |
| `/users` | `GET /me`, `PUT /me`, `GET /leaderboard`, `GET /:id` (includes friendship status) |
| `/friends` | `GET /`, `GET /requests`, `POST /`, `PUT /:id/accept`, `DELETE /:id` |
| `/ratings` | `GET /game/:gameId`, `POST /batch`, `POST /peer` |
| `/notifications` | `GET /`, `PUT /:id/read`, `PUT /read-all` |

### WebSocket (socket.io, same port)

| Event | Direction | Purpose |
| :--- | :--- | :--- |
| `join_game` | C → S | Client joins room `game_<id>` |
| `send_message` | C → S | Save + broadcast message |
| `new_message` | S → C | Real-time message to all room members |

Auth: `socket.handshake.auth.token` verified with `jwt.verify` on every connection.

---

## 4. Frontend Architecture

```
app/
├── _layout.tsx              ← AuthProvider, setUnauthorizedHandler, push token registration
├── index.tsx                ← Routing gate (login / onboarding / tabs)
├── login.tsx                ← Hero + FocusInput + bottom-sheet form card
├── register.tsx             ← Single-step account creation
├── onboarding.tsx           ← 4-step wizard (photo / bio / sports / levels)
├── (tabs)/
│   ├── _layout.tsx          ← Dark tab bar, height 62
│   ├── index.tsx            ← Map: courts + game markers, clustering, FAB
│   ├── discover.tsx         ← GameCard with accent bar, skeleton, modal filters
│   ├── games.tsx            ← My schedule, skeleton, accent bar cards
│   ├── chat.tsx             ← Events + Friends tabs, skeleton, unread badge
│   └── profile.tsx          ← 3-orb hero, skeleton, sport chips, inline edit
├── game-chat.tsx            ← socket.io real-time chat, avatar cache, tappable avatars
├── direct-chat.tsx          ← DM screen, pill bubbles, event cards, game sharing modal
├── modal.tsx                ← Create/Edit game (date picker, photo picker, invite friends)
├── player-profile.tsx       ← 3-orb hero, friend + message buttons
├── friends.tsx              ← Card-row tabs (Friends / Requests / Add)
├── notification-inbox.tsx   ← Notification list, mark-as-read
├── rate-players.tsx         ← Host attendance / peer ratings, celebratory done screen
├── game-results.tsx         ← Sport-color hero band, score bars, locked state
├── leaderboard.tsx          ← Podium + ranked list, shadow cards
├── court-detail.tsx         ← Orb hero, photo strip, reviews, pill submit
├── player-matching.tsx      ← Suggestions by shared sport + location
├── sport-preferences.tsx    ← Per-sport skill + favorite toggles
└── notifications-settings.tsx
```

### Design System

| File | Purpose |
| :--- | :--- |
| `constants/theme.ts` | `Colors`, `Spacing`, `Radius`, `Type`, `Shadow` — all visual tokens |
| `components/SkeletonLoader.tsx` | Shimmer skeletons: `DiscoverSkeleton`, `GamesSkeleton`, `ProfileStatsSkeleton`, `ChatSkeleton` |
| `components/AvatarCircle.tsx` | Reusable avatar (base64 or initial letter, tappable) |

### State Management

- **Auth state:** `AuthContext` (React Context) — token, user, login, logout, `setOnboardingComplete`.
- **Screen data:** Local `useState` + `useFocusEffect` for re-fetch on navigate-back.
- **Chat:** `socketRef` (socket.io) + `useState` message list; deduplication guard on `new_message` / `new_dm`.
- **Notification settings:** `AsyncStorage` (device-local).

### Key Utilities

| File | Purpose |
| :--- | :--- |
| `utils/api.ts` | `apiFetch` wrapper — auth header, 401 handler, JSON content-type |
| `utils/avatar.ts` | `getAvatarColor(name)` — deterministic color from 8-color palette |
| `utils/time.ts` | `isPastGame`, `formatTime`, `formatChatTimestamp` |
| `constants/api.ts` | `API_BASE` from `EXPO_PUBLIC_API_URL` env var |
| `constants/sports.ts` | `SPORT_COLORS`, `SPORT_ICONS`, `SPORT_FILTER_ITEMS` (9 sports, text labels) |

---

## 5. Security Considerations

| Concern | Mitigation |
| :--- | :--- |
| Brute-force login | `express-rate-limit` — 10 req/min on `/api/auth` |
| Token abuse | JWT verified on every protected request via `authMiddleware`; 90-day expiry |
| Race conditions | `SELECT FOR UPDATE` + MySQL transaction on `/api/games/:id/join` |
| Base64 upload size | Express body limit `10mb`; image picker quality capped at 0.6 |
| Friend invite abuse | `invited_friends` IDs verified against `Friends` table before insert |
| Socket auth | JWT verified on `connection` event; invalid tokens rejected before any room join |
| Duplicate ratings | Unique constraints on `(game_id, rater_id, ratee_id)` in both rating tables |

---

## 6. User Stories → Technical Solutions

| ID | As a... | I want to... | Technical Solution |
| :--- | :--- | :--- | :--- |
| US-1 | Newcomer | Find games within 2 km | Haversine `distance_km` in `GET /api/games`, client radius chips |
| US-2 | Organizer | Post a game at a verified court | Google Places API → court picker → game modal pre-fills location |
| US-3 | Newcomer | Filter by skill level | `level` column + filter UI on Discover |
| US-4 | Organizer | Know when someone joins in real time | Push notification on join + socket.io chat for coordination |
| US-5 | Organizer | Fill a last-minute spot | Push notification with urgency badge (≤2 spots) in Discover |
| US-6 | Player | Trust my teammates | Karma score from host attendance + peer ratings |
| US-7 | Player | Chat with my game group | socket.io room per game; REST fallback |
| US-8 | Player | See missed notifications | In-app Notifications inbox persisted in DB |
| US-9 | Player | Add friends and invite them | Friends system + invite chips in game modal |
