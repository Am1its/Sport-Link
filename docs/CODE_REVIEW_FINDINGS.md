# SportLink — Code Review Findings

**Date:** 2026-06-26
**Scope:** Full read-only review of `backend/` (29 JS files, ~3,800 LOC) and `frontend/` (key files + full TypeScript type-check).
**Method:** Manual file-by-file read, `node --check` on all backend files, `tsc --noEmit` on the frontend, migration/column cross-checks, and security pattern grep.

> ⚠️ This is a findings-only document. **No code was changed.** Severity is my best estimate of user impact × likelihood. Items are ordered so the highest-leverage fixes are at the top.

---

## ✅ What's solid (don't touch)

- **SQL injection:** All queries use parameterized `pool.execute(?)`. Dynamic SQL fragments (`LIMIT ${limit}`, `${lat}/${lng}` in suggestions) are gated behind `parseInt`/`parseFloat` + `isNaN` guards, so they're not injectable. This is consistently done — good discipline.
- **Auth:** JWT verified on every protected route; socket handshake verifies JWT in `io.use`. Passwords hashed with bcrypt (cost 10). Google accounts correctly reject password login (`!dbUser.password_hash`).
- **Race conditions:** The join path (`participants.js`) uses a transaction + `SELECT ... FOR UPDATE` to prevent over-fill. Reminder cron uses an atomic `UPDATE ... WHERE reminder_sent_at IS NULL` claim. Both are correct.
- **HTML escaping:** All server-rendered landing pages (`server.js`, `share.js`) escape user-controlled strings before interpolation.
- **Rate limiting:** Auth endpoints get a strict 10/min limiter; general routes 300/min. `trust proxy` is set for Railway.
- **Secrets:** No `.env` is tracked in git. All migration columns referenced in code exist in `backend/migrations/`.

---

## 🔴 High — correctness bugs with real user impact

### H1. Timezone mismatch: stored Israel-local times compared against UTC `NOW()` / server clock
**Files:** `backend/routes/games/checkin.js:26`, `backend/crons/autoComplete.js:23`, `backend/crons/reminders.js:21-23`, `backend/routes/games/crud.js:75,194,293`

