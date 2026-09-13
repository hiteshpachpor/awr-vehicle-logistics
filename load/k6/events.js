import { check } from "k6";
import sse from "k6/x/sse";
import { baseUrl, loadTripCount, loadTripId } from "./ids.js";

const trips = loadTripCount();
const clients = Number(__ENV.EVENT_CLIENTS || 50);
const duration = __ENV.DURATION || "5m";

export const options = {
  scenarios: {
    watch: {
      executor: "constant-vus",
      vus: clients,
      duration,
    },
  },
  thresholds: {
    checks: ["rate>0.99"],
  },
};

export default function () {
  const tripIndex = ((__VU - 1) % trips) + 1;
  let lastId = 0;
  let parsed = 0;

  const response = sse.open(
    `${baseUrl()}/api/trips/${loadTripId(tripIndex)}/events`,
    {
      method: "GET",
      headers: { Accept: "text/event-stream" },
      timeout: "4m45s",
    },
    (client) => {
      client.on("event", (event) => {
        if (event.name && event.name !== "position") {
          return;
        }
        if (!event.data || event.data.startsWith(":")) {
          return;
        }

        let position;
        try {
          position = JSON.parse(event.data);
        } catch {
          check(null, { "position JSON": () => false });
          return;
        }

        const positionId = Number(event.id);
        const monotonic = !Number.isFinite(positionId) || positionId > lastId;
        if (Number.isFinite(positionId)) {
          lastId = positionId;
        }
        parsed += 1;
        check(position, {
          "position JSON": (value) =>
            Boolean(value) && typeof value.latitude === "number",
          "position ids are monotonic": () => monotonic,
        });
      });

      client.on("error", () => {
        check(null, { "sse stayed connected": () => false });
      });
    },
  );

  check(response, {
    "sse connected": (res) => res.status === 200,
    "received a position": () => parsed > 0,
  });
}
