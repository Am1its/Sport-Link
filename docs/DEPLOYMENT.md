# SportLink Deployment Guide

Last updated: June 11, 2026

---

## Architecture Overview

| Layer | Service | URL |
|---|---|---|
| Backend API + Socket.io | Railway (Node.js) | `https://sport-link-production.up.railway.app` |
| Database | Railway (MySQL/MariaDB) | Internal Railway connection |
| Frontend | Expo (React Native) | iOS App Store / local dev |
| Error monitoring | Sentry | `https://o4511548367241216.ingest.de.sentry.io` |

---

## Backend (Railway)

### Environment Variables (set in Railway dashboard)

| Variable | Description |
|---|---|
| `PORT` | Set automatically by Railway |
| `DB_HOST` | Railway MySQL internal host |
| `DB_PORT` | Railway MySQL port (default 3306) |
| `DB_USER` | MySQL username |
| `DB_PASSWORD` | MySQL password |
| `DB_NAME` | `sportlink` |
| `JWT_SECRET` | Long random secret for JWT signing |
| `GOOGLE_PLACES_API_KEY` | Google Places API key |
| `GOOGLE_CLIENT_ID` | Google OAuth Web Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret |
| `CORS_ORIGIN` | Comma-separated allowed origins (or `*` for open) |
| `PUBLIC_URL` | `https://sport-link-production.up.railway.app` |

### Deploy Process

Railway deploys automatically on every push to `main`. The `start` script in `backend/package.json` runs `node server.js`.

### Database Migrations

Run migrations manually via the Railway MySQL console (Query tab):

| Migration | Description |
|---|---|
| 001–010 | Core schema (Users, Games, GameParticipants, Messages, Ratings, PeerRatings) |
| 011 | Friends table |
| 012 | Notifications table |
| 013 | CourtReviews table |
| 014 | SportPreferences table |
| 015 | DirectMessages table |
| 016 | `reminder_sent_at` on Games (dedup cron) |
| 017 | FULLTEXT index on Games(title, location_desc) |
| 018 | `recurrence` ENUM + `parent_game_id` on Games |
| 019 | CourtClaims table + owner_response on CourtReviews |

To verify migrations ran:
```sql
SHOW INDEX FROM Games WHERE Key_name = 'ft_games_search';
SHOW COLUMNS FROM Games LIKE 'recurrence';
SHOW COLUMNS FROM Games LIKE 'parent_game_id';
SHOW TABLES LIKE 'CourtClaims';
SHOW COLUMNS FROM CourtReviews LIKE 'owner_response';
```

### Database Backups

Railway automated backups require the Pro plan ($20/month). **Deferred until post-launch** when real user data exists and the Pro plan is justified.

Manual backup on demand (run from your machine with Railway's external MySQL connection string):
```bash
mysqldump -h <host> -P <port> -u <user> -p<password> sportlink > backup_$(date +%Y%m%d).sql
```
Connection string available in Railway → MySQL service → Connect tab.

---

## Frontend (Expo / EAS)

### Environment Variables

Create `frontend/.env` (not committed — in `.gitignore`):

```
EXPO_PUBLIC_API_URL=https://sport-link-production.up.railway.app
EXPO_PUBLIC_GOOGLE_CLIENT_ID=393613161940-b7l3pahi9lbodrgq7vn537424b8h9b6b.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=393613161940-tlkf5mb8gfi3fp9e93ni7eijn6t18qpd.apps.googleusercontent.com
EXPO_PUBLIC_SENTRY_DSN=https://f1294303fea3d52643849fe316ccc848@o4511548367241216.ingest.de.sentry.io/4511548370976848
```

For local dev, change `EXPO_PUBLIC_API_URL` to `http://<your-lan-ip>:3000`.

### Local Development

```bash
# Start backend
cd backend && node server.js

# Start frontend (iOS Simulator)
cd frontend && npx expo run:ios

# Start frontend (physical device via USB — same WiFi required)
cd frontend && npx expo run:ios --device
```

### EAS Build (for TestFlight / App Store)

Requires Apple Developer account ($99/yr). One-time setup:

```bash
npm install -g eas-cli
eas login          # login with Apple ID: oran2107@gmail.com
eas build:configure
```

Build profiles (`eas.json`):

```bash
# Development build (simulator)
eas build --platform ios --profile development

# Preview / TestFlight internal build
eas build --platform ios --profile preview

# Production App Store build
eas build --platform ios --profile production
```

### App Store Submission

After production build:

```bash
eas submit --platform ios --profile production
```

Requires in `eas.json` → `submit.production.ios`:
- `appleId`: `oran2107@gmail.com`
- `ascAppId`: App Store Connect App ID (get after creating app record)
- `appleTeamId`: Apple Developer Team ID (in developer.apple.com → Membership)

### Deep Linking

The `sportlink://` URL scheme is registered in `app.json → scheme`. Supported deep links:

| Deep link | Screen |
|---|---|
| `sportlink://game/:id` | `frontend/app/game/[id].tsx` |
| `sportlink://invite/:userId` | `frontend/app/invite/[id].tsx` |

### Public Pages (hosted on Railway)

| URL | Purpose |
|---|---|
| `/game/:id` | Game share landing page with OG meta + deep link |
| `/invite/:userId` | Referral/invite landing page |
| `/privacy` | Privacy policy (required for App Store) |
| `/terms` | Terms of service |
| `/health` | Health check endpoint |

---

## Sentry

- Project: React Native → `SportLink`
- DSN: `https://f1294303fea3d52643849fe316ccc848@o4511548367241216.ingest.de.sentry.io/4511548370976848`
- Initialized in `frontend/app/_layout.tsx` via `Sentry.init()`
- Wraps `RootLayout` with `Sentry.wrap()` for crash reporting
- `tracesSampleRate: 0.2` (20% of transactions for performance monitoring)
- Check the Sentry dashboard at `https://sentry.io` for live errors

---

## Google OAuth

- Web Client ID: `393613161940-b7l3pahi9lbodrgq7vn537424b8h9b6b.apps.googleusercontent.com`
- iOS Client ID: `393613161940-tlkf5mb8gfi3fp9e93ni7eijn6t18qpd.apps.googleusercontent.com`
- Flow: PKCE via `expo-auth-session` → `exchangeCodeAsync` → `access_token` → `POST /api/auth/google` → Google userinfo validation → JWT issued
- Authorized redirect URIs must include the iOS reverse client ID scheme in Google Cloud Console

---

## Checklist Before App Store Submission

- [x] Run migration 019 on Railway MySQL
- [x] Set `EXPO_PUBLIC_SENTRY_DSN` in Railway env vars
- [ ] Database backups — deferred until Pro plan (post-launch)
- [ ] Create Apple Developer account ($99/yr)
- [ ] Create app record in App Store Connect (get `ascAppId`)
- [ ] Fill `appleTeamId` in `eas.json`
- [ ] Run `eas build --platform ios --profile production`
- [ ] Upload screenshots (6.7" iPhone, 6.1" iPhone, optionally iPad)
- [ ] Write App Store description (see `docs/APP_STORE_METADATA.md`)
- [ ] Set Privacy Policy URL in App Store Connect: `https://sport-link-production.up.railway.app/privacy`
- [ ] Set Terms URL: `https://sport-link-production.up.railway.app/terms`
- [ ] Verify Google OAuth is approved for production (may need to submit for Google OAuth verification)
- [ ] Submit for App Store review
