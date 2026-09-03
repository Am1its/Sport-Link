# SportLink — Executive Summary

## 1. Overview

SportLink is a location-based mobile app that helps people find pickup sports games, teammates, and public courts nearby — and builds a trust layer around every game through a peer-rating and karma reputation system. Users discover games and courts on a live map, join or host a game in a tap, coordinate in real-time in-game chat, and build a reputation for reliability and sportsmanship that follows them across everything they play. The app supports 12 sports — basketball, tennis, volleyball, football, yoga, gym, studio classes, footvolley, swimming, padel, hiking, and walking — and launches hyper-locally in Tel Aviv.

SportLink is a full-stack production app: a React Native/Expo mobile client, a Node.js/Express + Socket.io backend, and a MySQL database, live on Railway with real-time chat, Google Places court discovery, push notifications, and Google OAuth sign-in.

## 2. The Problem & Target Audience

Finding a reliable pickup game on short notice still runs on closed, informal channels — WhatsApp groups, Facebook posts, word of mouth. That works fine if you're already inside the right group; it fails completely for anyone who isn't:

- **Idan, "The Newcomer"** (26, a student who just moved to Tel Aviv) loves football but his friends live elsewhere — he feels awkward showing up to a court alone hoping to join a game. He wants a friendly amateur game happening *tonight*, nearby.
- **Maya, "The Organizer"** (31, a tech team lead who runs a weekly basketball group) loses 1-2 players to last-minute cancellations most weeks, and spends hours on WhatsApp scrambling for replacements instead of just broadcasting "1 spot left" to people nearby who'd actually want it.
- **The Freelancer** — flexible schedule, looking for pickup games during the day when regular leagues aren't running.

These personas drove the actual technical architecture (see `docs/PRODUCT_DEFINITIONS.md` for the full user-story-to-implementation mapping) — e.g. the requirement "see all active games within X km" became the Haversine-distance radius filter on the games API; "trust that my teammates will show up" became the karma/rating system.

**Target audience:** recreational and amateur sports players in dense urban areas who play casually — not on an organized team — and want a faster, more reliable way to find games, partners, and courts near them, especially newcomers to a city with no existing sports network.

## 3. Product & Value Proposition

- **Live map** of public courts (Google Places, with SportLink community reviews layered on) and community-hosted games, filterable by sport and distance, with clustering at low zoom
- **One-tap game creation and joining** — drop a pin or pick a verified court, set sport/level/capacity/time, one-off or recurring (weekly/bi-weekly); waitlist with automatic promotion when a spot opens
- **Real-time chat** per game via Socket.io, so logistics happen in-app instead of across scattered group chats
- **Post-game ratings & karma**: the host marks attendance; participants anonymously rate each other on sportsmanship, punctuality, communication, and skill. The resulting karma score is visible on every profile and the leaderboard — visible trust, before you commit to a game
- **Social layer**: friends, direct messages with game-invite cards, player matching by shared sport + skill + proximity, an activity feed, and shareable invite links
- **Retention mechanics**: streaks, 11 auto-awarded achievement badges, weather widget on outdoor games, court ownership claims with manager announcements

## 4. Innovation & Key Advantages

- **Trust as a first-class feature, not an afterthought.** The peer-rating/karma system directly answers the one question every pickup-game participant actually has — "will this be a good game?" — before they leave the house.
- **Multi-sport, single social graph.** Twelve sports under one profile and one reputation, rather than a separate app and a separate identity per activity.
- **Public courts, not just paid venues.** Booking platforms like Playtomic/SportyHQ cover paid private facilities; SportLink also maps the free public courts (Sportek, parks) those platforms don't touch.
- **Open, location-based discovery.** WhatsApp/Facebook groups require already knowing the right group; SportLink democratizes access based on where you are, not who you already know — critical for anyone new to a city.
- **Real engineering behind it**, not just a wireframe: raw SQL for full control over correctness-critical queries (Haversine radius search, DST-correct Israel-timezone handling, transactional waitlist promotion), Socket.io rooms for real-time chat/DMs, and a Google Places integration that required pivoting from type-based to keyword-based search after an initial approach returned zero usable results for public courts (documented in `docs/TECHNICAL_VALIDATION.md`).

## 5. Competitors & Alternative Solutions

| Competitor | Their Focus | SportLink's Edge |
|---|---|---|
| **Meetup** | Broad social gatherings, planned weeks in advance | Spontaneity — SportLink is built for "tonight," not "in three weeks" |
| **Playtomic / SportyHQ** | Booking paid private venues (tennis/padel) | Also covers free public community courts, currently unmapped by booking apps |
| **WhatsApp / Facebook groups** | Closed communities, private networks | Open ecosystem — a newcomer to a city can't find a private group link; SportLink surfaces games by location, not social connections |

## 6. Target Market & Market Potential

Initial launch is deliberately **hyper-local and geo-fenced to the Tel Aviv district**, not nationwide — a dense, active amateur-sports population (beach volleyball, football, padel, running/hiking communities) makes it possible to reach a critical mass of concurrent users fast, which a spontaneous-pickup-game product depends on. The product and tech stack are city-agnostic (court data comes from the Google Places API, which has global coverage), so the same model can expand to additional Israeli cities and beyond once density is proven in one market.

## 7. Go-to-Market Strategy

A social sports app is worthless without active games already on it — SportLink's plan directly targets that cold-start problem:

1. **Hyper-local launch (geo-fencing):** Tel Aviv only, at first, to artificially inflate user density rather than spreading thin nationwide.
2. **Seeding via partnerships:** partner with the MTA student union and existing local league captains to migrate their regular weekly games onto the app, so it's populated with real events from day one.
3. **Event aggregation:** in the initial phase, manually import public sports events from existing Facebook groups so the map is never empty for a new user.
4. **Exhibition as a live test:** the QR-code demo at the project exhibition is a genuine (small-scale) user-acquisition moment — attendees who join during the demo are the first real, non-seeded users.

**Monetization (freemium + B2B2C), for context beyond MVP:** free game creation/joining for all users; a premium subscription tier for heavy organizers (league management, team stats, priority notifications); venue-partnership commissions on paid-facility bookings; hyper-local advertising (e.g. gear discounts surfaced after joining a match); and lead generation for personal trainers, yoga instructors, and boutique studios seeking visibility with an already-engaged, hyper-local athlete base.

## 8. Team & Responsibilities

| Name | GitHub |
|---|---|
| Amit Oved | [@Am1its](https://github.com/Am1its) |
| Gal Libal | [@gallibal](https://github.com/gallibal) |

Developed as part of the MTA Computer Science School — Software Entrepreneurship Workshop, Jan–Sep 2026.
