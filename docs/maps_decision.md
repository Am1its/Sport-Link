# Architecture Decision Record: Mapping & Places Provider

**Date:** 2026-02-04
**Status:** Decided

## 1. The Context
SportLink relies entirely on accurate location data. We need two distinct services:
1.  **Maps SDK:** To display the interactive map on the mobile device.
2.  **Places API:** To search for specific facility types (courts, parks, gyms) and get their details (address, photos).

## 2. Options Considered

### Option A: Google Maps Platform
* **Pros:** Best-in-class data accuracy for Israel (Tel Aviv). Detailed "Places" database including small community parks. $200 monthly free credit covers our MVP needs.
* **Cons:** Expensive if we scale beyond the free tier.

### Option B: Mapbox
* **Pros:** Better map customization/styling capabilities. Slightly cheaper at scale.
* **Cons:** Their "Places" data is less comprehensive than Google's for local Israeli points of interest.

### Option C: OpenStreetMap (OSM)
* **Pros:** 100% Free and Open Source.
* **Cons:** Data relies on community updates. Specific metadata (like "is this basketball court open?") is often missing or outdated.

## 3. The Verdict

**We have decided to proceed with: Google Maps Platform**

**Reasoning:**
1.  **Data Quality:** For a "Social Discovery" app, a user failing to find a court is a critical failure. Google provides the most reliable dataset for public facilities in Tel Aviv.
2.  **Ease of Integration:** The `react-native-maps` library has first-class support for Google Maps.
3.  **Validation:** Our technical validation (see `TECHNICAL_VALIDATION.md`) proved we can successfully query courts using Google's API.
