import type { DemoSession } from "./demo-auth";
import type { ApiErrorBody, TripStatus, TripView } from "./operations-types";
import { isSameLocation } from "./route-geometry";

export const tripStatusLabels: Record<TripStatus, string> = {
  created: "Scheduled",
  in_transit: "In transit",
  completed: "Completed",
  cancelled: "Cancelled",
};

export type TripAction = "start" | "simulate" | "complete" | "cancel";
export type WorkspaceRole = "operations" | "controller" | "driver";
export type TripTransitionStatus = Extract<
  TripStatus,
  "in_transit" | "completed" | "cancelled"
>;

export function tripTransitionSuccessNotice(
  status: TripTransitionStatus,
  referenceNumber: string,
) {
  if (status === "in_transit") {
    return {
      type: "success" as const,
      title: "Trip started",
      description: `${referenceNumber} is now in transit.`,
    };
  }
  if (status === "completed") {
    return {
      type: "success" as const,
      title: "Trip ended",
      description: `${referenceNumber} has been completed.`,
    };
  }
  return {
    type: "success" as const,
    title: "Trip cancelled",
    description: `${referenceNumber} has been cancelled.`,
  };
}

export function tripTransitionFailureNotice(
  status: TripTransitionStatus,
  description: string,
) {
  if (status === "in_transit") {
    return {
      type: "error" as const,
      title: "Trip could not be started",
      description,
    };
  }
  if (status === "completed") {
    return {
      type: "error" as const,
      title: "Trip could not be ended",
      description,
    };
  }
  return {
    type: "error" as const,
    title: "Trip could not be cancelled",
    description,
  };
}

export function availableTripActions(
  status: TripStatus,
): readonly TripAction[] {
  if (status === "created") {
    return ["start", "simulate", "cancel"] as const;
  }
  if (status === "in_transit") {
    return ["complete", "cancel"] as const;
  }
  return [] as const;
}

export function availableTripActionsForRole(
  status: TripStatus,
  role: WorkspaceRole,
  hasDriver: boolean,
) {
  return availableTripActions(status).filter((action) => {
    if (role === "driver") {
      return (
        action !== "cancel" &&
        ((action !== "start" && action !== "simulate") || hasDriver)
      );
    }
    return role === "operations" && action === "cancel";
  });
}

export function tripCreatedNotice(referenceNumber: string) {
  return {
    type: "success" as const,
    title: "Trip created",
    description: `${referenceNumber} is ready for driver assignment.`,
  };
}

export function tripAssignedNotice(
  driverName: string,
  referenceNumber: string,
) {
  return {
    type: "success" as const,
    title: "Driver assigned",
    description: `${driverName} will handle ${referenceNumber}.`,
  };
}

export function tripListUpdateNotice(update: {
  type: "created" | "assigned" | "status";
  to?: TripStatus;
  trip: TripView;
}) {
  if (update.type === "created") {
    return tripCreatedNotice(update.trip.trip.referenceNumber);
  }
  if (update.type === "assigned") {
    return tripAssignedNotice(
      update.trip.driver?.name ?? "A driver",
      update.trip.trip.referenceNumber,
    );
  }
  if (
    update.to === "in_transit" ||
    update.to === "completed" ||
    update.to === "cancelled"
  ) {
    return tripTransitionSuccessNotice(update.to, update.trip.trip.referenceNumber);
  }
  return null;
}

export function mergeTripByVersion(
  trips: TripView[],
  updated: TripView,
): { trips: TripView[]; applied: "new" | "newer" | "unchanged" } {
  const existing = trips.find((trip) => trip.trip.id === updated.trip.id);
  if (!existing) {
    return { trips: [updated, ...trips], applied: "new" };
  }
  if (updated.trip.version > existing.trip.version) {
    return {
      trips: trips.map((trip) =>
        trip.trip.id === updated.trip.id ? updated : trip,
      ),
      applied: "newer",
    };
  }
  return { trips, applied: "unchanged" };
}

export function mergeTripListByVersion(
  current: TripView[],
  incoming: TripView[],
): TripView[] {
  const currentById = new Map(
    current.map((trip) => [trip.trip.id, trip] as const),
  );
  const incomingIds = new Set(incoming.map((trip) => trip.trip.id));
  const extras = current.filter((trip) => !incomingIds.has(trip.trip.id));
  const merged = incoming.map((trip) => {
    const local = currentById.get(trip.trip.id);
    return local && local.trip.version > trip.trip.version ? local : trip;
  });
  return extras.length ? [...extras, ...merged] : merged;
}

export function matchesTrip(trip: TripView, query: string) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) {
    return true;
  }
  return [
    trip.trip.referenceNumber,
    trip.vehicle.registrationNumber,
    trip.vehicle.make,
    trip.vehicle.model,
    trip.customer.name,
    trip.driver?.name ?? "",
    trip.vendor.name,
    trip.trip.pickupAddress,
    trip.trip.dropoffAddress,
  ].some((value) => value.toLocaleLowerCase().includes(normalized));
}

export function getApiErrorMessage(
  body: ApiErrorBody | undefined,
  fallback = "The request could not be completed.",
) {
  if (body?.error?.details?.[0]?.message) {
    return body.error.details[0].message;
  }
  return body?.error?.message ?? fallback;
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Not scheduled";
  }
  return new Intl.DateTimeFormat("en-AE", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value));
}

export function formatRelativeTime(value: string | null | undefined) {
  if (!value) {
    return "No update";
  }
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1_000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(seconds) < 60) {
    return formatter.format(seconds, "second");
  }
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) {
    return formatter.format(minutes, "minute");
  }
  return formatter.format(Math.round(minutes / 60), "hour");
}

export function formatCoordinates(latitude: number, longitude: number) {
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
}

export function formatSpeed(speed: number | null, fallback = "Not reported") {
  return speed === null ? fallback : `${speed.toFixed(1)} km/h`;
}

export function formatPositionSource(source: "vendor" | "simulator") {
  return source === "simulator" ? "Simulation" : "Vendor";
}

export function formatTripRoute(trip: TripView) {
  return `${trip.trip.pickupAddress} to ${trip.trip.dropoffAddress}`;
}

export function getInitials(name: string | undefined) {
  const initials = name
    ?.trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return initials || "LV";
}

export function getWorkspaceChrome(session: DemoSession | null) {
  if (session?.role === "controller") {
    return {
      title: session.vendorName,
      mark: getInitials(session.vendorName),
      markColor: "bg-role-controller text-role-mark-foreground",
    };
  }
  if (session?.role === "driver") {
    return {
      title: session.driverName,
      mark: getInitials(session.driverName),
      markColor: "bg-role-driver text-role-mark-foreground",
    };
  }
  return {
    title:
      session?.role === "operations"
        ? "Operations Control"
        : "Driver trips",
    mark: "AWR",
    markColor: "bg-primary text-primary-foreground",
  };
}

export function hasActualDropoffMismatch(trip: TripView) {
  if (trip.trip.status !== "completed" || !trip.latestPosition) {
    return false;
  }

  return !isSameLocation(
    {
      lat: trip.latestPosition.latitude,
      lng: trip.latestPosition.longitude,
    },
    {
      lat: trip.trip.dropoffLatitude,
      lng: trip.trip.dropoffLongitude,
    },
  );
}
