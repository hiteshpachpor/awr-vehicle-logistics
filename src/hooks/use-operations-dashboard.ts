"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useDemoAuth } from "@/components/auth/demo-auth-provider";
import { useDriverLocation } from "@/hooks/use-driver-location";
import { useTripEvents } from "@/hooks/use-trip-events";
import { canAccessTrip, getSessionHome } from "@/lib/demo-auth";
import type {
  ApiErrorBody,
  DriverOption,
  Position,
  TripStatus,
  TripView,
} from "@/lib/operations-types";
import { getApiErrorMessage, matchesTrip } from "@/lib/operations-ui";

export type OperationsNotice = {
  type: "success" | "error";
  title: string;
  description: string;
};

export function useOperationsDashboard({
  initialTripId,
  focused,
  vendorId,
  driverId,
  createdReference,
}: {
  initialTripId: string | null;
  focused: boolean;
  vendorId?: string;
  driverId?: string;
  createdReference?: string;
}) {
  const router = useRouter();
  const { session, logout } = useDemoAuth();
  const [trips, setTrips] = useState<TripView[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialTripId);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | TripStatus>("all");
  const [notice, setNotice] = useState<OperationsNotice | null>(
    createdReference
      ? {
          type: "success",
          title: "Trip created",
          description: `${createdReference} is ready for driver assignment.`,
        }
      : null,
  );
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [assigningTripId, setAssigningTripId] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [positionLog, setPositionLog] = useState<Position[]>([]);
  const [positionsLoading, setPositionsLoading] = useState(focused);
  const [positionsError, setPositionsError] = useState<string | null>(null);

  const loadTrips = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      if (focused && session?.role === "driver") {
        const driverTripsResponse = await fetch(
          `/api/trips?driverId=${encodeURIComponent(session.driverId)}`,
          { cache: "no-store" },
        );
        const driverTripsBody = (await driverTripsResponse.json()) as
          | { data: TripView[] }
          | ApiErrorBody;
        if (!driverTripsResponse.ok || !("data" in driverTripsBody)) {
          throw new Error(getApiErrorMessage(driverTripsBody as ApiErrorBody));
        }
        const activeTrip = findActiveTrip(driverTripsBody.data);
        if (activeTrip && activeTrip.trip.id !== initialTripId) {
          router.replace(`/trips/${activeTrip.trip.id}`);
          return;
        }
      }

      const params = new URLSearchParams();
      if (vendorId) params.set("vendorId", vendorId);
      if (driverId) params.set("driverId", driverId);
      const endpoint =
        focused && initialTripId
          ? `/api/trips/${initialTripId}`
          : `/api/trips${params.size ? `?${params}` : ""}`;
      const response = await fetch(endpoint, { cache: "no-store" });
      const body = (await response.json()) as
        | TripView
        | { data: TripView[] }
        | ApiErrorBody;
      if (!response.ok) {
        throw new Error(getApiErrorMessage(body as ApiErrorBody));
      }

      const loadedTrips = "data" in body ? body.data : [body as TripView];
      if (
        focused &&
        session &&
        loadedTrips[0] &&
        !canAccessTrip(session, loadedTrips[0])
      ) {
        router.replace(getSessionHome(session));
        return;
      }

      setTrips(loadedTrips);
      setSelectedId((current) => {
        if (current && loadedTrips.some((trip) => trip.trip.id === current)) {
          return current;
        }
        if (
          initialTripId &&
          loadedTrips.some((trip) => trip.trip.id === initialTripId)
        ) {
          return initialTripId;
        }
        return null;
      });
      setLastRefresh(new Date());
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Trips could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [driverId, focused, initialTripId, router, session, vendorId]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadTrips(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadTrips]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => {
      setNotice(null);
      if (createdReference) router.replace("/ops/trips");
    }, 12_000);
    return () => window.clearTimeout(timer);
  }, [createdReference, notice, router]);

  useEffect(() => {
    if (focused || session?.role !== "driver" || loading) return;
    const activeTrip = findActiveTrip(trips);
    if (activeTrip) router.replace(`/trips/${activeTrip.trip.id}`);
  }, [focused, loading, router, session?.role, trips]);

  useEffect(() => {
    if (session?.role !== "controller" || drivers.length) return;

    const query = `?vendorId=${encodeURIComponent(session.vendorId)}`;
    void fetch(`/api/drivers${query}`, { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json()) as
          | { data: DriverOption[] }
          | ApiErrorBody;
        if (!response.ok || !("data" in body)) {
          throw new Error(getApiErrorMessage(body as ApiErrorBody));
        }
        setDrivers(body.data);
      })
      .catch((reason: unknown) => {
        setNotice({
          type: "error",
          title: "Drivers could not be loaded",
          description:
            reason instanceof Error ? reason.message : "Try refreshing.",
        });
      });
  }, [drivers.length, session]);

  useEffect(() => {
    if (!focused || !selectedId) return;

    let active = true;
    const loadingTimer = window.setTimeout(() => {
      setPositionsLoading(true);
      setPositionsError(null);
    }, 0);

    async function loadPositions() {
      try {
        const response = await fetch(`/api/trips/${selectedId}/positions`, {
          cache: "no-store",
        });
        const body = (await response.json()) as
          | { data: Position[] }
          | ApiErrorBody;
        if (!response.ok || !("data" in body)) {
          throw new Error(getApiErrorMessage(body as ApiErrorBody));
        }
        setPositionLog((current) =>
          active
            ? mergePositions(
                body.data,
                current.filter((position) => position.tripId === selectedId),
              )
            : current,
        );
      } catch (error) {
        if (!active) return;
        setPositionsError(
          error instanceof Error
            ? error.message
            : "Location pings could not be loaded.",
        );
      } finally {
        if (active) setPositionsLoading(false);
      }
    }

    void loadPositions();
    return () => {
      active = false;
      window.clearTimeout(loadingTimer);
    };
  }, [focused, selectedId]);

  const selectedTrip =
    trips.find((trip) => trip.trip.id === selectedId) ?? null;
  const driverLocation = useDriverLocation(
    selectedTrip,
    focused && session?.role === "driver",
  );

  const handlePosition = useCallback(
    (position: Position) => {
      setTrips((current) =>
        current.map((trip) =>
          trip.trip.id === position.tripId
            ? {
                ...trip,
                trip: { ...trip.trip, updatedAt: position.receivedAt },
                latestPosition: position,
              }
            : trip,
        ),
      );
      if (focused) {
        setPositionLog((current) => mergePositions([position], current));
      }
    },
    [focused],
  );
  const streamStatus = useTripEvents(
    focused && selectedTrip?.trip.status === "in_transit"
      ? selectedId
      : null,
    handlePosition,
  );

  const replaceTrip = useCallback((updated: TripView) => {
    setTrips((current) => {
      const exists = current.some((trip) => trip.trip.id === updated.trip.id);
      return exists
        ? current.map((trip) =>
            trip.trip.id === updated.trip.id ? updated : trip,
          )
        : [updated, ...current];
    });
    setSelectedId(updated.trip.id);
    setLastRefresh(new Date());
  }, []);

  async function transitionTrip(status: TripStatus) {
    if (!selectedId) return;
    setMutating(true);
    setMutationError(null);
    try {
      const response = await fetch(`/api/trips/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = (await response.json()) as TripView | ApiErrorBody;
      if (!response.ok) {
        throw new Error(getApiErrorMessage(body as ApiErrorBody));
      }
      replaceTrip(body as TripView);
    } catch (error) {
      setMutationError(
        error instanceof Error
          ? error.message
          : "The trip could not be updated.",
      );
    } finally {
      setMutating(false);
    }
  }

  async function assignDriver(tripId: string, nextDriverId: string) {
    setAssigningTripId(tripId);
    try {
      const response = await fetch(`/api/trips/${tripId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId: nextDriverId }),
      });
      const body = (await response.json()) as TripView | ApiErrorBody;
      if (!response.ok) {
        throw new Error(getApiErrorMessage(body as ApiErrorBody));
      }
      replaceTrip(body as TripView);
      setNotice({
        type: "success",
        title: "Driver assigned",
        description: `${(body as TripView).driver?.name} will handle ${(body as TripView).trip.referenceNumber}.`,
      });
    } catch (error) {
      setNotice({
        type: "error",
        title: "Driver could not be assigned",
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setAssigningTripId(null);
    }
  }

  const counts = useMemo(
    () => ({
      all: trips.length,
      created: trips.filter((trip) => trip.trip.status === "created").length,
      in_transit: trips.filter(
        (trip) => trip.trip.status === "in_transit",
      ).length,
      completed: trips.filter((trip) => trip.trip.status === "completed")
        .length,
      cancelled: trips.filter((trip) => trip.trip.status === "cancelled")
        .length,
    }),
    [trips],
  );
  const visibleTrips = useMemo(
    () =>
      trips.filter(
        (trip) =>
          (filter === "all" || trip.trip.status === filter) &&
          matchesTrip(trip, query),
      ),
    [filter, query, trips],
  );

  return {
    session,
    logout,
    selectedTrip,
    loading,
    loadError,
    lastRefresh,
    query,
    setQuery,
    filter,
    setFilter,
    notice,
    drivers,
    assigningTripId,
    mutating,
    mutationError,
    positionLog,
    positionsLoading,
    positionsError,
    driverLocation,
    streamStatus,
    counts,
    visibleTrips,
    loadTrips,
    transitionTrip,
    assignDriver,
  };
}

function findActiveTrip(trips: TripView[]) {
  return trips.find((trip) => trip.trip.status === "in_transit");
}

function mergePositions(...groups: Position[][]) {
  const positions = new Map<number, Position>();
  for (const position of groups.flat()) positions.set(position.id, position);
  return [...positions.values()]
    .sort(
      (left, right) =>
        new Date(right.recordedAt).getTime() -
          new Date(left.recordedAt).getTime() || right.id - left.id,
    )
    .slice(0, 100);
}
