# SportLink — Presentation Manual

Everything you need to know to practice for and survive the 2026-09-08 exhibition — the pitch, the demo script, deep technical knowledge for hard questions, and an honest list of what's *not* done, so nothing catches you off guard. Judges rotate through in ~10-15 min slots, ~6-7 per project, judging on: **Presentation, Complexity, Innovation, AI Usage, General impression** (per the program's own criteria — see `docs/exhibition_deliverables_and_logistics` context).

---

## 1. The 60-Second Pitch (memorize this cold)

> "SportLink helps you find a pickup sports game *tonight*, near you, with people you can actually trust to show up and play fair — not just find a court, and not just another WhatsApp group. You open the map, see live games and courts around you, join in one tap, and after the game, everyone rates each other on sportsmanship, punctuality, and skill. That builds a karma score that follows you everywhere — so before you even show up, you know whether this is going to be a good game. It's a full production app: React Native mobile client, a real-time Node.js backend, live on Railway right now, covering 12 sports, launching hyper-locally in Tel Aviv."

Say the app name, say "trust," say "tonight," say it's real and live. Everything else is detail.

---

## 2. The Problem, Concretely

Don't lead with features — lead with a person:

- **Idan** just moved to Tel Aviv, loves football, doesn't know anyone here. He's not going to walk up to a court full of strangers and ask to join. He needs to know *before* he shows up that there's a real game happening and it's not going to be weird.
- **Maya** runs a weekly basketball group. Every week, 1-2 people cancel last-minute and she burns an hour on WhatsApp trying to fill the spot before the court booking goes to waste.

The common thread: **existing tools (WhatsApp groups, Facebook, Meetup) all assume you already know people.** None of them solve "I don't know anyone here" or "I need a stranger I can trust, right now."

---

## 3. Live Demo Script (~5 minutes — this is the actual centerpiece, not the slides)

Rehearse this exact sequence so it's muscle memory:

1. **Map screen** — show live game + court markers around Tel Aviv, tap a cluster to zoom in, tap a game marker → bottom card
2. **Join a game** — tap Join, show the haptic/animation feedback, participant count updates
3. **Game chat** — open it, send a message, show it's real-time (ideally with a second device/judge's phone also in the chat)
4. **Discover tab** — filter by sport, show the radius filter
5. **Profile** — show karma score, sport preference chips, streak/badges
6. **The differentiator: ratings** — this is worth walking through even if you can't complete a full game cycle live: explain that after a game, the host marks attendance and everyone else rates sportsmanship/punctuality/communication/skill anonymously, and *that's* what builds the karma number they just saw on the profile. If you have a completed game in the seeded demo data, show the actual results screen.
7. **Friends / DM** — quick glance, mention shareable invite links

**If you only get to show one thing that makes judges go "oh, that's actually different"** — it's the ratings → karma flow. The map is table stakes; every competitor has a map. Nobody else has a trust layer.

---

## 4. Full Feature Reference (for when judges dig deeper)

| Area | What's built |
|---|---|
| **Map** | Live courts (Google Places) + community games, sport/distance filters, marker clustering at low zoom |
| **Discover** | Search, sport filter, radius filter (Haversine formula), sorted by preference match |
| **Games** | Create (drop pin or pick court), one-off or recurring (weekly/bi-weekly), waitlist with auto-promotion, check-in within 30 min of start, host can "boost" a game (push to nearby same-sport players), post-game photo |
| **Chat** | Real-time per-game chat (Socket.io), pagination for older messages, avatar caching |
| **Ratings/Karma** | Host confirms attendance; non-host participants peer-rate sportsmanship/punctuality/communication/skill (1-5); anonymous aggregate karma shown on profile + leaderboard |
| **Social** | Friends (request/accept), 1-on-1 DMs with read receipts + typing indicator, shareable game-invite cards, player matching by shared sport/skill/proximity, activity feed |
| **Courts** | Google Places detail (photos, hours, phone, rating) + SportLink community reviews, court ownership claims (managers can post announcements, reply to reviews) |
| **Retention** | Streaks, 11 auto-awarded badges, weather widget on outdoor games |
| **Auth** | Email/password (JWT, 90-day expiry) + Google Sign-In (PKCE) |
| **Safety** | Block/report users (mutual invisibility), admin reports endpoint |
| **Notifications** | Push for friend requests, joins, acceptances, rating nudges, badges — inbox persists all of them |

