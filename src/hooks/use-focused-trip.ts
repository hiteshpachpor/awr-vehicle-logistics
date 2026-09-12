"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useDemoAuth } from "@/components/auth/demo-auth-provider";
import { useControllerDrivers } from "@/hooks/use-controller-drivers";
import { useDriverLocation } from "@/hooks/use-driver-location";
import { useTripEvents } from "@/hooks/use-trip-events";
import { useTripNotice } from "@/hooks/use-trip-notice";
import { canAccessTrip, getSessionHome } from "@/lib/demo-auth";
import {
  DriverLocationAccessError,
  requestDriverLocationAccess,
  startTripLocationError,
} from "@/lib/driver-location";
import type {
  ApiErrorBody,
  Position,
  TripMutationError,
  TripView,
} from "@/lib/operations-types";
import {
  assignTripDriver,
  findActiveTrip,
} from "@/lib/trip-mutations";
import {
  getApiErrorMessage,
  tripAssignedNotice,
  tripTransitionFailureNotice,
  tripTransitionSuccessNotice,
  type TripTransitionStatus,
} from "@/lib/operations-ui";
import {
  SIMULATION_INTERVAL_MS,
  type SimulationPace,
} from "@/lib/simulation";
import { broadcastTripListUpdate } from "@/lib/trip-list-sync";

export function useFocusedTrip({ tripId }: { tripId: string }) {
  const router = useRouter();
  const { session, logout } = useDemoAuth();
  const [trip, setTrip] = useState<TripView | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const { notice, setNotice } = useTripNotice();
  const [assigningTripId, setAssigningTripId] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);
  const [mutationError, setMutationError] =
    useState<TripMutationError | null>(null);
  const [positionLog, setPositionLog] = useState<Position[]>([]);
  const [positionsLoading, setPositionsLoading] = useState(true);
  const [positionsError, setPositionsError] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [simulationPace, setSimulationPace] = useState<SimulationPace | null>(
    null,
  );
  const drivers = useControllerDrivers(session, setNotice);

  const loadTrip = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      if (session?.role === "driver") {
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
        if (activeTrip && activeTrip.trip.id !== tripId) {
          router.replace(`/trips/${activeTrip.trip.id}`);
          return;
        }
      }

      const response = await fetch(`/api/trips/${tripId}`, {
        cache: "no-store",
      });
      const body = (await response.json()) as TripView | ApiErrorBody;
      if (!response.ok) {
        throw new Error(getApiErrorMessage(body as ApiErrorBody));
      }

      const loadedTrip = body as TripView;
      if (session && !canAccessTrip(session, loadedTrip)) {
        router.replace(getSessionHome(session));
        return;
      }

      setTrip(loadedTrip);
      try {
        const simulationResponse = await fetch(
          `/api/trips/${loadedTrip.trip.id}/simulation`,
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
      setLastRefresh(new Date());
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Trips could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [router, session, tripId]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadTrip(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadTrip]);

  useEffect(() => {
    let active = true;
    const loadingTimer = window.setTimeout(() => {
      setPositionsLoading(true);
      setPositionsError(null);
    }, 0);

    async function loadPositions() {
      try {
        const response = await fetch(`/api/trips/${tripId}/positions`, {
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
                current.filter((position) => position.tripId === tripId),
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
  }, [tripId]);

  const simulationActive =
    simulating || trip?.latestPosition?.source === "simulator";
  const driverLocation = useDriverLocation(
    trip,
    session?.role === "driver" && !simulationActive,
  );

  const handlePosition = useCallback((position: Position) => {
    setTrip((current) =>
      current && current.trip.id === position.tripId
        ? {
            ...current,
            trip: { ...current.trip, updatedAt: position.receivedAt },
            latestPosition: position,
          }
        : current,
    );
    setPositionLog((current) => mergePositions([position], current));
  }, []);
  const streamStatus = useTripEvents(
    trip?.trip.status === "in_transit" ? tripId : null,
    handlePosition,
  );

  const replaceTrip = useCallback((updated: TripView) => {
    setTrip(updated);
    setLastRefresh(new Date());
  }, []);

  useEffect(() => {
    if (!simulating || !tripId) {
      return;
    }

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
  }, [replaceTrip, simulating, simulationPace?.intervalMs, tripId]);

  async function transitionTrip(status: TripTransitionStatus) {
    setMutating(true);
    setMutationError(null);
    try {
      if (status === "in_transit") {
        await requestDriverLocationAccess();
      }
      const response = await fetch(`/api/trips/${tripId}`, {
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
    setMutating(true);
    setMutationError(null);
    try {
      const response = await fetch(`/api/trips/${tripId}/simulation`, {
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

  async function assignDriver(nextTripId: string, nextDriverId: string) {
    setAssigningTripId(nextTripId);
    try {
      const updated = await assignTripDriver(nextTripId, nextDriverId);
      replaceTrip(updated);
      broadcastTripListUpdate({
        type: "assigned",
        trip: updated,
      });
      setNotice(
        tripAssignedNotice(
          updated.driver?.name ?? "A driver",
          updated.trip.referenceNumber,
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

  return {
    session,
    logout,
    trip,
    loading,
    loadError,
    lastRefresh,
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
    simulating: simulationActive,
    simulationPace,
    loadTrip,
    transitionTrip,
    simulateTrip,
    assignDriver,
  };
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
