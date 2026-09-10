"use client";

import Link from "next/link";
import {
  ArrowSquareOutIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  TruckIcon,
} from "@phosphor-icons/react";
import type { TripStatus, TripView } from "@/lib/operations-types";
import {
  formatRelativeTime,
  tripStatusLabels,
} from "@/lib/operations-ui";
import { cn } from "@/lib/utils";

const filters: Array<{ value: "all" | TripStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "created", label: "Ready" },
  { value: "in_transit", label: "In transit" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export function TripQueue({
  trips,
  selectedId,
  onSelect,
  query,
  onQueryChange,
  filter,
  onFilterChange,
  counts,
  loading,
}: {
  trips: TripView[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  query: string;
  onQueryChange: (query: string) => void;
  filter: "all" | TripStatus;
  onFilterChange: (filter: "all" | TripStatus) => void;
  counts: Record<"all" | TripStatus, number>;
  loading: boolean;
}) {
  return (
    <aside className="flex min-h-0 flex-col border-b border-border bg-surface lg:border-b-0 lg:border-r">
      <div className="border-b border-border p-4">
        <h2 className="text-sm font-semibold">Trips</h2>
        <label className="mt-3 flex h-10 items-center gap-2 rounded-[10px] border border-border bg-background px-3 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
          <MagnifyingGlassIcon
            size={16}
            className="shrink-0 text-muted-foreground"
          />
          <span className="sr-only">Search trips</span>
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search trips"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>
        <div
          className="mt-3 flex gap-1 overflow-x-auto"
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

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {loading ? (
          <TripQueueSkeleton />
        ) : trips.length ? (
          <ul className="grid gap-1">
            {trips.map((trip) => {
              const selected = trip.trip.id === selectedId;
              return (
                <li key={trip.trip.id} className="relative">
                  <button
                    type="button"
                    onClick={() => onSelect(trip.trip.id)}
                    className={cn(
                      "group w-full rounded-[10px] border px-3 py-3 pr-11 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                      selected
                        ? "border-primary/35 bg-primary/7"
                        : "border-transparent hover:bg-muted",
                    )}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">
                          {trip.trip.referenceNumber}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <TruckIcon size={14} />
                          {trip.vehicle.registrationNumber}
                        </span>
                      </span>
                      <StatusBadge status={trip.trip.status} />
                    </span>
                    <span className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                      <MapPinIcon size={14} className="mt-0.5 shrink-0" />
                      <span className="line-clamp-2">
                        {trip.trip.pickupAddress} to{" "}
                        {trip.trip.dropoffAddress}
                      </span>
                    </span>
                    <span className="mt-2 block text-[11px] text-muted-foreground">
                      Updated {formatRelativeTime(trip.trip.updatedAt)}
                    </span>
                  </button>
                  <Link
                    href={`/trips/${trip.trip.id}`}
                    aria-label={`Open focused view for ${trip.trip.referenceNumber}`}
                    className="absolute bottom-3 right-3 grid size-8 place-items-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ArrowSquareOutIcon size={16} />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="grid min-h-52 place-items-center p-6 text-center">
            <div>
              <TruckIcon
                size={28}
                className="mx-auto mb-3 text-muted-foreground"
              />
              <p className="text-sm font-semibold">No matching trips</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Change the filter or create a new trip.
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

export function StatusBadge({ status }: { status: TripStatus }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold",
        status === "in_transit" &&
          "border-primary/25 bg-primary/10 text-primary",
        status === "created" &&
          "border-border bg-background text-foreground",
        status === "completed" &&
          "border-foreground/20 bg-foreground/7 text-foreground",
        status === "cancelled" &&
          "border-border bg-muted text-muted-foreground",
      )}
    >
      {tripStatusLabels[status]}
    </span>
  );
}

function TripQueueSkeleton() {
  return (
    <div className="grid gap-2 p-1" aria-label="Loading trips">
      {[0, 1, 2, 3].map((item) => (
        <div
          key={item}
          className="h-32 animate-pulse rounded-[10px] bg-muted"
        />
      ))}
    </div>
  );
}
