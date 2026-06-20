# Changelog

All notable changes to SportLink are documented here, ordered from most recent to oldest.

---

## [Expo Go QR Map] — June 2026

**Goal:** Make the app fully usable via Expo Go QR scan (no dev build, no Apple account required). Needed for live class presentation where attendees scan a QR code.

### Root Cause
`react-native-maps` is no longer bundled in Expo Go starting SDK 49. Any scan of the QR code crashed with `RNMapsAirModule: null is not an object`. All other app functionality (auth, games, chat, DMs, courts, realtime) already worked in Expo Go — only the map was blocked.

### Solution: Dual Code Path
- **Detection:** `Constants.appOwnership === 'expo'` (from `expo-constants`) reliably returns `'expo'` only in Expo Go, not in dev builds or production. Previous attempts using `Constants.executionEnvironment` and `try/catch require('react-native-maps')` both incorrectly showed the fallback in dev builds.
- **Conditional require:** `react-native-maps` is now imported only when `!isExpoGo`, preventing the crash at module-load time.
- **Export switch:** `export default isExpoGo ? ExpoGoMapScreen : HomeScreen` — native map for dev/prod builds, Leaflet WebView for Expo Go.

### New Component: `frontend/components/LeafletMap.tsx`
Isolated WebView-based map. No data fetching — purely presentational.
- **Map tiles:** CartoDB Voyager (free, no API key).
- **Sport icons:** `@mdi/font@7.4.47` loaded from CDN. MDI class names are identical to `SPORT_ICONS` values (e.g. `mdi-basketball`), so no mapping needed.
- **Props:** `region` (initial center), `markers: LeafletMarker[]`, `userLocation`, `recenterTrigger` (counter), `panTarget` (for search panning), `onMarkerPress`, `onMapPress`.
- **RN → WebView:** `injectJavaScript` calling `window.setMarkers(json)`, `window.setView(lat, lng)`, `window.setUser(lat, lng)`. All injections guarded by `readyRef.current` (set when WebView posts `{type:'ready'}`).
- **WebView → RN:** `window.ReactNativeWebView.postMessage(JSON.stringify({type, ...}))`. Types: `ready`, `marker` (placeId), `mapclick` (lat, lng).
- **Pin styles:** Game pins = dark 34px circle, sport icon + colored border; joined games get green accent. Court pins = lighter 26px hollow ring. User location = blue dot.

### New Screen: `ExpoGoMapScreen` (in `app/(tabs)/index.tsx`)
Full feature parity with the native HomeScreen:
- **Search bar:** collapsible (search icon → TextInput in header). Debounced 400ms via `searchPlaces()`. Dropdown shows recent searches (AsyncStorage) and live results. Selecting a result injects `setView` via `panTarget` prop.
- **Drop pin:** FAB opens add menu ("Drop Pin" / "Choose Court") identical to native. Drop Pin → green banner "📍 Tap on the map to place a pin" → map tap navigates to game creation modal with those coordinates. Choose Court → bottom-sheet FlatList of nearby courts.
- **Type filter:** "All / Community Games / Courts" chip row above sport chips.
- **Sport filter:** same 12-sport chip row as native.
- **Recenter button:** increments `recenterTrigger` → WebView pans to `userLocation`.
- **BottomCard:** same component as native — full join flow, participant avatars, Full/Joined states.
- **Bug fixed:** FAB previously pushed `/modal` without lat/lng params, causing backend "latitude, longitude are required" error. Now passes `userLocation ?? region` coordinates.

### Dependency Added
- `react-native-webview: 13.15.0` — bundled in Expo Go, SDK 54-compatible. Added via `npx expo install`.

---

## [Add Padel, Hiking, Walking Sports] — June 2026

**Goal:** Expand supported sports from 9 to 12 by adding padel, hiking, and walking across all layers.

### Backend
- `backend/migrations/025_add_sports_padel_hiking_walking.sql` — `ALTER TABLE Games MODIFY sport_type ENUM(...)` adding the 3 new values. Apply on Railway.
- `backend/schema.sql` — reference ENUM updated.
- `backend/server.js` — added padel/hiking/walking to `SPORT_LABELS` and `SPORT_EMOJI` (🏓/🥾/🚶).
- `backend/routes/share.js` — added to `SPORT_EMOJIS`.

### Frontend
- `frontend/constants/sports.ts` — added to all 5 exports. Icons: `table-tennis` / `hiking` / `walk`. Colors: `#F43F5E` / `#22C55E` / `#64748B`.
- `frontend/app/modal.tsx`, `onboarding.tsx`, `sport-preferences.tsx` — local SPORTS arrays updated.
- `frontend/utils/weather.ts` — padel, hiking, walking added to `OUTDOOR_SPORTS` (weather chip will show for these).

---

## [Auth Screen Redesign] — June 2026

**Goal:** Replace the split hero/card layout on login and register with a full-screen immersive background, and bring onboarding into visual parity.

### New Component: `AuthBackground`
**`frontend/components/AuthBackground.tsx`** — new shared component
- Renders as `StyleSheet.absoluteFill` with `pointerEvents="none"` — zero layout impact on parent.
- Contains: 2 glow orbs (top-right + mid-left), 16 `FloatingIcon` instances spread across full screen height (not capped at 240px), each driven by `useFloatingOrb(phase)` for slow independent Y drift.
- `showLogo?: boolean` prop (default `true`). When `true`: centered logo block (100×100 ring, "SportLink" title, accent tagline dots) spring-scales in on mount via `withSpring(Springs.bouncy)`.
- Used in `login.tsx`, `register.tsx`, `onboarding.tsx`.

### Login (`login.tsx`)
- Removed explicit hero section (240px), `SportsBg`, `FloatingIcon`, `MaterialCommunityIcons` imports.
- Layout: `<View style={{ flex:1 }}>` → `<AuthBackground />` (absoluteFill behind) + `<ScrollView>` with flex spacer pushing panel to bottom.
- Panel (`Colors.surface`, rounded top corners only) replaces the old card. Panel slides up +80→0 (`Springs.bouncy`) + fades in on mount. Footer lives inside the panel.
- `KeyboardAvoidingView behavior="padding"` + `ScrollView` handles small-screen keyboard correctly (spacer compresses, panel scrolls if needed).

### Register (`register.tsx`)
- Same `AuthBackground` + flex-spacer + bottom panel layout as login.
- Back button (`position: 'absolute'`, top-left, 36×36, `zIndex: 10`) rendered outside `ScrollView` — stays fixed while content scrolls.
- Removed separate orb Views, header row, card title/subtitle.
- All animations preserved: `useFieldShake` on empty submit, `useSuccessBurst` particle burst on success, `useStaggerEntrance` field entrance.
- Google button style unified with login (white background, `#DB4437` icon).

### Onboarding (`onboarding.tsx`)
- Added `<AuthBackground showLogo={false} />` — same orbs + floating icons, no duplicate logo block.
- Header redesigned: replaced flat "SportLink" accent text + `borderBottomWidth:1` separator with a 60×60 logo ring (same visual language as auth, proportionally smaller) + subtitle + 4-segment progress bar.
- Entire header + ScrollView wrapped in `ReAnimated.View` with gentle fade+slide-up entrance (`Springs.gentle`, 30pt translateY, 350ms opacity).
- All existing step transitions, sport tiles, level controls, and nav buttons unchanged.

---

## [Bug Fixes] — June 2026

**Game Chat 500 Error**
- Root cause: `mysql2` prepared statements do not support `LIMIT ?` bind parameters — throws "incorrect arguments to mysql_stmt_execute". Fixed by inlining the validated integer limit directly in the SQL string (`LIMIT ${limit}`).

**Map Search Always Empty**
- Root cause: `/api/geocode` was calling the Google **Geocoding API** which is not enabled on the Railway API key (only the Places API is). Switched to `place/textsearch/json` (Places Text Search), which uses the already-enabled Places API and returns equivalent results.

