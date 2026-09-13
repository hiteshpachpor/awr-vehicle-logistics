# Technical decisions

The brief left some choices open. I picked these.

## PostgreSQL vs in-memory and Redis

The brief offered all three and asked for a justification. I chose PostgreSQL.

I did not want trip history to disappear when the process restarted, and I needed to replay missed SSE events. An in-memory store would have been quicker to start, and it would have failed both of those. Redis would have been a good live bus. It would have been a weaker place to keep trip state and an append-only location log.

PostgreSQL held the trip ledger and, through `LISTEN/NOTIFY`, the live signal. One datastore was enough for a single instance. I left PostGIS out as well. Latitude and longitude with ordinary indexes covered the map, and I did not have geofencing in the app, so spatial types were extra setup I did not need.

## SSE vs WebSocket and polling

The brief ruled out polling. Between SSE and WebSockets, I chose SSE.

The dashboard only needs the server to push positions to whoever is watching. Native `EventSource` already reconnects with `Last-Event-ID`, and Next.js can stream SSE on the Node runtime. WebSockets would have been the usual pick for a two-way vendor channel. For this app they would have added client libraries without changing what operations sees.

A broker would still be the right move for 100+ concurrent trips across more than one instance. This process does not do that.

## Ingest vs pushing straight to SSE connections

I kept location ingestion and the live stream as two separate paths.

A location POST validates, writes a row, and notifies. It does not walk a list of open SSE connections. A separate `LISTEN` client picks up the notification, and the SSE handler loads the row.

I did look at fanning out from the POST handler. That would have tied vendor traffic to whoever happened to have the dashboard open. If nobody was watching, the ping would still need to exist later. Notifications are not durable. The position row is. On reconnect I replay from the table.

```text
Driver → location API → trip_positions → PostgreSQL NOTIFY
                                             ↓
Dashboard ← SSE endpoint ← PostgreSQL LISTEN + database replay
```

## Long-lived Node and Docker vs serverless

I ran the app as a long-lived Next.js Node process in Docker, with `output: "standalone"`.

SSE and a `setInterval` simulator need a process that stays up. A serverless function that comes and goes would drop listeners and timers between invocations, which is why I did not go that way.

The simulator registry still lives in memory on that process. That is fine for one instance. With more than one, I would move scheduling to a worker.

## Mapbox vs Google Maps and Leaflet

The brief allowed any mapping provider. I chose Mapbox because I wanted the live map and the simulator to share one driving route.

Google Maps would have felt familiar on the dashboard, and it would have tied the live map to a billed Maps JavaScript key. Leaflet and OSM would have avoided a token. They also do not give first-class driving directions, so the simulator would have been a straight line while the map showed roads.

Mapbox gave me tiles and Directions from one public token, so the marker follows the same route the map draws. I still used Google Maps URLs when creating a trip. That is only an input helper, not the live map.

## Drizzle vs Prisma and raw SQL

I chose Drizzle because I wanted a schema I could read and constrain (checks, partial unique indexes) without a heavy generated client.

Prisma would have been faster to scaffold, then more generated-client ceremony. Raw SQL would have been fine. Drizzle kept the TypeScript models next to the SQL, which I preferred.

## npm vs pnpm

I chose npm because it is already on more machines. I did not want setup to start with installing another package manager.

## Layered handlers vs fat route files

I split the HTTP layer. Routes parse the request and call a handler. Handlers talk to services. Services talk to repositories. Zod sits at the edge.

Putting everything in the route files would have been shorter. This shape let me test the trip state machine, driver availability, and route geometry without pulling in Next.js request objects.

## Demo roles in the UI vs API authentication

The brief said auth did not need to be in code. I put roles in the browser session and left the APIs open.

JWT would have looked more finished. On a local stack with a shared password it would not have been real security. The login is there so you can switch personas. The APIs are not locked.

## Simulator as a fake GPS device vs animating the map

I treated the simulator as a fake GPS device. The browser starts the run. The Next.js process owns the clock and posts through the same location service as a vendor ping.

Animating the marker in the browser would have looked live on one screen. It would not have gone through ingestion, persistence, or SSE, which is what operations is actually watching.

## Vitest and Testcontainers vs Playwright and k6

I spent the unit and integration time on bugs that fail quietly: occupancy indexes, duplicate `eventId`, and `LISTEN/NOTIFY`. Those still live in Vitest and Testcontainers.

k6 is now in the repo for the ingest and SSE path the brief asked for. `npm run load:up` starts the production image with 1 CPU / 1 GiB on the app and on Postgres, then seeds 200 isolated in-transit trips beside the unchanged demo dataset. `npm run load:ingest` and `npm run load:events` run from an unconstrained k6 container on the same Compose network so the generator does not steal cycles from the box.

The first measured run is the source of capacity numbers. They live in [load/README.md](../load/README.md). Playwright is still not here; the load harness does not replace an E2E walkthrough.
