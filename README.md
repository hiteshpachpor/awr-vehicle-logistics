# AWR Vehicle Live Tracking

AWR works with logistics vendors who pick up and drop off customer vehicles. Once a trip is on the road, operations needs to see where that vehicle is — not a spreadsheet, a live map.

This app is that view. Operations creates a trip, a vendor assigns a driver, and the driver either shares phone GPS or runs a simulated journey along the real driving route. Positions land on a dashboard in real time: list, map, and a log of every ping.

Open [docs/index.md](docs/index.md) for the original brief, what we built beyond it, the technical decisions, and the API.

## Setup and installation

You need **Docker with Docker Compose**, or **Node.js 22+ and PostgreSQL 17+**.

Copy `.env.example` to `.env` and set `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` to a URL-restricted public Mapbox token. Without it the APIs still run; the map and driving-route simulator fall back to a straight line.

### Docker

```bash
docker compose up --build
```

That starts PostgreSQL, waits until it is healthy, applies migrations, loads the demo dataset, and serves the app at [http://localhost:3000](http://localhost:3000).

For hot reload while you edit `src`:

```bash
npm run docker:dev
```

Stop that stack with `npm run docker:down`. Wipe local data with `docker compose down --volumes`.

### Local Node

Start PostgreSQL yourself, then:

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

To empty the tables, reset identity sequences, and reload the same dataset:

```bash
npm run db:seed -- --reset-db
```

That flag is destructive. Drizzle’s migration history is left alone so applied migrations are not rerun.

### Sign in

Open `/` and use the password `password`.

- **Operations** — create trips, assign work, cancel a trip that has not finished.
- **Vendor controller** — assign drivers for that vendor.
- **Driver** — start, simulate, or end an assigned trip. Simulated trips follow the mapped route; live trips share browser geolocation.

The session is stored in the browser. APIs are unauthenticated on purpose.

The seed is 30 fictional UAE vehicle owners (one vehicle each), five logistics vendors, ten drivers, and one ready-to-start trip. Makes are Nissan 12, INFINITI 7, Renault 5, Chery 4, and Zeekr 2.

Stable ids:

```text
Customer: 00000000-0000-4000-8000-000000000001
Vehicle:  00000000-0000-4000-8000-000000000002
Vendor:   00000000-0000-4000-8000-000000000003
Driver:   00000000-0000-4000-8000-000000000004
Trip:     00000000-0000-4000-8000-000000000005
```

## Architecture and stack

The app is a long-lived Next.js Node process. PostgreSQL is the source of truth for trips and positions. Location writes do not talk to dashboards directly; they notify the database, and SSE clients listen.

```text
Driver → location API → trip_positions → PostgreSQL NOTIFY
                                             ↓
Dashboard ← SSE endpoint ← PostgreSQL LISTEN + database replay
```

Notifications are lightweight and not durable. Position rows are. If an SSE client reconnects with `Last-Event-ID`, missed points are replayed from PostgreSQL.

The stack around that is Drizzle for the schema, Zod at the HTTP edge, Mapbox for the map and driving directions, and Vitest for tests.

## Testing

```bash
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run build
```

Database integration tests use Testcontainers, so they need a running Docker daemon. They apply migrations to a fresh PostgreSQL instance and check constraints, idempotent seeding, and `LISTEN/NOTIFY`.
