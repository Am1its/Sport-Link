# Technical Validation Log: Google Places API

**Date:** Jan 11, 2026
**Component:** Geolocation & Places Service
**Status:** ✅ VALIDATED

## 1. The Challenge
Our initial requirement was to identify public sports facilities (basketball courts, football pitches) in Tel Aviv to populate the map.

### The Failure (Attempt #1)
We attempted to use the Google Places API `nearbySearch` with the parameter `type=stadium`.
* **Request:** Look for "stadiums" within 2km of Tel Aviv center.
* **Result:** `ZERO_RESULTS` or irrelevant professional stadiums only.
* **Root Cause:** Most public parks and community courts are not classified as "stadiums" in Google's taxonomy.

## 2. The Solution (Pivot)
We shifted our strategy to use **Keyword Search** instead of strict Type categorization.

### The Fix (Attempt #2)
* **New Parameter:** `keyword=sport+court` OR `keyword=football+field`.
* **Refinement:** Filtered results by ranking and distance.

### Sample JSON Response (Success)
We successfully retrieved data for **Sportek Tel Aviv**:
```json
{
   "business_status": "OPERATIONAL",
   "geometry": {
      "location": {
         "lat": 32.09668,
         "lng": 34.78685
      }
   },
   "name": "Sportek Tel Aviv",
   "place_id": "ChIJT8... (verified)",
   "rating": 4.6
}
```

## 3. Conclusion
The **Google Places API** is viable for the MVP, provided we use specific keyword combinations rather than generic place types. We have confirmed we can extract:
1.  Coordinates (Lat/Lng) for the map.
2.  Place Names for the UI.
3.  Place IDs for our Database primary keys.
