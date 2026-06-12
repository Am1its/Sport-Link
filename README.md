<div align="center">
  <img src="assets/banner.png" alt="SportLink Banner" width="60%">

  <h3>Find courts. Join pickup games. Build your player reputation.</h3>

  <p>
    <a href="#features">Features</a> •
    <a href="#architecture">Architecture</a> •
    <a href="#local-setup">Local Setup</a> •
    <a href="#deployment">Deployment</a> •
    <a href="#docs">Docs</a> •
    <a href="docs/CHANGELOG.md">Changelog</a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/React_Native-Expo-blue?logo=expo" />
    <img src="https://img.shields.io/badge/Backend-Node.js_+_Express-green?logo=node.js" />
    <img src="https://img.shields.io/badge/Database-MySQL-orange?logo=mysql" />
    <img src="https://img.shields.io/badge/Deployed-Railway-purple" />
  </p>
</div>

---

## About

**SportLink** is a location-based sports community app. Users discover public courts, create community pickup games, join games, rate each other after sessions, and build a karma reputation as a player.

Built as a full-stack production app with a live Railway backend, real-time socket.io chat, Google Places court discovery, Expo push notifications, and Google OAuth sign-in.

> Backend live at: `https://sport-link-production.up.railway.app`

---

## <a id="features"></a>Features

### Core
| Feature | Description |
|---|---|
| **Map** | Interactive map of nearby courts and community games. Filter by sport. Game markers cluster at low zoom. |
| **Discover** | Browse upcoming games with full-text search, sport filter, and radius filter. Sorted by sport preference match. |
| **Create Game** | Drop a pin or pick a court. Set sport, level, max players, scheduled time, photo, optional title. One-time or recurring (weekly / bi-weekly). |
| **Join Game** | One-tap join with optimistic UI + haptics. Real-time participant count. |
| **Game Chat** | Socket.io real-time chat per game with pagination (load older messages). Avatar caching. |
| **Post-Game Ratings** | Host marks attendance (arrived / no-show). Participants rate each other: sportsmanship, punctuality, communication, skill (1–5). Anonymous results. |
| **Karma** | Running reputation score: host ratings (+1/−1) + peer ratings. Displayed on profiles and leaderboard. |

### Social
| Feature | Description |
|---|---|
| **Friends** | Send/accept friend requests. View friends' karma. |
| **Direct Messages** | Real-time 1-on-1 DMs with socket.io. Share game invites via event cards. Read receipt ticks + typing indicator. |
| **Activity Feed** | See what games your friends joined or created. |
| **Invite by Link** | Share a personal invite link (`/invite/:userId`) — opens the app or a web landing page. |
| **Player Matching** | Discover other players with shared sports + skill level. Ranked by games played together. |
| **Leaderboard** | Top 20 players by karma with podium display. |
| **Block & Report** | Block users (mutual invisibility across all features). Report users for review. |
| **Streaks & Badges** | Consecutive game streaks tracked automatically. 11 achievement badges auto-awarded (first game, 5/25/50 games, host milestones, streak milestones, social butterfly). |

### Game UX
| Feature | Description |
|---|---|
| **Waitlist** | Games auto-enroll latecomers on a waitlist when full. Waitlist position shown on card. |
| **Check-In** | Players check in within 30 minutes of game start. Tracks attendance more precisely. |
| **Game Boost** | Host can boost a game once to send a push notification to nearby same-sport players. |
| **Post-Game Photo** | Host attaches a photo after game completion — visible on the game card. |
| **Weather Widget** | Weather forecast shown on outdoor-sport game cards (via Open-Meteo, no API key required). |

### Courts
| Feature | Description |
|---|---|
| **Court Discovery** | Google Places API (4 parallel queries) with mock fallback. Filter by sport. |
| **Court Detail** | Photos, hours, phone, Google rating + SportLink community reviews. |
| **Court Reviews** | Rate courts 1–5 stars + comment. One review per user per court. |
| **Court Ownership** | Any user can claim a court as manager. Managers can reply to reviews and post announcements. |
| **Court Announcements** | Court managers post pinned notices (e.g. "Closed this weekend"). Visible to all visitors. |

