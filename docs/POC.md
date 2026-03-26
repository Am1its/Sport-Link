# Proof of Concept (PoC) - SportLink

**Date:** March 2026
**Status:** ✅ Successfully Demonstrated

## 🎯 PoC Objective
The goal of this PoC is to validate the core technical flow of SportLink: displaying real-world sports facilities on a mobile map by integrating our chosen stack (React Native -> Node.js -> Google Places API).

## 🛠️ Components Demonstrated
1. **Frontend (Mobile):** A React Native application rendering a native Google Map via `react-native-maps`.
2. **Backend (API):** A Node.js/Express server exposing a `/api/courts/nearby` endpoint.
3. **External Integration:** The backend successfully queries the Google Places API (using keyword search) and parses the JSON response.
4. **Data Flow:** The mobile client fetches the parsed data from our backend and correctly places markers (Pins) on the map corresponding to the courts' Lat/Lng coordinates.

## 📱 The "Happy Path" Executed
* **Action:** User opens the app.
* **Process:** The app requests courts near Central Tel Aviv.
* **Result:** The map centers on Tel Aviv and displays a marker for "Sportek Tel Aviv" (and other local courts).

## 🚀 Next Steps (Towards Full Prototype)
* Connect the Node.js backend to **PostgreSQL/PostGIS** to save user-created games.
* Implement user authentication.
* Build the "Create Game" UI lobby.
