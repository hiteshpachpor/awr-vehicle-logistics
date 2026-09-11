import type { TripStatus } from "@/db/schema";

export const DRIVER_SCHEDULE_GAP_HOURS = 3;
export const DRIVER_SCHEDULE_GAP_MS = DRIVER_SCHEDULE_GAP_HOURS * 60 * 60 * 1_000;

export type DriverTripOccupancy = {
  id: string;
  status: TripStatus;
  scheduledAt: Date | string | null;
};

function toMillis(value: Date | string | null | undefined) {
  if (value == null || value === "") {
    return null;
  }
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

const occupyingStatuses: ReadonlySet<TripStatus> = new Set([
  "created",
  "in_transit",
]);

export function driverHasOtherInTransitTrip(
  tripId: string,
  occupancy: readonly DriverTripOccupancy[],
) {
  return occupancy.some(
    (trip) => trip.id !== tripId && trip.status === "in_transit",
  );
}

export function driverScheduleConflict(
  tripId: string,
  scheduledAt: Date | string | null,
  occupancy: readonly DriverTripOccupancy[],
): { code: string; message: string } | null {
  const scheduledOthers = occupancy.filter((trip) => {
    return (
      trip.id !== tripId &&
      occupyingStatuses.has(trip.status) &&
      toMillis(trip.scheduledAt) != null
    );
  });
  if (scheduledOthers.length === 0) {
    return null;
  }

  const candidateTime = toMillis(scheduledAt);
  if (candidateTime == null) {
    return {
      code: "DRIVER_SCHEDULE_REQUIRED",
      message:
        "Set a scheduled collection time at least 3 hours from this driver's other trips",
    };
  }

  const tooClose = scheduledOthers.some((trip) => {
    const otherTime = toMillis(trip.scheduledAt);
    return (
      otherTime != null &&
      Math.abs(candidateTime - otherTime) < DRIVER_SCHEDULE_GAP_MS
    );
  });

  if (tooClose) {
    return {
      code: "DRIVER_SCHEDULE_CONFLICT",
      message: "This driver has another trip scheduled within 3 hours",
    };
  }

  return null;
}
