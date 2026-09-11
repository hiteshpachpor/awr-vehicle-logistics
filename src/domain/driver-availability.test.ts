import { describe, expect, it } from "vitest";
import {
  DRIVER_SCHEDULE_GAP_MS,
  driverHasOtherInTransitTrip,
  driverScheduleConflict,
} from "./driver-availability";

const tripId = "trip-a";
const threeHours = DRIVER_SCHEDULE_GAP_MS;

describe("driverScheduleConflict", () => {
  it("allows a driver with no other occupying trips", () => {
    expect(driverScheduleConflict(tripId, null, [])).toBeNull();
  });

  it("allows a second scheduled trip exactly 3 hours apart", () => {
    expect(
      driverScheduleConflict(tripId, new Date("2026-09-11T12:00:00Z"), [
        {
          id: "trip-b",
          status: "created",
          scheduledAt: new Date("2026-09-11T15:00:00Z"),
        },
      ]),
    ).toBeNull();
  });

  it("allows a scheduled trip 3 hours after an in-transit trip", () => {
    expect(
      driverScheduleConflict(tripId, new Date("2026-09-11T12:00:00Z"), [
        {
          id: "trip-b",
          status: "in_transit",
          scheduledAt: new Date(Date.parse("2026-09-11T12:00:00Z") - threeHours),
        },
      ]),
    ).toBeNull();
  });

  it("rejects a second trip closer than 3 hours", () => {
    expect(
      driverScheduleConflict(tripId, new Date("2026-09-11T12:00:00Z"), [
        {
          id: "trip-b",
          status: "created",
          scheduledAt: new Date("2026-09-11T14:59:00Z"),
        },
      ]),
    ).toMatchObject({ code: "DRIVER_SCHEDULE_CONFLICT" });
  });

  it("compares ISO timestamps the same way as Date values", () => {
    expect(
      driverScheduleConflict(tripId, "2026-09-11T17:42:56.758Z", [
        {
          id: "trip-b",
          status: "created",
          scheduledAt: "2026-09-11T18:33:28.557Z",
        },
      ]),
    ).toMatchObject({ code: "DRIVER_SCHEDULE_CONFLICT" });
  });

  it("rejects assignment when this trip has no schedule and the driver already has one", () => {
    expect(
      driverScheduleConflict(tripId, null, [
        {
          id: "trip-b",
          status: "created",
          scheduledAt: new Date("2026-09-11T12:00:00Z"),
        },
      ]),
    ).toMatchObject({ code: "DRIVER_SCHEDULE_REQUIRED" });
  });

  it("ignores other trips that have no scheduled collection time", () => {
    expect(
      driverScheduleConflict(tripId, new Date("2026-09-11T12:00:00Z"), [
        { id: "trip-b", status: "created", scheduledAt: null },
      ]),
    ).toBeNull();
  });

  it("ignores the trip being assigned and finished trips", () => {
    expect(
      driverScheduleConflict(tripId, null, [
        { id: tripId, status: "created", scheduledAt: null },
        {
          id: "trip-done",
          status: "completed",
          scheduledAt: new Date("2026-09-11T12:00:00Z"),
        },
      ]),
    ).toBeNull();
  });
});

describe("driverHasOtherInTransitTrip", () => {
  it("detects another in-transit trip for the same driver", () => {
    expect(
      driverHasOtherInTransitTrip(tripId, [
        { id: "trip-b", status: "in_transit", scheduledAt: null },
      ]),
    ).toBe(true);
  });

  it("allows starting when the driver only has scheduled trips", () => {
    expect(
      driverHasOtherInTransitTrip(tripId, [
        { id: "trip-b", status: "created", scheduledAt: null },
      ]),
    ).toBe(false);
  });
});