**Map Tab Native Crashes (iOS 26)**
- Added null/NaN coordinate guards before all `<Marker coordinate=...>` renders and `animateToRegion()` calls — passing nil coordinates causes `NSInvalidArgumentException: insertObject:atIndex: object cannot be nil` in react-native-maps native layer.
- Stripped base64 `photo` and `post_game_photo` fields from the games list on the map tab (not displayed there; keeping them in state caused memory pressure).
- Upgraded `react-native-maps` 1.20.1 → 1.27.2 for iOS 26 (Apple's new year-aligned versioning, introduced WWDC 2025) MapKit compatibility.

---

## [Sprint 16] — June 2026 — Full Animation + Sound Makeover

**Goal:** Make every screen feel premium and kinetic — purposeful motion on every interaction, coordinated sound effects, expo-av audio system, react-native-reanimated v4 applied app-wide.

### Motion System
**`frontend/constants/motion.ts`** — new file
- `Springs` constants: `snappy` (stiffness:400/damping:28), `bouncy` (280/18), `gentle` (160/22).
- Rule: never hardcode `{ stiffness, damping }` inline anywhere — always import from here.

**`frontend/hooks/useAnimations.ts`** — 4 new hooks added
- `useFloatingOrb(phase)` — slow Y drift + opacity pulse loop for hero band orbs.
- `useCountUp(target, duration?)` — ticks a shared value from 0 to target on mount; used for profile/player stats.
- `useFieldShake()` — horizontal ±8px spring shake for validation errors on form fields.
- `useTypingIndicator()` — returns `{ visible, show, hide }`; used by both chat screens for the ••• bubble.

### Sound System
**`frontend/hooks/useSounds.ts`** — new file
- Preloads all 5 WAV files via `expo-av Audio.Sound.createAsync` on mount. Returns `play(name)` async function.

**`frontend/context/SoundContext.tsx`** — new file
- `SoundProvider` wraps app root in `_layout.tsx`. `useSound()` hook consumed in screens.
- Context type: `{ play: (name: SoundName) => Promise<void> }`. Default value: `async () => {}`.

**`frontend/assets/sounds/`** — 5 WAV files
- `chime.wav` (join/accept/success moments), `pop.wav` (send message), `success.wav` (register/form complete), `error.wav` (validation fail), `ding.wav` (receive message).

### Per-Screen Animations

**Auth (`register.tsx`, `login.tsx`)**
- Card slide-up (translateY 60→0, Springs.bouncy) + opacity on mount.
- 4-field stagger entrance (60ms per field, `useStaggerEntrance`).
- `useFieldShake()` + Warning haptic on validation error.
- `useSuccessBurst()` particle burst + `play('success')` + Success haptic on registration.

**Onboarding (`onboarding.tsx`)**
- Step slide transitions: old step slides out, new step slides in from the opposite side (Springs.bouncy). In-animation runs in `useEffect([step])` after re-render — not in the worklet callback.
- `SportTile` sub-component: scale bounce on select (Springs.bouncy).
- 4-segment `ProgressBar` sub-component: width transitions with `withTiming`.
- `play('chime')` + Success haptic on finish.

**Map Tab (`(tabs)/index.tsx`)**
- FAB rotates 0°→45° on open (Springs.snappy); resets to 0° on close or navigation.
- `FilterChip` sub-component: scale spring + `selectionAsync` haptic per chip.
- Bottom card: slides up from 30px + fades in (Springs.bouncy); slides down on dismiss (Springs.snappy).

**GameCard (`components/GameCard.tsx`)**
- Join button: accent-color flood fill overlay (`fillWidth` 0→1, Springs.bouncy) instead of instant background swap.
- `useEffect([game.id])` resets `fillWidth.value`, `isJoined`, `isWaitlisted` — handles FlatList cell recycling.
- `play('chime')` + Success haptic on successful join.

**Discover Tab (`(tabs)/discover.tsx`)**
- `StaggeredCard` sub-component: translateY 20→0 + opacity, 60ms stagger, capped at 400ms.
- Sport and radius modals: scale + opacity entrance (Springs.bouncy), `animationType="none"`.

**Games Tab (`(tabs)/games.tsx`)**
- `AnimatedSectionHeader`: translateX -20→0 on mount.
- `PulsingBadge`: infinite opacity 1→0.5→1 loop (3s cycle) for status badges.
- `StaggeredCard` (60ms stagger); history index offsets continue from upcoming count.
- Heavy haptic on Leave/Delete.

**Chat Tab (`(tabs)/chat.tsx`)**
- `StaggeredRow` (50ms stagger).
- `UnreadBar`: width 0→3 spring (Springs.bouncy) for unread indicator bar.
- `badgeScale` bounces on unread count increase (detected via `prevUnreadRef`).

**Profile Tab / Player Profile (`(tabs)/profile.tsx`, `player-profile.tsx`)**
- `FloatingBlob` sub-component: `useFloatingOrb` at phases 0/0.43/0.87 for 3-orb hero band.
- `SportChip` sub-component: `useStaggerEntrance(index, 100)` entrance.
- `useCountUp` for all 4 stat values (karma uses `Math.abs` with sign prefix).
- Avatar: spring scale 0→1 (Springs.bouncy) on mount.

**Chat Screens (`game-chat.tsx`, `direct-chat.tsx`)**
- `ChatBubble`: bubble rotates from ±2° to 0° on entrance (Springs.snappy).
- Typing indicator: 3 animated dots driven by `useTypingIndicator()` hook; wired to `dm_typing` socket event in direct-chat.
- Send: `play('pop')` + Medium haptic. Receive: `play('ding')` + Light haptic.

**Rate Players (`rate-players.tsx`)**
- `ThumbButton` sub-component: press bounce (Springs.bouncy).
- `StarRating` sub-component: 5 explicit `useSharedValue` (s0–s4) + 5 explicit `useAnimatedStyle` (a0–a4); cascade fill via `withDelay(i * 40, withSpring(1.25, bouncy, () => withSpring(1, snappy)))`.
- `play('success')` before Submit haptic.

**Leaderboard (`leaderboard.tsx`)**
- `AnimatedPodiumBlock` sub-component: height 0→finalHeight rise; delays `[150ms, 300ms, 0ms]` for `[2nd, 1st, 3rd]`.
- `ShimmerRow`: gold shimmer strip `withRepeat(withTiming(width, 2500ms), -1)` on top-3 rows.
- `StaggeredRow` (40ms stagger); `play('chime')` after data loads.

**Court Detail (`court-detail.tsx`)**
- `StarRating` sub-component (same 5-hook pattern as rate-players).
- Submit confirmation: `confirmOpacity`/`confirmTranslateY` driven by `useEffect([submitSuccess])`.

**Create/Edit Game Modal (`modal.tsx`)**
- `useFieldShake()` composed on submit button; `play('error')` + Warning haptic on validation.
- Photo preview: scale 0.8→1 + opacity 0→1 after picker (initialized to 1 in edit mode).
- `play('chime')` before Success haptic on game create.

**Friends (`friends.tsx`)**
- `StaggeredCard` (50ms stagger).
- `RequestCard` sub-component: `flashOpacity` green overlay `withSequence(withTiming(0.4), withTiming(0))` on accept.
- `play('chime')` + Success haptic on API success.

### Key Bug Fixes in Sprint 16
- **Onboarding slide-in timing:** In-animation must run in `useEffect([step])` after re-render, not inside the `withTiming` completion worklet (step content not mounted yet when worklet fires).
- **Map FAB not resetting:** `fabRotate.value = withSpring(0, Springs.snappy)` added to court-picker item `onPress` (was left at 45° after navigation).
- **FlatList cell recycling (GameCard):** `useEffect([game.id])` resets all shared values and local state to prevent stale animation state on recycled cells.

---

## [Sprint 15] — June 2026 — Animations, Haptics & UX Polish

**Goal:** Elevate SportLink to a premium sports-brand feel — purposeful motion, haptic feedback at every high-stakes moment, smooth screen transitions. No audio; haptics-only.

**Shared Animation Primitives (`frontend/hooks/useAnimations.ts`)**
- `usePressAnimation(config?)` — spring scale-down/up on any pressable; accepts `{ scaleDown, scaleUp, stiffness, damping }` overrides
- `useEntranceAnimation(delay?)` — translateY +12→0 + opacity 0→1 entrance
- `useStaggerEntrance(index, baseDelay)` — staggered entrance with 60ms per-item offset
- `useSuccessBurst()` — 6-dot particle burst for join celebrations

**Shared Components**
- `BackButton` — animated 36×36 circle (`usePressAnimation` + `Haptics.Light`); replaces inline back buttons across 9 screens
- `ChatBubble` — extracted from both chat screens; Reanimated entrance (slide + fade, direction-aware for own vs. other messages)

**Joining a Game (`GameCard.tsx`)**
- 3-phase press animation: scale-down → overshoot → settle
- `useSuccessBurst` particle burst on successful join
- Haptic: `Medium` on press → `notificationAsync(Success)` on join

**Sending a Message (`game-chat.tsx`, `direct-chat.tsx`)**
- Send button: `withTiming` opacity 0.35→1 as text is typed; spring press animation
- Outgoing bubble: slides up 12px + fades in (250ms spring)
- Incoming bubble: slides in from left + fades (220ms spring)
- Haptic: `Light` on send

**Rating Players (`rate-players.tsx`)**
- `AttendanceButton` — scale pulse + background `withTiming(180ms)`; `Heavy` haptic for No-Show, `Medium` for Arrived
- `ThumbButton` — scale pulse + `nudgeY` -4→0 spring for thumb-up; `selectionAsync` haptic
- `AnimatedStar` — staggered cascade fill (60ms per star, scale 1.3→1.0 spring); `selectionAsync` once per tap
- Done screen: `circleScale` spring 0.3→1.0, `useEntranceAnimation` for text, `useStaggerEntrance` for buttons, `notificationAsync(Success)` on submit

**Create Game Modal (`modal.tsx`)**
- `SportTile` component — scale spring + `selectionAsync` haptic per chip
- Photo preview: scale 0.92→1.0 spring on image selected
- Submit button: `usePressAnimation` + `impactAsync(Heavy)` before API call
- Success dismiss: opacity→0 + scale→0.97 over 250ms, `notificationAsync(Success)`, `setTimeout(router.back, 260)`

**Map Screen (`(tabs)/index.tsx`)**
- `FilterChip` component — scale 0.94→1.0 spring + `selectionAsync` per chip
- Bottom card: slides up from 30px + fades in on marker tap; slides down + fades out with deferred unmount (`runOnJS`) so exit animation plays before React unmounts the node
- Marker tap: `impactAsync(Light)` on court and game markers

**Screen Transition Tiers (`_layout.tsx`)**
- Peek (contextual): `presentation: 'modal'` — `player-profile`, `game-participants`, `notification-inbox`
- Destination: `animationDuration: 380` — `court-detail`, `game-results`, `leaderboard`, `rate-players`
- Auth/onboarding: `animation: 'fade'` — `login`, `register`, `onboarding`

**Tab Bar (`(tabs)/_layout.tsx` + 5 tab screens)**
- `AnimatedTabIcon` — active icon scales 1.0→1.15 with `withSpring` on focus
- Each tab's root view fades in with `withTiming(1, { duration: 180 })` via `useFocusEffect` — removes harsh cut on tab switch

---

## [Sprint 14] — June 2026 — Safety, Game UX, Discovery, Social, Courts, Android

### 14A — Safety & Trust
**Backend:**
- **Migration 020** — `BlockedUsers` table (`blocker_id`, `blocked_id`, UNIQUE); `Reports` table (`reporter_id`, `reported_id`, `reason` ENUM, `context`).
- `POST /api/users/:id/block`, `DELETE /api/users/:id/block` — block/unblock.
- `GET /api/users/blocked` — list blocked users.
- `POST /api/users/:id/report` — report with reason (spam/harassment/inappropriate/other).
- All social queries (games, DMs, users, suggestions, friends) filter out mutually blocked users via two correlated subqueries.

**Frontend:**
- `player-profile.tsx` — 3-dot "..." header button opens Block/Report action sheet.
- Report modal: reason radio group + Submit button.
- `blocked-users.tsx` — new screen listing blocked users with Unblock action. Accessible from Profile → Blocked Users menu item.

---

### 14B — Game UX
**Database (`backend/migrations/021_game_ux.sql`):**
- `GameParticipants` gains `status ENUM('joined','waitlist')` and `waitlist_position INT`.
- `GameParticipants` gains `checked_in_at DATETIME`.
- `Games` gains `boosted_at DATETIME` and `post_game_photo MEDIUMTEXT`.

**Backend (`backend/routes/games.js`):**
- All participant counts now use `COUNT(CASE WHEN status='joined' THEN user_id END)` so waitlisted players don't inflate the displayed count.
- `POST /:id/join` → auto-adds to waitlist when game is full (returns `status: 'waitlist'`, `waitlist_position`).
- `POST /:id/checkin` — participant checks in (enforces ±30 min window around `scheduled_time`).
- `POST /:id/boost` — host boosts the game (sets `boosted_at`; one boost per game; triggers push to nearby-sport users).
- `PUT /:id/post-photo` — host attaches post-game photo (base64) after game is completed.
- `GET /mine` returns `participant_status`, `waitlist_position`, `checked_in`.

**Frontend:**
- `frontend/utils/weather.ts` — Open-Meteo weather fetch; WMO code map; session cache per game.
- `discover.tsx` — "Join Waitlist" button (orange) when full; waitlist chip on joined games; date filter chips (Today / Weekend / Week).
- `games.tsx` — Waitlist badge; weather chip for outdoor sports; Boost button for host; Check In button in 30-min window; Add Photo on completed host games.

---

### 14C — Discovery
**Database (`backend/migrations/022_neighborhood.sql`):**
- `Games` gains `neighborhood VARCHAR(100)`; indexed.

**Backend (`backend/routes/geocode.js`):**
- `GET /api/geocode?q=` — forward geocode via Google → `[{name, lat, lng}]`.
- `GET /api/geocode?reverse=1&lat=&lng=` — reverse geocode → neighborhood name.

**Frontend:**
- `frontend/utils/geocode.ts` — `searchPlaces()` + `reverseGeocode()`.
- `index.tsx` (Map) — collapsible search bar in header; debounced geocode search; recent searches persisted in `AsyncStorage`.
- `discover.tsx` — neighborhood filter banner with clear button; tappable neighborhood tag on game cards.
- `modal.tsx` (Create/Edit Game) — neighborhood auto-filled via reverse geocode on new game; editable field.

---

### 14D — Social (Streaks, Badges, DM Polish)
**Database (`backend/migrations/023_streaks_badges.sql`):**
- `Users` gains `current_streak INT`, `longest_streak INT`, `last_game_date DATE`.
- `Badges` table: `(id, user_id, badge_key VARCHAR(50), earned_at)`. UNIQUE on `(user_id, badge_key)`.

**Backend (`backend/utils/badgeUtils.js`):**
- 11 badge definitions: `first_game`, `game_5/25/50`, `host_5/25`, `streak_3/7/30`, `social_butterfly`.
- `checkAndAwardBadges(userId, pool)` — queries stats, awards new badges via `INSERT IGNORE`, sends push notification per badge.

**Backend (`backend/server.js`):**
- `autoCompleteGames` now updates streaks (`current_streak`, `longest_streak`, `last_game_date`) for every participant when a game completes; calls `checkAndAwardBadges`.
- `dm_typing` socket handler: `socket.on('dm_typing', { to })` → `io.to('user_${to}').emit('dm_typing', { from })`.

**Backend (`backend/routes/dm.js`):**
- `GET /:userId` and `PUT /:userId/read` both emit `dm_read` socket event to `user_${other}` after marking messages read.

**Backend (`backend/routes/users.js`):**
- `fetchUser` now selects `current_streak`, `longest_streak`.
- `fetchBadges(userId)` helper queries `Badges` table.
- `GET /me` and `GET /:id` both return `badges[]` and streak fields.

**Frontend:**
- `profile.tsx` — 🔥 streak pill (orange) below stats bar; horizontal badge chip scroll row.
- `player-profile.tsx` — same streak pill + badge row on public profiles.
- `direct-chat.tsx` — read receipt ticks on own messages (single gray / double green via `dm_read` socket); typing indicator `• • •` bubble (via `dm_typing` socket, 3s timeout); typing emitted debounced 2s on input change.

---

### 14E — Court Announcements
**Database (`backend/migrations/024_court_announcements.sql`):**
- `CourtAnnouncements` table: `(id, place_id, user_id FK, message VARCHAR(500), created_at)`. Indexed on `place_id`.

**Backend (`backend/routes/courts.js`):**
- `GET /:placeId` now returns `announcements[]` (last 5, newest first).
- `POST /:placeId/announcements` — manager-only; creates announcement; returns created row.
- `DELETE /:placeId/announcements/:annId` — manager-only; removes announcement.

**Frontend (`frontend/app/court-detail.tsx`):**
- Announcements section between manager banner and community reviews.
- Orange-tinted cards per announcement with manager delete option.
- Manager input row with Post button.

---

### 14F — Android Polish & Web Share
**`frontend/app.json`:**
- Android `package` set to `com.am1its.sportlink`.
- Added `softwareKeyboardLayoutMode: "pan"` (prevents layout jumps on Android keyboards).
- Added `VIBRATE` + `RECEIVE_BOOT_COMPLETED` permissions.

**`frontend/app/_layout.tsx`:**
- Explicit `<StatusBar barStyle="light-content" backgroundColor="#1C1C1E">` for correct Android status bar theming.

**`frontend/hooks/useGoogleAuth.ts`:**
- `androidClientId` wired from `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` env var (no-op until Android OAuth client created in Google Cloud Console).

**`backend/routes/share.js`:**
- `GET /share/game/:id` — renders HTML with OG meta tags (title, description, sport emoji); mobile browsers auto-redirect to `sportlink://game/:id`.
- `GET /share/court/:placeId` — renders HTML with OG meta + community review aggregate; deep-links to `sportlink://court-detail?placeId=...`.

---

## [Sprint 13] — June 2026 — App Store Prep, Sentry, Court Ownership

### App Store Readiness
- **Icon & splash:** Generated `assets/icon.png` (1024×1024 PNG) and `assets/splash.png` (2048×2048) from Logo4 with dark `#1C1C1E` background. Both referenced in `app.json`.
- **`app.json`** updated: `userInterfaceStyle: dark`, iOS `buildNumber: "1"`, Android `versionCode: 1`, proper `NSLocationWhenInUseUsageDescription` / `NSCameraUsageDescription` / `NSPhotoLibraryUsageDescription` / `NSUserNotificationsUsageDescription` info.plist keys, iOS `privacyManifests` for `NSUserDefaults` access (CA92.1), `expo-notifications` plugin with green icon tint, `supportsTablet: false`.
- **`eas.json`** created: three build profiles — `development` (simulator), `preview` (internal distribution), `production` (auto-increment). Submit config with Apple ID pre-filled.
- **Privacy Policy** served at `GET /privacy` on Railway — covers data collected, usage, sharing (Google, Expo, Sentry, Railway), retention, user rights, children, contact.
- **Terms of Service** served at `GET /terms` on Railway — covers acceptance, permitted use, user content license, community standards, karma disclaimer, limitation of liability.

### Sentry Error Monitoring
- **`@sentry/react-native`** installed in frontend.
- `Sentry.init({ dsn: process.env.EXPO_PUBLIC_SENTRY_DSN, debug: false, tracesSampleRate: 0.2 })` called at module load in `frontend/app/_layout.tsx`.
- `RootLayout` wrapped in `Sentry.wrap()` to capture unhandled JS errors and promise rejections.
- DSN stored in `EXPO_PUBLIC_SENTRY_DSN` env var (`.env` + Railway env vars).

### Court Claim / Ownership (#17)
**Backend:**
- **Migration 019** — `CourtClaims` table: `id`, `place_id` (UNIQUE), `user_id` FK → Users, `claimed_at`. `CourtReviews` gains `owner_response VARCHAR(500) NULL` and `owner_response_at DATETIME NULL`.
- `POST /api/courts/:placeId/claim` — any authenticated user claims an unclaimed court (first-come, 409 if already claimed).
- `DELETE /api/courts/:placeId/claim` — manager releases claim.
- `PUT /api/courts/:placeId/reviews/:reviewId/response` — manager adds/updates response to a review (guards via CourtClaims lookup).
- `DELETE /api/courts/:placeId/reviews/:reviewId/response` — manager removes their response.
- `GET /api/courts/:placeId` — now returns `claimed_by: { id, username, avatar } | null` and `is_manager: boolean`.
- All review queries now include `owner_response` and `owner_response_at` fields.

**Frontend (`frontend/app/court-detail.tsx`):**
- `ClaimedBy` type added; `claimedBy`, `isManager`, `claiming` state.
- **Manager banner** (when claimed): accent-faint background, shield-checkmark icon, manager avatar + username, Release button for the manager.
- **Claim CTA** (when unclaimed): blue-faint card with "Manage This Court" button.
- `ReviewCard` updated — if `isManager`, shows "Reply as Manager" button on each review. Inline text input with Save/Cancel. Existing responses show with edit/delete icons. `owner_response` displayed in accent-faint bubble with shield-checkmark label.

### Code Quality
- **Code review #2** — 7 findings fixed and merged (branch `fix/code-review-findings-2`):
  1. **XSS** — `escapeHtml()` applied to all user-controlled strings in landing/invite pages (`backend/server.js`).
  2. **Notification routing** — cold-start and foreground listeners now navigate to `/game/[id]`; guarded on `user?.onboarding_complete`.
  3. **Invite URL crash** — `friends.tsx` guards `user?.id` before building share URL.
  4. **Debounce leak** — `discover.tsx` cancels pending search timer in `useFocusEffect` cleanup to prevent stale fetch on tab blur.
  5. **Redundant DB query** — `autoCompleteGames` now selects `parent_game_id` in the outer query; eliminates inner re-query.
  6. **Manager auth DRY** — `requireCourtManager(placeId, userId)` helper in `courts.js`; two handlers use it instead of inline SQL.
  7. **AvatarCircle** — claim banner in `court-detail.tsx` uses shared `<AvatarCircle>` instead of inline avatar block.

---

## [Sprint 12] — June 2026 — Engagement Loop, Growth Features, Improvements

### Google Sign-In (Production)
- PKCE flow via `expo-auth-session`. `POST /api/auth/google` validates access token against Google userinfo endpoint. New Google users route to `/onboarding`.

### Notification Tap → Navigate (#8)
- `Notifications.addNotificationResponseReceivedListener` in `_layout.tsx` navigates to `game-chat` (if `data.gameId`), `/friends`, or `/(tabs)/games`.
- Cold-start handler via `getLastNotificationResponseAsync()` with `coldStartHandled` ref guard.

### Real-Time Notification Badge via Socket.io (#9)
- `(tabs)/_layout.tsx`: socket connects on auth, listens for `new_dm` event → calls `checkUnread`.
- `AsyncStorage.multiGet` replaces sequential key reads for chat unread detection.

### Post-Game Push Nudge (#10)
- Cron sends push 30 min after `scheduled_time` to host + participants nudging them to rate.

### Auto-Complete Games (#11)
- `autoCompleteGames` cron transitions `active` games to `completed` 2 hours after `scheduled_time`.
- Recurring games: if `recurrence != 'none'` and `parent_game_id IS NULL`, spawns a new game `+7` or `+14` days out.

### Smart Game Recommendations (#12)
- `GET /api/games` joins `SportPreferences` for caller; returns `sport_match_score` (0–3). Discover sorts by `sport_match_score DESC, scheduled_time ASC`.

### Full-Text Game Search (#19)
- **Migration 017** — `ALTER TABLE Games ADD FULLTEXT INDEX ft_games_search (title, location_desc)`.
- `GET /api/games?q=` — `MATCH/AGAINST` in BOOLEAN MODE (prefix `+word*`) for ≥3 char queries; LIKE fallback for 2-char terms.
- Discover debounces 400ms, sends `?q=` to server, sport filter stays client-side.

### Chat Pagination (#18)
- `GET /api/chats/:gameId/messages?before=<id>&limit=30` — `ORDER BY id DESC`, reversed before response.
- `game-chat.tsx` switched to inverted `FlatList`; new messages prepend; `loadMore` appends older at array tail; `ListFooterComponent` shows loading indicator at visual top.

### Activity Feed (#15)
- `GET /api/activity` — UNION of friends' join events + game creation events; last 50; auth required.
- `frontend/app/activity.tsx` — FlatList with actor avatar (tappable → player-profile), 3px sport-color accent bar, "X joined / created Y" headline, sport badge, `timeAgo` helper.
- Accessible from Profile → Friend Activity.

### Social Sharing + Game Landing Pages (#13)
- `GET /game/:id` on Railway — server-renders HTML with OG meta tags, auto-redirects mobile to `sportlink://game/:id`, shows game info card.
- `GET /invite/:userId` — invite landing page with avatar, username, bio, sport; auto-redirects to `sportlink://invite/:userId`.
- `Share.share` on game cards and invite button uses full Railway URLs.

### Invite by Link / Referral (#14)
- `frontend/app/invite/[id].tsx` — deep link handler for `sportlink://invite/:userId`. Shows public profile, Add Friend CTA (or "Already Friends" / "Sign in" states).
- Share button in `friends.tsx` header invites via `${API_BASE}/invite/${user.id}`.

### Recurring Games (#16)
- **Migration 018** — `ALTER TABLE Games ADD COLUMN recurrence ENUM('none','weekly','biweekly') NOT NULL DEFAULT 'none'`, `ADD COLUMN parent_game_id INT NULL`, FK `→ Games(id) ON DELETE SET NULL`.
- `modal.tsx` — Repeat chip selector (One-time / Weekly / Bi-weekly) shown for new games.
- `games.tsx` — recurring badge (repeat icon + WEEKLY / BI-WEEKLY label) on game cards.
- Backend cron spawns child game on completion of root recurring games.

### Player Matching Improvement (#20)
- `GET /api/users/suggestions` — both branches now compute `shared_game_count` (completed games where both users participated).
- Sort order updated: `shared_count DESC, shared_game_count DESC, karma DESC`.
- Player cards show "✓ X games together" green badge when `shared_game_count > 0`.

### Code Quality
- All 10 findings from June 2026 code review fixed and merged (branch `fix/code-review-findings`).
- `frontend/constants/sports.ts` — `SPORT_LABELS` exported; `sportLabel(type)` helper function.
- `frontend/types/index.ts` — `Game.recurrence`, `Game.photo` types added.

---

## [Sprint 11] — May 2026 — Full UI/UX Overhaul & Design System

### Design Token System
**`frontend/constants/theme.ts`** — new file, single source of truth for all visual tokens.
- `Colors` — full semantic palette: `bg`, `surface`, `surface2`, text hierarchy (`text`, `textSub`, `textMuted`, `textHint`), `border`/`borderSub`, accent (`#0FEA95`) with `accentFaint`/`accentBorder`, `blue`, semantic states (`success`, `warning`, `error`) each with faint + border variants, utility accents (`orange`, `yellow`, `purple`).
- `Spacing` — 8-step incremental scale (`xs:4` → `huge:48`).
- `Radius` — consistent corner radii (`sm:8` → `pill:100`).
- `Type` — named text styles (`screenTitle`, `cardTitle`, `meta`, `btnPrimary`, etc.).
- `Shadow` — `card` (elevation 4) and `medium` (elevation 6) presets.

**Rule:** All screens now import from `theme.ts`. Raw hex values in `StyleSheet` are forbidden.

---

### Skeleton Loaders
**`frontend/components/SkeletonLoader.tsx`** — new file.
- `DiscoverSkeleton`, `GamesSkeleton`, `ProfileStatsSkeleton`, `ChatSkeleton` — each matches the exact shape of its real content using `Animated` pulse loop.
- Replaces all `ActivityIndicator` loading states in the four tab screens.

---

### Auth Screens Polish
**`frontend/app/login.tsx`** — full visual redesign.
- Hero section (height 240): 16 faint rotated sport icons from `MaterialCommunityIcons` as background grid; 2 glow orbs; logo in rounded square with `accentBorder` + glow shadow; tagline row with accent dots.
- Form card as bottom sheet: `borderTopLeftRadius/RightRadius: Radius.xxl`, `flex:1`.
- `FocusInput` component: `Animated.Value` interpolates border from `Colors.border` → `Colors.accent` on focus; return-key chains email → password → submit.
- Sign In / Create Account buttons: pill shape (`Radius.pill`) + green glow shadow.

**`frontend/app/register.tsx`** — same `FocusInput` pattern; back button now a 36×36 `Colors.surface` circle.

---

### Tab Screens Redesign
**`frontend/app/(tabs)/_layout.tsx`**
- Tab bar: `backgroundColor: '#1C1C1E'`, `borderTopWidth:1`, `borderTopColor: '#2C2C2E'`, `height:62`. Inactive tint: `Colors.textMuted`.

**`frontend/app/(tabs)/discover.tsx`**
- `GameCard`: 3px sport-color accent bar (absolute left edge, `overflow:hidden`), photo at top, sport label in sport color, compact meta row, full-width pill Join button.
- `DiscoverSkeleton` replaces spinner.

**`frontend/app/(tabs)/games.tsx`**
- Game cards use same 3px accent bar pattern. `GamesSkeleton` replaces spinner.

**`frontend/app/(tabs)/chat.tsx`**
- `ChatSkeleton` replaces spinner. Unread rows: `Colors.text` + `fontWeight:'800'`.

**`frontend/app/(tabs)/profile.tsx`**
- Hero band: 3-orb design (layered blobs tinted by `top_sport` color). `ProfileStatsSkeleton` during load. Avatar picker uses `['images']` (not deprecated `MediaTypeOptions.Images`).

---

### Screen-by-Screen Polish
All screens migrated to `theme.ts` tokens. Specific additions per screen:

**`frontend/app/onboarding.tsx`**
- 4-segment progress bar (flex-fill segments, height 4) replaces dots. Pill buttons. Sport tile `aspectRatio:1.1`.

**`frontend/app/friends.tsx`**
- Friend rows: elevated cards (`Shadow.card`, `Radius.lg`) instead of flat dividers.
- Back button: 36×36 circle. "Find Players": pill shape. Search box: `borderWidth:1.5`.

**`frontend/app/game-chat.tsx`**
- Bubbles: `borderRadius:20`. Other-bubble: `borderWidth:1`. Input bar focus state. Send button: green glow when active. Empty state: 80×80 icon circle.

**`frontend/app/rate-players.tsx`**
- Done screen: 100×100 checkmark circle with `successFaint` bg + green glow. "View Results": pill + glow. "Back to My Games": ghost button. Submit: pill.

**`frontend/app/game-results.tsx`**
- Header: sport-color hero band with 2 orbs. Back button: 36×36 semi-transparent circle. Locked state: 80×80 lock icon circle + pill "Rate Players" with glow. Score bar height: 6px.

**`frontend/app/leaderboard.tsx`**
- Podium blocks and list rows: `Shadow.card`. Back button: 36×36 circle. "You" badge: `accentFaint/accentBorder`. Empty state: 80×80 icon circle.

**`frontend/app/player-profile.tsx`**
- Hero: 3-orb design. Back button: 36×36 `rgba(0,0,0,0.35)` circle. Avatar ring: `borderWidth:3.5`, `Shadow.medium`, `marginTop:-56`. Loading state: 76×76 circle + spinner.

**`frontend/app/court-detail.tsx`**
- Hero band: 2 sport-color orbs. Submit review: pill + green glow. Info/write/review cards: `Shadow.card`. Photos: 220×145.

**`frontend/app/direct-chat.tsx`**
- Bubbles: `Radius.pill`. Input: pill-shaped with `borderWidth:1.5`. Send button: green glow. Event cards: `Shadow.card`. Empty state: 80×80 icon circle.

---

### Bug Fix — Direct Chat Header Avatar
**`frontend/app/direct-chat.tsx`**
- `fetchAvatars([otherId])` now called at mount alongside the current user's own avatar fetch. Previously, the friend's avatar in the header was only populated if they appeared as a `sender_id` in the message list — meaning it was blank for new conversations or when only the current user had sent messages.

---

## [Sprint 10] — May 2026 — Discover Screen Joined-Game State

### "✓ Joined" Button State in Find Games

**Backend (`backend/routes/games.js`)**
- `GET /api/games` is now auth-optional: if a valid JWT is present in the `Authorization` header, the query adds `CAST(EXISTS(SELECT 1 FROM GameParticipants WHERE game_id = g.id AND user_id = ?) AS UNSIGNED) AS is_joined` to the SELECT. Unauthenticated requests are unaffected — `is_joined` falls back to `false` in `toMapGame()`.
- `jwt` imported at the top of `games.js`; token decoded with a silent try/catch so a missing or expired token never causes a 401 on this public endpoint.
- `toMapGame()` mapper passes through `is_joined` as a boolean.

**Frontend (`frontend/app/(tabs)/discover.tsx`)**
- `Game` type gains `is_joined?: boolean`.
- `GameCard` gains `isJoined` local state (initialized from `game.is_joined`). Button priority order: **"Your Game"** (host, muted) → **"✓ Joined"** (already joined, muted green) → **"Full"** (muted red) → **"Join Game"** (active).
- On successful join: `setIsJoined(true)` flips the button immediately; `handleJoined` in `DiscoverScreen` also sets `is_joined: true` on the game object so state survives re-renders.

---

## [Sprint 9] — May 2026 — Court Reviews, Player Matching, Auth Redesign, Unified Onboarding & Direct Messaging

### Court Detail Screen & Reviews
**Database (`backend/migrations/011_court_reviews.sql`)**
- New `CourtReviews` table: `(id, place_id VARCHAR 200, user_id FK, rating TINYINT 1-5, comment VARCHAR 500, created_at)`. Unique on `(place_id, user_id)` — one review per user per court. FK → `Users(id) ON DELETE CASCADE`.

**Backend (`backend/routes/courts.js`)** — refactored + extended
- Moved `/nearby` handler from `server.js` into `routes/courts.js` (detectSportType, classifyVenueType, MOCK_COURTS).
- `GET /photo?ref=<photoRef>` — server-side proxy for Google Places photos; keeps API key hidden; streams response with 24h cache header.
- `GET /:placeId` — aggregates Google Places Details (name, address, phone, open_now, weekday_hours, photo_refs) + SportLink stats (`review_count`, `avg_rating`) + last 20 reviews. Graceful fallback if no API key or mock place_id.
- `GET /:placeId/reviews` — full reviews list with user avatars.
- `POST /:placeId/reviews` — upsert review via `INSERT … ON DUPLICATE KEY UPDATE`.
- `DELETE /:placeId/reviews/:reviewId` — delete own review (guards `user_id = caller`).

**Frontend (`frontend/app/court-detail.tsx`)** — new screen
- Route params: `{ placeId, name?, sport?, vicinity? }`.
- Hero band (sport color), horizontal Google Places photo strip, info card (open/closed indicator, address, phone, Google rating, collapsible opening hours).
- Community Reviews section: aggregate avg + star display.
- Write/edit review inline: tap stars + optional comment TextInput + Submit.
- Reviews FlatList with delete-own capability. `KeyboardAvoidingView` wraps comment input.

**Frontend (`frontend/app/(tabs)/index.tsx`)**
- Court bottom card changed from static "Public Court" label to a **"View Details"** `TouchableOpacity` → navigates to `court-detail` with `{ placeId, name, sport, vicinity }`.

---

### Bug Fix — Game Results Duplicate Rows
**Backend (`backend/routes/ratings.js`)**
- `GET /api/ratings/game/:gameId/results`: Fixed SQL `GROUP BY` including `r.attended` which caused one row per (user, attended-value) when a host had rated. Fix: `MAX(r.attended) AS attended`, removed `r.attended` from `GROUP BY`, scoped the `Ratings` LEFT JOIN with `AND r.rater_id = ?` (host_id). `ORDER BY MAX(r.attended) DESC, u.username ASC`.

---

### Auth Screens Redesign + Google OAuth Infrastructure
**Database (`backend/migrations/012_google_auth.sql`)**
- `ALTER TABLE Users ADD COLUMN google_id VARCHAR(100) NULL` + unique index.
- `ALTER TABLE Users MODIFY COLUMN password_hash VARCHAR(255) NULL` (allows Google-only accounts).

**Backend (`backend/routes/auth.js`)**
- `POST /api/auth/login` — now detects Google-only accounts (no `password_hash`) and returns a friendly error.
- `POST /api/auth/google` — exchanges auth code for tokens via Google OAuth2, fetches profile, creates or links user. Derives clean username from Google name with uniqueness suffix loop.

**Frontend (`frontend/app/login.tsx`)** — full rewrite
- Dark themed card with background accent circles, logo section, Google button (shows orange "Soon" badge, fires Alert), email/password inputs, show/hide password toggle.

**Frontend (`frontend/app/register.tsx`)** — simplified to single step
- Account creation only (username + email + password + Google "Coming Soon" button).
- On success: `login()` + `router.replace('/onboarding')`. All profile setup moved to unified onboarding.

**`frontend/app.json`**
- `slug`: `"frontend"` → `"sportlink"`, `scheme`: `"frontend"` → `"sportlink"`, `bundleIdentifier`: → `"com.am1its.sportlink"`.

---

### Unified Onboarding Flow
**Frontend (`frontend/app/onboarding.tsx`)** — complete rewrite
- **4-step wizard** replacing the previous 3-step (which lacked per-sport skill levels and didn't save preferences):
  1. **Photo** — avatar picker, skippable.
  2. **Bio** — 120-char multi-line text area, skippable.
  3. **Sports** — 3×3 grid of all 9 sports (multi-select, must pick ≥1 to advance).
  4. **Levels** — one row per selected sport: 5-dot skill selector (defaults to 3/Intermediate) + heart favorite toggle + level name label.
- On finish: `PUT /api/users/me` (avatar, bio, `onboarding_complete: true`) + `PUT /api/users/sport-preferences` (per-sport skill_level + is_favorite) → `setOnboardingComplete()` → `/(tabs)`.
- Sport preferences state persists if user navigates back to modify sport selection.

---

### Player Matching
**Backend (`backend/routes/users.js`)**
- `GET /api/users/suggestions?sport=&lat=&lng=` — registered before `/:id` to avoid shadowing. Returns `{ suggestions: [{ id, username, avatar, karma, top_sport, shared_count, shared_sports[] }] }`.
  - If user has sport preferences: `INNER JOIN SportPreferences` to find matching sports, optional sport and location (Haversine) filters, excludes self + existing friends.
  - Fallback (no preferences): karma-ranked non-friends list.

**Frontend (`frontend/app/player-matching.tsx`)** — new screen
- `useFocusEffect` + `Location.requestForegroundPermissionsAsync` for location-based matching.
- Horizontal sport filter chips. FlatList of player cards (avatar, sport badge, colored karma, shared sport chips, Add Friend button).
- Optimistic `pendingIds` Set for sent friend requests. Empty state with "Set Sport Preferences" button.

**Frontend (`frontend/app/(tabs)/profile.tsx`)**
- Added "Discover Players" menu item (magnet icon, green) in Community section.

---

### Direct Messaging with Event Sharing
**Database (`backend/migrations/013_direct_messages.sql`)**
- New `DirectMessages` table: `(id, sender_id FK, receiver_id FK, content TEXT NULL, type ENUM(text/event) DEFAULT text, event_id INT NULL FK → Games ON DELETE SET NULL, is_read BOOL DEFAULT FALSE, created_at)`. Indexed on `sender_id` and `receiver_id`.

**Backend (`backend/routes/dm.js`)** — new route file
- `GET /api/dm/` — conversation list with last message + unread count per conversation (uses `MAX(id)` pattern for last message, per-viewer unread subquery).
- `GET /api/dm/:userId` — messages history (up to 100, ASC). Auto-marks received messages as read. Includes joined game details (`game_title`, `game_sport`, `game_time`, `game_location`, `game_max_players`, `game_current_players`, `game_joined`, `game_is_host`) from **caller's perspective**.
- `POST /api/dm/:userId` — send text or event message. Validates content/event_id per type. Fetches message from sender's perspective for REST response; fetches again from receiver's perspective for socket emission (correct join/host state for each party). Emits `new_dm` to `user_${receiverId}` room.
- `PUT /api/dm/:userId/read` — mark all messages from that user as read.

**Backend (`backend/server.js`)**
- `app.set('io', io)` — exposes io instance to route handlers.
- Registered `/api/dm` route.
- Socket.io `connection` handler: `socket.join(`user_${socket.user.id}`)` — every user joins their personal room on connect.

**Frontend (`frontend/app/(tabs)/chat.tsx`)** — Events + Friends tabs
- Added `tab` state (`'events' | 'friends'`). Tab switcher bar: green pill highlights active tab; Friends tab shows red unread badge when total unread > 0.
- Events tab: existing game chats list (unchanged).
- Friends tab: DM conversations FlatList. Each item: avatar + username + last message preview (handles event-type messages: "Shared a game event") + timestamp + unread count badge. Unread dot positioned outside `overflow:hidden` via wrapper `View`.
- Both lists fetched in parallel via `Promise.all` in `useFocusEffect`.

**Frontend (`frontend/app/direct-chat.tsx`)** — new screen
- Route params: `{ userId, username }`.
- Real-time socket.io: listens for `new_dm` events filtered to this conversation; auto-marks read on arrival.
- Renders text bubbles and **event cards**: sport icon + title + time + location + player count + contextual action ("Join" button / "✓ Joined" / "You host" / "Ended" / "Full").
- "Join" button calls `POST /api/games/:id/join` and updates all matching messages optimistically.
- `+` button opens a bottom-sheet Modal listing user's upcoming active games (fetched lazily from `/api/games/mine`, cached for session). Selecting a game sends an `event`-type DM.
- Header taps → `player-profile`. Non-own avatars tappable → `player-profile`.

**Frontend (`frontend/app/player-profile.tsx`)**
- Friend button now lives in an `actionRow` (horizontal) paired with a **Message button** (chat-bubble icon, 52×52, dark bg) that navigates to `/direct-chat`. Hidden for own profile.

**Frontend (`frontend/app/game-chat.tsx`)**
- Fixed: "other user" avatar was a plain `View` — now uses the same tappable `avatarCircle` as own-message avatars, navigating to `player-profile`.

**Frontend (`frontend/app/_layout.tsx`)**
- Registered `<Stack.Screen name="direct-chat" />` and `<Stack.Screen name="player-matching" />`.

---

## [Sprint 8] — May 2026 — Sport Preferences, Profile Redesign & Game Results

### Sport Preferences System
**Database**
- New `SportPreferences` table: `(id, user_id, sport_type VARCHAR(50), skill_level TINYINT 1-5, is_favorite BOOLEAN DEFAULT FALSE, created_at)`. Unique on `(user_id, sport_type)`. FK → `Users(id) ON DELETE CASCADE`.

**Backend (`backend/routes/users.js`)**
- `GET /api/users/me` — now returns `top_sport` (most-played sport from game history) and `sport_preferences` (array of `{ sport_type, skill_level, is_favorite }`).
- `GET /api/users/:id` — same additions for public profiles.
- `GET /api/users/sport-preferences` — returns current user's full preferences array.
- `PUT /api/users/sport-preferences` — accepts `{ preferences: [{ sport_type, skill_level, is_favorite }] }`; replaces all existing rows in a single transaction (DELETE all + batch INSERT). Route registered before `/:id` to avoid shadowing.

**Frontend (`frontend/app/sport-preferences.tsx`)** — full rewrite
- All 9 sports displayed with per-sport cards.
- Per-sport: enable/disable toggle + 5-dot skill selector (tap any dot to set level 1-5; dots filled with sport color up to selected level) + heart icon for favorite.
- Tapping a skill dot automatically enables the sport.
- Loads saved preferences on focus via `GET /api/users/sport-preferences`; saves via `PUT`.

---

### Profile & Player-Profile Redesign

**Frontend (`frontend/app/(tabs)/profile.tsx`)**
- **Hero band**: full-width 140px colored band (avatar's deterministic color + opacity) with two decorative translucent circles.
- **Overlapping avatar**: avatar section uses `marginTop: -52` to overlap the hero band, giving a visual depth effect. Avatar ring border uses the same color.
- **Horizontal stats bar**: replaced 2×2 grid with a single row of 4 stats (Games / Hosted / Joined / Karma) separated by dividers.
- **Sport chips section**: horizontal `ScrollView` showing only enabled sport preferences — each chip displays the sport icon, name, skill level pill, and a red heart for favorites.
- "Edit" link navigates to `/sport-preferences` for managing preferences.
- `handleSave` uses `setStats(prev => ({ ...prev, ...data.user }))` to preserve `sport_preferences` in state (PUT /me doesn't return them).
- Fixed `UnauthorizedError` instanceof issue: removed import, changed catch to `err?.name !== 'UnauthorizedError'` check.

**Frontend (`frontend/app/player-profile.tsx`)**
- Same hero band pattern (130px) with `marginTop: -52` overlapping avatar.
- Back button positioned absolute in hero area.
- Sport badge overlay on avatar (bottom-right corner): shows `top_sport` icon.
- Horizontal 4-stat bar (same layout as own profile).
- Sport chips section (same horizontal scroll pattern).
- Friend button and all existing functionality preserved.

---

### Game Results Screen
**Backend (`backend/routes/ratings.js`)**
- `GET /api/ratings/game/:gameId/results` — **registered before `/game/:gameId`** to avoid route shadowing.
  - `can_view` gate: host must have submitted attendance for all participants; non-host must have submitted peer ratings for all others (host + participants).
  - Returns `{ can_view, results }` where results = per-player aggregate: `{ id, username, avatar, attended, peer_count, sportsmanship_pct, punctuality_pct, communication_pct, skill_avg }`.
  - All data is anonymous — no per-rater attribution in the response.

**Frontend (`frontend/app/game-results.tsx`)** — new screen
- Route params: `{ gameId, title?, sport?, scheduledTime? }`.
- **Locked state** (`can_view: false`): lock icon + "Results Locked" message + "Rate Players" button (navigates to `rate-players` via `router.replace`).
- **Results view** (`can_view: true`): FlatList of player cards showing:
  - Attended badge (green "Showed Up" / red "No-Show") from host's attendance rating.
  - Horizontal score bars for Sportsmanship, Punctuality, Communication — bar color: green ≥70% / orange ≥40% / red <40%.
  - 5-star skill display with numeric average.
  - "Based on N ratings" footnote per player.
  - "Scores are aggregated — individual votes are anonymous" note at top.

**Frontend (`frontend/app/(tabs)/games.tsx`)**
- Past completed games now show a gold **"Results"** button (`status='completed'` only) navigating to `game-results`.
- Non-host past games with `status='completed'` show both "Rate Players" and "Results" in the action row.

**Frontend (`frontend/app/rate-players.tsx`)**
- Post-submit done state: primary **"View Results"** button → `router.replace` to `game-results`.
- Secondary **"Back to My Games"** text link (gray, no background).
- "Already rated everyone" empty state shows the same two buttons.

---

### Button Styling Fix (`games.tsx`)
- Leave, Chat, and Players buttons all normalised to `height: 32, paddingHorizontal: 10, fontSize: 12, icon size: 12` so all three fit on one row without overflow.
- "Leave Game" label shortened to "Leave".
- Removed `flex: 1` from `leaveBtn` (was stretching to fill remaining row width).

---

## [Sprint 7] — May 2026 — Feature Completion: Real-Time Chat, Notification Inbox, Game Photos, Radius Search & Profile Friend Button

### WebSocket Chat (socket.io)
**Backend (`backend/server.js`)**
- Replaced `app.listen()` with `http.createServer(app)` + `socket.io` v4 `IOServer`.
- Socket auth middleware: extracts `token` from `socket.handshake.auth`, verifies with `jwt.verify` — unauthenticated connections are rejected.
- `join_game` event: client joins a socket.io room `game_<id>` after verifying membership via DB.
- `send_message` event: validates content length (≤1000 chars), saves to `Messages`, fetches the new row, and emits `new_message` to the entire room.
- CORS set to `{ origin: '*' }` for Expo Go compatibility.

**Frontend (`frontend/app/game-chat.tsx`)**
- Installed `socket.io-client` v4 via `npx expo install`.
- Replaced 3-second `setInterval` polling with a persistent socket connection on screen mount.
- On mount: connect to `API_BASE` with `{ auth: { token } }`, emit `join_game`, register `new_message` listener.
- Deduplication guard: checks `prev.some(m => m.id === msg.id)` before appending to prevent duplicates on reconnect.
- `sendMessage` now emits `send_message` via socket; falls back to REST `POST /api/chats/:id/messages` when socket is disconnected.
- Cleanup: `socket.disconnect()` on unmount.
- `API_BASE` imported from `../constants/api` for consistent socket URL.

---

### In-App Notification Inbox
**Database**
- New `Notifications` table: `(id INT PK, user_id INT FK, title VARCHAR(200), body TEXT, data JSON, is_read BOOL DEFAULT FALSE, created_at TIMESTAMP)`. Index on `user_id`. FK to `Users` with `ON DELETE CASCADE`.

**Backend (`backend/utils/sendPushNotification.js`)**
- Extended to also persist each notification to the `Notifications` table.
- Bulk-fetches `user_id` for all push tokens in one query (`SELECT id, push_token FROM Users WHERE push_token IN (...)`).
- Batch-inserts `(user_id, title, body, data)` rows via a single `INSERT INTO Notifications ... VALUES ...`.
- DB errors are caught and logged without interrupting the push send.

**Backend (`backend/routes/notifications.js`)** — new route file
- `GET /api/notifications` — returns last 50 notifications for current user (DESC), plus `unread_count`.
- `PUT /api/notifications/:id/read` — marks a single notification read (guards `user_id = caller`).
- `PUT /api/notifications/read-all` — marks all unread notifications read for current user.

**Backend (`backend/server.js`)**
- Registered `/api/notifications` route.

**Frontend (`frontend/app/notification-inbox.tsx`)** — new screen
- Lists notifications with unread green dot, title, body, and relative time (`timeAgo` helper).
- Unread rows have a subtle green tint background.
- Tapping a row calls `PUT /:id/read` and clears the dot optimistically.
- "Mark all read" button in header (only shown when `unread_count > 0`); fires `PUT /read-all`.
- Empty state: bell outline icon + "No notifications yet".

**Frontend (`frontend/app/(tabs)/profile.tsx`)**
- `fetchUnread()` called on screen focus via `useFocusEffect`; sets `unreadNotifs` state.
- "Notifications" menu item now navigates to `/notification-inbox` and shows a red badge pill when `unreadNotifs > 0`.
- Separate "Notification Settings" menu item kept below it (navigates to `/notifications-settings`).

---

### Game Photo
**Database**
- `ALTER TABLE Games ADD COLUMN photo MEDIUMTEXT NULL AFTER equipment_notes`.

**Backend (`backend/routes/games.js`)**
- `toMapGame()` now includes `photo: row.photo ?? null` in the response shape.
- `POST /api/games` — accepts `photo` (base64 string) in body; inserts into new column.
- `PUT /api/games/:id` — accepts `photo`; merges with existing value using same pattern as other optional fields.

**Frontend (`frontend/app/modal.tsx`)**
- Installed `expo-image-picker` (already available in Expo SDK).
- `pickPhoto()` helper: requests media library permission, launches picker with `aspect: [16, 9]`, `quality: 0.6`, `base64: true`.
- Photo state initialised from `params.existingPhoto` for edit mode.
- Photo section rendered above Invite Friends: shows 16:9 preview with an overlay remove button, or a dashed camera placeholder button when empty.
- `photo` included in POST/PUT body.

**Frontend (`frontend/app/(tabs)/discover.tsx`)**
- `Game` type extended with `photo: string | null`.
- `GameCard`: renders `<Image>` at 160px height with `borderRadius: 12` above the equipment row when `game.photo` is present.
- `Image` added to React Native imports.

**Frontend (`frontend/app/(tabs)/games.tsx`)**
- `Game` type extended with `photo: string | null`.
- `onEdit` router push includes `existingPhoto: item.photo ?? ''` param.

---

### Radius-Based Game Search
**Backend (`backend/routes/games.js`)**
- `GET /api/games` now accepts optional `?lat=&lng=&radius_km=` query params.
- When all three are present, adds a Haversine `distance_km` expression to the `SELECT` clause (3 bound params: `lat`, `lng`, `lat`) and filters with `HAVING distance_km <= ?` (1 more param: `radius_km`).
- Non-radius requests are unchanged (no extra params passed).

**Frontend (`frontend/app/(tabs)/discover.tsx`)**
- `expo-location` already installed; imported `* as Location`.
- `RADIUS_OPTIONS` constant: `[Any, 1 km, 5 km, 10 km, 20 km]`.
- `radiusKm` state (`number | null`, default `null`).
- `userLocation` ref caches the GPS result across re-fetches; cleared when a new radius chip is selected to force a fresh location fix.
- `fetchGames` requests `Location.requestForegroundPermissionsAsync()` then `getCurrentPositionAsync()` only when a km option is active and no cached location exists; appends `lat/lng/radius_km` to the URL.
- Second horizontal `ScrollView` of radius chips rendered below the sport chips; active chip uses a blue (`#4F9EFF`) color scheme distinct from the green sport chips.

---

### Player-Profile Friend Button
**Backend (`backend/routes/users.js`)**
- `GET /api/users/:id` now queries the `Friends` table for a row matching either `(viewer→target)` or `(target→viewer)`.
- Returns `friendship_status: 'none' | 'pending_sent' | 'pending_received' | 'friends'` and `friendship_id: number | null` in the user object.

**Frontend (`frontend/app/player-profile.tsx`)**
- `PublicUser` type extended with `friendship_status` and `friendship_id`.
- `handleFriendAction()` async handler:
  - `none` → `POST /api/friends` → sets state to `pending_sent`.
  - `pending_received` → `PUT /api/friends/:id/accept` → sets state to `friends`.
  - `friends` / `pending_sent` → confirms via `Alert`, then `DELETE /api/friends/:id` → sets state to `none`.
- Friend button rendered below stats (hidden for own profile via `!isMe`):
  - **Add Friend** — green background, dark text.
  - **Request Sent** — muted background, grey text + clock icon.
  - **Accept Request** — blue background, white text + checkmark icon.
  - **Remove Friend** — muted background, red destructive text.
- Loading spinner replaces content during API call.

---

### Auth — Token Expiry Extended
**Backend (`backend/routes/auth.js`)**
- JWT `expiresIn` changed from `'7d'` to `'90d'` — eliminates frequent forced logouts.

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
