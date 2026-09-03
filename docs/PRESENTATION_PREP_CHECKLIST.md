# Presentation Prep Checklist — Exhibition 2026-09-08

Live demo: attendees scan a QR code and run SportLink themselves via Expo Go,
simultaneously, on shared venue WiFi. Goal: nothing visibly breaks in front of
an audience.

## 🔴 Hard deadlines (poster)
- [ ] Equipment request form (only if requesting anything beyond table + power) — due **2026-08-22** (past — confirm this was handled)
- [x] Finalize poster content: 70cm × 100cm, 10cm header (project name, team names, mentor, college logo), 1.5cm no-text safe margin all edges
- [ ] Mentor approval on poster
- [x] Submit final PDF to studio@nevoart.co.il — due **2026-08-23**
- [ ] **Go check the printed poster at the school office** for quality/color issues before the day — recommended by the program, not yet confirmed done

## 🆕 New deliverables (added 2026-09-03, due same week — separate from the poster)
- [x] Executive Summary drafted — `docs/EXECUTIVE_SUMMARY.md`
- [x] Presentation content outline drafted — `docs/PRESENTATION_OUTLINE.md`
- [ ] **Actually build the slide deck** (PowerPoint/Keynote/Google Slides) from the outline — the outline is not the deck
- [ ] Submit both deliverables per the program's instructions

## 🛠 App technical readiness
- [x] General rate limiter raised 300→1500 req/min for shared-venue-NAT (done in an earlier session)
- [x] Run `backend/tests/smoke.js` — ran locally against the same backend code deployed to production: **9/9 passed** (DST timezone parsing, response shapes, waitlist promotion, ratings gating)
- [x] **Live rehearsal** — done 2026-09-03, and it was extremely high-value: caught and fixed a production outage (Railway trial expiry), an iOS Expo Go SDK-incompatibility block, an expo-router phantom-tabs crash, a dead CartoDB map-tile provider, missing court sport-type detection for 4 sports, an onboarding UI bug, an invisible icon color bug, and zero accessibility labels app-wide. See `docs/CHANGELOG.md` "Pre-exhibition hardening" entry for the full list.
- [ ] Manually verify the **Directions button** end-to-end on a real device (Waze / Google Maps / native Maps handoff) — still never confirmed since it shipped
- [ ] Check Railway backend cold-start behavior under a burst of simultaneous first requests
- [x] Confirm `CORS_ORIGIN` — unset, defaults to `*` (wildcard), which is permissive enough for the demo; fine as-is
- [x] Seed the DB with realistic games/courts/players — done: 8 users with real photo avatars, 13 games across 10 sports, ~10 friendships, active chat in both game-chat and DMs
- [x] Walk through onboarding as a brand-new user — done during rehearsal, found and fixed the sport-tile text-cutoff bug
- [x] Test the Expo Go QR scan path on both iOS and Android — done; **found a real blocker** (see below)
- [ ] Decide a fallback plan if live demo fails mid-presentation (pre-loaded backup device, or fall back to the 42s Remotion mockup video)

## 🔑 Critical: the Expo account sign-in wall (found 2026-09-03, not yet fully resolved for a room of strangers)
Expo Go on the current SDK enforces that the Expo account logged into Expo Go must match the one running the CLI/dev server — a real security feature, not a bug, but new behavior since the SDK 57 upgrade that never affected the app before. The only combination confirmed to work: **CLI and every phone's Expo Go logged into the same Expo account.**

- [ ] Create a **throwaway demo Expo account** (was about to be done via `npx expo register`, not yet confirmed finished)
- [ ] Log the CLI into that demo account before the presentation (`npx expo login` in `frontend/`)
- [ ] Prepare a slide/card showing the demo account's email + password for attendees to type into Expo Go before scanning the QR
- [ ] Confirm this actually works with a device that's never touched this Expo account before (not yet tested)

## 🎤 Day-of logistics
- [ ] Printed/displayed QR code, large enough to scan from a few meters away
- [ ] Test venue WiFi ahead of time if at all possible (or bring a hotspot as backup) — remember `--tunnel` is the fallback if LAN scanning fails due to client isolation
- [ ] Mockup video ready as an intro/fallback (`MockUpVideo/`, 42s Remotion render)
- [ ] Short talking points / script for walking people through the demo — **see `docs/PRESENTATION_MANUAL.md`** for a full rehearsal-ready reference covering the demo script, anticipated judge questions, and known limitations to be upfront about

---
*Source context: see project memory `presentation_readiness`, `exhibition_poster`, `exhibition_deliverables_and_logistics`, `feature_index_split` for background on what's already been fixed. `docs/CHANGELOG.md`'s "Pre-exhibition hardening" entry has the full technical detail behind every checked item above.*
