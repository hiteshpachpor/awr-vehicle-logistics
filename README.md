# AWR Vehicle Live Tracking

AWR works with logistics vendors who pick up and drop off customers' vehicles. While a trip is in progress, the AWR operations team needs to see where the vehicle is.

This app gives operations that view. Operations creates a trip, the vendor assigns a driver, and the driver either shares their browser location or runs a simulated journey along the driving route. Each location ping appears live on the trip's map and in its ping log, and the trip list updates when a trip changes status.

More detail is in [docs/README.md](docs/README.md), including the original brief, the features added beyond it, the technical decisions and the API.

## Setup and installation

The app needs Docker with Docker Compose, or Node.js 22 or later with PostgreSQL 17 or later.

Copy `.env.example` to `.env` and set `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` to a public Mapbox token that is restricted to your URLs. The APIs work without a token. In that case, the map and the simulator use a straight line between pickup and drop-off instead of the driving route.

### Docker

```bash
docker compose up --build
```

This starts PostgreSQL, waits until it is healthy, runs the migrations, loads the demo data and starts the app at [http://localhost:3000](http://localhost:3000).

To run the app with hot reload while editing files in `src`:

```bash
npm run docker:dev
```

Stop this stack with `npm run docker:down`. To also delete the local data, run `docker compose down --volumes`.

### Local Node

With PostgreSQL already running:

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

To clear the tables, reset the ID sequences and load the same demo data again:

```bash
npm run db:seed -- --reset-db
```

This deletes all application data. Drizzle's migration history is kept, so migrations that have already run are not run again.

### Sign in

Open `/` and sign in as one of these roles with the password `password`:

- **Operations** creates trips and can cancel trips that are scheduled or in transit.
- **Vendor controller** assigns the vendor's drivers to trips.
- **Driver** starts, simulates or ends an assigned trip. A simulated trip follows the driving route on the map, and a live trip shares the browser's location.

The session is stored in the browser, and the APIs have no authentication.

The demo data includes 30 fictional vehicle owners in the UAE with one vehicle each, five logistics vendors, ten drivers and 20 scheduled trips. The vehicles are 12 Nissan, 7 INFINITI, 5 Renault, 4 Chery and 2 Zeekr.

These IDs stay the same each time the demo data is loaded:

```text
Customer: 00000000-0000-4000-8000-000000000001
Vehicle:  00000000-0000-4000-8000-000000000002
Vendor:   00000000-0000-4000-8000-000000000003
Driver:   00000000-0000-4000-8000-000000000004
Trip:     00000000-0000-4000-8000-000000000005
```

## Architecture and stack

The app runs as a long-running Next.js Node process, and PostgreSQL stores the trips and location pings. The location API does not send updates to dashboards directly. It saves the ping and sends a database notification, and the SSE endpoint listens for that notification.

```text
Driver → location API → trip_positions → PostgreSQL NOTIFY
                                             ↓
Dashboard ← SSE endpoint ← PostgreSQL LISTEN + database replay
```

Notifications are not stored, but the location pings are. When an SSE client reconnects with `Last-Event-ID`, the pings it missed are loaded from PostgreSQL and sent again.

Drizzle manages the database schema, Zod validates API requests, and Mapbox provides the map and driving directions. Vitest runs the unit and integration tests, Playwright runs the end-to-end tests, and k6 runs the load test.

## Testing

```bash
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run build
```

The database integration tests use Testcontainers, so Docker must be running. They apply the migrations to a new PostgreSQL instance and check the database constraints, repeated seeding, and `LISTEN/NOTIFY`.

### End-to-end tests

The Playwright tests cover the main trip journey in Chromium. Operations signs in and creates a trip, the vendor controller assigns a driver, the driver runs a simulation, operations watches the pings arrive, and the driver ends the trip.

```bash
npx playwright install chromium
npm run test:e2e
```

Before the tests start, the demo data is reset and loaded again, so any data added locally is deleted. PostgreSQL must be running and reachable with the settings in `.env`. The tests use the app at [http://localhost:3000](http://localhost:3000) if it is already running, and otherwise start it with `npm run dev`. To open Playwright's interactive mode, run `npm run test:e2e:ui`.

### Load test

The k6 load test is not part of `npm test`. It runs against the production Docker Compose stack with CPU and memory limits. The setup and results are described in [load/README.md](load/README.md).

```bash
npm run load:up
npm run load:ingest
npm run load:events
npm run load:down
```

`npm run db:seed` loads only the demo data. The 200 extra in-transit trips used by the load test are added only when `--load-trips=200` is passed.
