# AWR Vehicle Live Tracking

AWR works with logistics vendors who pick up and drop off customer vehicles. Once a trip is underway, operations needs a live view of where that vehicle is.

This app is that dashboard. Operations creates a trip, a vendor assigns a driver, and the driver either shares phone GPS or runs a simulated journey along the driving route. Positions show up in real time on the list, the map, and a log of every ping.

More detail lives in [docs/README.md](docs/README.md): the original brief, extras we added, technical decisions, and the API.

## Setup and installation

You need Docker with Docker Compose, or Node.js 22+ and PostgreSQL 17+.

Copy `.env.example` to `.env` and set `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` to a URL-restricted public Mapbox token. The APIs still run without it. The map and the driving-route simulator then fall back to a straight line between pickup and drop-off.

### Docker

```bash
docker compose up --build
```

PostgreSQL starts, the app waits until it is healthy, migrations run, demo data loads, and the app is at [http://localhost:3000](http://localhost:3000).

Hot reload while you edit `src`:

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

That flag deletes application data. Drizzle’s migration history stays in place so applied migrations are not rerun.

### Sign in

Open `/` and use the password `password`.

- **Operations:** create trips, assign work, cancel a trip that has not finished.
- **Vendor controller:** assign drivers for that vendor.
- **Driver:** start, simulate, or end an assigned trip. Simulated trips follow the mapped route. Live trips share browser geolocation.

The session is stored in the browser. APIs have no authentication.

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

The app runs as a long-lived Next.js Node process. PostgreSQL stores trips and positions. A location write does not talk to dashboards directly. It notifies the database, and SSE clients listen.

```text
Driver → location API → trip_positions → PostgreSQL NOTIFY
                                             ↓
Dashboard ← SSE endpoint ← PostgreSQL LISTEN + database replay
```

Notifications are lightweight and not durable. Position rows are. If an SSE client reconnects with `Last-Event-ID`, missed points are replayed from PostgreSQL.

Drizzle handles the schema, Zod validates HTTP input, Mapbox draws the map and driving directions, and Vitest runs the tests.

## Testing

```bash
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run build
```

Database integration tests use Testcontainers, so they need a running Docker daemon. They apply migrations to a fresh PostgreSQL instance and check constraints, idempotent seeding, and `LISTEN/NOTIFY`.

### Load test

k6 is not part of `npm test`. It needs the production Compose stack with CPU and memory caps. See [load/README.md](load/README.md).

```bash
npm run load:up
npm run load:ingest
npm run load:events
npm run load:down
```

`npm run db:seed` is still the demo dataset. Pass `--load-trips=200` only when you want the extra in-transit fleet for ingest.
