# Additional features

The brief is a short checklist. The app is a small logistics product around that checklist. These are the extras, and why they are there.

- **Three demo workspaces (Operations, vendor Controller, Driver).** The brief describes three journeys. Splitting them in the UI means a reviewer can walk each one, instead of sharing a single screen that does everything.

- **Browser-only demo login.** Auth is not required in code, but someone still has to enter each persona. The password is `password`, the session lives in localStorage, and the APIs stay open. That is an honest demo boundary, not pretend security.

- **Customers, vehicles, vendors, and drivers.** A trip that is only two coordinates does not support “create, assign, monitor” in a way that feels real. Six tables is enough to tell that story without becoming a fleet platform.

- **Driver assignment as its own step.** Operations creates a trip on a vendor. The vendor controller assigns a driver. That matches how a 3PL actually works better than stuffing `driverId` into create.

- **Occupancy rules.** A driver can only have one in-transit trip, scheduled trips need a three-hour gap, and trip rows use an optimistic `version`. The demo should not be able to put the same person on two live jobs.

- **Real browser GPS, with an offline outbox.** The brief allows a simulator. We still built a vendor-side publisher, because assumption 1 is that drivers stream location. If a ping fails, the outbox keeps the original device timestamp and `eventId` so the timeline stays honest after reconnect.

- **Google Maps link import on New Trip.** Ops in the UAE shares Maps links, not typed coordinates. The form accepts a full URL or a `maps.app.goo.gl` short link and fills name, latitude, and longitude. No Google API key.

- **Simulator follows the mapped driving route.** A straight line between pickup and drop-off looks fake next to the road on the map. Interval plus kilometres per ping is how you describe “3 km every 10 seconds.” When the last ping hits drop-off, the trip completes so the happy-path demo finishes itself.

- **Docker Compose, seed data, health check.** `docker compose up --build` is the reviewer path. The seed is a small UAE-shaped dataset so the screens are not empty.

- **Idempotent ingestion, dual timestamps, LISTEN/NOTIFY, SSE replay.** Live tracking has to survive refresh, reconnect, and a vendor posting the same ping twice. These are the mechanics behind that, and they give the architecture deck something real to talk about.

- **Extra APIs.** List trips, customer/vehicle/vendor/driver lookups, recent positions, simulation status, Maps resolve, and health. The three endpoints in the brief are not enough to drive the dashboard.
