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

| ID | As a... | I want to... | So that... | **Technical Solution (HLD)** |
| :--- | :--- | :--- | :--- | :--- |
| **US-1** | **Newcomer** | See all active games within 2km of my location | I can walk to the game without driving. | **PostgreSQL + PostGIS** for efficient geospatial radius queries. |
| **US-2** | **Organizer** | Open a game at a specific, verified court | Players know exactly where to meet. | **Google Places API** ensures the location exists and has coordinates. |
| **US-3** | **Newcomer** | Filter games by skill level (1-5) | I don't join a pro league and embarrass myself. | **SQL Schema** with structured columns for filtering (not unstructured NoSQL). |
| **US-4** | **Organizer** | See in real-time when someone joins my game | I can stop searching for players. | **Node.js** backend handling concurrent requests and status updates. |

