"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowClockwiseIcon,
  MapPinIcon,
  PlusIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { useTripEvents } from "@/hooks/use-trip-events";
import type {
  ApiErrorBody,
  DriverOption,
  Position,
  TripStatus,
  TripView,
  VehicleOption,
} from "@/lib/operations-types";
import { getApiErrorMessage, matchesTrip } from "@/lib/operations-ui";
import { CreateTripDialog } from "./create-trip-dialog";
import { OperationsMap } from "./operations-map";
import { TripInspector } from "./trip-inspector";
import { TripQueue } from "./trip-queue";

type HealthStatus = "checking" | "available" | "unavailable";

export function OperationsDashboard({
  initialTripId = null,
  focused = false,
}: {
  initialTripId?: string | null;
  focused?: boolean;
}) {
  const [trips, setTrips] = useState<TripView[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialTripId);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [health, setHealth] = useState<HealthStatus>("checking");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | TripStatus>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [runningSimulations, setRunningSimulations] = useState<Set<string>>(
    new Set(),
  );

  const loadTrips = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/trips", { cache: "no-store" });
      const body = (await response.json()) as
        | { data: TripView[] }
        | ApiErrorBody;
      if (!response.ok || !("data" in body)) {
        throw new Error(getApiErrorMessage(body as ApiErrorBody));
      }
      setTrips(body.data);
      setSelectedId((current) => {
        if (current && body.data.some((trip) => trip.trip.id === current)) {
          return current;
        }
        if (
          initialTripId &&
          body.data.some((trip) => trip.trip.id === initialTripId)
        ) {
          return initialTripId;
        }
        return focused ? null : (body.data[0]?.trip.id ?? null);
      });
      setLastRefresh(new Date());
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Trips could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [focused, initialTripId]);

  const checkHealth = useCallback(async () => {
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      setHealth(response.ok ? "available" : "unavailable");
    } catch {
      setHealth("unavailable");
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadTrips();
      void checkHealth();
    }, 0);
    const interval = window.setInterval(() => {
      void checkHealth();
    }, 30_000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [checkHealth, loadTrips]);

  useEffect(() => {
    if (!createOpen || vehicles.length || optionsLoading) return;

    async function loadOptions() {
      setOptionsLoading(true);
      setOptionsError(null);
      try {
        const [vehiclesResponse, driversResponse] = await Promise.all([
          fetch("/api/vehicles", { cache: "no-store" }),
          fetch("/api/drivers", { cache: "no-store" }),
        ]);
        const vehiclesBody = (await vehiclesResponse.json()) as
          | { data: VehicleOption[] }
          | ApiErrorBody;
        const driversBody = (await driversResponse.json()) as
          | { data: DriverOption[] }
          | ApiErrorBody;
        if (!vehiclesResponse.ok || !("data" in vehiclesBody)) {
          throw new Error(getApiErrorMessage(vehiclesBody as ApiErrorBody));
        }
        if (!driversResponse.ok || !("data" in driversBody)) {
          throw new Error(getApiErrorMessage(driversBody as ApiErrorBody));
        }
        setVehicles(vehiclesBody.data);
        setDrivers(driversBody.data);
      } catch (error) {
        setOptionsError(
          error instanceof Error
            ? error.message
            : "Vehicle and driver options could not be loaded.",
        );
      } finally {
        setOptionsLoading(false);
      }
    }

    void loadOptions();
  }, [createOpen, drivers.length, optionsLoading, vehicles.length]);

  const selectedTrip =
    trips.find((trip) => trip.trip.id === selectedId) ?? null;

  const handlePosition = useCallback((position: Position) => {
    setTrips((current) =>
      current.map((trip) =>
        trip.trip.id === position.tripId
          ? {
              ...trip,
              trip: {
                ...trip.trip,
                updatedAt: position.receivedAt,
              },
              latestPosition: position,
            }
          : trip,
      ),
    );
  }, []);
  const streamStatus = useTripEvents(selectedId, handlePosition);

  const replaceTrip = useCallback((updated: TripView) => {
    setTrips((current) => {
      const exists = current.some(
        (trip) => trip.trip.id === updated.trip.id,
      );
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
      if (status === "completed" || status === "cancelled") {
        setRunningSimulations((current) => {
          const next = new Set(current);
          next.delete(selectedId);
          return next;
        });
      }
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

  async function startSimulation(intervalMs: number) {
    if (!selectedId) return;
    setMutating(true);
    setMutationError(null);
    try {
      const response = await fetch(`/api/trips/${selectedId}/simulation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intervalMs }),
      });
      const body = (await response.json()) as ApiErrorBody;
      if (!response.ok) {
        throw new Error(getApiErrorMessage(body));
      }
      setRunningSimulations((current) => new Set(current).add(selectedId));
      const tripResponse = await fetch(`/api/trips/${selectedId}`, {
        cache: "no-store",
      });
      if (tripResponse.ok) {
        replaceTrip((await tripResponse.json()) as TripView);
      }
    } catch (error) {
      setMutationError(
        error instanceof Error
          ? error.message
          : "The simulation could not be started.",
      );
    } finally {
      setMutating(false);
    }
  }

  async function stopSimulation() {
    if (!selectedId) return;
    setMutating(true);
    setMutationError(null);
    try {
      const response = await fetch(`/api/trips/${selectedId}/simulation`, {
        method: "DELETE",
      });
      if (!response.ok && response.status !== 404) {
        const body = (await response.json()) as ApiErrorBody;
        throw new Error(getApiErrorMessage(body));
      }
      setRunningSimulations((current) => {
        const next = new Set(current);
        next.delete(selectedId);
        return next;
      });
      if (response.status === 404) {
        const tripResponse = await fetch(`/api/trips/${selectedId}`, {
          cache: "no-store",
        });
        if (tripResponse.ok) {
          replaceTrip((await tripResponse.json()) as TripView);
        }
      }
    } catch (error) {
      setMutationError(
        error instanceof Error
          ? error.message
          : "The simulation could not be stopped.",
      );
    } finally {
      setMutating(false);
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

  return (
    <main className="flex min-h-[100dvh] flex-col bg-background">
      <header className="flex min-h-16 items-center justify-between gap-4 border-b border-border bg-surface px-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 min-w-12 place-items-center rounded-[10px] bg-primary px-2 text-sm font-black tracking-tight text-primary-foreground">
            AWR
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold">Operations Control</h1>
            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
              <span
                className={`size-1.5 rounded-full ${
                  health === "available"
                    ? "bg-primary"
                    : health === "unavailable"
                      ? "bg-destructive"
                      : "bg-muted-foreground"
                }`}
                aria-hidden="true"
              />
              <span>
                {health === "available"
                  ? "Systems available"
                  : health === "unavailable"
                    ? "System unavailable"
                    : "Checking systems"}
              </span>
              {lastRefresh ? (
                <span className="hidden sm:inline">
                  Updated{" "}
                  <time dateTime={lastRefresh.toISOString()}>
                    {lastRefresh.toLocaleTimeString("en-AE", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void loadTrips()}
            disabled={loading}
            aria-label="Refresh trips"
          >
            <ArrowClockwiseIcon
              size={18}
              className={loading ? "animate-spin" : ""}
            />
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <PlusIcon size={17} weight="bold" />
            <span className="hidden sm:inline">New trip</span>
            <span className="sm:hidden">New</span>
          </Button>
        </div>
      </header>

      {loadError ? (
        <div className="grid flex-1 place-items-center p-6">
          <div className="max-w-sm text-center">
            <WarningCircleIcon
              size={32}
              className="mx-auto mb-3 text-destructive"
            />
            <h2 className="font-semibold">Trips are unavailable</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {loadError}
            </p>
            <Button className="mt-5" onClick={() => void loadTrips()}>
              Try again
            </Button>
          </div>
        </div>
      ) : (
        <div
          className={
            focused
              ? "grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_380px]"
              : "grid min-h-0 flex-1 lg:grid-cols-[320px_minmax(380px,1fr)_360px]"
          }
        >
          {!focused ? (
            <TripQueue
              trips={visibleTrips}
              selectedId={selectedId}
              onSelect={(id) => {
                setSelectedId(id);
                setMutationError(null);
              }}
              query={query}
              onQueryChange={setQuery}
              filter={filter}
              onFilterChange={setFilter}
              counts={counts}
              loading={loading}
            />
          ) : null}

          <section className="flex min-h-[420px] min-w-0 flex-col border-b border-border lg:min-h-0 lg:border-b-0">
            <div className="flex min-h-14 items-center justify-between gap-4 border-b border-border bg-surface px-4">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold">
                  {selectedTrip
                    ? `${selectedTrip.trip.pickupAddress} to ${selectedTrip.trip.dropoffAddress}`
                    : "Live trip map"}
                </h2>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <MapPinIcon size={13} />
                  {selectedTrip?.latestPosition
                    ? "Showing latest reported position"
                    : "Pickup and dropoff route"}
                </p>
              </div>
            </div>
            <div className="min-h-72 flex-1">
              <OperationsMap trip={selectedTrip} />
            </div>
          </section>

          <TripInspector
            trip={selectedTrip}
            streamStatus={streamStatus}
            mutating={mutating}
            mutationError={mutationError}
            simulationRunning={
              selectedId ? runningSimulations.has(selectedId) : false
            }
            onTransition={(status) => void transitionTrip(status)}
            onStartSimulation={(intervalMs) =>
              void startSimulation(intervalMs)
            }
            onStopSimulation={() => void stopSimulation()}
            focused={focused}
          />
        </div>
      )}

      <CreateTripDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        vehicles={vehicles}
        drivers={drivers}
        optionsLoading={optionsLoading}
        optionsError={optionsError}
        onCreated={replaceTrip}
      />
    </main>
  );
}
