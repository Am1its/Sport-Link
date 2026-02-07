# High-Level Design (HLD) - SportLink

> **Note:** This technical design is derived from the User Personas and Stories defined in the [Product Definitions](PRODUCT_DEFINITIONS.md). The architecture is optimized to support location-based discovery (Persona: "Newcomer") and real-time event management (Persona: "Organizer").

## 1. System Architecture
The system follows a classic **Client-Server** architecture optimized for location-based services.

```mermaid
graph TD
    Client["📱 Mobile App (React Native)"]
    Server["⚙️ Backend API (Node.js)"]
    DB[("🗄️ Database (PostgreSQL)")]
    Google["🌍 Google Places API"]

    Client -- "1. User Requests (Search/Join)" --> Server
    Server -- "2. Query Locations" --> Google
    Server -- "3. Read/Write Data" --> DB
    Server -- "4. JSON Response" --> Client
```

---

## 2. Database Design (ERD)
We use a **Relational Model** to ensure data integrity between Users, Events, and Locations.

```mermaid
erDiagram
    USERS ||--o{ EVENTS : "hosts"
    USERS ||--o{ PARTICIPANTS : "joins"
    LOCATIONS ||--o{ EVENTS : "hosts"
    EVENTS ||--o{ PARTICIPANTS : "includes"

    USERS {
        int user_id PK
        string full_name
        int skill_level "1-5"
        string[] favorite_sports
    }
    
    LOCATIONS {
        string place_id PK "Google Place ID"
        string name
        float latitude
        float longitude
        string address
    }

    EVENTS {
        int event_id PK
        int host_id FK
        string place_id FK
        string sport_type
        datetime event_time
        int max_players
        string status "Open/Full"
    }

    PARTICIPANTS {
        int event_id PK "FK"
        int user_id PK "FK"
        datetime joined_at
    }
```

### Key Design Decisions:
1.  **Locations Table**: We store locations using their unique **Google Place ID** as the Primary Key. This prevents duplicate venues and allows easy re-fetching of updated data from Google.
2.  **Participants Table**: A junction table that manages the Many-to-Many relationship between Users and Events, preventing race conditions when joining a game.

---

## 3. Core API Endpoints (Draft)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **GET** | `/api/events/nearby` | Find events within X km radius (uses PostGIS). |
| **POST** | `/api/events` | Create a new game at a specific location. |
| **POST** | `/api/events/:id/join` | Add current user to the participant list. |
| **GET** | `/api/locations/search` | Proxy request to Google Places API (to hide API keys). |
