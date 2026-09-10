import { describe, expect, it } from "vitest";
import {
  availableTripActions,
  availableTripActionsForRole,
  formatDateTime,
  getApiErrorMessage,
  matchesTrip,
} from "./operations-ui";
import type { TripView } from "./operations-types";

const trip = {
  trip: {
    referenceNumber: "TRIP-DEMO-001",
    pickupAddress: "Dubai",
    dropoffAddress: "Sharjah",
  },
  vehicle: {
    registrationNumber: "DUBAI-A-48291",
    make: "Nissan",
    model: "Patrol",
  },
  customer: { name: "Omar Al Mansoori" },
  driver: { name: "Bilal Rahman" },
  vendor: { name: "Crescent Dune" },
} as TripView;

describe("operations UI helpers", () => {
  it("returns only valid lifecycle actions", () => {
    expect(availableTripActions("created")).toEqual(["start", "cancel"]);
    expect(availableTripActions("in_transit")).toEqual([
      "complete",
      "cancel",
    ]);
    expect(availableTripActions("completed")).toEqual([]);
    expect(
      availableTripActionsForRole("created", "operations", false),
    ).toEqual(["cancel"]);
    expect(
      availableTripActionsForRole("created", "controller", true),
    ).toEqual([]);
    expect(
      availableTripActionsForRole("created", "driver", true),
    ).toEqual(["start"]);
    expect(
      availableTripActionsForRole("in_transit", "driver", true),
    ).toEqual(["complete"]);
  });

  it("searches operational trip fields", () => {
    expect(matchesTrip(trip, "48291")).toBe(true);
    expect(matchesTrip(trip, "bilal")).toBe(true);
    expect(matchesTrip(trip, "abu dhabi")).toBe(false);
  });

  it("prefers validation details when mapping API errors", () => {
    expect(
      getApiErrorMessage({
        error: {
          message: "Validation failed",
          details: [{ message: "Latitude must be at most 90" }],
        },
      }),
    ).toBe("Latitude must be at most 90");
  });

  it("includes seconds in formatted timestamps", () => {
    expect(formatDateTime("2026-09-10T10:00:05Z")).toMatch(/:05(?:\s|$)/);
  });
});
