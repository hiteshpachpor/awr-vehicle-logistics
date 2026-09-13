import http from "k6/http";
import { check } from "k6";
import exec from "k6/execution";
import { baseUrl, loadTripCount, loadTripId } from "./ids.js";

const trips = loadTripCount();

export const options = {
  discardResponseBodies: true,
  summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
  scenarios: {
    hold: {
      executor: "constant-arrival-rate",
      rate: 150,
      timeUnit: "1s",
      duration: "5m",
      preAllocatedVUs: 80,
      maxVUs: 250,
      exec: "ingest",
    },
    ramp: {
      executor: "ramping-arrival-rate",
      startTime: "5m",
      startRate: 150,
      timeUnit: "1s",
      preAllocatedVUs: 250,
      maxVUs: 1000,
      stages: [
        { target: 300, duration: "2m" },
        { target: 300, duration: "2m" },
        { target: 500, duration: "2m" },
        { target: 500, duration: "2m" },
      ],
      exec: "ingest",
    },
  },
  thresholds: {
    "http_req_failed{scenario:hold}": ["rate<0.01"],
    "http_req_duration{scenario:hold}": ["p(95)<200"],
    "checks{scenario:hold}": ["rate>0.99"],
  },
};

export function ingest() {
  const iteration = exec.scenario.iterationInTest;
  const tripIndex = (iteration % trips) + 1;
  const seq = Math.floor(iteration / trips);
  const duplicate = seq > 0 && seq % 10 === 0;
  const eventId = `k6-${tripIndex}-${duplicate ? seq - 1 : seq}`;
  const jitter = (tripIndex % 50) / 1000;

  const response = http.post(
    `${baseUrl()}/api/trips/${loadTripId(tripIndex)}/location`,
    JSON.stringify({
      lat: 25.1774 + jitter,
      lng: 55.2407 + jitter,
      timestamp: new Date().toISOString(),
      speed: 40,
      eventId,
    }),
    {
      headers: { "Content-Type": "application/json" },
      tags: { duplicate: String(duplicate) },
    },
  );

  check(response, {
    "ingest accepted": (res) => res.status === 200 || res.status === 201,
    "idempotent retry is a duplicate": (res) =>
      !duplicate || res.status === 200,
  });
}
