# Additional features

The brief was a short checklist. I built a bit more around it so the product made sense as a logistics flow, not just a moving marker.

- **Three workspaces (Operations, vendor Controller, Driver).** The brief described three journeys. I gave each role its own screen rather than one dashboard that did everything.

- **Browser-only demo login.** Auth did not need to be in code, but you still have to pick a persona. The password is `password`, the session lives in localStorage, and the APIs stay open.

- **Customers, vehicles, vendors, and drivers.** A trip that is only two coordinates cannot really support create, assign, and monitor. Six tables was enough for that without turning into a full fleet system.

- **Driver assignment as its own step.** Operations creates a trip against a vendor. The vendor controller assigns a driver. I did not want `driverId` stuffed into create, because that is not how a 3PL handoff works.

- **Occupancy rules.** A driver can only have one in-transit trip. Scheduled trips need a three-hour gap. Trip rows use an optimistic `version`. That stops the same person ending up on two live jobs.

- **Real browser GPS, with an offline outbox.** The brief allowed a simulator. Assumption 1 still said drivers stream location, so I built that path too. If a ping fails, the outbox keeps the original device timestamp and `eventId`, and retries later.

- **Google Maps link import on New Trip.** People here share Maps links more often than they type coordinates. The form accepts a full URL or a `maps.app.goo.gl` short link and fills name, latitude, and longitude. No Google API key.

- **Simulator follows the mapped driving route.** A straight line between pickup and drop-off looks wrong next to the road on the map. Interval plus kilometres per ping is how you say “3 km every 10 seconds.” After the last drop-off ping, the trip completes by itself.

- **Docker Compose, seed data, health check.** `docker compose up --build` is the usual way to run the stack. The seed is a small UAE-shaped dataset so the screens are not empty.

- **Idempotent ingestion, dual timestamps, LISTEN/NOTIFY, SSE replay.** Refresh, reconnect, and a vendor posting the same ping twice all have to land cleanly. Those pieces are how that works.

- **Extra APIs.** List trips, customer/vehicle/vendor/driver lookups, recent positions, simulation status, Maps resolve, and health. The three endpoints in the brief were not enough to drive the dashboard.
