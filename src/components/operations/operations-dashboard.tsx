"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircleIcon,
  ArrowClockwiseIcon,
  SignOutIcon,
  MapPinIcon,
  PlusIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { useDemoAuth } from "@/components/auth/demo-auth-provider";
import { Button } from "@/components/ui/button";
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
import { LocationPingLog } from "./location-ping-log";
import { OperationsMap } from "./operations-map";
import { TripInspector } from "./trip-inspector";
import { TripQueue } from "./trip-queue";

export function OperationsDashboard({
  initialTripId = null,
  focused = false,
  vendorId,
  driverId,
  createdReference,
}: {
  initialTripId?: string | null;
  focused?: boolean;
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
  const [notice, setNotice] = useState<{
    type: "success" | "error";
    title: string;
    description: string;
  } | null>(
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
        if (
          !driverTripsResponse.ok ||
          !("data" in driverTripsBody)
        ) {
          throw new Error(
            getApiErrorMessage(driverTripsBody as ApiErrorBody),
          );
        }
        const activeTrip = driverTripsBody.data.find(
          (trip) => trip.trip.status === "in_transit",
        );
        if (activeTrip && activeTrip.trip.id !== initialTripId) {
          router.replace(`/trips/${activeTrip.trip.id}`);
          return;
        }
      }
      const params = new URLSearchParams();
      if (vendorId) params.set("vendorId", vendorId);
      if (driverId) params.set("driverId", driverId);
      const endpoint = focused && initialTripId
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
      const loadedTrips =
        "data" in body ? body.data : [body as TripView];
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
        error instanceof Error
          ? error.message
          : "Trips could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [driverId, focused, initialTripId, router, session, vendorId]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadTrips();
    }, 0);
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
    const activeTrip = trips.find(
      (trip) => trip.trip.status === "in_transit",
    );
    if (activeTrip) router.replace(`/trips/${activeTrip.trip.id}`);
  }, [focused, loading, router, session?.role, trips]);

  useEffect(() => {
    if (
      focused ||
      !session ||
      session.role === "driver" ||
      drivers.length
    ) {
      return;
    }
    const query =
      session.role === "controller"
        ? `?vendorId=${encodeURIComponent(session.vendorId)}`
        : "";
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
  }, [drivers.length, focused, session]);

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
        if (active) {
          setPositionsLoading(false);
        }
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
    if (focused) {
      setPositionLog((current) => mergePositions([position], current));
    }
  }, [focused]);
  const streamStatus = useTripEvents(focused ? selectedId : null, handlePosition);

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

  async function assignDriver(tripId: string, driverId: string) {
    setAssigningTripId(tripId);
    try {
      const response = await fetch(`/api/trips/${tripId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId }),
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
  const homeHref = session ? getSessionHome(session) : "/";
  const workspaceTitle =
    session?.role === "operations"
      ? "Operations Control"
      : session?.role === "controller"
        ? session.vendorName
        : (session?.driverName ?? "Driver trips");
  const homeLinkHref =
    session?.role === "driver" &&
    selectedTrip?.trip.status === "in_transit"
      ? `/trips/${selectedTrip.trip.id}`
      : homeHref;

  return (
    <main className="flex min-h-[100dvh] flex-col bg-background lg:h-[100dvh] lg:overflow-hidden">
      <header className="flex min-h-16 items-center justify-between gap-4 border-b border-border bg-surface px-4 sm:px-5">
        <Link
          href={homeLinkHref}
          aria-label="Go to trips index"
          className="flex min-w-0 items-center gap-3 rounded-[10px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="grid h-9 min-w-12 place-items-center rounded-[10px] bg-primary px-2 text-sm font-semibold tracking-tight text-primary-foreground">
            AWR
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold">
              {workspaceTitle}
            </h1>
            {lastRefresh ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Updated{" "}
                <time dateTime={lastRefresh.toISOString()}>
                  {lastRefresh.toLocaleTimeString("en-AE", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </p>
            ) : null}
          </div>
        </Link>
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
          {session?.role === "operations" ? (
            <Button asChild>
              <Link href="/ops/trips/new">
                <PlusIcon size={17} weight="bold" />
                <span className="hidden sm:inline">New trip</span>
                <span className="sm:hidden">New</span>
              </Link>
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Sign out"
            onClick={() => {
              logout();
              router.replace("/");
            }}
          >
            <SignOutIcon size={18} />
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
        focused ? (
          <div className="grid min-h-0 flex-1 lg:grid-cols-[380px_minmax(0,1fr)]">
            <div className="grid min-w-0 lg:col-start-2 lg:row-start-1 lg:min-h-0 lg:grid-rows-[minmax(360px,3fr)_minmax(260px,2fr)]">
              <section className="flex min-h-[420px] min-w-0 flex-col border-b border-border lg:min-h-0">
                <div className="flex min-h-14 items-center justify-between gap-4 border-b border-border bg-surface px-4">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold">
                      {selectedTrip
                        ? `${selectedTrip.trip.pickupAddress} to ${selectedTrip.trip.dropoffAddress}`
                        : "Live trip map"}
                    </h2>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPinIcon size={13} />
                      {selectedTrip?.latestPosition
                        ? "Showing latest reported position"
                        : "Showing pickup and drop-off locations"}
                    </p>
                  </div>
                </div>
                <div className="min-h-72 flex-1">
                  <OperationsMap trip={selectedTrip} />
                </div>
              </section>

              <LocationPingLog
                positions={positionLog}
                loading={positionsLoading}
                error={positionsError}
              />
            </div>

            <TripInspector
              trip={selectedTrip}
              streamStatus={streamStatus}
              mutating={mutating}
              mutationError={mutationError}
              role={session?.role ?? "operations"}
              homeHref={homeHref}
              locationStatus={driverLocation.status}
              locationError={driverLocation.error}
              onTransition={(status) => void transitionTrip(status)}
              focused
            />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 justify-center overflow-y-auto bg-background p-4 sm:p-6 lg:p-8">
            <TripQueue
              trips={visibleTrips}
              query={query}
              onQueryChange={setQuery}
              filter={filter}
              onFilterChange={setFilter}
              counts={counts}
              loading={loading}
              drivers={
                session?.role === "operations" ||
                session?.role === "controller"
                  ? drivers
                  : undefined
              }
              assigningTripId={assigningTripId}
              onAssignDriver={
                session?.role === "operations" ||
                session?.role === "controller"
                  ? (tripId, selectedDriverId) =>
                      void assignDriver(tripId, selectedDriverId)
                  : undefined
              }
            />
          </div>
        )
      )}
      {notice ? (
        <div
          role={notice.type === "error" ? "alert" : "status"}
          className="fixed right-4 top-4 z-50 flex w-[min(360px,calc(100vw-2rem))] items-start gap-3 rounded-xl border border-border bg-surface p-4 shadow-[0_18px_50px_rgb(20_22_26/22%)]"
        >
          {notice.type === "success" ? (
            <CheckCircleIcon
              size={20}
              weight="fill"
              className="mt-0.5 shrink-0 text-primary"
            />
          ) : (
            <WarningCircleIcon
              size={20}
              className="mt-0.5 shrink-0 text-destructive"
            />
          )}
          <div>
            <p className="text-sm font-semibold">{notice.title}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {notice.description}
            </p>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function mergePositions(...groups: Position[][]) {
  const positions = new Map<number, Position>();
  for (const position of groups.flat()) {
    positions.set(position.id, position);
  }
  return [...positions.values()]
    .sort(
      (left, right) =>
        new Date(right.recordedAt).getTime() -
          new Date(left.recordedAt).getTime() || right.id - left.id,
    )
    .slice(0, 100);
}
