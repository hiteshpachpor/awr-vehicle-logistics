import { describe, expect, it } from "vitest";
import {
  availableTripActions,
  availableTripActionsForRole,
  formatCoordinates,
  formatDateTime,
  formatPositionSource,
  formatSpeed,
  formatTripRoute,
  getApiErrorMessage,
  hasActualDropoffMismatch,
  matchesTrip,
  tripTransitionFailureNotice,
  tripTransitionSuccessNotice,
} from "./operations-ui";
import type { TripView } from "./operations-types";

const trip = {
  trip: {
    referenceNumber: "TRIP-DEMO-001",
    pickupAddress: "Dubai",
    dropoffAddress: "Sharjah",
  },
  vehicle: {
    registrationNumber: "Dubai A 48291",
    make: "Nissan",
    model: "Patrol",
  },
  customer: { name: "Omar Al Mansoori" },
  driver: { name: "Bilal Rahman" },
  vendor: { name: "Crescent Dune" },
} as TripView;

describe("operations UI helpers", () => {
  it("returns only valid lifecycle actions", () => {
    expect(availableTripActions("created")).toEqual([
      "start",
      "simulate",
      "cancel",
    ]);
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
    ).toEqual(["start", "simulate"]);
    expect(
      availableTripActionsForRole("created", "driver", false),
    ).toEqual([]);
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

  it("formats position and route values consistently", () => {
    expect(formatCoordinates(25.204849, 55.270783)).toBe(
      "25.2048, 55.2708",
    );
    expect(formatSpeed(42.37)).toBe("42.4 km/h");
    expect(formatSpeed(null, "—")).toBe("—");
    expect(formatPositionSource("simulator")).toBe("Simulation");
    expect(formatPositionSource("vendor")).toBe("Vendor");
    expect(formatTripRoute(trip)).toBe("Dubai to Sharjah");
  });

  it("builds start, end, and cancel toasts", () => {
    expect(tripTransitionSuccessNotice("in_transit", "TRIP-DEMO-001")).toEqual({
      type: "success",
      title: "Trip started",
      description: "TRIP-DEMO-001 is now in transit.",
    });
    expect(tripTransitionSuccessNotice("completed", "TRIP-DEMO-001")).toEqual({
      type: "success",
      title: "Trip ended",
      description: "TRIP-DEMO-001 has been completed.",
    });
    expect(tripTransitionSuccessNotice("cancelled", "TRIP-DEMO-001")).toEqual({
      type: "success",
      title: "Trip cancelled",
      description: "TRIP-DEMO-001 has been cancelled.",
    });
    expect(
      tripTransitionFailureNotice("in_transit", "Driver is already in transit."),
    ).toEqual({
      type: "error",
      title: "Trip could not be started",
      description: "Driver is already in transit.",
    });
    expect(
      tripTransitionFailureNotice("completed", "Trip is not in transit."),
    ).toEqual({
      type: "error",
      title: "Trip could not be ended",
      description: "Trip is not in transit.",
    });
    expect(
      tripTransitionFailureNotice("cancelled", "Trip is already completed."),
    ).toEqual({
      type: "error",
      title: "Trip could not be cancelled",
      description: "Trip is already completed.",
    });
  });

  it("labels an actual drop-off only when a completed trip ended elsewhere", () => {
    const completed = {
      trip: {
        status: "completed",
        dropoffLatitude: 25.305,
        dropoffLongitude: 55.378,
      },
      latestPosition: { latitude: 25.2931, longitude: 55.3607 },
    } as TripView;

    expect(hasActualDropoffMismatch(completed)).toBe(true);
    expect(
      hasActualDropoffMismatch({
        ...completed,
        trip: { ...completed.trip, status: "in_transit" },
      } as TripView),
    ).toBe(false);
    expect(
      hasActualDropoffMismatch({
        ...completed,
        latestPosition: { latitude: 25.305, longitude: 55.378 },
      } as TripView),
    ).toBe(false);
  });
});
