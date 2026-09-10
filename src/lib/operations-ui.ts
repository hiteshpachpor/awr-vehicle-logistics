import type { ApiErrorBody, TripStatus, TripView } from "./operations-types";

export const tripStatusLabels: Record<TripStatus, string> = {
  created: "Scheduled",
  in_transit: "In transit",
  completed: "Completed",
  cancelled: "Cancelled",
};

export type TripAction = "start" | "complete" | "cancel";
export type WorkspaceRole = "operations" | "controller" | "driver";

export function availableTripActions(
  status: TripStatus,
): readonly TripAction[] {
  if (status === "created") {
    return ["start", "cancel"] as const;
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
      return action !== "cancel" && (action !== "start" || hasDriver);
    }
    return role === "operations" && action === "cancel";
  });
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
