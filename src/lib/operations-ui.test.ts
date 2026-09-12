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
  getInitials,
  getWorkspaceChrome,
  hasActualDropoffMismatch,
  matchesTrip,
  mergeTripByVersion,
  mergeTripListByVersion,
  tripAssignedNotice,
  tripCreatedNotice,
  tripListUpdateNotice,
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

  it("merges a new trip at the front and keeps the higher version", () => {
    const first = {
      trip: { id: "trip-a", version: 1, status: "created" },
    } as TripView;
    const incoming = {
      trip: { id: "trip-b", version: 1, status: "created" },
    } as TripView;
    const newer = {
      trip: { id: "trip-a", version: 2, status: "in_transit" },
    } as TripView;

    expect(mergeTripByVersion([first], incoming)).toEqual({
      trips: [incoming, first],
      applied: "new",
    });
    expect(mergeTripByVersion([first], newer).applied).toBe("newer");
    expect(mergeTripByVersion([newer], first).applied).toBe("unchanged");
  });

  it("overlays a list snapshot without clobbering a newer local version", () => {
    const local = {
      trip: { id: "trip-a", version: 3, status: "in_transit" },
    } as TripView;
    const stale = {
      trip: { id: "trip-a", version: 2, status: "created" },
    } as TripView;
    const extra = {
      trip: { id: "trip-b", version: 1, status: "created" },
    } as TripView;
    const created = {
      trip: { id: "trip-c", version: 1, status: "created" },
    } as TripView;

    expect(mergeTripListByVersion([local, extra], [stale, created])).toEqual([
      extra,
      local,
      created,
    ]);
  });

  it("builds workspace chrome from the demo session", () => {
    expect(getInitials("Crescent Dune")).toBe("CD");
    expect(getInitials("Bilal")).toBe("B");
    expect(getInitials("")).toBe("LV");
    expect(getInitials(undefined)).toBe("LV");
    expect(getWorkspaceChrome({ role: "operations" })).toEqual({
      title: "Operations Control",
      mark: "AWR",
      markColor: "bg-primary text-primary-foreground",
    });
    expect(
      getWorkspaceChrome({
        role: "controller",
        vendorId: "vendor-1",
        vendorName: "Crescent Dune",
      }),
    ).toEqual({
      title: "Crescent Dune",
      mark: "CD",
      markColor: "bg-role-controller text-role-mark-foreground",
    });
    expect(
      getWorkspaceChrome({
        role: "driver",
        vendorId: "vendor-1",
        vendorName: "Crescent Dune",
        driverId: "driver-1",
        driverName: "Bilal Rahman",
      }),
    ).toEqual({
      title: "Bilal Rahman",
      mark: "BR",
      markColor: "bg-role-driver text-role-mark-foreground",
    });
    expect(getWorkspaceChrome(null)).toEqual({
      title: "Driver trips",
      mark: "AWR",
      markColor: "bg-primary text-primary-foreground",
    });
  });

  it("builds create and assign toasts and skips unknown status targets", () => {
    expect(tripCreatedNotice("TRIP-DEMO-001")).toEqual({
      type: "success",
      title: "Trip created",
      description: "TRIP-DEMO-001 is ready for driver assignment.",
    });
    expect(tripAssignedNotice("Bilal Rahman", "TRIP-DEMO-001")).toEqual({
      type: "success",
      title: "Driver assigned",
      description: "Bilal Rahman will handle TRIP-DEMO-001.",
    });
    expect(
      tripListUpdateNotice({
        type: "created",
        trip: trip,
      }),
    ).toMatchObject({ title: "Trip created" });
    expect(
      tripListUpdateNotice({
        type: "status",
        to: "created",
        trip,
      }),
    ).toBeNull();
  });
});
