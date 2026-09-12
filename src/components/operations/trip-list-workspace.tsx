"use client";

import { useRouter } from "next/navigation";
import { useTripList } from "@/hooks/use-trip-list";
import { getSessionHome, isController } from "@/lib/demo-auth";
import { getWorkspaceChrome } from "@/lib/operations-ui";
import { TripQueue } from "./trip-queue";
import { WorkspaceLoadError, WorkspaceShell } from "./workspace-shell";

export function TripListWorkspace({
  vendorId,
  driverId,
  createdReference,
}: {
  vendorId?: string;
  driverId?: string;
  createdReference?: string;
}) {
  const router = useRouter();
  const {
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
  } = useTripList({ vendorId, driverId, createdReference });
  const homeHref = session ? getSessionHome(session) : "/";
  const chrome = getWorkspaceChrome(session);
  const controller = isController(session);

  return (
    <WorkspaceShell
      layout="list"
      chrome={chrome}
      homeHref={homeHref}
      lastRefresh={lastRefresh}
      loading={loading}
      onRefresh={() => void loadTrips()}
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
          onRetry={() => void loadTrips()}
        />
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
            drivers={controller ? drivers : undefined}
            assigningTripId={assigningTripId}
            showVendor={session?.role === "operations"}
            onAssignDriver={
              controller
                ? (tripId, selectedDriverId) =>
                    void assignDriver(tripId, selectedDriverId)
                : undefined
            }
          />
        </div>
      )}
    </WorkspaceShell>
  );
}
