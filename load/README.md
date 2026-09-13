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

In another terminal, while ingest is in the 40 rps hold:

```bash
npm run load:events
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
| `load:ingest` | 40 rps hold for 5 minutes across 200 trips (about one ping per trip every 5 s), then ramp 40 → 80 → 150 rps. About 10% of pings reuse `eventId`. Fail the hold if errors exceed 1%. |
| `load:events` | 50 SSE clients on 50 trips for 5 minutes. Run it with ingest so there are positions to receive. |
| `load:events:wallboard` | 200 SSE clients, one per load trip. |

## Outcome

Host: Docker Desktop on macOS, 2026-09-13. Production image (`next start`), 200 load trips, default pool size 10. k6 ingest and SSE ran together: 50 SSE clients during the 40 rps hold, 200 SSE clients during the ramp.

**40 rps hold** (the 200-trip / 5 s GPS cadence): 12,001 requests, **0% failed**, 40.00 iters/s, hold checks 100%.

**Ramp to 150 rps:** 36,158 requests across the whole script, **0 HTTP errors**. Overall ingest p95 **37 ms** (p99 466 ms, max 1.68 s). **Did not break at 150 rps.** 143 dropped k6 iterations at the top of the ramp were generator scheduling, not 4xx/5xx.

**50 SSE clients:** 5 minutes, **3,850** `position` events (~12/s). JSON and monotonic-id checks 100%. That rate matches 50 of 200 trips receiving ~40 writes/s.

**200 SSE clients:** 5 minutes, **26,200** events (~79/s) during the ramp. Same checks green.

**Box:** App CPU ~20–35% of 1 CPU in the hold, peak **86%** with 200 SSE clients plus 150 rps. RSS **82–154 MiB** of 1 GiB. Postgres peak ~80% of 1 CPU, **38–72 MiB**. No OOM, no CPU hard-throttle. `/api/health` stayed ok.

40 rps on this box is boring. The 1 vCPU / 1 GiB process still served 150 location POSTs per second with live SSE fan-out. The next place to look is not ingest latency; it is connection count and the default pool of 10 if you keep climbing.
