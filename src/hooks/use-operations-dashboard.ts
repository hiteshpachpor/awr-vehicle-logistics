"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDemoAuth } from "@/components/auth/demo-auth-provider";
import { useDriverLocation } from "@/hooks/use-driver-location";
import { useTripEvents } from "@/hooks/use-trip-events";
import { useTripListEvents } from "@/hooks/use-trip-list-events";
import { canAccessTrip, getSessionHome } from "@/lib/demo-auth";
import {
  DriverLocationAccessError,
  requestDriverLocationAccess,
  startTripLocationError,
} from "@/lib/driver-location";
import type {
  ApiErrorBody,
  DriverOption,
  Position,
  TripListUpdate,
  TripMutationError,
  TripStatus,
  TripView,
} from "@/lib/operations-types";
import {
  getApiErrorMessage,
  matchesTrip,
  mergeTripByVersion,
  mergeTripListByVersion,
  tripAssignedNotice,
  tripCreatedNotice,
  tripListUpdateNotice,
  tripTransitionFailureNotice,
  tripTransitionSuccessNotice,
  type TripTransitionStatus,
} from "@/lib/operations-ui";
import {
  SIMULATION_INTERVAL_MS,
  type SimulationPace,
} from "@/lib/simulation";
import { broadcastTripListUpdate } from "@/lib/trip-list-sync";

