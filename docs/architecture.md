# SportLink — Architecture Diagrams

Paste any block into [mermaid.live](https://mermaid.live) or view natively in GitHub / Obsidian / Notion.

---

## 1. Screen Navigation Flow

```mermaid
flowchart TD
    ROOT["index.tsx\n(routing gate)"]

    ROOT -->|no token| LOGIN["login.tsx"]
    ROOT -->|token + !onboarding| ONBOARDING["onboarding.tsx\n(4-step wizard)"]
    ROOT -->|token + onboarding| TABS

    LOGIN -->|success| TABS
    LOGIN -->|new user| REGISTER["register.tsx"]
    LOGIN -->|Google OAuth| TABS
    REGISTER -->|success| ONBOARDING
    ONBOARDING -->|finish| TABS

    subgraph TABS ["/(tabs)"]
        MAP["index.tsx\nMap"]
        DISCOVER["discover.tsx\nDiscover"]
        GAMES["games.tsx\nMy Schedule"]
        CHAT["chat.tsx\nChat"]
        PROFILE["profile.tsx\nProfile"]
    end

    MAP -->|tap game/court| BOTTOMCARD["BottomCard\n(join/view)"]
    MAP -->|FAB → create| MODAL["modal.tsx\nCreate Game"]
    DISCOVER -->|tap game| MODAL_JOIN["join flow"]
    GAMES -->|Edit| MODAL
    GAMES -->|Chat| GAMECHAT["game-chat.tsx"]
    GAMES -->|Players| PARTICIPANTS["game-participants.tsx"]
    GAMES -->|Rate| RATEPLAYERS["rate-players.tsx"]
    GAMES -->|Results| GAMERESULTS["game-results.tsx"]
    CHAT -->|Events tab| GAMECHAT
    CHAT -->|Friends tab| DIRECTCHAT["direct-chat.tsx"]
    PROFILE -->|Leaderboard| LEADERBOARD["leaderboard.tsx"]
    PROFILE -->|Friends| FRIENDS["friends.tsx"]
    PROFILE -->|Sport Prefs| SPORTPREFS["sport-preferences.tsx"]
    PROFILE -->|Notifications| NOTIF["notification-inbox.tsx"]
    PROFILE -->|Notif Settings| NOTIFSETTINGS["notifications-settings.tsx"]
    PROFILE -->|Player Matching| PLAYERMATCHING["player-matching.tsx"]

    GAMECHAT -->|tap avatar| PLAYERPROFILE["player-profile.tsx"]
    PARTICIPANTS -->|tap row| PLAYERPROFILE
    LEADERBOARD -->|tap row| PLAYERPROFILE
    FRIENDS -->|tap friend| PLAYERPROFILE
    PLAYERPROFILE -->|Message btn| DIRECTCHAT
    MAP -->|court → View Details| COURTDETAIL["court-detail.tsx"]

    MODAL --> INVITE["invite/\n(invite friends)"]
```

---

## 2. Auth Flow

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant BE as Backend
    participant G as Google OAuth
    participant AS as AsyncStorage

    rect rgb(40,40,60)
        Note over U,AS: Email / Password Login
        U->>FE: enter email + password
        FE->>BE: POST /api/auth/login
        BE-->>FE: { token, user }
        FE->>AS: store token
        FE->>FE: router.replace(onboarding or tabs)
    end

    rect rgb(40,60,40)
        Note over U,AS: Google Sign-In (PKCE)
        U->>FE: tap Google button
        FE->>G: useAuthRequest (code_challenge)
        G-->>FE: auth code
        FE->>G: exchangeCodeAsync (+ code_verifier in extraParams)
        G-->>FE: access_token
        FE->>BE: POST /api/auth/google { access_token }
        BE->>G: GET userinfo endpoint
        G-->>BE: { email, name, google_id }
        BE-->>FE: { token, user }
        FE->>AS: store token
        FE->>FE: onboarding_complete? → tabs : onboarding
    end

    rect rgb(60,40,40)
        Note over U,AS: Registration → Onboarding
        U->>FE: fill username/email/password
        FE->>BE: POST /api/auth/register
        BE-->>FE: { token, user }
        FE->>AS: store token
        FE->>FE: router.replace('/onboarding')
        Note over FE: 4-step wizard:<br/>Photo → Bio → Sports → Levels
        FE->>BE: PUT /api/users/me (avatar, bio, onboarding_complete:true)
        FE->>BE: PUT /api/users/sport-preferences
        FE->>FE: router.replace('/(tabs)')
    end
```

---

## 3. API Route Map

```mermaid
graph LR
    FE["Frontend"]

    subgraph AUTH["/api/auth"]
        A1["POST /register"]
        A2["POST /login"]
        A3["POST /google"]
    end

    subgraph USERS["/api/users"]
        U1["GET /me"]
        U2["PUT /me"]
        U3["GET /search"]
        U4["GET /leaderboard"]
        U5["GET /avatars?ids="]
        U6["GET|PUT /sport-preferences"]
        U7["PUT /push-token"]
        U8["GET /suggestions"]
        U9["GET /:id (public profile)"]
    end

    subgraph GAMES["/api/games (sub-routers)"]
        G1["GET / (nearby, auth-optional)"]
        G2["GET /mine"]
        G3["POST / (create)"]
        G4["PUT /:id (edit)"]
        G5["DELETE /:id (cancel)"]
        G6["GET /:id/participants"]
        G7["POST /:id/join"]
        G8["DELETE /:id/leave"]
        G9["POST /:id/check-in"]
        G10["PUT /:id/complete"]
    end

    subgraph COURTS["/api/courts"]
        C1["GET /nearby"]
        C2["GET /photo?ref="]
        C3["GET /:placeId (detail)"]
        C4["GET /:placeId/reviews"]
        C5["POST /:placeId/reviews"]
        C6["DELETE /:placeId/reviews/:id"]
    end

    subgraph RATINGS["/api/ratings"]
        R1["GET /game/:id (unrated list)"]
        R2["GET /game/:id/results"]
        R3["POST /batch (host attendance)"]
        R4["POST /peer (participant ratings)"]
    end

    subgraph CHATS["/api/chats"]
        CH1["GET / (my chats)"]
        CH2["GET /:gameId/messages"]
        CH3["POST /:gameId/messages"]
    end

    subgraph DM["/api/dm"]
        D1["GET / (conversations)"]
        D2["GET /:userId (messages)"]
        D3["POST /:userId (send)"]
        D4["PUT /:userId/read"]
    end

    subgraph FRIENDS["/api/friends"]
        F1["GET / (accepted)"]
        F2["GET /requests"]
        F3["POST / (send request)"]
        F4["PUT /:id/accept"]
        F5["DELETE /:id"]
    end

    subgraph NOTIF["/api/notifications"]
        N1["GET /"]
        N2["PUT /:id/read"]
        N3["PUT /read-all"]
    end

    FE --> AUTH
    FE --> USERS
    FE --> GAMES
    FE --> COURTS
    FE --> RATINGS
    FE --> CHATS
    FE --> DM
    FE --> FRIENDS
    FE --> NOTIF
```

---

## 4. Real-Time Events (Socket.io)

```mermaid
sequenceDiagram
    participant FE1 as Client A
    participant SRV as Server (socket.io)
    participant FE2 as Client B

    Note over FE1,FE2: On connect — every client joins their personal room
    FE1->>SRV: join room "user_${myId}"
    FE2->>SRV: join room "user_${myId}"

    rect rgb(40,50,70)
        Note over FE1,FE2: Game Chat
        FE1->>SRV: emit "send_message" { gameId, content }
        SRV->>SRV: persist to Messages table
        SRV-->>FE1: emit "new_message" (to game room)
        SRV-->>FE2: emit "new_message" (to game room)
    end

    rect rgb(40,70,50)
        Note over FE1,FE2: Direct Messages
        FE1->>SRV: POST /api/dm/:userId (REST)
        SRV->>SRV: persist to DirectMessages table
        SRV-->>FE2: emit "new_dm" (to "user_${receiverId}" room)
        Note over FE2: receiver sees message in real-time
    end

    rect rgb(70,50,40)
        Note over FE1,FE2: Push Notifications (Expo)
        SRV->>SRV: sendPushNotifications helper
        SRV-->>FE2: Expo push to device token
        SRV->>SRV: persist to Notifications table
    end
```

---

## 5. Database Entity Relationships

```mermaid
erDiagram
    Users {
        int id PK
        string username
        string email
        string password_hash
        string google_id
        string bio
        text avatar
        string push_token
        bool onboarding_complete
    }

    Games {
        int id PK
        int host_id FK
        enum sport_type
        int level
        float latitude
        float longitude
        string location_desc
        string scheduled_time
        string equipment_notes
        text photo
        int max_players
        string title
        enum status
    }

    GameParticipants {
        int id PK
        int game_id FK
        int user_id FK
        datetime joined_at
    }

    Messages {
        int id PK
        int game_id FK
        int user_id FK
        string username
        text content
        datetime created_at
    }

    Ratings {
        int id PK
        int game_id FK
        int rater_id FK
        int ratee_id FK
        bool attended
    }

    PeerRatings {
        int id PK
        int game_id FK
        int rater_id FK
        int ratee_id FK
        tinyint sportsmanship
        tinyint punctuality
        tinyint communication
        tinyint skill
    }

    Friends {
        int id PK
        int requester_id FK
        int addressee_id FK
        enum status
    }

    DirectMessages {
        int id PK
        int sender_id FK
        int receiver_id FK
        text content
        enum type
        int event_id FK
        bool is_read
    }

    CourtReviews {
        int id PK
        string place_id
        int user_id FK
        tinyint rating
        string comment
    }

    SportPreferences {
        int id PK
        int user_id FK
        string sport_type
        tinyint skill_level
        bool is_favorite
    }

    Notifications {
        int id PK
        int user_id FK
        string title
        text body
        json data
        bool is_read
    }

    Users ||--o{ Games : "hosts"
    Users ||--o{ GameParticipants : "joins"
    Games ||--o{ GameParticipants : "has"
    Games ||--o{ Messages : "has"
    Users ||--o{ Messages : "sends"
    Users ||--o{ Ratings : "rates"
    Users ||--o{ PeerRatings : "peer-rates"
    Users ||--o{ Friends : "connects"
    Users ||--o{ DirectMessages : "sends/receives"
    Users ||--o{ CourtReviews : "writes"
    Users ||--o{ SportPreferences : "sets"
    Users ||--o{ Notifications : "receives"
    Games ||--o{ Ratings : "has"
    Games ||--o{ PeerRatings : "has"
    Games ||--o{ DirectMessages : "shared as event"
```

---

## 6. Game Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> active: POST /games (create)
    active --> active: join / leave participants
    active --> cancelled: DELETE /games/:id (host cancels)
    active --> completed: PUT /games/:id/complete (host closes)
    completed --> rated: POST /ratings/batch + /peer (all rate)
    cancelled --> [*]
    rated --> [*]

    note right of active
        - Participants can join/leave
        - Host can edit details
        - Socket chat open
    end note

    note right of completed
        - Host submits attendance (Ratings)
        - Participants submit peer ratings (PeerRatings)
        - Results visible after rating
    end note
```

---

## 7. Map Screen Logic (Dual Code Path)

```mermaid
flowchart TD
    BOOT["App boots"] --> CHECK{"Constants.appOwnership\n=== 'expo'?"}
    CHECK -->|YES — Expo Go| LEAFLET["ExpoGoMapScreen\n(LeafletMap WebView)"]
    CHECK -->|NO — Dev/Prod build| NATIVE["HomeScreen\n(react-native-maps)"]

    LEAFLET --> WEBVIEW["Leaflet 1.9.4\nCartoDB Voyager tiles\nMDI sport icons"]
    WEBVIEW -->|injectJS| BRIDGE["window.setMarkers()\nwindow.setView()\nwindow.setUser()\nwindow.zoomToCluster()"]
    BRIDGE -->|postMessage| EVENTS["type: ready | marker | mapclick | zoom"]

    NATIVE --> RNM["MapView + Markers\nCustom callouts"]

    subgraph SHARED["Shared state (both paths)"]
        FILTERS["All / Games / Courts\n+ 12 sport sub-chips"]
        CLUSTER["clusterGames()\nlatDelta threshold 0.012"]
        BOTTOMCARD["BottomCard join flow"]
        SOCKET["socket.io live updates"]
    end

    LEAFLET --> SHARED
    NATIVE --> SHARED
```
