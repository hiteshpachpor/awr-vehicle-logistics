"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CaretDownIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CarIcon,
  CubeIcon,
  FlagCheckeredIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  SteeringWheelIcon,
} from "@phosphor-icons/react";
import { EmptyState } from "@/components/ui/empty-state";
import type {
  DriverOption,
  TripStatus,
  TripView,
} from "@/lib/operations-types";
import { formatRelativeTime } from "@/lib/operations-ui";
import { cn } from "@/lib/utils";
import { TripStatusBadge } from "./trip-status-badge";
import { DriverAssignment } from "./driver-assignment";

const filters: Array<{ value: "all" | TripStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "created", label: "Scheduled" },
  { value: "in_transit", label: "In transit" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const PAGE_SIZES = [10, 25, 50] as const;
type PageSize = (typeof PAGE_SIZES)[number];

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
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(trips.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const rangeStart = trips.length ? (currentPage - 1) * pageSize + 1 : 0;
  const rangeEnd = Math.min(currentPage * pageSize, trips.length);
  const pagedTrips = trips.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  useEffect(() => {
    setPage(1);
  }, [filter, pageSize, query]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  return (
    <section className="w-full self-start">
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

        <div>
        {loading ? (
          <TripQueueSkeleton />
        ) : trips.length ? (
          <ul className="divide-y divide-border">
            {pagedTrips.map((trip) => (
              <li
                key={trip.trip.id}
                className={cn(
                  "overflow-hidden transition-colors",
                  onAssignDriver &&
                    trip.trip.status === "created" &&
                    "bg-background/35",
                )}
              >
                <Link
                  href={`/trips/${trip.trip.id}`}
                  className="group relative grid p-4 outline-none transition-colors hover:bg-muted/45 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring min-[560px]:grid-cols-[minmax(180px,.8fr)_minmax(260px,1.2fr)] min-[560px]:gap-x-5 sm:p-5 lg:grid-cols-[minmax(155px,.72fr)_minmax(260px,1.3fr)_minmax(210px,1fr)_max-content_32px] lg:items-center lg:gap-6"
                >
                  <span className="flex min-w-0 items-start gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-base font-semibold">
                        {trip.customer.name}
                      </span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">
                        {trip.vehicle.make} {trip.vehicle.model}
                      </span>
                      <span
                        aria-label={`Registration ${trip.vehicle.registrationNumber}`}
                        className="mt-2 inline-flex h-5 items-center rounded-[3px] border border-[#202124] bg-white px-1.5 text-[10px] font-semibold leading-none tracking-[0.06em] text-[#111214]"
                      >
                        {trip.vehicle.registrationNumber}
                      </span>
                    </span>
                  </span>

                  <span className="mt-4 flex min-w-0 items-stretch gap-3 text-sm min-[560px]:mt-0">
                    <span
                      aria-hidden="true"
                      className="flex w-6 shrink-0 flex-col items-center py-0.5"
                    >
                      <MapPinIcon
                        size={18}
                        weight="duotone"
                        className="shrink-0 text-muted-foreground"
                      />
                      <span className="my-0.5 w-px min-h-2 flex-1 bg-muted-foreground/45" />
                      <CaretDownIcon
                        size={12}
                        className="-my-[0.5em] shrink-0 text-muted-foreground"
                      />
                      <span className="my-0.5 w-px min-h-2 flex-1 bg-muted-foreground/45" />
                      <FlagCheckeredIcon
                        size={18}
                        weight="duotone"
                        className="shrink-0 text-primary"
                      />
                    </span>
                    <span className="grid min-w-0 flex-1 content-between gap-3">
                      <span className="min-w-0 leading-5">
                        <span className="sr-only">Pickup </span>
                        {trip.trip.pickupAddress}
                      </span>
                      <span className="min-w-0 leading-5">
                        <span className="sr-only">Delivery </span>
                        {trip.trip.dropoffAddress}
                      </span>
                    </span>
                  </span>

                  <span className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t border-border pt-4 min-[560px]:col-span-2 lg:contents">
                    <span className="min-w-0">
                      <span className="flex min-w-0 items-center gap-1.5 text-sm leading-5">
                        <CubeIcon
                          size={14}
                          weight="duotone"
                          aria-hidden="true"
                          className="relative -top-px shrink-0 text-muted-foreground"
                        />
                        <span className="sr-only">Vendor</span>
                        <span className="truncate font-medium">
                          {trip.vendor.name}
                        </span>
                      </span>
                      <span className="mt-1.5 flex min-w-0 items-center gap-1.5 text-xs leading-4">
                        <SteeringWheelIcon
                          size={14}
                          weight="duotone"
                          aria-hidden="true"
                          className="relative -top-px shrink-0 text-muted-foreground"
                        />
                        <span className="sr-only">Driver</span>
                        <span className="truncate font-medium">
                          {trip.driver?.name ?? "Unassigned"}
                        </span>
                      </span>
                    </span>
                    <TripMilestone trip={trip} />
                  </span>
                  <span className="trip-open-affordance hidden size-8 place-items-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:bg-surface-strong group-hover:text-foreground lg:grid">
                    <CaretRightIcon
                      size={16}
                      className="transition-transform group-hover:translate-x-0.5"
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
            icon={<CarIcon weight="duotone" />}
            title="No matching trips"
            description="Change the filter or create a new trip."
          />
        )}
        {!loading && trips.length ? (
          <TripPagination
            page={currentPage}
            pageSize={pageSize}
            total={trips.length}
            totalPages={totalPages}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        ) : null}
        </div>
      </div>
    </section>
  );
}

function TripPagination({
  page,
  pageSize,
  total,
  totalPages,
  rangeStart,
  rangeEnd,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: PageSize;
  total: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: PageSize) => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          Per page
        </span>
        <div
          className="flex gap-1"
          role="group"
          aria-label="Results per page"
        >
          {PAGE_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              aria-pressed={pageSize === size}
              onClick={() => onPageSizeChange(size)}
              className={cn(
                "min-w-8 rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                pageSize === size
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {size}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          {rangeStart}–{rangeEnd} of {total}
        </span>
      </div>
      <nav
        className="flex flex-wrap items-center gap-1"
        aria-label="Trip list pages"
      >
        <button
          type="button"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="grid size-8 place-items-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
        >
          <CaretLeftIcon size={16} />
        </button>
        {pageNumbers(page, totalPages).map((item, index) =>
          item === "ellipsis" ? (
            <span
              key={`ellipsis-${index}`}
              className="grid size-8 place-items-center text-xs text-muted-foreground"
            >
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              aria-current={item === page ? "page" : undefined}
              aria-label={`Page ${item}`}
              onClick={() => onPageChange(item)}
              className={cn(
                "min-w-8 rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                item === page
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {item}
            </button>
          ),
        )}
        <button
          type="button"
          aria-label="Next page"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="grid size-8 place-items-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
        >
          <CaretRightIcon size={16} />
        </button>
      </nav>
    </div>
  );
}

function pageNumbers(current: number, total: number): Array<number | "ellipsis"> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const items: Array<number | "ellipsis"> = [];
  const windowStart = Math.max(2, current - 1);
  const windowEnd = Math.min(total - 1, current + 1);

  items.push(1);
  if (windowStart > 2) items.push("ellipsis");
  for (let page = windowStart; page <= windowEnd; page += 1) {
    items.push(page);
  }
  if (windowEnd < total - 1) items.push("ellipsis");
  items.push(total);
  return items;
}

function TripMilestone({ trip }: { trip: TripView }) {
  const timestamp =
    trip.trip.status === "created"
      ? trip.trip.scheduledAt
      : trip.trip.status === "in_transit"
        ? trip.trip.startedAt
        : trip.trip.status === "completed"
          ? trip.trip.completedAt
          : trip.trip.cancelledAt;

  return (
    <span className="grid w-max justify-items-end gap-1.5 lg:justify-items-start">
      <TripStatusBadge status={trip.trip.status} />
      <span className="text-xs text-muted-foreground">
        {timestamp ? formatRelativeTime(timestamp) : "Time not set"}
      </span>
    </span>
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
