# SportLink - Full Prototype

This document details the complete architecture, implementation, and end-to-end flow of the SportLink Full Prototype — backed by a real MySQL database, a real REST + WebSocket API, and Google Places data.

---

## 🗺️ 1. What Was Built

| Layer | PoC (Sprint 1) | Full Prototype (Current) |
| :--- | :--- | :--- |
| **Database** | None | MySQL — 8 relational tables |
| **Auth** | Hardcoded `isLoggedIn` | JWT (90-day expiry), persisted via AsyncStorage |
| **Courts** | 3 hardcoded mock pins | Google Places API — 4 parallel queries, deduped |
| **Games** | Local React state | DB-persisted with full CRUD + photo attachment |
| **Join Game** | Alert placeholder | Transaction + row-lock (race-condition safe) |
| **Chat** | Static placeholder | socket.io real-time (REST fallback) |
| **My Games** | Empty screen | Upcoming/History with host controls (edit/delete/leave) |
| **Discover** | Empty screen | Searchable + sport filter + radius filter |
| **Ratings** | None | Host attendance (±karma) + peer category ratings |
| **Push Notifs** | None | Expo push on join/cancel/friend/reminder |
| **Notification Inbox** | None | Persisted in DB, unread badge, mark-as-read |
| **Friends** | None | Send/accept/decline, profile friend button |
| **Leaderboard** | None | Top 20 by karma, podium for top 3 |
| **Onboarding** | None | 3-step wizard (avatar → bio → sport prefs) |
| **Avatars** | None | Base64 — picker in profile + onboarding |
| **Game Photo** | None | 16:9 base64 photo on game cards |
| **Radius Search** | None | Haversine filter on Discover screen |
| **Player Profiles** | None | Public profile with Add/Remove Friend button |
| **Profile** | Hardcoded name | Live stats + edit (username, bio, avatar) |

---

## 🗄️ 2. Database Schema

Eight tables with foreign keys, unique constraints, and performance indexes.

```sql
Users
  id                INT PK AUTO_INCREMENT
  username          VARCHAR(50)  UNIQUE NOT NULL
  email             VARCHAR(100) UNIQUE NOT NULL
  password_hash     VARCHAR(255) NOT NULL
  bio               VARCHAR(200)
  avatar            MEDIUMTEXT          -- base64 JPEG
  push_token        VARCHAR(200)        -- Expo push token
  onboarding_complete BOOLEAN DEFAULT FALSE
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP

Games
  id              INT PK AUTO_INCREMENT
  host_id         INT FK → Users(id)
  sport_type      ENUM('basketball','tennis','volleyball','football',
                       'yoga','footvolley','studio','gym')
  level           TINYINT(1–5)
  latitude        DECIMAL(10,8)
  longitude       DECIMAL(11,8)
  location_desc   VARCHAR(255)
  scheduled_time  VARCHAR(100)    -- 'YYYY-MM-DD HH:MM' (Israel local time)
  equipment_notes TEXT
  photo           MEDIUMTEXT      -- base64 JPEG (optional)
  max_players     INT
  title           VARCHAR(100)
  status          ENUM('active','cancelled','completed') DEFAULT 'active'
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP

GameParticipants
  id        INT PK AUTO_INCREMENT
  game_id   INT FK → Games(id)
  user_id   INT FK → Users(id)
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  UNIQUE (game_id, user_id)

Messages
  id         INT PK AUTO_INCREMENT
  game_id    INT FK → Games(id)
  user_id    INT FK → Users(id)
  username   VARCHAR(50)
  content    TEXT
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

Ratings                          -- host-only attendance marks
  id         INT PK AUTO_INCREMENT
  game_id    INT FK → Games(id)
  rater_id   INT FK → Users(id)
  ratee_id   INT FK → Users(id)
  attended   BOOLEAN
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  UNIQUE (game_id, rater_id, ratee_id)

PeerRatings                      -- non-host category ratings
  id             INT PK AUTO_INCREMENT
  game_id        INT FK → Games(id)
  rater_id       INT FK → Users(id)
  ratee_id       INT FK → Users(id)
  sportsmanship  TINYINT   -- 0/1
  punctuality    TINYINT   -- 0/1
  communication  TINYINT   -- 0/1
  skill          TINYINT   -- 1-5
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  UNIQUE (game_id, rater_id, ratee_id)

Friends
  id           INT PK AUTO_INCREMENT
  requester_id INT FK → Users(id)
  addressee_id INT FK → Users(id)
  status       ENUM('pending','accepted')
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  UNIQUE (requester_id, addressee_id)

Notifications
  id         INT PK AUTO_INCREMENT
  user_id    INT FK → Users(id) ON DELETE CASCADE
  title      VARCHAR(200) NOT NULL
  body       TEXT NOT NULL
  data       JSON
  is_read    BOOLEAN DEFAULT FALSE
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  INDEX (user_id)
```