**12 supported sports:** basketball, tennis, volleyball, football, yoga, gym, studio, footvolley, swimming, padel, hiking, walking.

---

## 5. Technical Deep-Dive (for Complexity-focused questions)

**Stack:** React Native + Expo (Expo Router, file-based routing) · Node.js + Express + Socket.io (same port) · MySQL/MariaDB via raw SQL (`mysql2/promise`, **no ORM** — deliberate choice for full control over correctness-critical queries) · Railway hosting (auto-deploy from `main`) · Google Places API · Expo Push · Sentry.

**Why no ORM?** Full control over exact query behavior for things that are easy to get subtly wrong with an ORM abstraction layer: Haversine distance filtering, transactional waitlist promotion (a leave + promote-next-in-line has to happen atomically), and DST-correct Israel timezone handling (Israel is UTC+2 in winter, UTC+3 in summer — `new Date(str)` parsing breaks across the DST boundary if you're not careful).

**A real, documented technical pivot** (good "hardest problem" answer): the first attempt at court discovery used Google Places' `type=stadium` filter and got zero usable results — most public courts and parks aren't classified as "stadiums" in Google's taxonomy. Pivoted to keyword search (`"sport court"`, `"מגרש"`) instead, which is what ships today. Documented in `docs/TECHNICAL_VALIDATION.md`.

**Another real one from this week:** upgrading the Expo SDK (54→57, needed because current Expo Go on iOS only runs the latest published SDK) surfaced that a belief the team held about Expo Router — "a named export instead of a default export keeps a helper file from becoming an extra tab" — was actually never true on the current version. Root-caused by reading Expo Router's own source rather than guessing, and fixed by moving those files outside the `app/` directory entirely, which is the only exclusion the framework actually guarantees.

**Architecture:** client ↔ REST (HTTP/JSON) + Socket.io (same port) ↔ Express ↔ MySQL. Auth is JWT with a `token_version` column for remote session revocation (logout-all-devices). 17-table schema — games, participants, chat messages, ratings, peer-ratings, friends, notifications, court reviews/claims, blocks, reports, badges.

**If asked about scale:** the app already accounts for one real scaling issue — a shared-venue-WiFi presentation scenario where many devices share one NAT'd public IP, which broke a naive per-IP rate limiter (fixed by raising the limit, since the limiter couldn't distinguish "one person abusing the API" from "a room full of legitimate users behind one IP").

---

## 6. AI Usage — This Is a Named Judging Criterion, Answer It Directly

Don't undersell this — it's explicitly scored. Concrete, honest talking points:

- AI-assisted development (Claude Code) was used throughout the project: architecture and design decisions, implementing features, debugging real production issues, and code review.
- **Concrete example from this week:** a live-device rehearsal surfaced a chain of real bugs invisible from reading code alone — a production outage, an SDK incompatibility, a routing framework bug, a dead third-party API dependency, incomplete sport-detection logic, and zero accessibility labels app-wide. All of these were found and fixed through AI-assisted debugging that included reading the actual framework source code to find root causes, not guessing — e.g., confirming Expo Router's phantom-tab bug by reading its compiled source, not just trial-and-error.
- **Code review was also AI-assisted**: a structured review pass caught a real regression in a same-day fix (a regex ordering bug where a more specific sport-detection pattern was unreachable because a more general one matched first) before it shipped.
- If asked "did AI write the whole app" — be honest: AI assisted throughout, but architecture decisions, product judgment, business strategy, and final calls were the team's.

---

## 7. Anticipated Hard Questions & How to Answer Them

