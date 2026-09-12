"use client";

import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { useOperationsDashboard } from "@/hooks/use-operations-dashboard";
import { getSessionHome } from "@/lib/demo-auth";
import { formatTripRoute } from "@/lib/operations-ui";
import { cn } from "@/lib/utils";
import { LocationPingLog } from "./location-ping-log";
import { OperationsMap } from "./operations-map";
import {
  TripBackLink,
  TripIdentity,
  TripInspector,
} from "./trip-inspector";
import { TripQueue } from "./trip-queue";

type FocusedTab = "details" | "map" | "locations";

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
  const [detailTab, setDetailTab] = useState<FocusedTab>("details");
  const {
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
    simulating,
    simulationPace,
    counts,
    visibleTrips,
    loadTrips,
    transitionTrip,
    simulateTrip,
    assignDriver,
  } = useOperationsDashboard({
    initialTripId,
    focused,
    vendorId,
    driverId,
    createdReference,
  });
  const homeHref = session ? getSessionHome(session) : "/";
  const workspaceTitle =
    session?.role === "operations"
      ? "Operations Control"
      : session?.role === "controller"
        ? session.vendorName
        : (session?.driverName ?? "Driver trips");
  const workspaceMark =
    session?.role === "controller"
      ? getInitials(session.vendorName)
      : session?.role === "driver"
        ? getInitials(session.driverName)
        : "AWR";
  const workspaceMarkColor =
    session?.role === "controller"
      ? "bg-role-controller text-role-mark-foreground"
      : session?.role === "driver"
        ? "bg-role-driver text-role-mark-foreground"
        : "bg-primary text-primary-foreground";
  const homeLinkHref =
    session?.role === "driver" &&
    selectedTrip?.trip.status === "in_transit"
      ? `/trips/${selectedTrip.trip.id}`
      : homeHref;
  const showTripBackLink =
    focused &&
    !(
      session?.role === "driver" &&
      selectedTrip?.trip.status === "in_transit"
    );

  return (
    <main
      className={cn(
        "flex min-h-[100dvh] flex-col bg-background",
        focused
          ? "h-[100dvh] overflow-hidden"
          : "lg:h-[100dvh] lg:overflow-hidden",
      )}
    >
      <header className="flex min-h-16 items-center justify-between gap-4 border-b border-border bg-surface px-4 sm:px-5">
        <Link
          href={homeLinkHref}
          aria-label="Go to trips index"
          className="flex min-w-0 items-center gap-3 rounded-[10px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span
            className={`grid h-9 min-w-12 place-items-center rounded-[10px] px-2 text-sm font-semibold tracking-tight ${workspaceMarkColor}`}
          >
            {workspaceMark}
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
                    second: "2-digit",
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
                <PlusIcon size={17} />
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
              weight="duotone"
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
          <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[380px_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)]">
            <div className="bg-surface px-5 pt-3 lg:hidden">
              {showTripBackLink ? <TripBackLink href={homeHref} /> : null}
              {selectedTrip ? (
                <div className={cn(showTripBackLink && "mt-3", "pb-4")}>
                  <TripIdentity
                    trip={selectedTrip}
                    streamStatus={streamStatus}
                  />
                </div>
              ) : null}
            </div>

            <div
              role="tablist"
              aria-label="Trip view"
              className="flex h-12 shrink-0 items-end gap-4 overflow-x-auto border-b border-border bg-surface px-5 lg:col-start-2 lg:row-start-1 lg:px-4"
            >
              {(
                [
                  { id: "details", label: "Details" },
                  { id: "map", label: "Map" },
                  {
                    id: "locations",
                    label: `Location pings (${positionLog.length})`,
                  },
                ] as const
              ).map((tab) => {
                const selected =
                  tab.id === "map"
                    ? detailTab === "map"
                    : detailTab === tab.id;
                const desktopMapFallback =
                  tab.id === "map" && detailTab === "details";

                return (
                  <button
                    key={tab.id}
                    id={`trip-${tab.id}-tab`}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-controls={`trip-${tab.id}-panel`}
                    onClick={() => setDetailTab(tab.id)}
                    className={cn(
                      "relative h-full shrink-0 whitespace-nowrap px-1 text-sm font-semibold outline-none transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full focus-visible:ring-2 focus-visible:ring-ring",
                      tab.id === "details" && "lg:hidden",
                      desktopMapFallback
                        ? "text-muted-foreground after:bg-transparent hover:text-foreground lg:text-foreground lg:after:bg-primary"
                        : selected
                          ? "text-foreground after:bg-primary"
                          : "text-muted-foreground after:bg-transparent hover:text-foreground",
                    )}
                  >
                    {tab.label}
                  </button>
                );
              })}
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
              locationPendingCount={driverLocation.pendingCount}
              onTransition={(status) => void transitionTrip(status)}
              onSimulate={(pace) => void simulateTrip(pace)}
              simulating={simulating}
              simulationPace={simulationPace}
              focused
              drivers={session?.role === "controller" ? drivers : undefined}
              assigningTripId={assigningTripId}
              onAssignDriver={
                session?.role === "controller"
                  ? (tripId, selectedDriverId) =>
                      void assignDriver(tripId, selectedDriverId)
                  : undefined
              }
              className={detailTab === "details" ? undefined : "hidden lg:block"}
            />

            <section
              id="trip-map-panel"
              role="tabpanel"
              aria-labelledby="trip-map-tab"
              className={cn(
                "min-h-0 min-w-0 flex-1 flex-col bg-surface lg:col-start-2 lg:row-start-2",
                detailTab === "map"
                  ? "flex"
                  : detailTab === "details"
                    ? "hidden lg:flex"
                    : "hidden",
              )}
            >
              <div className="flex min-h-14 items-center justify-between gap-4 border-b border-border px-4">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold">
                    {selectedTrip
                      ? formatTripRoute(selectedTrip)
                      : "Live trip map"}
                  </h2>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPinIcon size={13} weight="duotone" />
                    {selectedTrip?.latestPosition
                      ? "Showing latest reported position"
                      : "Showing pickup and drop-off locations"}
                  </p>
                </div>
              </div>
              <div className="relative min-h-0 min-w-0 flex-1">
                <OperationsMap
                  trip={selectedTrip}
                  visible={detailTab === "map"}
                />
              </div>
            </section>

            <div
              id="trip-locations-panel"
              role="tabpanel"
              aria-labelledby="trip-locations-tab"
              className={cn(
                "min-h-0 flex-1 flex-col lg:col-start-2 lg:row-start-2",
                detailTab === "locations" ? "flex" : "hidden",
              )}
            >
              <LocationPingLog
                positions={positionLog}
                loading={positionsLoading}
                error={positionsError}
              />
            </div>
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
              highlightedTripIds={highlightedTripIds}
              revealTripId={revealTripId}
              drivers={session?.role === "controller" ? drivers : undefined}
              assigningTripId={assigningTripId}
              showVendor={session?.role === "operations"}
              onAssignDriver={
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
              weight="duotone"
              className="mt-0.5 shrink-0 text-primary"
            />
          ) : (
            <WarningCircleIcon
              size={20}
              weight="duotone"
              className="mt-0.5 shrink-0 text-destructive"
            />
          )}
          <div>
            <p className="text-sm font-semibold">{notice.title}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {notice.description}
            </p>
            {notice.hint ? (
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {notice.hint}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}

function getInitials(name: string | undefined) {
  const initials = name
    ?.trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return initials || "LV";
}
