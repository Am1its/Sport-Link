# SportLink — Full Project Audit & Improvement Spec

**Status update (2026-07-02, same day):** Batch 1 (all of section 8's backend bug batch — B1, B2, B3, B4, B5, B6, B11, B15) implemented, syntax-checked, and verified against a local MySQL instance with end-to-end request tests. Details in each item below marked `[DONE]`. Batches 2-5 not started.

**Date:** 2026-07-02
**Scope:** Full read of `backend/` (all routes, crons, sockets, utils), `frontend/` (all tabs, key screens, components, hooks, utils), `docs/` (business strategy, product definitions, prior code reviews), memory & CLAUDE.md.
**Method:** Read-only. No code changed. Cross-checked against `docs/CODE_REVIEW_FINDINGS.md` (2026-06-26) so already-fixed items are not repeated; deferred items from that review are re-listed only where still relevant.

Ordering inside each section = highest impact first. Each finding has a **Fix** direction so implementation can start immediately after approval.

---

## 1. 🔴 Bugs — confirmed, worth fixing soon

### B1. Notifications `unread_count` is always `null` (broken destructuring) `[DONE]`
**File:** `backend/routes/notifications.js:11-24`

```js
const [[{ unread_count }], [rows]] = await Promise.all([pool.execute(...), pool.execute(...)]);
```

`pool.execute()` resolves to `[rowsArray, fields]`. The pattern `[{ unread_count }]` therefore destructures `{ unread_count }` from the **rows array itself** (an Array has no `unread_count` property) → `undefined` → `Number(undefined)` = `NaN` → serialized as `null` in JSON. The correct pattern needs one more level: `[[[{ unread_count }]], [[rows]]]` — or simpler, two awaited calls.

**Impact:** `profile.tsx` (`setUnreadNotifs(data.unread_count)`) — the red unread badge on the Notifications menu item **never shows**. (The DM unread badge on the Chat tab is computed separately and works.)
**Fix:** Destructure correctly, e.g.:
```js
const [countRes, listRes] = await Promise.all([...]);
const unread_count = countRes[0][0].unread_count;
const rows = listRes[0];
```

### B2. DM history returns the **oldest** 100 messages, not the newest `[DONE]`
**File:** `backend/routes/dm.js:92-111` — `GET /:userId` uses `ORDER BY dm.created_at ASC LIMIT 100`.

Once a conversation passes 100 messages, the endpoint keeps returning the first 100 ever sent; new messages never appear on screen (except live socket ones, which vanish on reload). Latent time bomb for any active friendship.

**Fix:** `ORDER BY dm.id DESC LIMIT 100`, then `messages.reverse()` before responding. Longer-term: add `?before=` pagination like game chat already has, and switch `direct-chat.tsx` from `ScrollView` to an inverted `FlatList` (game-chat.tsx is the template).

### B3. `ISRAEL_NOW_SQL` hardcodes `+03:00` — 1 hour wrong all winter `[DONE]`
**File:** `backend/utils/israelTime.js:12` — `CONVERT_TZ(NOW(), '+00:00', '+03:00')`.

The June timezone fix (H1) is only half-DST-correct: `parseIsraelTime()` (Node side) handles IDT/IST properly via `Intl`, but the SQL constant is a fixed summer offset. From ~late Oct to ~late Mar (IST, UTC+2), every SQL comparison drifts +1h: games listing cutoff (`crud.js:76`), reminders window (`reminders.js:24-25`), auto-complete (`autoComplete.js:25`), discover date filters.

**Fix:** `CONVERT_TZ(NOW(), 'UTC', 'Asia/Jerusalem')` — named zones handle DST. Verify Railway MySQL has the tz tables loaded (`SELECT CONVERT_TZ(NOW(),'UTC','Asia/Jerusalem')` returns non-NULL); if not, load `mysql_tzinfo_to_sql` or fall back to computing "now in Israel" in Node with `Intl` and passing it as a bind parameter.

### B4. Game **edit** still validates `scheduled_time` with `new Date()` (H1 leftover) `[DONE]`
**File:** `backend/routes/games/crud.js:293-297` (`PUT /:id`)

`POST /` was fixed to use `parseIsraelTime`, but `PUT /:id` still does `new Date(scheduled_time)` — on Railway (UTC) an Israel-local string parses 2–3h late, so a host can reschedule a game into the recent past (or get a false rejection near the boundary).

**Fix:** copy the POST pattern: `const parsed = parseIsraelTime(scheduled_time); if (parsed && parsed <= new Date()) → 400`.

### B5. In-app notifications are silently dropped for users without a push token `[DONE]`
**File:** `backend/utils/sendPushNotification.js:9` — `messages.filter(m => m.to && m.to.startsWith('ExponentPushToken['))` runs **before** the DB persist, and every caller builds its recipient list from `WHERE push_token IS NOT NULL`.

Anyone who declined push permission (or runs in a simulator/Expo Go) gets **nothing in the in-app notification inbox** — joins, friend requests, cancellations all vanish for them, even though the inbox exists precisely to cover that case.

**Fix:** decouple the two channels. Change the helper signature to accept `user_id` per message (callers already query Users anyway), always `INSERT INTO Notifications`, and only send to Expo for entries with a valid token. This also removes the fragile token→user reverse lookup.

### B6. Participant counts still inconsistent in 3 endpoints (M1 leftovers) `[DONE]`
The June fix standardized `participant_count` in `games/` routes, but three places still count waitlisted rows and mishandle the host slot:

| File | Problem |
|---|---|
| `backend/server.js:86` (`/game/:id` landing page) | `COUNT(gp.user_id)` includes waitlist; shown as `count + 1 / max` on the public share page |
| `backend/routes/share.js:86,96-97` (`/share/game/:id`) | `COUNT(*)` includes waitlist; `spots = max_players - current_players` ignores the host slot (off by one vs. join logic `count >= max_players - 1`) and renders `NaN spots left` when `max_players` is NULL |
| `backend/routes/dm.js:21,102` (`game_current_players` on event cards) | `COUNT(*)` includes waitlist; frontend `EventCard` (`direct-chat.tsx:456`) then applies yet another convention (`current >= max`, no host slot, no +1) so the same game shows different numbers in DM vs Discover |

**Fix:** use the rule-26 `COUNT(CASE WHEN COALESCE(status,'joined')='joined' ...)` everywhere; define one convention (host occupies slot 1, display = participants+1, full = participants ≥ max−1) and apply it in all three; guard `max_players IS NULL` in share.js.

### B7. Waitlist is unreachable from the Map (dead-end "Full" button)
**Files:** `frontend/app/(tabs)/index.tsx:227-230` (BottomCard) vs `frontend/components/GameCard.tsx:242-252`.

Discover's GameCard correctly offers **"Join Waitlist"** when full; the map's BottomCard renders a dead "Full" label. Same backend, same game — inconsistent affordance on the primary discovery surface.

**Fix:** port the GameCard full-state branch to BottomCard (button → `POST /join` → handle `data.waitlisted` → "On Waitlist #N" state).

### B8. Joining a full game from a DM event card fakes success
**File:** `frontend/app/direct-chat.tsx:231-242` — `handleJoinGame` ignores `data.waitlisted` and marks the card `game_joined: 1` + increments the count. A waitlisted user sees "✓ Joined" and an inflated count.

**Fix:** check `data.waitlisted` and show a waitlist alert/state like GameCard does.

### B9. Reverse geocoding may be dead (Geocoding API vs. rule 14) — **verify**
**File:** `backend/routes/geocode.js:16` uses `maps/api/geocode/json` for `?reverse=1` (neighborhood autofill in the create-game modal). CLAUDE.md rule 14 states only the **Places API** is enabled on the Railway key. If that's still true, reverse geocoding returns `REQUEST_DENIED` and the modal's neighborhood field silently never autofills.

**Fix:** confirm with one curl against the production key. Either enable Geocoding API on the key, or reimplement reverse lookup via Places Nearby Search, or update rule 14 if the key was already extended.

### B10. Profile stats over/under-count
**File:** `backend/routes/users.js:25-36` (`fetchUser`)
- `games_joined` = `COUNT(*) FROM GameParticipants` — includes **waitlisted** rows and games that were **cancelled**.
- `games_hosted` includes cancelled games.
- `top_sport` only looks at `GameParticipants` — a user who mostly **hosts** basketball shows no top sport (and profile hero color falls back), while `users/suggestions` computes it from hosted+joined.

**Fix:** add `status='joined'` + join on `Games.status != 'cancelled'` for counts; reuse the hosted+joined UNION (already written in suggestions) for `top_sport`.

### B11. Ratings timing/eligibility gaps `[DONE]`
**File:** `backend/routes/ratings.js`
- `POST /batch` and `POST /peer` don't check `Games.status` — attendance/peer ratings can be submitted while a game is still `active` (or long before it happens), enabling pre-game karma farming with invited friends.
- Waitlisted users count as participants: they can peer-rate and be rated (`SELECT ... FROM GameParticipants` without `status='joined'`).

**Fix:** require `status='completed'` for both POST endpoints; filter participant sets to `status='joined'`.

### B12. Game-chat half-features (dead code)
**File:** `frontend/app/game-chat.tsx`
- The typing indicator (`useTypingIndicator`, lines 251-257) can never appear — no socket listener registers for typing in game chats (only DM_TYPING exists, and only DMs emit it).
- `AsyncStorage.setItem('chat_last_read_${id}', ...)` (lines 139, 149) is **written but never read** — the Events tab has no unread indicator at all, while the Friends tab does.

**Fix:** either finish both (add a `game_typing` socket event; compare `last_message_at` vs stored `chat_last_read` in `chat.tsx` to bold unread event chats — cheap, no backend change needed for the unread part) or delete the dead writes. Recommended: finish the unread badge (high perceived value), drop or complete typing.

### B13. Fragile non-ISO date parsing on the frontend
**Files:** `frontend/utils/time.ts:34` (`isPastGame`), `frontend/app/(tabs)/map/useMapData.ts:16` (`isPast`) — both call `new Date('YYYY-MM-DD HH:MM')`, a non-ISO format whose parsing is engine-dependent; meanwhile `games.tsx:30` and `direct-chat.tsx:205-210` parse the same strings two other ways.

**Fix:** one `parseGameTime(str): Date | null` in `utils/time.ts` (split-and-construct like direct-chat does — always valid, device-local) and use it in all four places. Also removes the duplicated `isPast`/`isPastGame` pair.

### B14. Socket `DM_TYPING` bypasses blocks
**File:** `backend/sockets/index.js:57-62` — a blocked user can't send DMs (fixed in June) but can still make the "•••" typing bubble appear on the blocker's open chat screen by emitting typing events.

**Fix:** add the mutual-block check (or at least a friendship/conversation check) before forwarding; cache per socket to avoid a query per keystroke.

### B15. Registration input validation is minimal `[DONE]`
**File:** `backend/routes/auth.js:13-32` — no email format check, no password minimum length (a 1-char password is accepted), no username length/charset check (client caps at 30, API doesn't). `PUT /users/me` has the same username gap.

**Fix:** small validator: email regex, password ≥ 8, username 3–30 chars `[a-zA-Z0-9_.]`. Return field-specific messages (the register screen already has shake + error sound plumbing).

---

## 2. 🟠 Performance & payload

### P1. `GET /api/games` ships full base64 photos, client throws them away
`toMapGame` includes `photo` and `post_game_photo`; the map (`useMapData.ts:76-79`) **strips them after download**. With a handful of photo games, every map focus re-downloads megabytes over cellular just to discard them. Discover does use photos, but full-resolution base64-in-JSON for a list is still heavy.

**Fix (staged):**
1. Quick: `?include_photos=0` (or a `fields` param) on `GET /games`; map passes it, discover keeps photos. Pure SQL column selection, no schema change.
2. Later: move photos out of the row — `GET /api/games/:id/photo` streamed with cache headers (same pattern as the existing courts photo proxy), store thumbnails, or object storage. Same story applies to avatars (B/P2).

### P2. Avatars as base64 blobs in list endpoints
Leaderboard, friends, participants, DM conversations, reviews, activity — each row carries a full base64 avatar. The avatar-cache endpoint (`/users/avatars`) exists but only chats use it, and it has **no cap on the number of ids** requested.

**Fix:** cap `ids` (e.g. 50) server-side; medium-term serve avatars via `GET /api/users/:id/avatar` with `Cache-Control` and drop them from list SQL.

### P3. Leaderboard/karma full-table scan
`KARMA_SQL` runs two correlated subqueries per user across **all Users** on every leaderboard request. Fine now; will not scale.

**Fix (later):** maintain a `karma` column updated on rating insert, or cache the leaderboard for N minutes in memory.

### P4. Discover double-fetches on entry
`discover.tsx` — the debounce `useEffect` (line 159) fires 400ms after mount *and* `useFocusEffect` (line 164) fires immediately → two identical requests per screen entry.

**Fix:** skip the debounce effect on first render (ref flag), or drop the focus-effect fetch and let the debounce own it.

### P5. Expo push receipts ignored (deferred L5, still open)
Dead/rotated tokens accumulate; Expo eventually throttles senders who keep pushing to `DeviceNotRegistered` tokens.

**Fix:** parse the ticket response in `sendPushNotification.js`; on `DeviceNotRegistered`, `UPDATE Users SET push_token = NULL`.

---

## 3. 🟡 Product-integrity / security posture

- **S1. Blocks don't cover games.** A blocked user can still see the blocker's games on the map **detail** (`GET /games/:id` has no block filter — the list does), join them, appear in participants, and share the game chat. Decide the contract: if "mutual invisibility across all features" is the promise, add the block filter to `GET /games/:id` and a check in `POST /:id/join`.
- **S2. Court claims are honor-system.** Anyone can claim any court instantly and start posting official-looking announcements + review responses. Fine for a demo; before launch add at least a manual-approval flag (`status='pending'` + you flipping it) — one column + one WHERE clause.
- **S3. Reports go into a table nobody reads.** No admin surface, no notification. Cheapest viable: a daily cron that emails/pushes you new report counts, or a `GET /api/admin/reports` behind an `is_admin` column.
- **S4. JWTs live 90 days with no revocation** — logout is client-side only; a leaked token works for 3 months even after password change. Standard fix: `token_version` column checked in authMiddleware, bump on password change/logout-all. Low urgency pre-launch, cheap to do.
- **S5. Google auth username generation race** (`auth.js:97-101`) — the check-then-insert loop can collide under concurrency; wrap the INSERT in a retry-on-`ER_DUP_ENTRY` instead.

---

## 4. 🚨 Pre-launch blockers (App Store reality check)

1. **In-app account deletion is missing — Apple will reject.** App Review Guideline 5.1.1(v) requires apps with account creation to offer **in-app** account deletion. The privacy policy says "contact us to delete" — that alone fails review. Needed: `DELETE /api/users/me` (FKs already cascade for most tables; add explicit deletes for Games/Messages or anonymize), plus a "Delete Account" row with a confirm dialog in profile → Account.
2. **`expo-av` is deprecated** (SDK 54 is its last release; removed in SDK 55). The sound system (`useSounds.ts`) is the only consumer. Migrate to `expo-audio` (`createAudioPlayer`) — small, contained change, better done before the SDK 55 upgrade forces it.
3. **`apple-itunes-app` meta tags still say `app-id=PLACEHOLDER`** (`server.js:170,259`) — harmless now, must be filled once the App Store ID exists (smart banner won't render otherwise).
4. **Two divergent game landing pages**: `server.js GET /game/:id` (used by GameCard share) and `share.js GET /share/game/:id` — different HTML, different count bugs (B6). Consolidate on one and 301 the other.
5. **DB backups** still manual (known deferral) — worth a weekly `mysqldump` GitHub Action or cron on Railway before real users, not after.

---

## 5. 💡 Feature opportunities (ranked by leverage)

### F1. Close the loop on the "Dynamic Skill" system — the data already exists
`BUSINESS_STRATEGY.md` sells this as the core trust mechanic: *"If a user claims to be a '5' but the community rates them a '2', their profile dynamically adjusts."* Today `PeerRatings.skill` (1–5) is collected on every rating flow and then **used for nothing** except the per-game results screen.
**Spec:** compute `community_skill = AVG(pr.skill)` per user (optionally per top sport, min 3 ratings); show it next to the self-reported level on profile/player-profile ("Self: 4 · Community: 3.2 ⭐"); optionally feed it into Discover's skill-proximity sort instead of the self-reported `SportPreferences.skill_level`. Backend: one query; frontend: one chip. Highest story-per-effort ratio in the backlog.

### F2. Karma consequences ("ghost gating")
Business doc promises ghosting "eventually restricts joining high-demand games" — karma is currently cosmetic. **Spec:** if karma < threshold (e.g. −5), block joining games in their final N hours (`POST /join` check + friendly error), or show a "reliability" tier on join requests. Even a soft version (host sees joiner's attendance rate) adds real trust value.

### F3. Events-tab unread badges (finish B12)
Client-only: compare `last_message_at` with the stored `chat_last_read_${id}`; bold row + count chip like the Friends tab. Big perceived polish for ~30 lines.

### F4. Notify participants when a game is edited
`PUT /games/:id` changes time/location silently — participants find out when they show up at the wrong court. **Spec:** on edit, diff `scheduled_time`/`location_desc`, push "⏰ Game time changed to …" to joined participants (helper + notification pattern already exists for delete).

### F5. "Search this area" on the map
Courts are fetched once around the initial location (`useMapData` runs `fetchCourts` only on mount). Pan to another neighborhood → stale courts. **Spec:** the standard floating "Search this area" chip appears after the region moves > X km from last fetch center; taps `GET /courts/nearby` with the new center. Games are global already, so this is courts-only.

### F6. Notification inbox rows should navigate
`notification-inbox.tsx` rows only mark-as-read on tap; the payload `data` already carries `gameId`/`screen`. Reuse `navigateFromNotification()` from `_layout.tsx` on row press. Tiny change, expected behavior.

### F7. Host management of participants
Hosts can't remove a no-show/problem player before the game (only cancel everything). **Spec:** `DELETE /games/:id/participants/:userId` (host-only, triggers waitlist promotion — logic already exists in leave) + a remove button in `game-participants.tsx` when `is_host`.

### F8. Hebrew i18n + RTL
Full spec already written (`docs/superpowers/specs/2026-06-12-hebrew-i18n-rtl-design.md`, ~39 files, 5 phases). Given the Tel-Aviv-only launch strategy, this is arguably the highest *market-fit* item on the list. Recommend scheduling it as the next major sprint after the bug batch.

### F9. Smaller ideas (backlog)
- **Game comments / post-game feed:** post_game_photo exists but is single-photo, last-write-wins (`lifecycle.js:125` overwrites); a `GamePhotos` table + small gallery would make history screens social.
- **Recurring game edit propagation** (edit parent → ask "apply to future occurrences?").
- **Court hours-aware game creation** ("this court closes at 22:00" warning via existing Places hours).
- **Friend-gated DM toggle** (deferred M7 — decide and document; current behavior is open DMs with block enforcement).
- **Phone verification** (business doc) — defer until real launch; Google + email is fine for TestFlight.
- **Premium/organizer tier & venue booking** — post-launch monetization, per business plan.

---

## 6. 🎨 UI/UX polish

- **U1. Map header/game count on light background** uses inverted colors by design, but `index.tsx` styles carry ~8 raw hex/rgba values (`#f0f0f0`, `rgba(255,255,255,0.95)`, `#E5E5EA`, `#FFF9C4`, `#FBC02D`, `#999`) — violates rule 9. Add `Colors.light*` tokens to `theme.ts` and migrate. Same for `LEVEL_META` colors in `modal.tsx:46-51` (move to `sports.ts`/`theme.ts` as `LEVEL_COLORS`).
- **U2. BottomCard shows game "rating" star = skill level** (`toMapGame` maps `rating: row.level`; `index.tsx:174-177` renders it with a ⭐). A star badge reading "3" implies review score, not level. Show `Lv.3` chip (like GameCard) for games and keep ⭐ only for courts.
- **U3. Level label "Inter"** (`modal.tsx:48`) — abbreviation reads oddly next to `SKILL_LABELS`' "Intermediate"; "Mid" or full word.
- **U4. Accessibility — reduced motion & sound toggle.** The app is animation/sound-heavy (great for demo). Respect `useReducedMotion()` from Reanimated in the shared hooks (`useAnimations.ts` is a single choke point — one check covers the whole app), and add a "Sounds" switch in notification/settings persisting to AsyncStorage, read in `SoundContext`.
- **U5. `runOnJS` → `scheduleOnRN`** (`index.tsx:9,399`): `runOnJS` is deprecated in Reanimated 4 and removed in 5 (per Software Mansion guidance). One call site; migrate to `scheduleOnRN` from `react-native-worklets` when convenient.
- **U6. Waitlist position honesty:** positions never compact when someone ahead leaves the waitlist (`MAX(waitlist_position)+1` on join, no renumber on waitlist-leave) — a user can sit at "#4" in an empty queue. Either renumber on leave or display rank via `ROW_NUMBER()` at read time.
- **U7. Discover empty-state** doesn't mention active date/neighborhood filters in the "Try adjusting your filters" hint condition (only search/sport/radius).

---

## 7. 🧹 Code quality / DX

- **Q1. Zero automated tests.** Highest-value first tests (plain node scripts or vitest + a test DB): join/leave/waitlist promotion race, ratings validation, `parseIsraelTime` around DST transitions, and the B1 destructuring class of bug (a smoke test hitting each GET endpoint and asserting response shape would have caught it).
- **Q2. `Messages.username` snapshot column is dead** — writes on insert, but reads JOIN `Users` anyway. Drop the column (migration) or stop joining.
- **Q3. CLAUDE.md drift:** cluster threshold documented as `latDelta < 0.012`/`gridSize/3` vs code `0.015`/`/2.5`; register.tsx described both as having Google button and "Coming Soon" badge; "all 9 sports" appears in the onboarding paragraph though there are 12. Worth a doc pass so the assistant context stays truthful.
- **Q4. Duplicate landing-page code** (see A4/B6) — `server.js` inline pages vs `routes/share.js`; extract one `renderGamePage()`.
- **Q5. `AuthContext` user object staleness:** username changes via profile edit update the server but not `AsyncStorage`'s `user` (login-time snapshot) — `user?.username` used in chat fallbacks/avatars can show the old name until re-login. Small: expose `updateUser()` from AuthContext and call it in profile save.
- **Q6. `boost` targeting** (deferred M4, still open): users who never hosted resolve to distance 0 and always get boost pushes. Include last *joined* game location (UNION, as `users/suggestions` already does) or skip users with no signal.

---

## 8. Suggested execution order

**Batch 1 — bug fixes (backend-first per workflow rule):**
B1 (unread badge) → B2 (DM history) → B3+B4 (timezone) → B5 (inbox persistence) → B6 (counts trio) → B11 (ratings gating) → B15 (auth validation).

**Batch 2 — frontend bug/UX parity:** B7 (map waitlist) → B8 → B13 (parseGameTime) → F3 (events unread) → F6 (inbox navigation) → U2/U3.

**Batch 3 — pre-launch:** A1 account deletion → A2 expo-audio migration → P5 push receipts → A4/Q4 landing-page consolidation → backups.

**Batch 4 — features:** F1 dynamic skill → F4 edit notifications → F5 search-this-area → F7 host tools → F2 karma gating.

**Batch 5 — the big one:** F8 Hebrew i18n + RTL sprint (spec ready).
