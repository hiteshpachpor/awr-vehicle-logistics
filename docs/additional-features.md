# Additional features

The brief listed the core requirements. A few more features were added so that the app works as a complete logistics flow, from creating a trip to seeing the vehicle arrive.

- **A workspace for each role.** The brief describes separate journeys for operations, vendors and drivers, so each role has its own screens instead of sharing one dashboard.

- **Demo sign-in in the browser.** Authentication did not need to be built, but a role still has to be chosen. The password is `password`, the session is stored in localStorage, and the APIs are not protected.

- **Customers, vehicles, vendors and drivers.** A trip needs these records before it can be created, assigned and tracked. Six database tables cover this without turning the app into a full fleet management system.

- **Driver assignment as a separate step.** Operations creates a trip for a vendor, and the vendor controller then assigns one of the vendor's drivers. This matches how work is handed over to a 3PL vendor, so the request to create a trip does not include a driver.

- **Rules that prevent double booking.** A driver can have only one trip in transit, and a vehicle can be on only one active trip. A driver's scheduled trips must be at least three hours apart. Each trip also has a version number, so one update cannot silently overwrite another.

- **Real browser GPS with an offline queue.** The brief allowed a simulator, but its first assumption says that drivers send their location during a trip, so real GPS was built as well. If a ping cannot be sent, it is kept on the device with its original timestamp and event ID and sent again later.

- **Google Maps link import when creating a trip.** Locations are often shared as Google Maps links rather than coordinates. The New Trip form accepts a full Google Maps URL or a `maps.app.goo.gl` short link, and fills in the place name, latitude and longitude. No Google API key is needed.

- **A simulator that follows the driving route.** A straight line between pickup and drop-off would cut across roads on the map, so the simulator follows the Mapbox driving route. Its pace is set by the update interval and the distance per ping, for example 3 km every 10 seconds. The trip is completed automatically after the last ping at the drop-off point.

- **Docker Compose, demo data and a health check.** `docker compose up --build` starts the whole stack. The demo data is a small UAE-based dataset, so the screens have content from the start.

- **Reliable location updates.** Duplicate pings are ignored by using the event ID. Each ping stores both the time the device recorded it and the time the server received it. A dashboard that reconnects receives the pings it missed. Together, these keep the map correct after a page refresh, a dropped connection, or a vendor sending the same ping twice.

- **Extra API endpoints.** The dashboard also needs a trip list, lookups for customers, vehicles, vendors and drivers, recent positions, simulation status, Google Maps link lookup and a health check. The three endpoints in the brief were not enough to support the screens.

- **Load and end-to-end tests.** A k6 load test measures how much location traffic one small instance can handle, and Playwright tests cover the main trip journey in a real browser.
