"use client";

import Link from "next/link";
import {
  ArrowLeftIcon,
  BroadcastIcon,
  BuildingsIcon,
  CalendarBlankIcon,
  CarIcon,
  CheckCircleIcon,
  MapPinIcon,
  PlayIcon,
  UserIcon,
  WarningCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { DriverLocationStatus } from "@/hooks/use-driver-location";
import type { StreamStatus } from "@/hooks/use-trip-events";
import type { TripStatus, TripView } from "@/lib/operations-types";
import {
  availableTripActionsForRole,
  formatDateTime,
  formatRelativeTime,
} from "@/lib/operations-ui";
import { StatusBadge } from "./trip-queue";

const streamLabels: Record<StreamStatus, string> = {
  idle: "Not connected",
  connecting: "Connecting",
  live: "Live updates",
  reconnecting: "Reconnecting",
  unavailable: "Updates unavailable",
};

export function TripInspector({
  trip,
  streamStatus,
  mutating,
  mutationError,
  role,
  homeHref,
  locationStatus,
  locationError,
  onTransition,
  focused,
}: {
  trip: TripView | null;
  streamStatus: StreamStatus;
  mutating: boolean;
  mutationError: string | null;
  role: "operations" | "controller" | "driver";
  homeHref: string;
  locationStatus: DriverLocationStatus;
  locationError: string | null;
  onTransition: (status: TripStatus) => void;
  focused?: boolean;
}) {
  const actions = trip
    ? availableTripActionsForRole(
        trip.trip.status,
        role,
        Boolean(trip.driver),
      )
    : [];

  if (!trip) {
    return (
      <aside className="grid min-h-72 place-items-center bg-surface p-8 text-center lg:border-l lg:border-border">
        <div className="max-w-xs">
          <CarIcon size={28} className="mx-auto mb-3 text-muted-foreground" />
          <p className="font-semibold">No trip selected</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Choose a trip to review its assignment and current status.
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="min-h-0 overflow-y-auto bg-surface lg:col-start-1 lg:row-start-1 lg:border-r lg:border-border">
      <div className="border-b border-border p-5">
        {focused &&
        !(role === "driver" && trip.trip.status === "in_transit") ? (
          <Link
            href={homeHref}
            className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeftIcon size={14} />
            All trips
          </Link>
        ) : null}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold tracking-tight">
              {trip.customer.name}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {trip.vehicle.registrationNumber}
            </p>
          </div>
          <StatusBadge status={trip.trip.status} />
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <BroadcastIcon
            size={16}
            weight={streamStatus === "live" ? "fill" : "regular"}
            className={
              streamStatus === "live" ? "text-primary" : "text-muted-foreground"
            }
          />
          <span>{streamLabels[streamStatus]}</span>
          {trip.latestPosition ? (
            <span>
              Last position{" "}
              {formatRelativeTime(trip.latestPosition.recordedAt)}
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 p-5">
        {actions.length ? (
          <DetailGroup title="Trip controls">
            <div className="grid grid-cols-2 gap-2">
              {actions.includes("start") ? (
                <Button
                  disabled={mutating}
                  onClick={() => onTransition("in_transit")}
                >
                  <PlayIcon weight="fill" />
                  Start trip
                </Button>
              ) : null}
              {actions.includes("complete") ? (
                <Button
                  disabled={mutating}
                  onClick={() => onTransition("completed")}
                >
                  <CheckCircleIcon weight="bold" />
                  End trip
                </Button>
              ) : null}
              {actions.includes("cancel") ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="secondary" disabled={mutating}>
                      <XCircleIcon />
                      Cancel trip
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel this trip?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This ends the trip and prevents future location updates.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep trip</AlertDialogCancel>
                      <AlertDialogAction
                        destructive
                        onClick={() => onTransition("cancelled")}
                      >
                        Cancel trip
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : null}
            </div>

            {mutationError ? (
              <div
                role="alert"
                className="mt-3 flex items-start gap-2 text-sm font-medium text-destructive"
              >
                <WarningCircleIcon size={18} className="mt-0.5 shrink-0" />
                {mutationError}
              </div>
            ) : null}
          </DetailGroup>
        ) : null}

        <DetailGroup title="Assignment">
          <DetailItem
            icon={<CarIcon />}
            label="Vehicle"
            value={`${trip.vehicle.make} ${trip.vehicle.model}`}
            detail={`${trip.vehicle.registrationNumber}${trip.vehicle.color ? `, ${trip.vehicle.color}` : ""}`}
          />
          <DetailItem
            icon={<UserIcon />}
            label="Customer"
            value={trip.customer.name}
          />
          <DetailItem
            icon={<UserIcon />}
            label="Driver"
            value={trip.driver?.name ?? "Not assigned yet"}
            detail={
              trip.driver
                ? (trip.driver.phone ?? "No phone recorded")
                : "The logistics vendor will assign a driver."
            }
          />
          <DetailItem
            icon={<BuildingsIcon />}
            label="Logistics vendor"
            value={trip.vendor.name}
          />
        </DetailGroup>

        <DetailGroup title="Route">
          <DetailItem
            icon={<MapPinIcon />}
            label="Pickup"
            value={trip.trip.pickupAddress}
            detail={`${trip.trip.pickupLatitude.toFixed(4)}, ${trip.trip.pickupLongitude.toFixed(4)}`}
          />
          <DetailItem
            icon={<MapPinIcon />}
            label="Dropoff"
            value={trip.trip.dropoffAddress}
            detail={`${trip.trip.dropoffLatitude.toFixed(4)}, ${trip.trip.dropoffLongitude.toFixed(4)}`}
          />
          <DetailItem
            icon={<CalendarBlankIcon />}
            label="Scheduled collection"
            value={formatDateTime(trip.trip.scheduledAt)}
          />
        </DetailGroup>

        <DetailGroup title="Latest position">
          {trip.latestPosition ? (
            <div className="grid grid-cols-2 gap-3">
              <Metric
                label="Coordinates"
                value={`${trip.latestPosition.latitude.toFixed(4)}, ${trip.latestPosition.longitude.toFixed(4)}`}
              />
              <Metric
                label="Speed"
                value={
                  trip.latestPosition.speed === null
                    ? "Not reported"
                    : `${trip.latestPosition.speed.toFixed(1)} km/h`
                }
              />
              <Metric
                label="Source"
                value={
                  trip.latestPosition.source === "simulator"
                    ? "Simulation"
                    : "Vendor"
                }
              />
              <Metric
                label="Recorded"
                value={formatDateTime(trip.latestPosition.recordedAt)}
              />
            </div>
          ) : (
            <div className="rounded-[10px] bg-muted p-4 text-sm leading-6 text-muted-foreground">
              No location has been received for this trip.
            </div>
          )}
        </DetailGroup>

        {role === "driver" && trip.trip.status === "in_transit" ? (
          <DetailGroup title="Location sharing">
            <div
              className={
                locationError
                  ? "rounded-[10px] bg-destructive/8 p-3 text-sm text-destructive"
                  : "rounded-[10px] bg-primary/8 p-3 text-sm text-foreground"
              }
            >
              <p className="font-semibold">
                {locationStatus === "sharing"
                  ? "Sharing live location"
                  : locationStatus === "requesting"
                    ? "Requesting location access"
                    : "Location sharing needs attention"}
              </p>
              <p className="mt-1 text-xs leading-5">
                {locationError ??
                  "Keep this page open while the trip is in progress."}
              </p>
            </div>
          </DetailGroup>
        ) : null}

      </div>
    </aside>
  );
}

function DetailGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-3 text-xs font-semibold text-muted-foreground">
        {title}
      </h3>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

function DetailItem({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-muted-foreground [&>svg]:size-[17px]">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5 text-sm font-medium leading-5">{value}</p>
        {detail ? (
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            {detail}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] bg-muted p-3">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold leading-5">{value}</p>
    </div>
  );
}
