# Deliverable 1 checklist

The brief asked for a working Next.js app covering trip APIs, live location, a simulator, and an operations dashboard. Here is how that maps onto this repo.

## Backend

| Requirement | Status |
| --- | --- |
| `POST /api/trips` and `GET /api/trips/:id` | Built, plus a list endpoint with filters, and `PATCH` to start, complete, cancel, or assign a driver. |
| `POST /api/trips/:id/location` with `{ lat, lng, timestamp, speed? }` | Built. `eventId` is optional and makes a ping idempotent. |
| WebSocket or SSE, without polling | SSE at `GET /api/trips/:id/events`. Clients can reconnect with `Last-Event-ID` and the server replays missed positions. |
| Server-side trip simulator, configurable interval, predefined route | Built. It follows the same Mapbox driving route the map draws, with a straight-line fallback. Interval and distance per ping are configurable. |
| Data store, with a justification | PostgreSQL 17 with Drizzle. Why is in [technical decisions](technical-decisions.md). |

## Dashboard

| Requirement | Status |
| --- | --- |
| Active trips list with status | The queue shows Scheduled, In transit, Completed, and Cancelled, with search and pagination. |
| Live map with a moving marker | Mapbox map, driving polyline, marker updates over SSE. |
| Trip timeline of location pings | Ping log with device time, received time, speed, and source. |
| Vendor simulator panel: start, stop, interval | Drivers start a simulated trip from a dialog that sets the update interval (and distance per ping). Ending the trip, or letting it reach drop-off, stops it. |
| Responsive desktop and tablet | Split layout on large screens. Details, Map, and Locations tabs on smaller viewports. |
