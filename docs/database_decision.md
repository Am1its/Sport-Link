# Architecture Decision Record: Database Strategy

**Date:** 2026-02-04  
**Revised:** 2026-05-05  
**Status:** Accepted  
**Context:** SportLink requires a database that can handle structured relationships (Users joining Games at specific Locations) and perform efficient geospatial queries (e.g., "Find open football games within 2km").

## 1. The Context
The core data requirements for the MVP are:
* **Relational Integrity:** We need to link Users to Games and Games to Locations without data duplication.
* **Geospatial Support:** Querying nearby games by coordinates (Lat/Lng) to support the map feature.
* **Complex Filtering:** Ability to filter games by multiple criteria simultaneously (Location + Time + Sport Type + Skill Level).

## 2. Options Considered

### Option A: PostgreSQL (Relational / SQL)
* **Pros:** Industry standard for structured data. **PostGIS** extension offers the world's best open-source geospatial support. Strongly typed schema prevents data corruption.
* **Cons:** Requires defining a schema upfront (less flexible during early prototyping). PostGIS adds operational overhead for a student project scope. Fewer hosting options that are free and easy to set up locally.

### Option B: MySQL / MariaDB (Relational / SQL)
* **Pros:** Widely available, easy local setup (`brew install mysql`), excellent `mysql2` Node.js driver with async/await support. `DECIMAL(10,8)` columns handle lat/lng precision without a spatial extension. Very fast for the read-heavy patterns SportLink uses.
* **Cons:** No native PostGIS-equivalent; radius queries require computing distance in application logic or with `ST_Distance_Sphere`. Less advanced window functions than Postgres.

### Option C: MongoDB (NoSQL / Document)
* **Pros:** Flexible schema (easy to change fields on the fly). Native JSON storage matches API responses.
* **Cons:** Handling complex many-to-many relationships (Users ↔ Games ↔ Ratings) is harder than in SQL. ACID transactions are more complex.

### Option D: Firebase Firestore (BaaS)
* **Pros:** Built-in real-time updates (great for the Chat feature). Serverless.
* **Cons:** Limited querying capabilities (complex filters like "Location AND Time AND Type" are difficult). Vendor lock-in.

## 3. Decision Matrix

| Criterion | MySQL / MariaDB | PostgreSQL | MongoDB | Firebase |
| :--- | :--- | :--- | :--- | :--- |
| **Relational Data** | Excellent | Excellent | Fair | Poor |
| **Geospatial Querying** | Good (ST_Distance_Sphere) | Excellent (PostGIS) | Good ($near) | Basic |
| **Complex Queries** | High | High | Medium | Low |
| **Real-Time** | Requires Setup | Requires Setup | Requires Setup | Built-in |
| **Local Dev Setup** | Very Easy | Moderate | Easy | Easy |
| **Node.js Ecosystem** | Excellent (mysql2) | Good (pg) | Excellent (mongoose) | Good |

## 4. The Verdict (Decision)

**We have decided to proceed with: MySQL / MariaDB**

**Reasoning:**

During prototyping we migrated from the originally proposed PostgreSQL to **MySQL/MariaDB** based on practical constraints and performance observations:

1. **Simplicity of setup:** MySQL is available out of the box on the team's machines and on standard shared hosting. No extension installation required.
2. **Raw SQL over ORM:** We use `mysql2/promise` with `pool.execute()` directly — no Sequelize, no Prisma. This gives us full query control and zero abstraction overhead, which is appropriate for a well-defined schema that changes rarely.
3. **Sufficient geospatial support:** Nearby-game queries are delegated to the Google Places API for courts. For community games, coordinates are stored as `DECIMAL(10,8)` / `DECIMAL(11,8)` and proximity filtering is handled at the application layer — fully sufficient for the current scale.
4. **Schema integrity:** Foreign keys, ENUMs, CHECK constraints (`level BETWEEN 1 AND 5`), and `UNIQUE` constraints (e.g. on `GameParticipants`, `Ratings`) provide the same relational guarantees as Postgres for this use case.

## 5. Final Schema

| Table | Key Columns |
| :--- | :--- |
| `Users` | `id`, `username`, `email`, `password_hash`, `created_at` |
| `Games` | `id`, `host_id`, `sport_type` (ENUM), `level` (TINYINT 1–5), `latitude`, `longitude`, `location_desc`, `scheduled_time` (VARCHAR), `max_players`, `status` |
| `GameParticipants` | `id`, `game_id`, `user_id`, `joined_at` — UNIQUE on `(game_id, user_id)` |
| `Messages` | `id`, `game_id`, `user_id`, `username`, `content`, `created_at` |
| `Ratings` | `id`, `game_id`, `rater_id`, `ratee_id`, `attended` (BOOL), `created_at` — UNIQUE on `(game_id, rater_id, ratee_id)` |

## 6. Next Steps
* ~~Set up a hosted PostgreSQL instance~~ — replaced by local MySQL/MariaDB instance.
* Run migration scripts in order: `schema.sql` → `001_add_participants.sql` → `002_add_messages.sql` → `003_add_ratings.sql`.
* If scale requires geospatial indexing in the future, consider adding `SPATIAL` indexes on lat/lng columns or migrating to PostGIS at that point.