**"How is this different from Meetup / Playtomic / just using WhatsApp?"**
→ Meetup is for events planned weeks ahead — too slow for "tonight." Playtomic/SportyHQ only cover paid private venues; SportLink also maps free public courts they don't touch. WhatsApp groups are closed — a newcomer to a city literally cannot find the group link. SportLink is open and location-based: it doesn't require already knowing anyone.

**"What's your business model?"**
→ Freemium: free to join/create games. Premium tier for heavy organizers (league management, stats, priority notifications). Plus venue-partnership commissions and lead-gen for trainers/studios wanting visibility with an engaged local audience. (Full detail in `docs/BUSINESS_STRATEGY.md` / `docs/EXECUTIVE_SUMMARY.md`.)

**"How do you solve cold start — an empty app with no games is useless."**
→ Deliberately launching hyper-local (Tel Aviv only, not nationwide) to concentrate density. Seeding real weekly games via partnerships (student union, existing league captains) so the map has real content on day one, plus manually importing known public games from Facebook groups in the early phase.

**"Is the rating system gameable? What stops brigading or fake ratings?"**
→ Ratings are tied to actual game participation — only people the system confirms joined that specific game can rate each other, validated server-side against the real participant list (not client-trusted input). Ratings are anonymous in aggregate, so no one rater can be identified or retaliated against.

**"What's the hardest bug you hit?"**
→ Pick one from §5 depending on what resonates — the Google Places taxonomy pivot (good "problem was more subtle than it looked" story) or the Expo Router phantom-tabs bug (good "we verified via source code, not guessing" story, and ties directly into the AI-usage question too).

**"What would you build next?"**
→ Hebrew/RTL localization (spec already written, not yet implemented), Android Google Sign-In, TestFlight distribution for iOS (needs a paid Apple Developer account), venue-partnership integrations, and deepening the karma system (e.g. karma-gated access to high-demand games).

**"Is user data safe? Any security work?"**
→ JWT auth with server-side session revocation, block/report enforcement checked at every DM/friend-request entry point (not just client-side), server-validated rating participant lists (rejects ratings against people who weren't actually in the game), rate limiting on auth endpoints against brute force.

**"Why React Native / this stack specifically?"**
→ Single codebase for iOS + Android, Expo's tooling made it possible to demo live via QR code without needing app-store distribution — directly relevant to how you're demoing today.

---

## 8. Known Limitations — Be Upfront If Asked, Don't Get Caught Defensive

- **Push notifications don't work in Expo Go** (Apple/Expo platform limitation since SDK 53, not app-specific) — they do work in a real device build, which isn't set up yet (needs a paid Apple Developer account).
- **Hebrew/RTL localization** isn't implemented yet — full spec exists, deprioritized as not urgent for now.
- **Android Google Sign-In** isn't configured (needs an Android OAuth client in Google Cloud Console).
- **iOS production distribution** (TestFlight) isn't set up — needs the $99/yr Apple Developer Program.
- **The live demo requires everyone's Expo Go logged into the same (throwaway, disposable) demo account** — a real constraint from how Expo Go's dev-session security model works, not something in the app itself.

If a judge asks about any of these, answer plainly and pivot to what *is* done — a judge respects "here's what's left and why" far more than a dodge.

---

## 9. If Something Breaks Live

- Backend down / map not loading → check WiFi is actually connected, not venue WiFi with client isolation; `--tunnel` mode is the fallback if LAN scanning fails
- Fall back to the 42-second Remotion mockup video (`MockUpVideo/`) rather than fighting a live bug in front of judges
- If a specific feature glitches mid-demo, don't debug live — narrate what *should* happen and move on; you have ~6-7 judge rotations, one bad run isn't fatal

---

## 10. Quick Facts Cheat Sheet

- **Team:** Amit Oved, Gal Libal — MTA Computer Science School, Software Entrepreneurship Workshop
- **12 sports**, **17 database tables**, **hyper-local launch: Tel Aviv**
- **Live backend:** `sport-link-production.up.railway.app`, live right now on Railway
- **Track:** Applicative (top 3 win prizes in this track)
- **Exhibition:** Tuesday 2026-09-08, arrive 10:00, Weston building, judging all day, awards ceremony 14:45
