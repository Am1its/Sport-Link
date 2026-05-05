# SportLink - Full Prototype

This document details the architecture, implementation, and end-to-end flow of the SportLink Full Prototype — the first version of the app backed by a real database, a real API, and real Google Places data.

---

## 🗺️ 1. What Was Built

The prototype covers the complete user journey: from registration to creating a game, joining another player's game, and chatting with teammates — all persisted in a real MySQL database.

| Layer | Before (PoC) | After (Full Prototype) |
| :--- | :--- | :--- |
| **Database** | None | MySQL with 4 relational tables |
| **Auth** | Hardcoded `isLoggedIn = false` | JWT-based register/login, persisted via AsyncStorage |
| **Courts** | 3 hardcoded mock pins | Real Google Places API, nearby search by GPS |
| **Games** | Local React state (lost on refresh) | Saved to DB, fetched on every map focus |
| **Join Game** | Alert placeholder | Full validation + DB insert |
| **Chat** | Static placeholder | Per-game message threads, 3-second polling |
| **My Games** | Empty screen | Live feed of hosted & joined games |
| **Discover** | Empty screen | Searchable, filterable game list |
| **Profile** | Hardcoded name, broken logout | Real username + live stats from DB |

---

## 🗄️ 2. Database Schema

Four tables, enforced with foreign keys and unique constraints.

```sql
Users
  id            INT PK AUTO_INCREMENT
  username      VARCHAR(50)  UNIQUE NOT NULL
  email         VARCHAR(100) UNIQUE NOT NULL
  password_hash VARCHAR(255) NOT NULL
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP

Games
  id              INT PK AUTO_INCREMENT
  host_id         INT FK → Users(id)
  sport_type      ENUM('basketball','tennis','volleyball','football')
  level           TINYINT(1–5)
  latitude        DECIMAL(10,8)
  longitude       DECIMAL(11,8)
  location_desc   VARCHAR(255)
  scheduled_time  VARCHAR(100)
  equipment_notes TEXT
  max_players     INT
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
```

---

## 🔌 3. Backend API

All routes are prefixed with `/api`. Auth-protected routes require `Authorization: Bearer <token>`.

### Authentication — `/api/auth`
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/register` | — | Creates user, returns JWT |
| `POST` | `/login` | — | Validates credentials, returns JWT |

### Courts — `/api/courts`
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/nearby?lat=&lng=` | — | Two parallel Google Places searches (`מגרש` + `sport court`), deduplicated. Falls back to mock data if no API key. |

### Games — `/api/games`
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | — | All active games with participant count |
| `POST` | `/` | ✅ | Create a game (host = caller) |
| `GET` | `/mine` | ✅ | Games where caller is host or participant |
| `POST` | `/:id/join` | ✅ | Join a game — validates not host, not duplicate, not full |

### Chats — `/api/chats`
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | ✅ | All game chats caller is in, ordered by last message |
| `GET` | `/:gameId/messages` | ✅ | Messages for a game (requires being host or participant) |
| `POST` | `/:gameId/messages` | ✅ | Send a message to a game chat |

### Users — `/api/users`
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/me` | ✅ | Caller's username, games hosted count, games joined count |

---

## 📱 4. Frontend Screens

### Map (Home)
- Requests GPS permission on load; falls back to Tel Aviv if denied.
- Fetches real courts from Google Places using the device's coordinates.
- Fetches community games from `/api/games` via `useFocusEffect` (refreshes every time the user returns to the map).
- Filter bar: **All / Community Games / Courts**.
- Bottom card differentiates three states: **Your Game** (host), **Join Game** (open game), **Public Court** (Places API result).
- Join validates against the backend and shows live player count (e.g. `3 / 10 players`).

### Create Game (Modal)
- Launched by tapping the map to select a pin location.
- Captures: sport type, skill level (1–5), location note, start time, max players, equipment notes.
- `POST /api/games` with the JWT token; navigates back on success.
- The map auto-refreshes via `useFocusEffect`.

### Discover
- Fetches all active games from `/api/games`.
- Sport filter chips: **All / 🏀 / 🎾 / 🏐 / ⚽**.
- Text search filters by sport type or location description.
- Each card shows level, time, player count, and an inline **Join Game** button with full / your-game states.

### My Games
- Fetches `/api/games/mine` with the JWT.
- **HOST** badge (green) for games created by the user.
- **JOINED** badge (orange) for games joined.
- Empty state includes a direct "Open Map" shortcut.

### Chat
- Fetches `/api/chats` with the JWT — only shows games the user is part of.
- Displays last message preview and timestamp per game chat.
- Tapping a row navigates to the **Game Chat** screen.

### Game Chat
- Full message thread for a single game.
- Polls `/api/chats/:gameId/messages` every 3 seconds.
- Own messages: right-aligned, green bubble. Others: left-aligned, dark bubble with sender name.
- Send via button or keyboard return key.

### Profile
- Fetches `/api/users/me` for live stats: **Total Games**, **Hosted**, **Joined**.
- Username pulled from the JWT via `AuthContext`.
- **Sign Out** clears AsyncStorage and redirects to Login.

---

## 🔐 5. Authentication Flow

```
Register/Login
      │
      ▼
  Backend issues JWT (7-day expiry)
      │
      ▼
  AsyncStorage.setItem('token')   ← persists across app restarts
      │
      ▼
  AuthContext provides token + user to all screens
      │
      ▼
  app/index.tsx reads token on cold start
      ├── token exists  → redirect to Map
      └── no token      → redirect to Login
```

JWT payload: `{ id, username }`. All protected routes verify the token via `authMiddleware` before touching the database.

---

## 🎬 6. End-to-End Demo Flow

The following flow exercises every major feature of the prototype:

1. **Player A** registers → lands on the map with GPS location.
2. Player A taps the map → selects a pin → fills the Create Game form → posts a basketball game for tonight, max 5 players.
3. The game pin appears on the map immediately after returning.
4. **Player B** (second device or account) registers → opens **Discover** → finds the basketball game → taps **Join Game**.
5. Player A's map card now shows `1 / 5 players`.
6. Both players open the **Chat** tab → see the shared game chat → exchange messages.
7. Both see the game under **My Games** — Player A with **HOST** badge, Player B with **JOINED** badge.
8. Player A opens **Profile** → stats show `1` game hosted.
9. Player B opens **Profile** → stats show `1` game joined.

---

## ⚙️ 7. How to Run

**Prerequisites:** Node.js, MySQL (via Homebrew: `brew install mysql && brew services start mysql`).

```bash
# 1. Apply database schema + migrations
cd backend
mysql -u root -p < schema.sql
mysql -u root -p < migrations/001_add_participants.sql
mysql -u root -p < migrations/002_add_messages.sql

# 2. Configure environment
# Edit backend/.env — set DB_PASSWORD, GOOGLE_PLACES_API_KEY, JWT_SECRET

# 3. Start the backend
npm install
node server.js

# 4. Start the frontend (separate terminal)
cd ../frontend
npm install
npx expo start

# 5. Scan the QR code with Expo Go on your phone
# Ensure your phone and Mac are on the same Wi-Fi network
# Update frontend/constants/api.ts with your Mac's local IP (ipconfig getifaddr en0)
```
