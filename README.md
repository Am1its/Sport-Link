# SportLink - Find Your Match. Play Your Game.

**SportLink** is a social platform designed to help people find sports partners in real-time.
Our mission is to transform fragmented sports communities (currently scattered across Facebook and WhatsApp) into a single, efficient, and location-based ecosystem.

## 🚀 The Vision (Think Big)
To enable anyone to find sports partners easily, without relying on their existing social circle.
We aim for SportLink to be the essential app for anyone moving to a new city, looking to build their athletic community.

## 🎯 MVP Scope (Start Small)
For the current development phase (ending September 2026), we are focusing on:
* **Core Value**: Finding people to play with, easily and quickly.
* **Features**: Create/Join nearby games, filter by time/location/skill level, and real-time connection.
* **Target**: Single city deployment with a limited number of sports to validate user engagement.

## 🛠️ Technical Feasibility & Stack
Our project relies on proven location-based technologies:
* **Frontend**: React Native (Targeting Mobile)
* **Backend**: Node.js
* **Database**: MongoDB / PostgreSQL
* **External APIs**: Google Maps Platform (Places & Maps JavaScript API)

## 🧪 Technical Validation (Phase 1)
We have successfully validated the core technical requirement: fetching real-time athletic facility data.
* **Challenge**: Initial tests with the `stadium` type returned `ZERO_RESULTS`.
* **Solution**: Pivoted to `keyword` and `field` searches (keyword=sport+court), successfully identifying local hubs like **Sportek Tel Aviv** and **"New" Sport Centre**.
* **Status**: **OK** - API communication and location data retrieval are fully functional.

## 📅 Roadmap (Gantt Overview)
1. **Jan 11, 2026**: Tech Validation (Completed) 
2. **Jan 18, 2026**: High-Level Design (HLD) 
3. **Mar 15, 2026**: Proof of Concept (PoC) 
4. **May 10, 2026**: Full Prototype 
5. **Sep 8,  2026**: Final Submission & Pitch 

## 👥 The Team
* **Amit Oved** 
* **Gal Libal** 

---
*Developed as part of the MTA Computer Science School - Software Entrepreneurship Workshop 2025*
