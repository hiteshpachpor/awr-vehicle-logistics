"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDemoAuth } from "@/components/auth/demo-auth-provider";
import { useControllerDrivers } from "@/hooks/use-controller-drivers";
import { useTripListEvents } from "@/hooks/use-trip-list-events";
import { useTripNotice } from "@/hooks/use-trip-notice";
import { isController } from "@/lib/demo-auth";
import type {
  ApiErrorBody,
  TripListUpdate,
  TripStatus,
  TripView,
} from "@/lib/operations-types";
import {
  assignTripDriver,
  findActiveTrip,
  upsertTrip,
} from "@/lib/trip-mutations";
import {
  getApiErrorMessage,
  matchesTrip,
  mergeTripByVersion,
  mergeTripListByVersion,
  tripAssignedNotice,
  tripCreatedNotice,
  tripListUpdateNotice,
} from "@/lib/operations-ui";
import { broadcastTripListUpdate } from "@/lib/trip-list-sync";

export function useTripList({
  vendorId,
  driverId,
  createdReference,
}: {
  vendorId?: string;
  driverId?: string;
  createdReference?: string;
}) {
  const router = useRouter();
  const { session, logout } = useDemoAuth();
  const [trips, setTrips] = useState<TripView[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | TripStatus>("all");
  const { notice, setNotice } = useTripNotice({
    initialNotice: createdReference
      ? tripCreatedNotice(createdReference)
      : null,
    onExpire: createdReference
      ? () => router.replace("/ops/trips")
      : undefined,
  });
  const [highlightedTripIds, setHighlightedTripIds] = useState<string[]>([]);
  const [revealTripId, setRevealTripId] = useState<string | null>(null);
  const [assigningTripId, setAssigningTripId] = useState<string | null>(null);
  const drivers = useControllerDrivers(session, setNotice);
  const tripsRef = useRef<TripView[]>([]);
  const highlightTimers = useRef(new Map<string, number>());

  const loadTrips = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (vendorId) params.set("vendorId", vendorId);
      if (driverId) params.set("driverId", driverId);
      const endpoint = `/api/trips${params.size ? `?${params}` : ""}`;
      const response = await fetch(endpoint, { cache: "no-store" });
      const body = (await response.json()) as
        | { data: TripView[] }
        | ApiErrorBody;
      if (!response.ok || !("data" in body)) {
        throw new Error(getApiErrorMessage(body as ApiErrorBody));
      }

      setTrips((current) => {
        const next = mergeTripListByVersion(current, body.data);
        tripsRef.current = next;
        return next;
      });
      setLastRefresh(new Date());
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Trips could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [driverId, vendorId]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadTrips(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadTrips]);

  useEffect(() => {
    if (session?.role !== "driver" || loading) return;
    const activeTrip = findActiveTrip(trips);
    if (activeTrip) router.replace(`/trips/${activeTrip.trip.id}`);
  }, [loading, router, session?.role, trips]);

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
      const nextNotice = tripListUpdateNotice(update);
      if (nextNotice) setNotice(nextNotice);
      highlightTrip(
        update.trip.trip.id,
        merged.applied === "new" && update.type === "created",
      );
    },
    [highlightTrip, setNotice],
  );

  useTripListEvents({
    enabled: session?.role === "operations" || session?.role === "controller",
    vendorId:
      vendorId ??
      (isController(session) ? session.vendorId : undefined),
    onUpdate: handleListUpdate,
    onSync: () => {
      void syncTrips();
    },
  });

  useEffect(() => {
    const timers = highlightTimers.current;
    return () => {
      for (const timer of timers.values()) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  async function assignDriver(tripId: string, nextDriverId: string) {
    setAssigningTripId(tripId);
    try {
      const updated = await assignTripDriver(tripId, nextDriverId);
      setTrips((current) => {
        const next = upsertTrip(current, updated);
        tripsRef.current = next;
        return next;
      });
      setLastRefresh(new Date());
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
    counts,
    visibleTrips,
    loadTrips,
    assignDriver,
  };
}
