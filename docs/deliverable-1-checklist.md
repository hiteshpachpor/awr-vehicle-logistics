# Deliverable 1 checklist

The brief asked for a working Next.js app with trip APIs, live location updates, a simulator and an operations dashboard. This checklist shows where each requirement is covered in the app.

## Backend

| Requirement | Status |
| --- | --- |
| `POST /api/trips` and `GET /api/trips/:id` | Built. There is also a list endpoint with filters, and a `PATCH` endpoint to start, complete or cancel a trip, or to assign a driver. |
| `POST /api/trips/:id/location` with `{ lat, lng, timestamp, speed? }` | Built. An optional `eventId` makes sure a ping that is sent twice is saved only once. |
| WebSocket or SSE, without polling | Built with SSE at `GET /api/trips/:id/events`. Clients can reconnect with `Last-Event-ID`, and the server sends the positions they missed. |
| Server-side trip simulator with a configurable interval and a predefined route | Built. The simulator follows the same Mapbox driving route shown on the map, and uses a straight line if the route is not available. The update interval and the distance per ping can both be set. |
| Data store, with a justification | PostgreSQL 17 with Drizzle. The reasons are explained in [technical decisions](technical-decisions.md). |

## Dashboard

| Requirement | Status |
| --- | --- |
| Active trips list with status | The trip list shows Scheduled, In transit, Completed and Cancelled trips, with search and pagination. |
| Live map with a moving marker | A Mapbox map shows the driving route, and the vehicle marker moves as updates arrive over SSE. |
| Trip timeline of location pings | The ping log shows the device time, received time, speed and source of each ping. |
| Vendor simulator panel with start, stop and interval | The driver starts a simulated trip from a dialog, where the update interval and the distance per ping are set. The simulation stops when the driver ends the trip or when the vehicle reaches the drop-off point. |
| Responsive layout for desktop and tablet | Large screens show the trip details and map side by side. Smaller screens show them in Details, Map and Location pings tabs. |
