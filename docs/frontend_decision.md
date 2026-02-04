# Architecture Decision Record: Frontend Technology Stack

**Date:** 2026-02-04  
**Status:** Proposed  
**Context:** The SportLink MVP requires a mobile interface that heavily relies on geolocation, interactive maps, and real-time updates.

## 1. The Context
We need to select a frontend framework that allows us to:
* Integrate **Google Places API** and **Maps SDK** smoothly.
* Access device hardware (GPS, Location Services) efficiently.
* Develop quickly for both iOS and Android (Cross-Platform) within the workshop timeframe.
* Support a "Social Discovery" UI (Map view + List view + Chat).

## 2. Options Considered

### Option A: React Native (Meta)
* **Pros:** Uses JavaScript/TypeScript (common knowledge), huge ecosystem, native rendering.
* **Cons:** Navigation can be complex, bridge performance issues with heavy map usage.

### Option B: Flutter (Google)
* **Pros:** Compiles to native code (high performance), excellent **Google Maps** integration, consistent UI across devices.
* **Cons:** Requires learning Dart (new language), slightly larger app size.

### Option C: Progressive Web App (PWA)
* **Pros:** Fastest to deploy, no App Store required, runs on any browser.
* **Cons:** Limited access to background GPS (crucial for "users near me"), lower performance for complex maps.

## 3. Decision Matrix

| Criterion | React Native | Flutter | PWA |
| :--- | :--- | :--- | :--- |
| **Map Performance** | Good | Excellent | Fair |
| **GPS Access** | Native | Native | Limited |
| **Dev Speed** | High | High | Very High |
| **Learning Curve** | Low (JS) | Medium (Dart) | Low (Web) |

## 4. The Verdict (Decision)

**We have decided to proceed with: React Native**

**Reasoning:**
Since SportLink is a location-first application, PWA was rejected due to limitations in background location tracking. 

We chose React Native because:
1.  It offers the best balance between performance and development speed for our team.
2.  It has robust libraries for Google Maps integration (which we validated in our technical research).
3.  It allows us to deliver a high-quality "Native" feel for the MVP.

## 5. Next Steps
* Initialize the project repository with the chosen framework boilerplate.
* Install Map SDK dependencies.
* Create the first "Hello World" screen showing the user's location on a map.