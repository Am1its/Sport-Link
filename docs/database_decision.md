# Architecture Decision Record: Database Strategy

**Date:** 2026-02-04  
**Status:** Proposed  
**Context:** SportLink requires a database that can handle structured relationships (Users joining Events at specific Locations) and perform efficient geospatial queries (e.g., "Find open football games within 2km").

## 1. The Context
The core data requirements for the MVP are:
* **Relational Integrity:** We need to link Users to Events and Events to Locations without data duplication.
* **Geospatial Support:** High-performance querying for coordinates (Lat/Lng) to support the "Nearby" feature.
* **Complex Filtering:** Ability to filter events by multiple criteria simultaneously (Location + Time + Sport Type + Skill Level).

## 2. Options Considered

### Option A: PostgreSQL (Relational / SQL)
* **Pros:** Industry standard for structured data. **PostGIS** extension offers the world's best open-source geospatial support. Strongly typed schema prevents data corruption.
* **Cons:** Requires defining a schema upfront (less flexible than NoSQL during early prototyping).

### Option B: MongoDB (NoSQL / Document)
* **Pros:** Flexible schema (easy to change fields on the fly). Native JSON storage matches our API responses perfectly.
* **Cons:** Handling complex many-to-many relationships (e.g., "Show me all users who played at Sportek last week") is harder than in SQL. ACID transactions are more complex.

### Option C: Firebase Firestore (BaaS)
* **Pros:** Built-in real-time updates (great for the Chat feature). Serverless (no backend maintenance).
* **Cons:** Limited querying capabilities (complex filters like "Location AND Time AND Type" are difficult). Vendor lock-in.

## 3. Decision Matrix

| Criterion | PostgreSQL | MongoDB | Firebase |
| :--- | :--- | :--- | :--- |
| **Geospatial Querying** | Excellent (PostGIS) | Good ($near) | Basic |
| **Relational Data** | Excellent (Joins) | Fair ($lookup) | Poor |
| **Real-Time** | Requires Setup | Requires Setup | Built-in |
| **Complex Queries** | High | Medium | Low |

## 4. The Verdict (Decision)

**We have decided to proceed with: PostgreSQL**

**Reasoning:**
Since SportLink is heavily dependent on relationships (Users <-> Games <-> Locations) and location-based sorting, **PostgreSQL** is the superior choice.
1.  **PostGIS**: Allows us to perform advanced radius searches efficiently.
2.  **Data Integrity**: Ensures that if a User is deleted, their sign-ups are handled correctly (Foreign Keys).
3.  **Future Proofing**: SQL allows for complex analytics later (e.g., "Most popular sport in Tel Aviv").
*Note: We may use a lightweight Redis instance or Firebase specifically for the Chat feature, but the core data will live in Postgres.*

## 5. Next Steps
* Set up a hosted PostgreSQL instance (e.g., on Supabase, Render, or Neon).
* Run the initial migration script (`schema.sql`) defined in our HLD.
* Connect the Node.js backend using an ORM like **Prisma** or **Sequelize**.