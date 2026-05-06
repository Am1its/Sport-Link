# Product Definitions: Personas & User Stories

To ensure our technical architecture serves real user needs, we have defined the following personas and user stories. The system's HLD is directly derived from these requirements.

## 👥 1. User Personas

### Persona A: Idan, The "Newcomer"
* **Age:** 26
* **Status:** Student, just moved to Tel Aviv.
* **Pain Point:** Loves football but his friends live in another city. He feels awkward going to a court alone hoping to join a game.
* **Goal:** Wants to find a friendly amateur game nearby happening *tonight*.

### Persona B: Maya, The "Organizer"
* **Age:** 31
* **Status:** Tech Team Lead, organizes a weekly basketball group.
* **Pain Point:** Every week, 1-2 players cancel last minute. She spends hours on WhatsApp trying to find replacements to avoid canceling the court booking.
* **Goal:** Wants to instantly broadcast a "1 spot left" alert to relevant players in the area.

---

## 📖 2. User Stories & Technical Implications

Here is how user needs translate into our architectural choices:

| ID | As a... | I want to... | So that... | **Technical Solution (Implemented)** |
| :--- | :--- | :--- | :--- | :--- |
| **US-1** | **Newcomer** | See all active games within X km of my location | I can walk to the game without driving. | **Haversine formula** in `GET /api/games?radius_km=` + radius chips in Discover screen. |
| **US-2** | **Organizer** | Open a game at a specific, verified court | Players know exactly where to meet. | **Google Places API** (4 parallel queries) — court picker pre-fills game location. |
| **US-3** | **Newcomer** | Filter games by skill level (1-5) | I don't join a pro league and embarrass myself. | `level` column in `Games` + filter UI in Discover; level badge on map markers. |
| **US-4** | **Organizer** | See in real-time when someone joins my game | I can stop searching for players. | **Push notification** on join + **socket.io** group chat for coordination. |
| **US-5** | **Organizer** | Fill a last-minute spot quickly | The game doesn't get cancelled. | Urgency badge (≤2 spots left) in Discover + 30-min reminder push to all participants. |
| **US-6** | **Newcomer** | Trust that my teammates will show up | I don't waste a trip to the court. | **Karma score** from host attendance ratings + peer category ratings. |
| **US-7** | **Player** | Chat with my game group | We can coordinate meetup details. | **socket.io** room per game — real-time, no polling. |
| **US-8** | **Player** | See notifications I missed | I don't miss important game updates. | **Notification inbox** — all push payloads persisted to DB; unread badge on profile. |
| **US-9** | **Player** | Add friends and invite them to my games | I play with people I already know. | **Friends system** + invite chips in the Create Game modal. |

