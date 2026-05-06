# SportLink - App Flow & Core Features

**Status:** Full Prototype — Sprint 7 complete  
**Target Audience:** Tel Aviv Amateur Athletes

---

## 📱 Core Application Screens (Bottom Navigation)

### 1. 🗺️ Map (Home)
- Real GPS location via `expo-location`; fallback to Tel Aviv center.
- Fetches courts from Google Places (4 parallel queries, deduped) + community games from `/api/games`.
- **Custom markers:**
  - Outdoor courts: hollow dashed ring with sport color.
  - Gyms/studios: filled tinted circle.
  - Community games: sport-colored marker with level badge; clusters into a green count-circle at low zoom.
- **Filter bar:** All / Games / Courts + 8 sport sub-chips (Basketball, Tennis, Volleyball, Football, Yoga, Gym, Studio, Footvolley).
- **FAB:** "Drop Pin" (tap map to place) or "Choose Court" (bottom-sheet court picker).
- **Bottom card states:** Your Game / Join Game (spring haptic animation) / Full / Public Court.
- Past games hidden from map.

### 2. 🔍 Discover
- Searchable, filterable game list (title, location, sport type).
- **Sport filter chips** (8 sports) + **radius chips** (Any / 1 km / 5 km / 10 km / 20 km) using Haversine distance on the backend.
- Game cards show: sport, title, location, time, player count (amber urgency badge for ≤2 spots), level, equipment notes, and a 16:9 game photo if the host added one.
- Join Game button with spring animation + haptics; optimistic update with rollback on failure.
- Pull-to-refresh.

### 3. 📅 My Schedule
- **Upcoming** section: host games (Edit / Delete / Chat) + joined games (Leave / Chat).
- **History** section: past games with "Rate Players" button.
- Pull-to-refresh.

### 4. 💬 Chat
- List of all game chats the user is part of; last message preview + sender.
- Tapping navigates to the **Game Chat** screen (socket.io real-time).

### 5. 👤 Profile
- Real avatar (base64) or deterministic colored initial letter.
- Inline edit mode: username, bio, avatar (image picker).
- 2×2 stat grid: Total Games / Hosted / Joined / Karma (green + / red -).
- **Menu:**
  - Community: Leaderboard, Friends.
  - Account: Notifications (with unread badge), Notification Settings, Sport Preferences, Sign Out.

---

## 🚀 Key Features

### Real-Time Chat (socket.io)
- When a user opens a game chat, the client connects via socket.io and joins room `game_<id>`.
- Messages appear instantly for all participants — no polling.
- Falls back to REST POST if the socket is disconnected.

### In-App Notification Inbox
- Every push notification (join, friend request, game cancel, reminder) is also persisted in the `Notifications` table.
- Profile screen shows a red unread badge on the Notifications menu item.
- Inbox lists up to 50 recent notifications; tap to mark read; "Mark all read" button.

### Game Photo
- Hosts can attach a 16:9 court or action photo when creating or editing a game.
- Photo stored as base64 in the `Games.photo` column.
- Displayed on Discover cards and editable in the modal.

### Radius-Based Game Search
- Discover screen offers distance chips (1 km / 5 km / 10 km / 20 km).
- Selecting a distance requests GPS permission and sends `?lat=&lng=&radius_km=` to the backend.
- Backend filters using the Haversine formula with `HAVING distance_km <= ?`.

### Player-Profile Friend Button
- Viewing any player's profile shows their karma and stats.
- A context-aware button: **Add Friend** / **Request Sent** / **Accept Request** / **Remove Friend**.
- `GET /api/users/:id` returns `friendship_status` and `friendship_id` so the button renders correctly with no extra request.

### Karma & Ratings
- **Host:** After a game, marks each participant Arrived (✅ +1 karma) or No-Show (❌ -1 karma).
- **Players:** Rate each other on Sportsmanship, Punctuality, Communication (thumbs up/down) and Skill (1–5 stars).
- Karma computed live in SQL — never stale.

### Push Notifications
- Sent for: new player joins your game, game cancelled, friend request sent/accepted, game starting in ~30 min.
- Registered via `expo-notifications`; token stored in `Users.push_token`.
- Game-start reminders: `setInterval` every 60 s on the backend.

### Friends System
- Search users by username prefix; send / accept / reject requests.
- When creating a game, accepted friends appear as invite chips → added as participants automatically.
- Friend requests and acceptances each trigger a push notification.

### Onboarding
- 3-step wizard on first login: upload avatar, write bio, select sport preferences.
- Each step skippable; completes by setting `onboarding_complete = true`.

### Leaderboard
- Top 20 users by karma.
- Podium view for ranks 1–3 (medal + platform block + larger avatar).
- Current user highlighted with a "You" badge.

---

## 🔐 Authentication

- JWT issued on register/login with a **90-day expiry** (extended from 7-day in Sprint 7).
- Token stored in `AsyncStorage`; read on cold start for instant re-auth.
- Any 401 response triggers global `_onUnauthorized` → `logout()` → redirect to `/login`.
- Routing gate in `index.tsx`: no token → `/login`; token + `!onboarding_complete` → `/onboarding`; else → `/(tabs)`.

---

## 📸 App Screenshot

<div align="center">
  <img src="../assets/app_screenshot.png" alt="SportLink App Screenshot" width="40%">
</div>
