# AWR Vehicle Live Tracking

Backend foundation for the AWR vehicle live-tracking assignment. It provides
trip management, vendor location ingestion, PostgreSQL-backed SSE delivery, and
a trip simulator that follows the mapped driving route.

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

## Demo workspaces

Open `/` and sign in with the password `password`.

- AWR Operations uses `/ops/trips` and can create trips, assign drivers, and
  cancel ready trips.
- A vendor Controller uses `/vendor/:vendorId/trips` and can assign that
  vendor's drivers.
- A Driver uses `/vendor/:vendorId/driver/:driverId/trips`, can start, simulate,
  and end assigned trips. Simulated trips follow the mapped route; real trips
  share browser geolocation while in transit.

The demo session is stored in the browser. APIs remain unauthenticated by
design.

## API

### Operations lookups

```text
GET /api/customers
GET /api/vehicles?customerId=:id
GET /api/vendors
GET /api/drivers
```

These endpoints provide customer, vehicle, active-vendor, and active-driver
options for operations workflows. New trips are assigned to a vendor; that
vendor assigns a driver separately.

### Trips

```text
POST  /api/trips
GET   /api/trips
GET   /api/trips?status=in_transit
GET   /api/trips?vendorId=:id
GET   /api/trips?driverId=:id
GET   /api/trips/:id
PATCH /api/trips/:id
```

Create a trip:

```json
{
  "vehicleId": "00000000-0000-4000-8000-000000000002",
  "vendorId": "00000000-0000-4000-8000-000000000003",
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

Assign a driver before the trip starts:

```json
{ "driverId": "00000000-0000-4000-8000-000000000004" }
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
GET    /api/trips/:id/simulation
POST   /api/trips/:id/simulation
DELETE /api/trips/:id/simulation
```

Starting a simulation starts a scheduled trip, then walks the same Mapbox
driving route shown on the map. It posts one GPS ping immediately at pickup
and another every 5 seconds, advancing 1 km along the polyline each time,
through the same ingestion service as vendor traffic. The trip stays in
transit when the vehicle reaches drop-off so the driver can end it. If Mapbox
directions are unavailable, the simulator falls back to a straight line
between pickup and drop-off. Deleting stops the current simulation without
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
