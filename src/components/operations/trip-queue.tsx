"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CaretRightIcon,
  CarIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  SteeringWheelIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchSelect } from "@/components/ui/search-select";
import type {
  DriverOption,
  TripStatus,
  TripView,
} from "@/lib/operations-types";
import { formatRelativeTime } from "@/lib/operations-ui";
import { cn } from "@/lib/utils";
import { TripStatusBadge } from "./trip-status-badge";

const filters: Array<{ value: "all" | TripStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "created", label: "Scheduled" },
  { value: "in_transit", label: "In transit" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export function TripQueue({
  trips,
  query,
  onQueryChange,
  filter,
  onFilterChange,
  counts,
  loading,
  drivers,
  assigningTripId,
  onAssignDriver,
}: {
  trips: TripView[];
  query: string;
  onQueryChange: (query: string) => void;
  filter: "all" | TripStatus;
  onFilterChange: (filter: "all" | TripStatus) => void;
  counts: Record<"all" | TripStatus, number>;
  loading: boolean;
  drivers?: DriverOption[];
  assigningTripId?: string | null;
  onAssignDriver?: (tripId: string, driverId: string) => void;
}) {
  return (
    <section className="w-full max-w-6xl self-start">
      <div className="mb-5">
        <h2 className="text-xl font-semibold tracking-tight">Trips</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review assignments and open a trip to monitor its progress.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-[0_12px_32px_rgb(20_22_26/8%)]">
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <label className="flex h-10 w-full max-w-md items-center gap-2 rounded-[10px] border border-border bg-background px-3 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
            <MagnifyingGlassIcon
              size={16}
              className="shrink-0 text-muted-foreground"
            />
            <span className="sr-only">Search trips</span>
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search by trip, vehicle, driver, or route"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>
          <div
            className="flex gap-1 overflow-x-auto"
            aria-label="Filter trips by status"
          >
            {filters.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => onFilterChange(item.value)}
                aria-pressed={filter === item.value}
                className={cn(
                  "shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  filter === item.value
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {item.label} {counts[item.value]}
              </button>
            ))}
          </div>
        </div>

        <div className="hidden grid-cols-[minmax(170px,.75fr)_minmax(280px,1.5fr)_140px_110px] gap-5 border-b border-border bg-muted/35 px-5 py-2.5 text-xs font-semibold text-muted-foreground lg:grid">
          <span>Trip</span>
          <span>Route</span>
          <span>Last update</span>
          <span>Status</span>
        </div>

        <div className="p-2">
        {loading ? (
          <TripQueueSkeleton />
        ) : trips.length ? (
          <ul className="grid gap-1">
            {trips.map((trip) => (
              <li
                key={trip.trip.id}
                className={cn(
                  "overflow-hidden rounded-[10px] border border-transparent transition-colors hover:border-border",
                  onAssignDriver &&
                    trip.trip.status === "created" &&
                    "border-border",
                )}
              >
                <Link
                  href={`/trips/${trip.trip.id}`}
                  className="group grid gap-4 px-3 py-4 outline-none transition-colors hover:bg-muted/55 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring lg:grid-cols-[minmax(170px,.75fr)_minmax(280px,1.5fr)_140px_110px] lg:items-center lg:gap-5 lg:px-3 lg:py-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">
                      {trip.customer.name}
                    </span>
                    <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CarIcon size={14} className="shrink-0" />
                      {trip.vehicle.registrationNumber}
                    </span>
                  </span>

                  <span className="flex min-w-0 items-start gap-2 text-sm leading-5">
                    <MapPinIcon
                      size={16}
                      className="mt-0.5 shrink-0 text-muted-foreground"
                    />
                    <span className="line-clamp-2">
                      {trip.trip.pickupAddress}{" "}
                      <span className="text-muted-foreground">to</span>{" "}
                      {trip.trip.dropoffAddress}
                    </span>
                  </span>

                  <span className="text-xs text-muted-foreground">
                    <span className="lg:hidden">Updated </span>
                    {formatRelativeTime(trip.trip.updatedAt)}
                  </span>

                  <span className="flex items-center justify-between gap-3">
                    <TripStatusBadge status={trip.trip.status} />
                    <CaretRightIcon
                      size={16}
                      className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                    />
                  </span>
                </Link>
                {onAssignDriver && trip.trip.status === "created" ? (
                  <DriverAssignment
                    trip={trip}
                    drivers={drivers ?? []}
                    assigning={assigningTripId === trip.trip.id}
                    onAssign={onAssignDriver}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            className="min-h-56"
            icon={<CarIcon />}
            title="No matching trips"
            description="Change the filter or create a new trip."
          />
        )}
        </div>
      </div>
    </section>
  );
}

function DriverAssignment({
  trip,
  drivers,
  assigning,
  onAssign,
}: {
  trip: TripView;
  drivers: DriverOption[];
  assigning: boolean;
  onAssign: (tripId: string, driverId: string) => void;
}) {
  const [driverId, setDriverId] = useState(trip.driver?.id ?? "");
  const vendorDrivers = drivers.filter(
    (driver) => driver.vendor.id === trip.vendor.id,
  );

  return (
    <div className="flex flex-col gap-3 border-t border-border bg-background p-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 items-center gap-2.5 sm:mr-auto">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
          <SteeringWheelIcon size={18} />
        </span>
        <span className="min-w-0">
          <span className="block text-xs font-semibold">Assign driver</span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {trip.vendor.name}
          </span>
        </span>
      </div>
      <div className="flex min-w-0 flex-col gap-2 sm:w-[360px] sm:flex-row">
        <div className="min-w-0 flex-1">
        <SearchSelect
          value={driverId}
          onValueChange={setDriverId}
          options={vendorDrivers.map((driver) => ({
            value: driver.id,
            label: driver.name,
            description: driver.externalReference ?? undefined,
            searchText: driver.phone ?? "",
          }))}
          placeholder={
            vendorDrivers.length ? "Choose driver" : "No active drivers"
          }
          searchPlaceholder="Search drivers"
          disabled={assigning || !vendorDrivers.length}
          triggerClassName="h-11 min-h-11 py-1"
        />
        </div>
        <Button
          type="button"
          className="h-11 shrink-0"
          disabled={!driverId || assigning || driverId === trip.driver?.id}
          onClick={() => onAssign(trip.trip.id, driverId)}
        >
          {assigning
            ? "Saving…"
            : trip.driver
              ? "Update"
              : "Assign"}
        </Button>
      </div>
    </div>
  );
}

function TripQueueSkeleton() {
  return (
    <div className="grid gap-1" aria-label="Loading trips">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="h-[76px] animate-pulse rounded-[10px] bg-muted"
        />
      ))}
    </div>
  );
}
