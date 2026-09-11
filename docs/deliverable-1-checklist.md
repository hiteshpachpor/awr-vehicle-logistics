# Deliverable 1 checklist

The brief asks for a working Next.js app: trip APIs, live location, a simulator, and an operations dashboard. This is how that list maps onto what is in the repo. The architecture presentation and live walkthrough are separate deliverables; they are not done here.

The brief also says authentication does not need to be in code, and that a testing strategy belongs in the presentation. Those stay out of this checklist.

## Backend

| Requirement | Status |
| --- | --- |
| `POST /api/trips` and `GET /api/trips/:id` | Done. There is also a list endpoint with filters, and `PATCH` to start, complete, cancel, or assign a driver. |
| `POST /api/trips/:id/location` with `{ lat, lng, timestamp, speed? }` | Done. `eventId` is optional and makes a ping idempotent. |
| WebSocket or SSE, without polling | SSE at `GET /api/trips/:id/events`. Clients can reconnect with `Last-Event-ID` and the server replays missed positions. |
| Server-side trip simulator, configurable interval, predefined route | Done. It walks the same Mapbox driving route the map draws, with a straight-line fallback. Interval and distance per ping are configurable. |
| Data store, with a justification | PostgreSQL 17 with Drizzle. The justification lives in [technical decisions](technical-decisions.md). |

## Dashboard

| Requirement | Status |
| --- | --- |
| Active trips list with status | Done. The queue shows Scheduled, In transit, Completed, and Cancelled, with search and pagination. |
| Live map with a moving marker | Done. Mapbox map, driving polyline, marker updates over SSE. |
| Trip timeline of location pings | Done. The ping log shows device time, received time, speed, and source. |
| Vendor simulator panel: start, stop, interval | Done. Drivers start a simulated trip from a dialog that sets the update interval (and distance per ping). Ending the trip, or letting it reach drop-off, stops it. |
| Responsive desktop and tablet | Done. Split layout on large screens; Details, Map, and Locations tabs on smaller viewports. |

## Still outstanding for the assignment

- **Deliverable 2 — architecture presentation (PPT/PDF).** Required, and a large part of the score. Auth, scale, security, analytics, testing strategy, and deployment belong there.
- **Live walkthrough.** A session, not a file in the repo.

The brief names several testing layers (component tests, Playwright, k6). We have unit tests, handler tests, and Testcontainers for the database. The rest is presentation material unless we decide to add it later.