`scheduled_time` is stored as a bare string `YYYY-MM-DD HH:MM` in **Israel local time** (per CLAUDE.md rule #6). Multiple places compare it against `NOW()` (MySQL server TZ, UTC on Railway) or `new Date(string)` (Node process TZ, UTC on Railway). Every one of these is off by the Israel offset (2–3h).

- **Check-in (most impactful):** `new Date(game.scheduled_time.replace(' ', 'T') + ':00')` parses the Israel-local string as if it were UTC. The ±30-minute check-in window therefore opens ~2–3 hours **after** the real game time — players cannot check in when the game actually starts.
- **Auto-complete:** Games flip to `completed` ~2–3h later than the intended "3h after start."
- **Reminders:** The "~30 min before" push fires at the wrong absolute moment.
- **Create/edit validation:** The "must be in the future" check (`new Date(scheduled_time) <= new Date()`) can wrongly accept a past Israel time or reject a valid near-future one near the boundary.

**Why it matters:** Check-in is effectively broken at the real game time; the whole feature silently misbehaves. **Fix direction:** normalize on one approach — either store UTC, or pin the MySQL session `time_zone = '+03:00'` / use `CONVERT_TZ`, and parse with an explicit offset in Node. Pick one and apply everywhere `scheduled_time` meets the clock.

### H2. Block relationship not enforced on DM send/fetch (only on the list)
**File:** `backend/routes/dm.js` (`POST /:userId`, `GET /:userId`)

The `BlockedUsers` filter exists only in `GET /` (conversation list, lines 57–58). `POST /:userId` and `GET /:userId` have **no block check**, so a blocked user can still:
- Send DMs that are persisted and pushed in real time via the `new_dm` socket emit.
- Read the existing thread.

CLAUDE.md / README describe blocking as "mutual invisibility across all features," so this is a contract violation, not just polish. **Fix direction:** add the mutual-block `EXISTS` guard to the send and fetch handlers (reject with 403).

### H3. Karma manipulation — ratee is never validated as a game participant
**File:** `backend/routes/ratings.js` (`POST /batch`, `POST /peer`)

Both endpoints insert rows whose `ratee_id` comes straight from the request body, filtered only by `r.ratee_id !== userId`. Neither checks that `ratee_id` was actually in the game.

- A host can create throwaway games and `POST /batch` with `attended: 0` against any victim's id → `-1` karma each (via `KARMA_SQL`), or `attended: 1` to inflate allies.
- A participant can `POST /peer` arbitrary `ratee_id`s and move their `sportsmanship/punctuality/communication` karma ±1 each.

The `UNIQUE(game_id, rater_id, ratee_id)` constraint caps it to one row per game, but games are unlimited, so the abuse is unbounded over time. **Fix direction:** before insert, intersect submitted `ratee_id`s with the actual participant set (host + `GameParticipants`) for that `game_id` and drop the rest.

---

## 🟠 Medium — bugs / inconsistencies worth fixing

### M1. `participant_count` is computed two different ways
**Files:** `games/crud.js` vs `games/helpers.js`

- `GET /` counts **joined only**: `COUNT(CASE WHEN COALESCE(gp.status,'joined')='joined' ...)`.
- `GET /:id`, `POST /`, `PUT /:id` count **all rows** including waitlisted: `COUNT(gp.user_id)`.

So the same game shows a different player count on the list vs. the detail/after-create response once anyone is waitlisted. Standardize on the joined-only count everywhere.

### M2. `is_joined` is true for waitlisted users
**Files:** `games/crud.js:66,152` (`EXISTS(... GameParticipants ...)`)

The `is_joined` flag tests for *any* participant row regardless of `status`, so a waitlisted user sees "✓ Joined" in Discover/Map instead of a waitlist state. Consider `AND status='joined'` (or surface waitlist explicitly).

### M3. Waitlist promotion on leave is not transactional
**File:** `games/participants.js:124-171` (`DELETE /:id/leave`)

The leave path does `DELETE` then a separate `SELECT ... waitlist` + `UPDATE ... status='joined'` using the pool (no transaction, no `FOR UPDATE`). Two concurrent leaves, or a leave racing a join, can promote the same waitlist row twice or skip promotion. Lower probability than the join path (which *is* protected), but the asymmetry is worth closing with a transaction.

### M4. Boost proximity falls back to the game's own location for users who never hosted
**File:** `games/lifecycle.js:50-83`

Distance is computed from "the target user's most recent hosted game location," `COALESCE`'d to the *boosting game's* coordinates. Users who have never hosted therefore resolve to distance 0 and are always notified, regardless of where they actually are. Functional but spams far-away users. Consider using the user's last *participated* location too, or skip users with no location signal.

### M5. Host "check-in" is a silent no-op
**File:** `games/checkin.js:34-39`

When the caller is the host, the endpoint returns `{ success: true }` but writes nothing (there's no host check-in column). If the UI shows the host as "checked in" afterward, that state is fiction and won't survive a refresh. Either persist host check-in or have the API tell the client it wasn't recorded.

### M6. Streak can increment multiple times in one day
**File:** `crons/autoComplete.js:111-123`

`daysSinceLast` is `0` for a second game completed the same day, which is `<= 8`, so `current_streak` increments again and `last_game_date` is re-set to today. A user playing two games in a day double-counts their streak. Guard with `daysSinceLast >= 1` (or skip when `last_game_date = CURDATE()`).

### M7. DMs are not restricted to friends
**File:** `backend/routes/dm.js` (`POST /:userId`)

README/CLAUDE describe DMs as "friend-to-friend," but `POST /:userId` accepts any existing user id. Combined with H2 (no block check), any user can DM any other user. If friend-gating is intended, enforce an `accepted` Friends row; if open DMs are intended, update the docs. (Either way, H2's block check should land.)

---

## 🟡 Low — minor / polish / robustness

### L1. TypeScript build has 2 errors (`tsc --noEmit` fails)
- `app/(tabs)/map/AddFab.tsx:5` — imports `AnimatedStyleProp`, which Reanimated v4 no longer exports (`error TS2724`; it's now `AnimatedStyle`).
- `app/modal.tsx:235` — `API.game(gameId as string)` casts `number | null` to `string` (`error TS2352`).

Neither necessarily crashes at runtime (Metro/Babel strips types), but a green `tsc` is worth keeping; these will also bite if CI ever gates on type-check.

### L2. Self-action checks use strict `===` against body values that may be strings
**Files:** `friends.js:57` (`addressee_id === requesterId`), `ratings.js` filters (`r.ratee_id !== userId`)

`req.user.id` is a number; JSON body ids may arrive as strings, making `"5" === 5` false and bypassing the self-guard. Low impact (DB unique constraints / downstream filters usually catch it) but worth normalizing with `Number(...)`.

### L3. Friend requests can target blocked users
**File:** `friends.js` (`POST /`)

The block filter is applied to the friends list and requests list, but `POST /` doesn't check blocks, so you can send a request to someone you blocked / who blocked you (it just won't render for them). Add the mutual-block guard for consistency with H2.

### L4. `event`-type DMs don't validate the referenced game exists
**File:** `dm.js:125-135`

`event_id` is accepted as-is; the `LEFT JOIN` just yields null game fields if it's bogus. Cosmetic, but validating it points to a real game (and is one the sender can see) would prevent broken event cards.

### L5. Push HTTP call ignores Expo's response receipts
**File:** `utils/sendPushNotification.js:52-60`

The Expo push response body is drained and discarded. Invalid/`DeviceNotRegistered` tokens are never detected or cleared, so dead tokens accumulate. Consider reading the ticket response and clearing tokens Expo reports as unregistered.

### L6. `crud.js POST /` validates `level` but the `INSERT` uses the raw `level`, not `levelNum`
**File:** `games/crud.js:177-202`

Harmless today (the raw value already passed `1–5` validation and MySQL coerces), but inserting the parsed `levelNum` would be cleaner and avoids surprising values like `"3 "`.

### L7. Duplicated sport emoji/label maps
**Files:** `server.js`, `routes/share.js` (and frontend `constants/sports.ts`)

Three separate sport→emoji/label tables exist and have already drifted (e.g. `studio` is `💃` in `server.js` but `🎵` in `share.js`; `footvolley` differs too). Consider a single shared module to keep them in sync.

---

## Suggested fix order

1. **H1 timezone** — pick one normalization strategy and apply it to checkin, both crons, and create/edit validation. Highest user-visible impact (check-in is broken).
2. **H2 + H3 + M7** — close the abuse/contract gaps (block enforcement on DM send/fetch + friend POST; participant validation on ratings; decide friend-gating for DMs). Best done together since they share the "validate the counterparty" theme.
3. **M1 / M2** — make `participant_count` and `is_joined` consistent (single source of truth in `helpers.js`).
4. **M3 / M6** — transaction on waitlist promotion; one-streak-per-day guard.
5. **L1** — get `tsc --noEmit` back to green.
6. Remaining L items as cleanup.

---

## Notes / things I could not verify here

- **Runtime behavior:** I did not start the server or DB (no live MySQL configured in this review), so the timezone findings are from reading the comparisons, not observed drift. They're high-confidence from the code, but a quick check-in test on a deployed game would confirm the exact offset.
- **No automated tests exist** (`npm test` is the placeholder). The transactional join path and the karma SQL are the two areas that would benefit most from a couple of integration tests if you ever add a suite.