### Auth & Profile
| Feature | Description |
|---|---|
| **Email Auth** | Register with username + email + password. JWT (90-day expiry). |
| **Google Sign-In** | PKCE flow via expo-auth-session. New users routed to onboarding. |
| **Onboarding** | 4-step wizard: photo → bio → sports (multi-select) → skill levels + favorites. |
| **Sport Preferences** | Per-sport: skill level (1–5) + favorite toggle. Drives game recommendations and player matching. |
| **Profile** | Games hosted/joined, karma, top sport, sport preference chips, streak pill, badge scroll row. Inline edit. |
| **Push Notifications** | Expo push tokens. Sent for: friend requests, game joins, friend acceptance, post-game rating nudge, badge earned. |

---

## <a id="architecture"></a>Architecture

```
📱 React Native (Expo / Expo Router)
        │
        ├── REST (HTTP/JSON)   ──────────► Node.js / Express  ──► MySQL (Railway)
        │                                         │
        └── Socket.io (WS)  ─────────────────────┘
                                                  │
                                      Google Places API
                                      Expo Push Service
                                      Sentry (error monitoring)
```

**Tech stack:**

| Layer | Technology | Notes |
|---|---|---|
| Mobile | React Native + Expo SDK | `expo-router` file-based routing, iOS + Android |
| Navigation | Expo Router | Stack + Tabs, typed routes |
| Maps | `react-native-maps` + Google Places | Court discovery, game markers, clustering |
| Real-time | socket.io v4 | Same port as REST; JWT auth on handshake; game rooms + DM rooms |
| Backend | Node.js + Express | Raw SQL via `mysql2/promise` pool — no ORM |
| Database | MySQL / MariaDB | 17 tables; raw SQL; FULLTEXT search on Games |
| Auth | JWT (90-day) + Google OAuth (PKCE) | Stored in `AsyncStorage`; global 401 handler |
| Push | Expo Push API | Backend sends via `https://exp.host/--/api/v2/push/send` |
| Error monitoring | Sentry (`@sentry/react-native`) | Wraps root layout; DSN in env var |
| Hosting | Railway | Auto-deploy from `main`; MySQL on Railway |

**Design system:** `frontend/constants/theme.ts` — single source of truth for `Colors`, `Spacing`, `Radius`, `Type`, `Shadow`. All screens import from here; no raw hex values in StyleSheets.

---

## <a id="local-setup"></a>Local Setup

### Prerequisites
- Node.js 18+
- MySQL 8 running locally
- Expo CLI: `npm install -g expo-cli`
- (Optional) Xcode for iOS simulator

### 1. Clone and install

```bash
git clone https://github.com/Am1its/Sport-Link.git
cd Sport-Link

# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 2. Backend environment

Create `backend/.env`:

```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=sportlink
JWT_SECRET=your_secret_key
GOOGLE_PLACES_API_KEY=your_places_key
GOOGLE_CLIENT_ID=your_google_web_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### 3. Database setup

```bash
mysql -u root -p -e "CREATE DATABASE sportlink;"
# Run migrations in order:
for f in backend/migrations/*.sql; do
  mysql -u root -p sportlink < "$f"
done
```

### 4. Frontend environment

Create `frontend/.env`:

```env
EXPO_PUBLIC_API_URL=http://<your-lan-ip>:3000
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your_google_web_client_id
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your_google_ios_client_id
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=your_google_android_client_id  # optional, needed for Android Google Sign-In
EXPO_PUBLIC_SENTRY_DSN=your_sentry_dsn
```

### 5. Run

```bash
# Terminal 1 — backend
cd backend && node server.js

# Terminal 2 — iOS simulator
cd frontend && npx expo run:ios

# Physical device (USB + same WiFi)
cd frontend && npx expo run:ios --device
```

---

## <a id="deployment"></a>Deployment

The backend deploys automatically to Railway on every push to `main`.

**Production URLs:**

| Route | Description |
|---|---|
| `/health` | Health check |
| `/game/:id` | Game share landing (OG meta + deep link) |
| `/invite/:userId` | Referral landing page |
| `/share/game/:id` | Rich game share preview page (OG tags + deep link) |
| `/share/court/:placeId` | Court share preview page with community review aggregate |
| `/privacy` | Privacy policy |
| `/terms` | Terms of service |
| `/api/*` | REST API (see [`docs/API.md`](docs/API.md)) |

