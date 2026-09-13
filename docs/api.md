# API

This page lists the HTTP endpoints used by the app. The endpoints have no authentication, and the demo session is stored only in the browser.

JSON request bodies are validated with Zod unless a section says otherwise. Errors use this format: `{ "error": { "code", "message", "details?" } }`.

## Lookups

```text
GET /api/customers
GET /api/vehicles?customerId=:id
GET /api/vendors
GET /api/drivers
```

These endpoints provide the options for the New Trip form and for driver assignment. Vehicles are filtered by customer, and only active vendors and drivers are returned.

`POST /api/google-maps/resolve` accepts `{ "url": "..." }` and returns the place name and coordinates from a Google Maps link. Short links from `maps.app.goo.gl` are also supported.

`GET /api/health` checks whether the app can reach PostgreSQL.

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

Start or complete a trip:

```json
{ "status": "in_transit" }
```

Assign a driver before the trip starts:

```json
{ "driverId": "00000000-0000-4000-8000-000000000004" }
```

A trip moves from `created` to `in_transit` to `completed`. A trip that is `created` or `in_transit` can also be cancelled. A driver must be assigned before a trip can start.

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

`eventId` is optional and must be unique within a trip. The device time is stored as `recorded_at`, and the time the server accepted the request is stored as `received_at`.

When the driver is offline, the driver workspace keeps GPS pings in a queue. It sends them later with the original device `timestamp` and the same `eventId`.

## Live events

```text
GET /api/trips/:id/events
Accept: text/event-stream
Last-Event-ID: 42
```

This stream sends `position` events, along with heartbeat comments to keep the connection open. Each position's numeric ID is used as the SSE event ID. When a client reconnects, the positions it missed are loaded from PostgreSQL and sent first.

```text
GET /api/trips/events
GET /api/trips/events?vendorId=:id
Accept: text/event-stream
```

This stream sends a `trip.updated` event when a trip is created, when a driver is assigned, or when the status changes (`created`, `in_transit`, `completed` or `cancelled`). The payload is `{ type, from?, to?, trip }`, where `trip` has the same shape as the response from `GET /api/trips/:id`. Operations connects without `vendorId`, and a vendor controller passes their own vendor ID. Missed events are not replayed, so after reconnecting, clients fetch `GET /api/trips` again.

## Simulator

```text
GET    /api/trips/:id/simulation
POST   /api/trips/:id/simulation
DELETE /api/trips/:id/simulation
```

`POST` starts a scheduled trip and moves the vehicle along the same Mapbox driving route shown on the map. The body can include `intervalMs` (1,000 to 60,000) and `stepMeters` (100 to 20,000). By default, a ping is sent every 5 seconds and the vehicle moves 1 km each time.

The first GPS ping is sent straight away at the pickup point, and then one ping is sent at each interval. The pings go through the same location API as vendor traffic. The speed is calculated from the interval and the distance, so 3 km every 10 seconds is 1,080 km/h. After the last ping at the drop-off point, the simulator waits one more interval and completes the trip. If Mapbox directions are not available, it uses a straight line between pickup and drop-off.

`GET` shows whether a simulation is running. `DELETE` stops the current simulation and leaves the trip in transit.
