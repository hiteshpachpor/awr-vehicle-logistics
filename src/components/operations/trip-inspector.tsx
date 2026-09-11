"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  BroadcastIcon,
  CubeIcon,
  CalendarBlankIcon,
  CarIcon,
  CheckCircleIcon,
  MapPinIcon,
  PathIcon,
  PlayIcon,
  UserIcon,
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
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/input";
import type { DriverLocationStatus } from "@/hooks/use-driver-location";
import type { StreamStatus } from "@/hooks/use-trip-events";
import type { DriverOption, TripStatus, TripView } from "@/lib/operations-types";
import {
  availableTripActionsForRole,
  formatCoordinates,
  formatDateTime,
  formatPositionSource,
  formatRelativeTime,
  formatSpeed,
} from "@/lib/operations-ui";
import {
  formatSimulationPace,
  parseSimulationForm,
  SIMULATION_INTERVAL_SECONDS_MAX,
  SIMULATION_INTERVAL_SECONDS_MIN,
  SIMULATION_STEP_KM_MAX,
  SIMULATION_STEP_KM_MIN,
  type SimulationPace,
} from "@/lib/simulation";
import { cn } from "@/lib/utils";
import { DriverAssignment } from "./driver-assignment";
import { TripStatusBadge } from "./trip-status-badge";

const streamLabels: Record<StreamStatus, string> = {
  idle: "Not connected",
  connecting: "Connecting",
  live: "Live updates",
  reconnecting: "Reconnecting",
  unavailable: "Updates unavailable",
};

export function TripBackLink({
  href,
  className,
}: {
  href: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring lg:min-h-0",
        className,
      )}
    >
      <ArrowLeftIcon size={14} />
      All trips
    </Link>
  );
}

export function TripIdentity({
  trip,
  streamStatus,
}: {
  trip: TripView;
  streamStatus: StreamStatus;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold tracking-tight">
            {trip.customer.name}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {trip.vehicle.registrationNumber}
          </p>
        </div>
        <TripStatusBadge status={trip.trip.status} />
      </div>
      {trip.trip.status === "in_transit" ? (
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <BroadcastIcon
            size={16}
            weight="duotone"
            className={
              streamStatus === "live"
                ? "text-primary"
                : "text-muted-foreground"
            }
          />
          <span>{streamLabels[streamStatus]}</span>
          {trip.latestPosition ? (
            <span>
              Last position {formatRelativeTime(trip.latestPosition.recordedAt)}
            </span>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

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
  onSimulate,
  simulating = false,
  simulationPace = null,
  focused,
  drivers,
  assigningTripId,
  onAssignDriver,
  className,
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
  onSimulate?: (pace: SimulationPace) => void;
  simulating?: boolean;
  simulationPace?: SimulationPace | null;
  focused?: boolean;
  drivers?: DriverOption[];
  assigningTripId?: string | null;
  onAssignDriver?: (tripId: string, driverId: string) => void;
  className?: string;
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
      <aside
        id="trip-details-panel"
        role="tabpanel"
        aria-labelledby="trip-details-tab"
        className={cn(
          "min-h-0 flex-1 bg-surface lg:col-start-1 lg:row-start-1 lg:row-span-2 lg:border-r lg:border-border",
          className,
        )}
      >
        <EmptyState
          className="h-full min-h-72 p-8"
          icon={<CarIcon weight="duotone" />}
          title="No trip selected"
          description="Choose a trip to review its assignment and current status."
        />
      </aside>
    );
  }

  return (
    <aside
      id="trip-details-panel"
      role="tabpanel"
      aria-labelledby="trip-details-tab"
      className={cn(
        "min-h-0 flex-1 overflow-y-auto bg-surface lg:col-start-1 lg:row-start-1 lg:row-span-2 lg:border-r lg:border-border",
        className,
      )}
    >
      <div className="hidden border-b border-border p-5 lg:block">
        {focused &&
        !(role === "driver" && trip.trip.status === "in_transit") ? (
          <TripBackLink href={homeHref} className="mb-4" />
        ) : null}
        <TripIdentity trip={trip} streamStatus={streamStatus} />
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
                  <PlayIcon />
                  Start trip
                </Button>
              ) : null}
              {actions.includes("simulate") && onSimulate ? (
                <SimulateTripDialog
                  mutating={mutating}
                  onSimulate={onSimulate}
                />
              ) : null}
              {actions.includes("complete") ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button disabled={mutating}>
                      <CheckCircleIcon />
                      End trip
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>End this trip?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This marks the trip as completed and stops location
                        updates.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep trip in transit</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onTransition("completed")}
                      >
                        End trip
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
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
              <InlineAlert className="mt-3 font-medium">
                {mutationError}
              </InlineAlert>
            ) : null}
          </DetailGroup>
        ) : null}

        <DetailGroup title="Assignment">
          <DetailItem
            icon={<CarIcon weight="duotone" />}
            label="Vehicle"
            value={`${trip.vehicle.make} ${trip.vehicle.model}`}
            detail={`${trip.vehicle.registrationNumber}${trip.vehicle.color ? `, ${trip.vehicle.color}` : ""}`}
          />
          <DetailItem
            icon={<UserIcon weight="duotone" />}
            label="Customer"
            value={trip.customer.name}
          />
          {role === "controller" &&
          trip.trip.status === "created" &&
          onAssignDriver ? (
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-muted-foreground [&>svg]:size-[17px]">
                <UserIcon weight="duotone" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-muted-foreground">
                  Driver
                </p>
                <DriverAssignment
                  trip={trip}
                  drivers={drivers ?? []}
                  assigning={assigningTripId === trip.trip.id}
                  onAssign={onAssignDriver}
                  compact
                />
              </div>
            </div>
          ) : (
            <DetailItem
              icon={<UserIcon weight="duotone" />}
              label="Driver"
              value={trip.driver?.name ?? "Not assigned yet"}
              detail={
                trip.driver
                  ? (trip.driver.phone ?? "No phone recorded")
                  : role === "controller"
                    ? undefined
                    : "The logistics vendor will assign a driver."
              }
            />
          )}
          <DetailItem
            icon={<CubeIcon weight="duotone" />}
            label="Logistics vendor"
            value={trip.vendor.name}
          />
        </DetailGroup>

        <DetailGroup title="Route">
          <DetailItem
            icon={<MapPinIcon weight="duotone" />}
            label="Pickup"
            value={trip.trip.pickupAddress}
            detail={formatCoordinates(
              trip.trip.pickupLatitude,
              trip.trip.pickupLongitude,
            )}
          />
          <DetailItem
            icon={<MapPinIcon weight="duotone" />}
            label="Dropoff"
            value={trip.trip.dropoffAddress}
            detail={formatCoordinates(
              trip.trip.dropoffLatitude,
              trip.trip.dropoffLongitude,
            )}
          />
          <DetailItem
            icon={<CalendarBlankIcon weight="duotone" />}
            label="Scheduled collection"
            value={formatDateTime(trip.trip.scheduledAt)}
          />
        </DetailGroup>

        <DetailGroup title="Latest position">
          {trip.latestPosition ? (
            <div className="grid grid-cols-2 gap-3">
              <Metric
                label="Coordinates"
                value={formatCoordinates(
                  trip.latestPosition.latitude,
                  trip.latestPosition.longitude,
                )}
              />
              <Metric
                label="Speed"
                value={formatSpeed(trip.latestPosition.speed)}
              />
              <Metric
                label="Source"
                value={formatPositionSource(trip.latestPosition.source)}
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
                simulating || !locationError
                  ? "rounded-[10px] bg-primary/8 p-3 text-sm text-foreground"
                  : "rounded-[10px] bg-destructive/8 p-3 text-sm text-destructive"
              }
            >
              {simulating ? (
                <>
                  <p className="font-semibold">Simulating live location</p>
                  <p className="mt-1 text-xs leading-5">
                    {simulationPace
                      ? `A simulated vehicle is moving along the mapped route at ${formatSimulationPace(simulationPace)}.`
                      : "A simulated vehicle is moving along the mapped route."}
                  </p>
                </>
              ) : (
                <>
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
                </>
              )}
            </div>
          </DetailGroup>
        ) : null}

      </div>
    </aside>
  );
}

