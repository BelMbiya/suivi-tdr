# Track TDR Architecture

## System
```mermaid
flowchart LR
  Browser["Web Dashboard"] --> NextApp["Next.js 16 App Router"]
  NextApp --> Routes["Route Handlers"]
  Routes --> Services["Domain Services"]
  Services --> Repositories["Repositories"]
  Repositories --> Neon["Neon PostgreSQL PostGIS"]
  Services --> Redis["Redis RateLimit Presence"]
  Browser --> SocketClient["Socket.IO Client"]
  SocketClient --> SocketServer["Custom Next Server Socket.IO"]
  SocketServer --> RedisAdapter["Redis Adapter"]
```

## Database
```mermaid
erDiagram
  Organization ||--o{ User : owns
  Organization ||--o{ Area : owns
  Organization ||--o{ Location : owns
  User ||--o{ Session : has
  User ||--o{ UserRole : has
  Role ||--o{ UserRole : assigned
  User ||--o{ UserArea : assigned
  Area ||--o{ UserArea : contains
  Area ||--o{ Location : scopes
  Area ||--o{ Geofence : scopes
  User ||--o{ Location : emits
  Geofence ||--o{ GeofenceEvent : triggers
  User ||--o{ GeofenceEvent : causes
```

## Location Flow
```mermaid
sequenceDiagram
  participant Web
  participant API
  participant Service
  participant PostGIS
  participant Socket
  Web->>API: POST /api/locations
  API->>Service: validate Zod and authorize
  Service->>PostGIS: find assigned Area using ST_Contains
  Service->>PostGIS: insert Location
  Service->>PostGIS: evaluate Geofences
  Service->>Socket: emit location:update
  API-->>Web: success response
```

## Socket.IO
```mermaid
flowchart LR
  Client["Dashboard Client"] -->|"connect auth"| SocketServer["Socket.IO"]
  SocketServer --> OrgRoom["org:id room"]
  SocketServer --> AreaRoom["area:id room"]
  LocationService["Location Service"] -->|"location:update"| OrgRoom
  LocationService -->|"location:update"| AreaRoom
```

## Production Strategy
- Use Neon pooled `DATABASE_URL` for application traffic and direct `DIRECT_DATABASE_URL` for migrations.
- Enable PostGIS on Neon before applying migrations.
- Run `npm run prisma:deploy` during release, then start the app.
- Use Redis for rate limiting, Socket.IO adapter and presence.
- Keep the Next.js custom server when Socket.IO is required in the same process.
- Partition `Location` by month when write volume grows beyond the initial single-table threshold.

## Observability
- Log API errors and domain events as structured JSON.
- Track metrics: positions/minute, Socket.IO connections, ingestion latency, DB query latency, Redis latency, geofence events/minute, out-of-area rate.
- Recommended stack: Sentry for errors, OpenTelemetry traces, Prometheus/Grafana for metrics.

## Microservices Evolution
1. Extract location ingestion into a dedicated service.
2. Add a queue/event bus for high-volume position writes.
3. Extract realtime gateway for Socket.IO.
4. Move geofence evaluation to async workers.
5. Archive old locations to cold storage while keeping aggregates in PostgreSQL.
