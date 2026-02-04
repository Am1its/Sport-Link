# SportLink - Project Charter & Research

## 🚀 The Vision (Think Big)
To enable anyone to find sports partners easily, without relying on their existing social circle.
We aim for SportLink to be the essential app for anyone moving to a new city, looking to build their athletic community.

## 🎯 MVP Scope (Start Small)
For the current development phase (ending September 2026), we are focusing on:
* **Core Value**: Finding people to play with, easily and quickly.
* **Features**: Create/Join nearby games, filter by time/location/skill level, and real-time connection.
* **Target**: Single city deployment with a limited number of sports to validate user engagement.

## 🧪 Technical Validation (Phase 1)
*Date: Jan 11, 2026*

We have successfully validated the core technical requirement: fetching real-time athletic facility data using Google Places API.

### The Challenge
Initial tests using the specific `stadium` place type returned `ZERO_RESULTS` in our target area, failing to identify community courts.

### The Solution
We pivoted to a flexible search strategy using `keyword` query parameters (e.g., `keyword=sport+court`). This successfully identified local hubs like **Sportek Tel Aviv** and **"New" Sport Centre**.

### Status
✅ **PASSED** - API communication, coordinate extraction, and location data retrieval are fully functional.

---
*Documented for the MTA Computer Science School - Software Entrepreneurship Workshop 2025*
