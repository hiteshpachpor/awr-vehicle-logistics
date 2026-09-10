# AWR Vehicle Live Tracking

Backend foundation for the AWR vehicle live-tracking assignment. It provides
trip management, vendor location ingestion, PostgreSQL-backed SSE delivery, and
a configurable trip simulator. The dashboard will be implemented separately.

## Architecture

The application runs as a long-lived Next.js Node process with PostgreSQL as
its source of truth.

```text
Driver → location API → trip_positions → PostgreSQL NOTIFY
                                             ↓
Dashboard ← SSE endpoint ← PostgreSQL LISTEN + database replay
```

Location ingestion is independent of connected dashboards. Notifications are
lightweight and non-durable; position rows are durable. SSE clients reconnect
with `Last-Event-ID`, and the server replays missed positions from PostgreSQL.

## Requirements

- Docker with Docker Compose, or
- Node.js 22+ and PostgreSQL 17+

## Run with Docker

```bash
docker compose up --build
```

This starts PostgreSQL, waits for it to become healthy, applies migrations,
loads deterministic demo data, and starts the application on
<http://localhost:3000>.

The seed contains 30 fictional UAE vehicle owners, one vehicle per owner, five
imaginary logistics vendors, ten drivers, and a ready-to-start trip. Vehicle
volume follows the requested distribution: Nissan 12, INFINITI 7, Renault 5,
Chery 4, and Zeekr 2.

Primary seeded identifiers:

```text
Customer: 00000000-0000-4000-8000-000000000001
Vehicle:  00000000-0000-4000-8000-000000000002
Vendor:   00000000-0000-4000-8000-000000000003
Driver:   00000000-0000-4000-8000-000000000004
Trip:     00000000-0000-4000-8000-000000000005
```

### Docker development with hot reload

```bash
npm run docker:dev
```

The development override bind-mounts the project into the container, keeps
container-managed `node_modules` and `.next` volumes, and runs Next.js in
development mode. Changes under `src` are reflected without rebuilding the
image. Polling is enabled so file changes are detected reliably by Docker
Desktop on macOS.

Stop the development stack with:

```bash
npm run docker:down
```

Reset all local data:

```bash
docker compose down --volumes
```

## Run locally

Copy `.env.example` to `.env`, start PostgreSQL, then run:

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Set `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` to a URL-restricted public Mapbox token
to enable the operations map.

To truncate all application tables, reset identity sequences, and reload the
deterministic dataset:

```bash
npm run db:seed -- --reset-db
```

The reset flag is destructive. Drizzle's migration history is intentionally
preserved so applied migrations are not rerun.

## API

### Operations lookups

```text
GET /api/vehicles
GET /api/drivers
```

These endpoints provide vehicle and active-driver options with their related
customer and logistics-vendor details for the operations trip form.

### Trips

```text
POST  /api/trips
GET   /api/trips
GET   /api/trips?status=in_transit
GET   /api/trips/:id
PATCH /api/trips/:id
```

Create a trip:

```json
{
  "vehicleId": "00000000-0000-4000-8000-000000000002",
  "driverId": "00000000-0000-4000-8000-000000000004",
  "pickup": {
    "address": "AWR Showroom, Dubai",
    "lat": 25.2048,
    "lng": 55.2708
  },
  "dropoff": {
    "address": "Customer Address, Sharjah",
    "lat": 25.3463,
    "lng": 55.4209
  }
}
```

Start or complete a trip:

```json
{ "status": "in_transit" }
```

Allowed transitions are `created → in_transit → completed`; created and
in-transit trips may also be cancelled.

### Location ingestion

```text
POST /api/trips/:id/location
```

```json
{
  "lat": 25.2048,
  "lng": 55.2708,
  "timestamp": "2026-09-10T18:00:00Z",
  "speed": 12.5,
  "eventId": "vendor-message-123"
}
```

`eventId` is optional and provides idempotency within a trip. Device time is
stored as `recorded_at`; server receipt time is stored separately.

### Live events

```text
GET /api/trips/:id/events
Accept: text/event-stream
Last-Event-ID: 42
```

The endpoint emits `position` events and heartbeat comments. The numeric
position ID is the SSE cursor.

### Simulator

```text
POST   /api/trips/:id/simulation
DELETE /api/trips/:id/simulation
```

```json
{ "intervalMs": 1000 }
```

Starting a simulator starts a newly created trip. It sends the predefined route
through the same ingestion service as vendor traffic and completes the trip
when the route is exhausted. Deleting stops the current simulation without
completing the trip.

## Quality checks

```bash
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run build
```

Database integration tests use Testcontainers and therefore require a running
Docker daemon. They apply migrations to a fresh PostgreSQL instance and verify
constraints, idempotent seeding, and `LISTEN/NOTIFY`.

## Production considerations

This implementation intentionally targets the assignment's single-instance
Docker deployment. The in-process simulator registry is not distributed. For a
multi-instance production deployment, move simulation scheduling to a worker
and replace PostgreSQL notifications with a durable broker or managed real-time
service. Authentication, authorization, rate limiting, observability, and
location-retention policies are presentation concerns and are not implemented.
