# API

These are the HTTP endpoints the app uses. There is no authentication on them; the demo session only lives in the browser.

Unless noted, JSON request bodies are validated with Zod. Errors come back as `{ "error": { "code", "message", "details?" } }`.

## Lookups

```text
GET /api/customers
GET /api/vehicles?customerId=:id
GET /api/vendors
GET /api/drivers
```

These feed the New Trip form and driver assignment. Vehicles are scoped to a customer. Vendors and drivers are the active ones.

`POST /api/google-maps/resolve` accepts `{ "url": "..." }` and returns a place name with coordinates from a Google Maps link, including `maps.app.goo.gl` short links.

`GET /api/health` checks that PostgreSQL is reachable.

## Trips

```text
POST  /api/trips
GET   /api/trips
GET   /api/trips?status=in_transit
GET   /api/trips?vendorId=:id
GET   /api/trips?driverId=:id
GET   /api/trips/:id
PATCH /api/trips/:id
GET   /api/trips/:id/positions
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

Start or complete:

```json
{ "status": "in_transit" }
```

Assign a driver before the trip starts:

```json
{ "driverId": "00000000-0000-4000-8000-000000000004" }
```

Allowed transitions are `created → in_transit → completed`. Created and in-transit trips may also be cancelled. A driver has to be assigned before a trip can start.

## Location

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

`eventId` is optional and is unique per trip. Device time is stored as `recorded_at`; the time the server accepted the POST is `received_at`.

The driver workspace queues GPS pings while offline and POSTs them later with the original device `timestamp` and a stable `eventId`.

## Live events

```text
GET /api/trips/:id/events
Accept: text/event-stream
Last-Event-ID: 42
```

The stream emits `position` events and heartbeat comments. The numeric position id is the SSE cursor. On reconnect, missed rows are replayed from PostgreSQL.

## Simulator

```text
GET    /api/trips/:id/simulation
POST   /api/trips/:id/simulation
DELETE /api/trips/:id/simulation
```

`POST` starts a scheduled trip and walks the same Mapbox driving route shown on the map. The body may include `intervalMs` (1,000–60,000) and `stepMeters` (100–20,000). Defaults are a ping every 5 seconds, advancing 1 km.

It posts one GPS ping immediately at pickup, then one at each interval, through the same ingestion path as vendor traffic. Speed is derived from those two values (3 km every 10 seconds is 1,080 km/h). After the last drop-off ping, it waits one more interval and completes the trip. If Mapbox directions are unavailable, it falls back to a straight line between pickup and drop-off.

`GET` reports whether a simulation is running. `DELETE` stops the current run without completing the trip.
