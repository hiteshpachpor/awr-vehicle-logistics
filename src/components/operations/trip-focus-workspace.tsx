"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPinIcon } from "@phosphor-icons/react";
import { useFocusedTrip } from "@/hooks/use-focused-trip";
import { getSessionHome, isController } from "@/lib/demo-auth";
import { formatTripRoute, getWorkspaceChrome } from "@/lib/operations-ui";
import { cn } from "@/lib/utils";
import { LocationPingLog } from "./location-ping-log";
import { OperationsMap } from "./operations-map";
import {
  TripBackLink,
  TripIdentity,
  TripInspector,
} from "./trip-inspector";
import { WorkspaceLoadError, WorkspaceShell } from "./workspace-shell";

type FocusedTab = "details" | "map" | "locations";

export function TripFocusWorkspace({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [detailTab, setDetailTab] = useState<FocusedTab>("details");
  const {
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
    simulating,
    simulationPace,
    loadTrip,
    transitionTrip,
    simulateTrip,
    assignDriver,
  } = useFocusedTrip({ tripId });
  const homeHref = session ? getSessionHome(session) : "/";
  const chrome = getWorkspaceChrome(session);
  const controller = isController(session);
  const homeLinkHref =
    session?.role === "driver" && trip?.trip.status === "in_transit"
      ? `/trips/${trip.trip.id}`
      : homeHref;
  const showTripBackLink = !(
    session?.role === "driver" && trip?.trip.status === "in_transit"
  );

  return (
    <WorkspaceShell
      layout="focus"
      chrome={chrome}
      homeHref={homeLinkHref}
      lastRefresh={lastRefresh}
      loading={loading}
      onRefresh={() => void loadTrip()}
      canCreateTrip={session?.role === "operations"}
      onSignOut={() => {
        logout();
        router.replace("/");
      }}
      notice={notice}
    >
      {loadError ? (
        <WorkspaceLoadError
          message={loadError}
          onRetry={() => void loadTrip()}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[380px_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)]">
          <div className="bg-surface px-5 pt-3 lg:hidden">
            {showTripBackLink ? <TripBackLink href={homeHref} /> : null}
            {trip ? (
              <div className={cn(showTripBackLink && "mt-3", "pb-4")}>
                <TripIdentity trip={trip} streamStatus={streamStatus} />
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
            trip={trip}
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
            drivers={controller ? drivers : undefined}
            assigningTripId={assigningTripId}
            onAssignDriver={
              controller
                ? (selectedTripId, selectedDriverId) =>
                    void assignDriver(selectedTripId, selectedDriverId)
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
                  {trip ? formatTripRoute(trip) : "Live trip map"}
                </h2>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPinIcon size={13} weight="duotone" />
                  {trip?.latestPosition
                    ? "Showing latest reported position"
                    : "Showing pickup and drop-off locations"}
                </p>
              </div>
            </div>
            <div className="relative min-h-0 min-w-0 flex-1">
              <OperationsMap trip={trip} visible={detailTab === "map"} />
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
      )}
    </WorkspaceShell>
  );
}