**Karma formula** (computed at query time, never stored):
```
karma = SUM(attended=1 ? +1 : -1)         -- from Ratings
      + SUM(sportsmanship=1 ? +1 : -1)    -- from PeerRatings
      + SUM(punctuality=1 ? +1 : -1)
      + SUM(communication=1 ? +1 : -1)
```

---

## 🔌 3. Backend API

All REST routes are prefixed with `/api`. Auth-protected routes require `Authorization: Bearer <token>`.

### Authentication — `/api/auth`
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/register` | — | Creates user, returns 90-day JWT |
| `POST` | `/login` | — | Validates credentials, returns 90-day JWT |

### Courts — `/api/courts`
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/nearby?lat=&lng=` | — | 4 parallel Google Places queries (`מגרש`, `sport court`, `type=gym`, `yoga studio dance`), deduplicated by `place_id`. Falls back to mock data. |

### Games — `/api/games`
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/?lat=&lng=&radius_km=` | — | All upcoming active games. Optional Haversine radius filter. |
| `GET` | `/mine` | ✅ | Games where caller is host or participant (all statuses). |
| `POST` | `/` | ✅ | Create game. Accepts `photo` (base64). Validates level/max_players/future time. Pre-invites `invited_friends` after verifying friendship. |
| `PUT` | `/:id` | ✅ | Edit game (host only). Accepts `photo`. |
| `DELETE` | `/:id` | ✅ | Cancel game (host only). Pushes cancellation notification to participants. |
| `POST` | `/:id/join` | ✅ | Join game. Transaction + `SELECT FOR UPDATE` prevents race conditions. Pushes notification to host. |
| `DELETE` | `/:id/leave` | ✅ | Leave game (participant only). |
| `GET` | `/:id/participants` | ✅ | Returns host + participants with avatars. |
| `POST` | `/:id/complete` | ✅ | Mark game completed (host only). |

### Chats — `/api/chats`
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | ✅ | All game chats caller belongs to, with last message preview. |
| `GET` | `/:gameId/messages` | ✅ | Last 100 messages. Requires membership. |
| `POST` | `/:gameId/messages` | ✅ | Send message (REST fallback — socket.io is primary). |

### Users — `/api/users`
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/me` | ✅ | Caller's profile + live karma. |
| `PUT` | `/me` | ✅ | Update username / bio / avatar / `onboarding_complete`. Dynamic SET — only sent fields updated. |
| `GET` | `/search?q=` | ✅ | Username prefix search (min 2 chars, excludes self). |
| `GET` | `/avatars?ids=1,2,3` | ✅ | Bulk avatar fetch for chat caching. |
| `GET` | `/leaderboard` | ✅ | Top 20 users by karma. |
| `PUT` | `/push-token` | ✅ | Save or clear Expo push token. |
| `GET` | `/:id` | ✅ | Public profile + `friendship_status` (`none` / `pending_sent` / `pending_received` / `friends`) + `friendship_id`. |

### Friends — `/api/friends`
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | ✅ | Accepted friends with karma. |
| `GET` | `/requests` | ✅ | Incoming pending requests. |
| `POST` | `/` | ✅ | Send request. Checks both directions for duplicates. Pushes notification. |
| `PUT` | `/:id/accept` | ✅ | Accept request. Pushes notification to requester. |
| `DELETE` | `/:id` | ✅ | Remove friend or reject/cancel request. |

