# Load test

The brief asked for a k6 or Artillery run against location ingest. This harness does that on a pinned single-instance box, then adds SSE watchers so we measure the live path operations actually sees — not only HTTP POST latency.

It is not the demo walkthrough and it is not part of `npm test`.

## Resource constraints

The overlay in [`compose.load.yaml`](../compose.load.yaml) is meant to look like one small server running both processes, not like a developer laptop with spare cores.

| Service | Limit | Why |
| --- | --- | --- |
| `application` | 1 CPU, 1 GiB | One long-lived `next start` process. `NODE_OPTIONS=--max-old-space-size=768` so V8 does not assume host RAM. |
| `database` | 1 CPU, 1 GiB | Sidecar Postgres. `shared_buffers=256MB`, `max_connections=100`. |
| `k6` | unconstrained | Traffic generator. It must not steal CPU from the system under test. |

The default `pg.Pool` size (10) is left as the product ships. The in-process simulator is not started; its timers would sit on the same Node event loop we are measuring.

Project name is `awr-load`, so the volume is separate from a normal `docker compose up`. Ports are still 3000 and 5432 — stop the demo stack first.

Docker Desktop cgroup limits are comparable to a small GKE pod, not identical to a GCP vCPU. Treat the numbers as a repeatable single-instance result, not Cloud SQL capacity.

## Data setup

The demo seed is unchanged: 30 owners, 10 drivers, 20 `created` trips, and the stable README ids.

`--load-trips=N` (default **200** when the flag is present) inserts an isolated harness *after* that seed:

- 1 customer (`Load Harness Fleet`) so the New Trip picker grows by one name, not 200.
- 1 **inactive** vendor (hidden from `GET /api/vendors`).
- N vehicles, N **inactive** drivers, N trips already `in_transit` with `startedAt` set.
- Every load trip uses the same Dubai → Sharjah route. k6 does not need route variety.
- One driver and one vehicle per trip, so occupancy unique indexes never block scaling.
- Trip ids are `00000000-0000-4000-9500-` plus a 12-digit index. k6 derives the same ids; there is no fixture file.

Demo vehicles and drivers are not reused. Twenty demo vehicles already have `created` trips, and `trips_vehicle_active_unique` treats `created` and `in_transit` as active.

```bash
npm run db:seed -- --reset-db --load-trips=200
```

`Dockerfile` and default `docker compose up` do not pass this flag. The load overlay does, and it resets application tables on each application start so the fleet is empty of positions.

`GET /api/trips` will list the 200 in-transit rows. That is an intentional read-path stress, not a walkthrough profile. Inactive vendor and drivers stay off the assignment forms.

Override N with `LOAD_TRIPS` on `load:up`. The seeder hard-errors above 10,000.

## Run

```bash
npm run load:up
npm run load:ingest
```

In another terminal, while ingest is in the 150 rps hold:

```bash
npm run load:events
```

Start the wallboard when the ramp begins (five minutes in), or run it in parallel with a delay:

```bash
npm run load:events:wallboard
```

The first SSE run may spend a few seconds provisioning `k6/x/sse` (k6 1.3+ community extension). That needs outbound network from the k6 container.

Watch the box, not only `/api/health`:

```bash
docker stats --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}'
```

Tear down with `npm run load:down`. Add `-v` if you want the load volume gone.

| Script | What it does |
| --- | --- |
| `load:ingest` | **150 rps hold** for 5 minutes (1 Hz on 200 trips), then ramp 150 → 300 → 500 rps. About 10% of pings reuse `eventId`. Fail the hold if errors exceed 1% or p95 exceeds 200 ms. 40 rps is the realistic 5 s GPS cadence; it is too light for this box. |
| `load:events` | 50 SSE clients on 50 trips for 5 minutes, paired with the 150 rps hold. |
| `load:events:wallboard` | 200 SSE clients for 8 minutes, paired with the 300–500 ramp. |

## What we measured

Two runs on Docker Desktop on macOS, 13 Sep 2026. Production app (`next start`), 200 fake in-transit trips, one CPU and 1 GiB for the app, the same for Postgres.

In plain terms: **how many GPS pings per second can this small box take while dashboards are watching, before it gets slow?**

### Easy load: 40 pings per second

That is 200 trips sending a ping every 5 seconds — the same cadence as the in-app simulator.

The app barely noticed. Every request succeeded. Typical response time was **37 milliseconds**. The CPU sat around a quarter busy.

That number is realistic for vendors. It is too gentle to learn where the product breaks.

### Harder load: 150 pings per second

That is 200 trips sending about once a second, with 50 dashboards watching.

This is the useful test. Every request still succeeded. Most responses were fast; **95% finished within 164 milliseconds** (we required under 200). The CPU was about half busy, and sometimes maxed out for a moment. Memory stayed under 320 MiB of the 1 GiB cap.

Dashboards received the pings in order. About 33 updates per second reached the 50 watchers, which is what you would expect if they were looking at 50 of the 200 trips.

**150 pings per second is a load this box can hold.**

### Until it queues: 500 pings per second

We then pushed toward 300 and 500 pings per second, with all 200 dashboards open.

The app still almost never returned an error. It just **got slow**. At the top of the ramp, 95% of pings took **more than two seconds**. k6 had 1,000 virtual users waiting and still could not send 500 pings every second — the server was busy, so new pings piled up.

CPU was pinned. Memory was fine (still ~320 MiB). Postgres was not the problem. Health checks still passed.

**The product does not crash at 500 pings per second. It queues.** People would see a lagging marker, not a red error. The limit is the single Node process and its 10 database connections, not disk or RAM.

### Takeaway

| Pings per second | What it feels like |
| --- | --- |
| 40 | Easy. Like 200 vehicles pinging every 5 seconds. |
| 150 | Busy but OK. Like those vehicles pinging every second. |
| 500 | Markers lag by seconds. Requests wait in line instead of failing. |
