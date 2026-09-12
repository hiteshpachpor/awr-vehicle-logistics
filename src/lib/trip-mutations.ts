import type { ApiErrorBody, TripView } from "@/lib/operations-types";
import { getApiErrorMessage } from "@/lib/operations-ui";

export function findActiveTrip(trips: TripView[]) {
  return trips.find((trip) => trip.trip.status === "in_transit");
}

export function upsertTrip(trips: TripView[], updated: TripView) {
  const exists = trips.some((trip) => trip.trip.id === updated.trip.id);
  return exists
    ? trips.map((trip) =>
        trip.trip.id === updated.trip.id ? updated : trip,
      )
    : [updated, ...trips];
}

export async function assignTripDriver(tripId: string, driverId: string) {
  const response = await fetch(`/api/trips/${tripId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ driverId }),
  });
  const body = (await response.json()) as TripView | ApiErrorBody;
  if (!response.ok) {
    throw new Error(getApiErrorMessage(body as ApiErrorBody));
  }
  return body as TripView;
}
