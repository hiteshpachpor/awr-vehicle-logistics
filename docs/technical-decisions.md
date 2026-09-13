# Technical decisions

The brief left several choices open. This page explains what was chosen for each one and why.

## PostgreSQL vs in-memory storage and Redis

The brief offered all three options and asked for a justification. PostgreSQL was chosen.

Trip history needed to survive a process restart, and missed SSE events needed to be sent again after a reconnect. In-memory storage would have been quicker to set up, but it could not do either of those. Redis handles live messaging well, but it is less suited to storing trip records and a long history of location pings.

PostgreSQL stores the trips and location pings, and its `LISTEN/NOTIFY` feature carries the live update signal. One database is enough while the app runs as a single instance. PostGIS was not added, because latitude and longitude with ordinary indexes are enough for the map, and there is no geofencing in the app yet.

## SSE vs WebSockets and polling

The brief ruled out polling. Between SSE and WebSockets, SSE was chosen.

The dashboard only needs the server to push positions to whoever is watching. The browser's built-in `EventSource` reconnects on its own and sends `Last-Event-ID`, and Next.js can stream SSE on the Node runtime. WebSockets are the usual choice when vendors and the server need to talk both ways. For this app, they would have added client libraries without changing what operations sees.

With more than 100 concurrent trips across several app instances, a message broker would be needed. The current single process does not use one.

## Separating location ingestion from the live stream

Saving a location and pushing it to dashboards are handled as two separate steps.

The location API validates the request, saves the ping and sends a notification. It does not loop through open SSE connections. A separate `LISTEN` client receives the notification, and the SSE handler then loads the saved ping.

Sending updates straight from the location API to open connections was considered. That would have made vendor requests depend on who had the dashboard open, and a ping still has to be stored when nobody is watching. Notifications are not stored, but the location ping is, so a reconnecting dashboard is caught up from the table.

```text
Driver → location API → trip_positions → PostgreSQL NOTIFY
                                             ↓
Dashboard ← SSE endpoint ← PostgreSQL LISTEN + database replay
```

## Long-running Node process in Docker vs serverless

The app runs as a long-running Next.js Node process in Docker, with `output: "standalone"`.

SSE connections and the simulator's `setInterval` timer need a process that keeps running. Serverless functions stop between requests, which would close the listeners and stop the timers.

Running simulations are still held in the memory of that process. This works for one instance. With more than one instance, the simulator would move to a separate worker.

## Mapbox vs Google Maps and Leaflet

The brief allowed any mapping provider. Mapbox was chosen so that the live map and the simulator could use the same driving route.

Google Maps would have been familiar to users, but it would have tied the live map to a billed Maps JavaScript API key. Leaflet with OpenStreetMap needs no token, but it does not include driving directions, so the simulator would have moved in a straight line while the map showed roads.

Mapbox provides both map tiles and driving directions with one public token, so the marker follows the route drawn on the map. Google Maps links are still accepted when creating a trip, but only to fill in the pickup and drop-off locations.

## Drizzle vs Prisma and raw SQL

Drizzle was chosen because its schema is easy to read and supports database constraints such as checks and partial unique indexes, without a large generated client.

Prisma would have been quicker to set up, but it relies on a generated client. Raw SQL would also have worked. Drizzle keeps the TypeScript models close to the SQL.

## npm vs pnpm

npm was chosen because it is already installed on most machines, so setup does not start with installing another package manager.

## Layered handlers vs large route files

The HTTP layer is split into layers. Routes parse the request and call a handler, handlers call services, and services call repositories. Zod validates requests at the edge.

Putting all the logic in the route files would have meant less code. The layered structure allows the trip state machine, driver availability rules and route calculations to be tested without Next.js request objects.

## Demo roles in the browser vs API authentication

The brief said authentication did not need to be built. Roles are stored in the browser session, and the APIs are left open.

Adding JWTs would have made the app look more complete, but with a shared demo password on a local stack it would not have added real security. The sign-in screen exists so that roles can be switched during a demo. The APIs are not protected.

## Simulator as a fake GPS device vs animating the map

The simulator acts like a GPS device. The browser starts the simulation, and the Next.js process runs the timer and sends each ping through the same location service that a vendor uses.

Animating the marker in the browser would have looked live on one screen, but it would have skipped the location API, the database and the SSE stream, which are the parts operations relies on.

## Testing approach

Unit and integration tests focus on problems that are hard to notice when using the app, such as the rules that prevent double booking, duplicate `eventId` values and `LISTEN/NOTIFY`. They run with Vitest, and the database tests use Testcontainers.

Playwright tests cover the main trip journey in Chromium. Operations signs in and creates a trip, the vendor controller assigns a driver, the driver runs a simulation, operations watches the pings arrive, and the driver ends the trip. Cancelling trips, search and filters, Google Maps link import, browser GPS and the offline queue, wrong passwords, role access rules, tablet layout, and the Firefox and WebKit browsers are out of scope.

A k6 load test covers the location API and the SSE stream, as the brief asked. `npm run load:up` starts the production image with 1 CPU and 1 GiB of memory for the app and the same for PostgreSQL, then adds 200 in-transit trips alongside the demo data. `npm run load:ingest` and `npm run load:events` run k6 in a separate container without resource limits, so the load generator does not take CPU away from the app.

The results are in [load/README.md](../load/README.md). With 1 CPU and 1 GiB of memory, the app handled 150 GPS pings per second within the response time target. At 500 pings per second, requests queued and the app slowed down, but it kept running.
