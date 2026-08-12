# Presentation Prep Checklist — Exhibition 2026-09-08

Live demo: attendees scan a QR code and run SportLink themselves via Expo Go,
simultaneously, on shared venue WiFi. Goal: nothing visibly breaks in front of
an audience.

## 🔴 Hard deadlines (poster)
- [ ] Equipment request form (only if requesting anything beyond table + power) — due **2026-08-22**
- [ ] Finalize poster content: 70cm × 100cm, 10cm header (project name, team names, mentor, college logo), 1.5cm no-text safe margin all edges
- [ ] Mentor approval on poster
- [ ] Submit final PDF to studio@nevoart.co.il — due **2026-08-23**, no edits possible after sending
  - Subject: project name
  - Body: project name + team representative's full name + contact info

## 🛠 App technical readiness
- [x] **General rate limiter** (`backend/server.js:55-61`) had the same shared-venue-NAT problem `/api/auth` had before its fix — raised 300→1500 req/min per IP
- [ ] Manually verify the **Directions button** end-to-end on a real device (Waze / Google Maps / native Maps handoff) — never confirmed since it shipped
- [ ] Run `backend/tests/smoke.js` against the Railway production backend
- [ ] **Live rehearsal**: several phones on the same WiFi, scanning the QR and hitting map/discover/chat/join simultaneously — this is the scenario that already caught 3 real bugs during dev, do it again before the real day
- [ ] Check Railway backend cold-start behavior under a burst of simultaneous first requests
- [ ] Confirm `CORS_ORIGIN` is set correctly for whatever URL/setup the demo uses
- [ ] Seed the DB with enough realistic games/courts/players so the app doesn't look empty to a fresh scanner
- [ ] Walk through onboarding as a brand-new user (fresh account) to make sure first-run UX is clean
- [ ] Test the Expo Go QR scan path on both iOS and Android devices
- [ ] Decide a fallback plan if live demo fails mid-presentation (pre-loaded backup device, or fall back to the 42s Remotion mockup video)

## 🎤 Day-of logistics
- [ ] Printed/displayed QR code, large enough to scan from a few meters away
- [ ] Test venue WiFi ahead of time if at all possible (or bring a hotspot as backup)
- [ ] Mockup video ready as an intro/fallback (`MockUpVideo/`, 42s Remotion render)
- [ ] Short talking points / script for walking people through the demo

---
*Source context: see project memory `presentation_readiness`, `exhibition_poster`, `feature_index_split` for background on what's already been fixed.*