function SimulateTripDialog({
  mutating,
  onSimulate,
}: {
  mutating: boolean;
  onSimulate: (pace: SimulationPace) => void;
}) {
  const [intervalSeconds, setIntervalSeconds] = useState("5");
  const [stepKm, setStepKm] = useState("1");
  const pace = parseSimulationForm(intervalSeconds, stepKm);

  return (
    <AlertDialog
      onOpenChange={(open) => {
        if (open) {
          setIntervalSeconds("5");
          setStepKm("1");
        }
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="secondary" disabled={mutating}>
          <PathIcon />
          Simulate trip
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Simulate this trip?</AlertDialogTitle>
          <AlertDialogDescription>
            This starts the trip and moves a simulated vehicle along the mapped
            route. Real location sharing will not be used.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <FormField
            label="Update interval"
            htmlFor="simulation-interval-seconds"
            helper={`${SIMULATION_INTERVAL_SECONDS_MIN} to ${SIMULATION_INTERVAL_SECONDS_MAX}`}
          >
            <NumberFieldWithUnit
              id="simulation-interval-seconds"
              unit="seconds"
              type="number"
              min={SIMULATION_INTERVAL_SECONDS_MIN}
              max={SIMULATION_INTERVAL_SECONDS_MAX}
              step={1}
              inputMode="numeric"
              aria-describedby="simulation-interval-seconds-description"
              value={intervalSeconds}
              onChange={(event) => setIntervalSeconds(event.target.value)}
            />
          </FormField>
          <FormField
            label="Distance per update"
            htmlFor="simulation-step-km"
            helper={`${SIMULATION_STEP_KM_MIN} to ${SIMULATION_STEP_KM_MAX}`}
          >
            <NumberFieldWithUnit
              id="simulation-step-km"
              unit="km"
              type="number"
              min={SIMULATION_STEP_KM_MIN}
              max={SIMULATION_STEP_KM_MAX}
              step={0.1}
              inputMode="decimal"
              aria-describedby="simulation-step-km-description"
              value={stepKm}
              onChange={(event) => setStepKm(event.target.value)}
            />
          </FormField>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          {pace
            ? `The simulated vehicle will travel ${formatSimulationPace(pace)}.`
            : "Enter an interval from 1 to 60 seconds and a distance from 0.1 to 20 km."}
        </p>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep trip scheduled</AlertDialogCancel>
          <AlertDialogAction
            disabled={!pace}
            onClick={(event) => {
              if (!pace) {
                event.preventDefault();
                return;
              }
              onSimulate(pace);
            }}
          >
            Simulate trip
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function NumberFieldWithUnit({
  unit,
  className,
  id,
  "aria-describedby": describedBy,
  ...props
}: React.ComponentPropsWithoutRef<"input"> & { unit: string }) {
  const unitId = id ? `${id}-unit` : undefined;

  return (
    <div className="relative">
      <Input
        id={id}
        aria-describedby={
          [describedBy, unitId].filter(Boolean).join(" ") || undefined
        }
        className={cn(
          "bg-surface pr-[4.75rem] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
          className,
        )}
        {...props}
      />
      <span
        id={unitId}
        className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
      >
        {unit}
      </span>
    </div>
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