export type OperationsNotice = {
  type: "success" | "error";
  title: string;
  description: string;
  hint?: string;
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
    createdReference ? tripCreatedNotice(createdReference) : null,
  );
  const [highlightedTripIds, setHighlightedTripIds] = useState<string[]>([]);
  const [revealTripId, setRevealTripId] = useState<string | null>(null);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [assigningTripId, setAssigningTripId] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);
  const [mutationError, setMutationError] =
    useState<TripMutationError | null>(null);
  const [positionLog, setPositionLog] = useState<Position[]>([]);
  const [positionsLoading, setPositionsLoading] = useState(focused);
  const [positionsError, setPositionsError] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [simulationPace, setSimulationPace] = useState<SimulationPace | null>(
    null,
  );
  const tripsRef = useRef<TripView[]>([]);
  const highlightTimers = useRef(new Map<string, number>());

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

      setTrips((current) => {
        const next = focused
          ? loadedTrips
          : mergeTripListByVersion(current, loadedTrips);
        tripsRef.current = next;
        return next;
      });
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
      if (focused && loadedTrips[0]) {
        try {
          const simulationResponse = await fetch(
            `/api/trips/${loadedTrips[0].trip.id}/simulation`,
            { cache: "no-store" },
          );
          const simulationBody = (await simulationResponse.json()) as
            | { data: SimulationStatusPayload }
            | ApiErrorBody;
          if (
            simulationResponse.ok &&
            "data" in simulationBody &&
            simulationBody.data.status === "running"
          ) {
            setSimulating(true);
            setSimulationPace({
              intervalMs: simulationBody.data.intervalMs,
              stepMeters: simulationBody.data.stepMeters,
            });
          } else {
            setSimulating(false);
            setSimulationPace(null);
          }
        } catch {
          setSimulating(false);
          setSimulationPace(null);
        }
      } else {
        setSimulating(false);
        setSimulationPace(null);
      }
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
  const simulationActive =
    simulating || selectedTrip?.latestPosition?.source === "simulator";
  const driverLocation = useDriverLocation(
    selectedTrip,
    focused && session?.role === "driver" && !simulationActive,
  );

  const handlePosition = useCallback(
    (position: Position) => {
      setTrips((current) => {
        const next = current.map((trip) =>
          trip.trip.id === position.tripId
            ? {
                ...trip,
                trip: { ...trip.trip, updatedAt: position.receivedAt },
                latestPosition: position,
              }
            : trip,
        );
        tripsRef.current = next;
        return next;
      });
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
      const next = exists
        ? current.map((trip) =>
            trip.trip.id === updated.trip.id ? updated : trip,
          )
        : [updated, ...current];
      tripsRef.current = next;
      return next;
    });
    setSelectedId(updated.trip.id);
    setLastRefresh(new Date());
  }, []);

  const highlightTrip = useCallback((tripId: string, reveal: boolean) => {
    setHighlightedTripIds((current) =>
      current.includes(tripId) ? current : [...current, tripId],
    );
    if (reveal) setRevealTripId(tripId);
    const existing = highlightTimers.current.get(tripId);
    if (existing) window.clearTimeout(existing);
    const timer = window.setTimeout(() => {
      highlightTimers.current.delete(tripId);
      setHighlightedTripIds((current) =>
        current.filter((id) => id !== tripId),
      );
      setRevealTripId((current) => (current === tripId ? null : current));
    }, 4_000);
    highlightTimers.current.set(tripId, timer);
  }, []);

  const syncTrips = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (vendorId) params.set("vendorId", vendorId);
      if (driverId) params.set("driverId", driverId);
      const response = await fetch(
        `/api/trips${params.size ? `?${params}` : ""}`,
        { cache: "no-store" },
      );
      const body = (await response.json()) as
        | { data: TripView[] }
        | ApiErrorBody;
      if (!response.ok || !("data" in body)) {
        return;
      }
      setTrips((current) => {
        const next = mergeTripListByVersion(current, body.data);
        tripsRef.current = next;
        return next;
      });
      setLastRefresh(new Date());
    } catch {
      // The next reconnect retries; the open tab keeps its current list.
    }
  }, [driverId, vendorId]);

  const handleListUpdate = useCallback(
    (update: TripListUpdate) => {
      const merged = mergeTripByVersion(tripsRef.current, update.trip);
      if (merged.applied === "unchanged") {
        return;
      }
      tripsRef.current = merged.trips;
      setTrips(merged.trips);
      setLastRefresh(new Date());
      const notice = tripListUpdateNotice(update);
      if (notice) setNotice(notice);
      highlightTrip(
        update.trip.trip.id,
        merged.applied === "new" && update.type === "created",
      );
    },
    [highlightTrip],
  );

  useTripListEvents({
    enabled:
      !focused &&
      (session?.role === "operations" || session?.role === "controller"),
    vendorId:
      vendorId ??
      (session?.role === "controller" ? session.vendorId : undefined),
    onUpdate: handleListUpdate,
    onSync: () => {
      void syncTrips();
    },
  });

  useEffect(() => {
    return () => {
      for (const timer of highlightTimers.current.values()) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  useEffect(() => {
    if (!simulating || !selectedId) {
      return;
    }

    const tripId = selectedId;
    const intervalMs = simulationPace?.intervalMs ?? SIMULATION_INTERVAL_MS;
    let active = true;

    async function refreshSimulatedTrip() {
      try {
        const response = await fetch(`/api/trips/${tripId}`, {
          cache: "no-store",
        });
        const body = (await response.json()) as TripView | ApiErrorBody;
        if (!active || !response.ok || !("trip" in body)) {
          return;
        }
        if (body.trip.status !== "in_transit") {
          replaceTrip(body);
          setSimulating(false);
          setSimulationPace(null);
        }
      } catch {
        // The next interval retries; the live map still updates over SSE.
      }
    }

    const timer = window.setInterval(() => {
      void refreshSimulatedTrip();
    }, intervalMs);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [replaceTrip, selectedId, simulating, simulationPace?.intervalMs]);

  async function transitionTrip(status: TripTransitionStatus) {
    if (!selectedId) return;
    setMutating(true);
    setMutationError(null);
    try {
      if (status === "in_transit") {
        await requestDriverLocationAccess();
      }
      const response = await fetch(`/api/trips/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = (await response.json()) as TripView | ApiErrorBody;
      if (!response.ok) {
        throw new Error(getApiErrorMessage(body as ApiErrorBody));
      }
      const updated = body as TripView;
      replaceTrip(updated);
      broadcastTripListUpdate({
        type: "status",
        to: status,
        trip: updated,
      });
      if (status !== "in_transit") {
        setSimulating(false);
        setSimulationPace(null);
      }
      setNotice(
        tripTransitionSuccessNotice(status, updated.trip.referenceNumber),
      );
    } catch (error) {
      if (error instanceof DriverLocationAccessError) {
        const locationError = startTripLocationError(error.reason);
        setMutationError(locationError);
        setNotice({ type: "error", ...locationError });
        return;
      }
      const description =
        error instanceof Error
          ? error.message
          : "The trip could not be updated.";
      setMutationError({
        title: "The trip could not be updated",
        description,
      });
      setNotice(tripTransitionFailureNotice(status, description));
    } finally {
      setMutating(false);
    }
  }

  async function simulateTrip(pace: SimulationPace) {
    if (!selectedId) return;
    setMutating(true);
    setMutationError(null);
    try {
      const response = await fetch(`/api/trips/${selectedId}/simulation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pace),
      });
      const body = (await response.json()) as
        | {
            data: {
              status: string;
              intervalMs: number;
              stepMeters: number;
            };
            trip: TripView;
          }
        | ApiErrorBody;
      if (!response.ok) {
        throw new Error(getApiErrorMessage(body as ApiErrorBody));
      }
      setSimulating(true);
      if ("data" in body) {
        setSimulationPace({
          intervalMs: body.data.intervalMs,
          stepMeters: body.data.stepMeters,
        });
      }
      if ("trip" in body) {
        replaceTrip(body.trip);
        broadcastTripListUpdate({
          type: "status",
          to: body.trip.trip.status,
          trip: body.trip,
        });
      }
    } catch (error) {
      setMutationError({
        title: "The trip could not be simulated",
        description:
          error instanceof Error
            ? error.message
            : "The trip could not be simulated.",
      });
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
      broadcastTripListUpdate({
        type: "assigned",
        trip: body as TripView,
      });
      setNotice(
        tripAssignedNotice(
          (body as TripView).driver?.name ?? "A driver",
          (body as TripView).trip.referenceNumber,
        ),
      );
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
    highlightedTripIds,
    revealTripId,
    drivers,
    assigningTripId,
    mutating,
    mutationError,
    positionLog,
    positionsLoading,
    positionsError,
    driverLocation,
    streamStatus,
    simulating: simulationActive,
    simulationPace,
    counts,
    visibleTrips,
    loadTrips,
    transitionTrip,
    simulateTrip,
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

type SimulationStatusPayload =
  | { status: "idle" }
  | { status: "running"; intervalMs: number; stepMeters: number };
