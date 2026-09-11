"use client";

import { useEffect, useState } from "react";
import { SteeringWheelIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { SearchSelect } from "@/components/ui/search-select";
import type { DriverOption, TripView } from "@/lib/operations-types";
import { cn } from "@/lib/utils";

export function DriverAssignment({
  trip,
  drivers,
  assigning,
  onAssign,
  compact = false,
  inline = false,
}: {
  trip: TripView;
  drivers: DriverOption[];
  assigning: boolean;
  onAssign: (tripId: string, driverId: string) => void;
  compact?: boolean;
  inline?: boolean;
}) {
  const assignedDriverId = trip.driver?.id ?? "";
  const [driverId, setDriverId] = useState(assignedDriverId);
  const vendorDrivers = drivers.filter(
    (driver) => driver.vendor.id === trip.vendor.id,
  );
  const hasChange = Boolean(driverId) && driverId !== assignedDriverId;
  const embedded = compact || inline;

  useEffect(() => {
    setDriverId(assignedDriverId);
  }, [assignedDriverId]);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center",
        inline
          ? "relative z-20 min-w-0"
          : compact
            ? "mt-1.5"
            : "border-t border-border bg-background px-4 py-3 sm:px-5 sm:py-4",
      )}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {embedded ? null : (
        <div className="flex min-w-0 items-center gap-2.5 sm:mr-auto">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
            <SteeringWheelIcon size={18} weight="duotone" />
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-semibold">
              {trip.driver ? "Change driver" : "Assign driver"}
            </span>
          </span>
        </div>
      )}
      <div
        className={cn(
          "flex min-w-0",
          inline
            ? "items-center gap-2"
            : embedded
              ? "w-full flex-col gap-2 sm:flex-row sm:items-center"
              : "flex-col gap-2 sm:w-[360px] sm:flex-row sm:items-center",
        )}
      >
        <div className={cn("min-w-0", inline ? "w-[184px] shrink-0" : "flex-1")}>
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
            triggerClassName="h-11 min-h-11 px-3 py-1"
            contentClassName={inline ? "w-[220px]" : undefined}
          />
        </div>
        {hasChange || assigning ? (
          <Button
            type="button"
            className="h-11 shrink-0"
            disabled={!hasChange || assigning}
            onClick={() => onAssign(trip.trip.id, driverId)}
          >
            {assigning ? "Saving…" : trip.driver ? "Update" : "Assign"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