### Ratings — `/api/ratings`
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/game/:gameId` | ✅ | Returns `{ is_host, players }` — host sees unrated participants; non-host sees unrated peers. |
| `POST` | `/batch` | ✅ | Host submits attendance batch. |
| `POST` | `/peer` | ✅ | Non-host submits category ratings batch. |

### Notifications — `/api/notifications`
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | ✅ | Last 50 notifications + `unread_count`. |
| `PUT` | `/:id/read` | ✅ | Mark one notification read. |
| `PUT` | `/read-all` | ✅ | Mark all notifications read. |

### WebSocket (socket.io)
The server binds socket.io to the same HTTP port (3000).

| Event | Direction | Description |
| :--- | :--- | :--- |
| `join_game` | Client → Server | Joins room `game_<id>` (DB-verified membership). |
| `send_message` | Client → Server | Saves message to DB, emits `new_message` to room. |
| `new_message` | Server → Client | Broadcast to all clients in the game room. |

Auth: JWT passed via `socket.handshake.auth.token` — unauthenticated connections are rejected.

---

## 📱 4. Frontend Screens

### Tabs

**Map (Home) — `(tabs)/index.tsx`**
- GPS permission → device location → fetches courts (Google Places) + games (`/api/games`).
- Custom markers: hollow dashed for outdoor courts; filled tinted for gyms/studios; green circle for community games.
- Grid-based game clustering at low zoom (no library) — tap cluster to zoom in.
- Filter bar: All / Games / Courts + 8 sport sub-chips.
- FAB: "Drop Pin" or "Choose Court" (bottom sheet) → game creation modal.
- Bottom card: Your Game / Join Game (spring haptic animation) / Full / Public Court states.
- Past games filtered from map.

**Discover — `(tabs)/discover.tsx`**
- Fetches all upcoming games; optional Haversine radius filter (`?lat=&lng=&radius_km=`).
- Sport filter chips (8 sports) + distance chips (Any / 1 km / 5 km / 10 km / 20 km).
- Text search by sport, location, or title.
- Cards show: sport, title, location, time, player count (urgency badge ≤2 spots), skill level, equipment notes, and game photo when present.
- Join with spring animation + haptics; pull-to-refresh.

**My Schedule — `(tabs)/games.tsx`**
- Fetches `/api/games/mine`.
- Upcoming / History sections.
- Host: Edit + Delete + Chat buttons. Joined: Leave + Chat buttons.
- Past games: "Rate Players" button.
- Pull-to-refresh.

**Chat — `(tabs)/chat.tsx`**
- Fetches `/api/chats` — only games the user is part of.
- Last message preview + timestamp per game chat.

**Profile — `(tabs)/profile.tsx`**
- Live stats: Total Games / Hosted / Joined / Karma (color-coded ± green/red).
- Inline edit mode: username, bio, avatar (image picker).
- Unread notification badge on Notifications menu item.
- Menu: Leaderboard, Friends, Notifications (inbox), Notification Settings, Sport Preferences, Sign Out.

### Screens

**Onboarding — `onboarding.tsx`**
- 3-step wizard: Avatar → Bio → Sport Preferences.
- Animated progress dots; each step skippable.
- Calls `PUT /api/users/me` with `onboarding_complete: true` on finish.

**Game Form (Modal) — `modal.tsx`**
- Create (POST + lat/lng) or Edit (PUT) mode.
- Fields: title, sport (8 icons), level (1–5), location, date/time (native picker, Israel timezone), max players, equipment notes, photo (16:9 image picker with preview), invite friends chips.

**Game Chat — `game-chat.tsx`**
- socket.io real-time connection; joins room `game_<id>` on mount.
- Falls back to REST POST if socket disconnected.
- Avatar cache via `seenUserIds` ref.
- Own messages right-aligned (green bubble); others left-aligned with sender name.

**Rate Players — `rate-players.tsx`**
- Host: Arrived / No-Show toggles per player; submit when all marked.
- Non-host: thumbs up/down (sportsmanship, punctuality, communication) + 1–5 star skill selector.

**Leaderboard — `leaderboard.tsx`**
- Podium (top 3) + ranked list (4–20); "You" badge on own row.

**Friends — `friends.tsx`**
- 3 tabs: Friends list / Incoming requests / Search & add.
- Tapping a friend opens their player profile.

**Player Profile — `player-profile.tsx`**
- Avatar, bio, karma card, stats (Total / Hosted / Joined).
- Friend button (Add / Request Sent / Accept Request / Remove Friend) — state-driven, hidden for own profile.

**Notification Inbox — `notification-inbox.tsx`**
- Lists last 50 notifications with unread dot and relative time.
- Tap to mark read. "Mark all read" in header.

**Sport Preferences — `sport-preferences.tsx`**
- Sport toggles + skill level per sport; persisted in `AsyncStorage`.

**Notification Settings — `notifications-settings.tsx`**
- Toggle per notification type; persisted in `AsyncStorage`.

---

## 🔐 5. Authentication Flow

```
Register/Login
      │
      ▼
  Backend issues JWT (90-day expiry)
      │
      ▼
  AsyncStorage.setItem('token')   ← persists across app restarts
      │
      ▼
  AuthContext provides token + user to all screens
      │
      ▼
  app/index.tsx reads token on cold start
      ├── no token              → /login
      ├── token + !onboarding   → /onboarding
      └── token + onboarding    → /(tabs)

  Any 401 response (expired/invalid token)
      │
      ▼
  apiFetch calls _onUnauthorized()
      │
      ▼
  logout() → clear AsyncStorage → redirect to /login
