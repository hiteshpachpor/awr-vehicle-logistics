# Load test

The brief asked for a k6 or Artillery load test of the location API. This load test runs k6 against a single app instance with fixed CPU and memory limits. It also opens SSE connections, so it measures the live updates that operations sees as well as the response time of the location API.

It is separate from the demo walkthrough and is not part of `npm test`.

## Resource limits

The settings in [`compose.load.yaml`](../compose.load.yaml) are meant to be similar to one small server running the app and the database, rather than a laptop with spare CPU cores.

| Service | Limit | Reason |
| --- | --- | --- |
| `application` | 1 CPU, 1 GiB | One long-running `next start` process. `NODE_OPTIONS=--max-old-space-size=768` stops Node from assuming it can use all of the host's memory. |
| `database` | 1 CPU, 1 GiB | PostgreSQL running alongside the app, with `shared_buffers=256MB` and `max_connections=100`. |
| `k6` | No limit | Generates the traffic. It has no limit so that it does not take CPU away from the app being tested. |

The database connection pool keeps its default size of 10, the same as in the app. The simulator is not started, because its timers would run on the same Node process that is being measured.

The Compose project is named `awr-load`, so it uses a separate volume from a normal `docker compose up`. It still uses ports 3000 and 5432, so the demo stack needs to be stopped first.

Docker Desktop limits are similar to a small GKE pod, but they are not the same as a Google Cloud vCPU. The results show what one instance can handle in a repeatable setup, and are not a measure of Cloud SQL capacity.

## Test data

The demo data does not change. It still has 30 vehicle owners, 10 drivers, 20 scheduled trips and the fixed IDs listed in the main README.

`--load-trips=N` adds a separate set of load test data after the demo data. N is 200 by default when the flag is used.

- One customer, `Load Harness Fleet`, so the New Trip form shows only one extra name.
- One inactive vendor, which is hidden from `GET /api/vendors`.
- N vehicles, N inactive drivers and N trips that are already `in_transit`, with `startedAt` set.
- Every load test trip uses the same route from Dubai to Sharjah, because k6 does not need different routes.
- Each trip has its own driver and vehicle, so the rules that prevent double booking do not limit the test.
- Trip IDs start with `00000000-0000-4000-9500-`, followed by a 12-digit number. k6 builds the same IDs, so no fixture file is needed.

Demo vehicles and drivers are not reused. The 20 demo vehicles already have scheduled trips, and the `trips_vehicle_active_unique` index counts both `created` and `in_transit` trips as active.

```bash
npm run db:seed -- --reset-db --load-trips=200
```

The `Dockerfile` and the default `docker compose up` do not pass this flag. The load test setup does, and it resets the application tables each time the app starts, so the trips start with no location pings.

`GET /api/trips` returns the 200 in-transit trips as well. This is intended, as it also puts load on the trip list. The inactive vendor and drivers do not appear in the assignment forms.

To change N, set `LOAD_TRIPS` when running `load:up`. The seed script stops with an error if N is above 10,000.

## Running the test

```bash
npm run load:up
npm run load:ingest
```

While the ingest test is holding at 150 pings per second, run this in another terminal:

```bash
npm run load:events
```

When the ingest test starts increasing the load after five minutes, run the larger dashboard test:

```bash
npm run load:events:wallboard
```

The first SSE run can take a few seconds to set up `k6/x/sse`, a community extension for k6 1.3 and later. The k6 container needs internet access for this.

Watch the containers' resource usage as well as `/api/health`:

```bash
docker stats --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}'
```

Stop the stack with `npm run load:down`. Add `-v` to also delete the load test volume.

| Script | What it does |
| --- | --- |
| `load:ingest` | Holds 150 pings per second for 5 minutes, which is one ping per second for each of the 200 trips. It then increases to 300 and then 500 pings per second. About 10% of pings reuse an `eventId`. The hold fails if more than 1% of requests fail or if 95% of requests take longer than 200 ms. 40 pings per second matches the realistic 5-second GPS interval, but it is too light a load to find this server's limits. |
| `load:events` | Opens 50 SSE connections on 50 trips for 5 minutes, alongside the 150 pings per second hold. |
| `load:events:wallboard` | Opens 200 SSE connections for 8 minutes, alongside the increase from 300 to 500 pings per second. |

## Results

Two runs were done on Docker Desktop on macOS on 13 September 2026, using the production app (`next start`), 200 in-transit test trips, and 1 CPU and 1 GiB of memory each for the app and PostgreSQL.

The question these runs answer is how many GPS pings per second this small server can accept while dashboards are watching, before it slows down.

### Light load: 40 pings per second

This is 200 trips sending a ping every 5 seconds, which is the same interval the simulator uses.

Every request succeeded, with a typical response time of 37 milliseconds. The CPU was about a quarter busy.

This load is realistic for vendors, but it is too light to show where the app reaches its limits.

### Heavy load: 150 pings per second

This is 200 trips sending a ping about once a second, with 50 dashboards watching.

Every request succeeded, and 95% of requests finished within 164 milliseconds, under the 200 millisecond target. The CPU was about half busy, with short peaks at full use. Memory stayed under 320 MiB of the 1 GiB limit.

The dashboards received the pings in order. About 33 updates per second reached the 50 open connections, which matches 50 of the 200 trips being watched.

This server can hold 150 pings per second.

### Overload: up to 500 pings per second

The load was then increased to 300 and 500 pings per second, with 200 dashboards connected.

The app returned almost no errors, but it became slow. At the peak, 95% of pings took more than two seconds. k6 had 1,000 virtual users waiting and still could not send 500 pings every second, because the server was busy and new pings had to wait.

The CPU was fully used, while memory stayed at about 320 MiB and PostgreSQL was not the bottleneck. Health checks still passed.

At 500 pings per second the app keeps running and queues requests. Operations would see the map marker lag behind, but would not see errors. The limit is the single Node process and its 10 database connections, not disk space or memory.

### Summary

| Pings per second | What it means for users |
| --- | --- |
| 40 | Light load, equal to 200 vehicles sending a ping every 5 seconds. |
| 150 | Heavy load that the server still handles, equal to 200 vehicles sending a ping every second. |
| 500 | Map markers lag by a few seconds, and requests wait in a queue instead of failing. |
