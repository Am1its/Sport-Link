# SportLink — Presentation Outline (9-12 slides)

> Content/talking-point draft to build the actual deck from (PowerPoint/Google Slides/Keynote). Remember: the live demo is the centerpiece in front of judges (~5 min total) — these slides support it, they don't compete with it. Keep on-screen text minimal; this outline has more detail than should actually appear per slide.

---

**Slide 1 — Title**
- SportLink — "Find courts. Join pickup games. Build your player reputation."
- Amit Oved · Gal Libal — MTA Computer Science School, Software Entrepreneurship Workshop

**Slide 2 — The Problem & Who Has It**
- Finding a reliable pickup game on short notice still runs on scattered WhatsApp groups, Facebook posts, and word of mouth — fine if you're already in the right group, useless if you're not
- Idan, "The Newcomer": just moved to Tel Aviv, loves football, friends live elsewhere — feels awkward showing up to a court alone hoping to join in
- Maya, "The Organizer": runs a weekly basketball group, loses players to last-minute cancellations most weeks, burns hours on WhatsApp finding replacements
- Target: recreational/amateur players who play casually, not on an organized team — especially newcomers with no existing local sports network

**Slide 3 — Solution Concept & Value Proposition**
- A map-based app to discover courts and community games, join in one tap — and a peer-rating/karma system that makes trustworthiness visible *before* you commit to a game
- 12 sports, one social graph, one reputation

**Slide 4 — Product Walkthrough (leads into the demo)**
- Map: public courts (Google Places) + community games, filterable by sport/distance, clustered markers
- Create or join a game; waitlist with automatic promotion when a spot frees up
- Real-time in-game chat (Socket.io)
- After the game: host marks attendance, participants peer-rate sportsmanship / punctuality / communication / skill → aggregate karma on every profile and the leaderboard
- Friends, DMs with shareable game-invite cards, player matching, streaks & badges
- **[Live demo — the ~5-minute centerpiece — happens here]**

**Slide 5 — Market & Competitors**
- Launch strategy: hyper-local, geo-fenced to Tel Aviv only — concentrate density rather than spread thin, in a city with a genuinely active amateur sports culture
- Meetup: broad, planned-weeks-ahead gatherings — too slow for "tonight"
- Playtomic / SportyHQ: booking paid private venues only — SportLink also covers free public courts they don't map
- WhatsApp/Facebook groups: closed networks — a newcomer can't find a private group link; SportLink surfaces games by location, not who you already know

**Slide 6 — Go-to-Market & Next Steps**
- Solve cold start directly: seed real weekly games via MTA student union + local league captain partnerships, plus manual event aggregation from existing Facebook groups so the map is never empty for a new user
- The exhibition demo itself is a live, small-scale user-acquisition test
- Beyond MVP: freemium (organizer subscription tier), venue-partnership commissions, hyper-local advertising, lead-gen for trainers/studios
- Technical next steps: Hebrew/RTL localization (spec already written), Android Google Sign-In, TestFlight/production iOS distribution

**Slide 7 — Key Technologies & Development Tools**
- React Native + Expo (Expo Router, file-based navigation), TypeScript
- Node.js + Express + Socket.io backend, raw SQL over MySQL/MariaDB — no ORM, by deliberate choice, for full control over correctness-critical queries
- Google Places API for live court data (server-proxied to keep the key off the client); Google Sign-In (PKCE) for auth
- Deployed on Railway (backend + MySQL), auto-deploy from `main`
- **Real technical challenge:** our first attempt at court discovery used Google Places' `type=stadium` filter and returned zero usable results — most public parks/courts (e.g. Sportek Tel Aviv) simply aren't classified as "stadiums" in Google's taxonomy. Pivoted to keyword search (`"sport court"`, `"מגרש"`) instead of type filtering, which is what actually ships today (documented in `docs/TECHNICAL_VALIDATION.md`)

**Slide 8 — Architecture**
- React Native/Expo client ↔ REST (HTTP/JSON) + Socket.io (same port) ↔ Node/Express ↔ MySQL (Railway)
- Also integrates: Google Places API, Expo Push Service, Sentry error monitoring
- Auth: JWT (90-day expiry), Google OAuth via PKCE, stored in AsyncStorage with a global 401 handler
- 17-table schema covering games, participants, chat, ratings/peer-ratings, friends, notifications, court reviews/claims, blocks/reports, badges

**Slide 9 — Close**
- SportLink: the app that makes it easy to find a game tonight, and easy to trust who shows up
- Thank you / questions

---

*Optional slides 10-12 if you want more room: a screenshots/UI showcase slide, the karma/rating algorithm in more depth (it's the most distinctive technical piece), or the monetization model (freemium + B2B2C) if judges probe on business viability.*