```

JWT payload: `{ id, username }`. All protected routes verify via `authMiddleware`.

---

## 🔔 6. Push Notification Flow

```
Event (join / cancel / friend request / game reminder)
      │
      ▼
  sendPushNotifications(messages)          ← backend utility
      │
      ├── Lookup user_id for each push_token (Users table)
      ├── INSERT INTO Notifications (persists inbox entry)
      └── POST to exp.host/--/api/v2/push/send (Expo API)
```

Game-start reminders: `setInterval` every 60 s → queries games starting in 25–35 min → notifies host + participants exactly once (in-memory `remindersSent` Map).

---

## 🎬 7. End-to-End Demo Flow

1. **Player A** registers → 3-step onboarding (avatar, bio, sport prefs) → lands on map.
2. Player A taps "Drop Pin" → selects a pin → fills game form (title, sport, level, photo, max players) → posts game.
3. Game pin appears on map; card visible in Discover.
4. **Player B** registers → opens Discover → sets radius to 5 km → finds the game → taps Join.
5. Player A receives push notification "🏅 New player joined!"; map card shows `1 / N players`.
6. Both open Chat tab → enter game chat → send messages in real time (socket.io).
7. Player A opens Friends → searches for Player B → sends friend request.
8. Player B receives push notification → opens Notification Inbox → sees the request → goes to Friends → accepts.
9. Both see each other on Friends tab; Player A can now invite Player B directly in the Create Game modal.
10. After the scheduled time, Player A opens My Schedule → Past section → taps "Rate Players" → marks attendance.
11. Player B does the same → submits peer ratings (sportsmanship, punctuality, communication, skill).
12. Both players' karma updates; reflected on Leaderboard.

---

## ⚙️ 8. How to Run

**Prerequisites:** Node.js ≥ 18, MySQL / MariaDB.

```bash
# 1. Clone and enter the project
git clone <repo> && cd SportLink

# 2. Configure environment
cp backend/.env.example backend/.env
# Set: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, GOOGLE_PLACES_API_KEY, JWT_SECRET

# 3. Apply the database schema
mysql -u root -p <your_db_name> < backend/schema.sql

# 4. Start the backend
cd backend && npm install && node server.js

# 5. Configure the frontend
# Edit frontend/.env — set EXPO_PUBLIC_API_URL to your Mac's local IP:
# EXPO_PUBLIC_API_URL=http://192.168.x.x:3000
# (find your IP with: ipconfig getifaddr en0)

# 6. Start the frontend
cd frontend && npm install && npx expo start

# 7. Scan the QR code with Expo Go
# Make sure your phone and Mac are on the same Wi-Fi network
```

**socket.io note:** The socket.io server runs on the same port (3000) as the REST API — no extra port or process needed.
