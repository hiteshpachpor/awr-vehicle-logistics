# Technical decisions

These are the choices that shaped the assignment build: what the brief left open, what we picked, and what we did not.

## PostgreSQL, not in-memory or Redis

The brief offers all three and asks for a justification.

In-memory dies on restart and cannot replay missed SSE events. Redis is a good live bus, but a weak source of truth for trip state and history. PostgreSQL holds the trip ledger and, via `LISTEN/NOTIFY`, the live signal. That is enough for a single-instance demo without a second datastore.

We also skipped PostGIS. Latitude and longitude with ordinary indexes cover the MVP. Spatial types would add setup without a geofence feature in the code.

## SSE, not WebSocket or polling

Polling is out. WebSockets would be the usual two-way vendor channel, but this dashboard is one-way: the server pushes positions to whoever is watching. Native `EventSource` already reconnects with `Last-Event-ID`, and Next.js can stream SSE on the Node runtime. WebSockets would have meant extra client libraries for no extra product.

At 100+ concurrent trips across more than one instance, a broker still makes more sense. That is a presentation point, not something this process implements.

## Ingest is separate from the live stream

A location POST validates, writes a row, and notifies. It does not walk a list of SSE connections. A separate `LISTEN` client picks up the notification and the SSE handler loads the row.

The alternative is fanning out from the POST handler. That ties vendor traffic to whoever happens to have the dashboard open, and it breaks if nobody is watching. Notifications are not durable; the position row is. Reconnect replays from the table.

```text
Driver → location API → trip_positions → PostgreSQL NOTIFY
                                             ↓
Dashboard ← SSE endpoint ← PostgreSQL LISTEN + database replay
```

## Long-lived Node and Docker, not serverless

SSE and a `setInterval` simulator need a process that stays up. `output: "standalone"` plus Compose matches that. A Vercel-style function would drop listeners and timers between invocations.

The simulator registry lives in memory on that process. Fine for the assignment. For production, scheduling would move to a worker.

## Mapbox, not Google Maps JS or Leaflet

Google Maps is a fine dashboard, but it couples the live map to a billed Maps JavaScript key. Leaflet and OSM need no token, and also have no first-class driving directions, so the simulator would be a straight line pretending to be a road.

Mapbox gives tiles and Directions from one public token. The marker walks the same road the map draws. Google Maps URLs are only a create-trip input, not the live map.

## Drizzle, not Prisma or raw SQL

We wanted a schema we could read and constrain — checks, partial unique indexes — without a heavy generated client. Prisma is faster to scaffold and more ceremony afterwards. Raw SQL would have been fine; Drizzle keeps the TypeScript models next to the SQL.

## npm, not pnpm

Reviewers may not have pnpm. Compatibility won.

## Layered handlers, not fat route files

Routes parse the request and call a handler. Handlers talk to services. Services talk to repositories. Zod sits at the edge.

That is the standard we would set on a team, and it lets us test the trip state machine, driver availability, and route geometry without pulling in Next.js request objects.

## Demo roles in the UI, nothing on the APIs

The brief says auth does not need to be in code, but must be covered in the presentation. Building JWT now would steal time from the deck, where that work is actually scored. Client session plus open APIs is an honest demo.

## The simulator is a fake GPS device

If the map interpolated locally, operations would not be testing ingestion, persistence, or SSE. The browser starts the run; the Next.js process owns the clock and posts through the same location service as a vendor ping.

## Vitest and Testcontainers, not Playwright or k6 in the repo

The brief’s testing section is a strategy to present, and the scenario allows a partial implementation. We put the effort into unit tests and a real PostgreSQL via Testcontainers — schema, idempotency, `LISTEN/NOTIFY` — the parts most likely to rot. UI end-to-end and load tests are what we would add with more time, which the brief also asks you to say out loud.