**iOS builds** use EAS Build (see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the full runbook).

```bash
npm install -g eas-cli
eas login
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

---

## <a id="docs"></a>Docs

| Document | Description |
|---|---|
| [`docs/API.md`](docs/API.md) | Complete API reference — all endpoints, socket events, rate limits |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Railway + EAS + Sentry runbook, migration checklist, App Store submission steps |
| [`docs/APP_STORE_METADATA.md`](docs/APP_STORE_METADATA.md) | App Store Connect copy, keywords, screenshot list, reviewer notes |
| [`docs/CHANGELOG.md`](docs/CHANGELOG.md) | Full sprint-by-sprint changelog |
| [`docs/HLD.md`](docs/HLD.md) | High-level system design |
| [`docs/PRODUCT_DEFINITIONS.md`](docs/PRODUCT_DEFINITIONS.md) | User personas and stories |
| [`docs/BUSINESS_STRATEGY.md`](docs/BUSINESS_STRATEGY.md) | Growth and monetization strategy |
| [`docs/AUTHENTICATION_MODEL.md`](docs/AUTHENTICATION_MODEL.md) | Auth and trust model |
| [`docs/TECHNICAL_VALIDATION.md`](docs/TECHNICAL_VALIDATION.md) | Maps API validation |

---

## Database Schema (summary)

| Table | Purpose |
|---|---|
| `Users` | Accounts — email/password or Google OAuth, avatar (base64), push token, karma via subquery |
| `Games` | Pickup games — sport, level, location, scheduled time, photo, recurrence, parent_game_id |
| `GameParticipants` | Game join records |
| `Messages` | Game chat messages |
| `Ratings` | Host attendance ratings (attended bool) per game |
| `PeerRatings` | Peer ratings: sportsmanship, punctuality, communication, skill (1–5) |
| `Friends` | Friend requests and accepted friendships |
| `Notifications` | Push notification inbox (last 50 per user) |
| `CourtReviews` | Court ratings + comments + optional manager response |
| `SportPreferences` | Per-user per-sport: skill level + favorite flag |
| `DirectMessages` | 1-on-1 messages (text or game event cards) |
| `CourtClaims` | Court manager claims (one manager per court) |
| `BlockedUsers` | Mutual block relationships |
| `Reports` | User reports with reason + context |
| `Badges` | Earned achievement badges per user |
| `CourtAnnouncements` | Manager-posted court notices |

---

## Milestones

| Date | Milestone | Status |
|---|---|---|
| Jan 11, 2026 | [Tech Validation (Maps API)](docs/TECHNICAL_VALIDATION.md) | ✅ Done |
| Jan 18, 2026 | [High-Level Design](docs/HLD.md) | ✅ Done |
| Jan 25, 2026 | [Product Definitions](docs/PRODUCT_DEFINITIONS.md) | ✅ Done |
| Mar 15, 2026 | [Proof of Concept](docs/POC.md) | ✅ Done |
| Mar 26, 2026 | [App Flow & Core Features](docs/APP_FLOW.md) | ✅ Done |
| Mar 29, 2026 | [Business & Growth Strategy](docs/BUSINESS_STRATEGY.md) | ✅ Done |
| Apr 1, 2026 | [Authentication & Trust Model](docs/AUTHENTICATION_MODEL.md) | ✅ Done |
| May 10, 2026 | [Full Prototype](docs/FULL_PROTOTYPE.md) | ✅ Done |
| Jun 11, 2026 | Production-ready build (Sprint 13) | ✅ Done |
| Jun 12, 2026 | Sprint 14 — Safety, Game UX, Social, Courts, Android | ✅ Done |
| Jun 12, 2026 | Sprint 15 — Animations, Haptics & UX Polish | ✅ Done |
| Sep 8, 2026 | Final Submission | ⏳ Pending |

---

## Team

- **Amit Oved** — [GitHub](https://github.com/Am1its)
- **Gal Libal** — [GitHub](https://github.com/gallibal)

*Developed as part of the MTA Computer Science School — Software Entrepreneurship Workshop 2025*
