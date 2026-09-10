"use client";

import { FormEvent, useState } from "react";
import { WarningCircleIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SearchSelect } from "./search-select";
import { getApiErrorMessage } from "@/lib/operations-ui";
import type {
  ApiErrorBody,
  CreateTripPayload,
  DriverOption,
  TripView,
  VehicleOption,
} from "@/lib/operations-types";

const inputClass =
  "h-11 w-full rounded-[10px] border border-border bg-surface px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:opacity-50";

type FormState = {
  vehicleId: string;
  driverId: string;
  referenceNumber: string;
  scheduledAt: string;
  pickupAddress: string;
  pickupLat: string;
  pickupLng: string;
  dropoffAddress: string;
  dropoffLat: string;
  dropoffLng: string;
};

const initialForm: FormState = {
  vehicleId: "",
  driverId: "",
  referenceNumber: "",
  scheduledAt: "",
  pickupAddress: "",
  pickupLat: "",
  pickupLng: "",
  dropoffAddress: "",
  dropoffLat: "",
  dropoffLng: "",
};

export function CreateTripDialog({
  open,
  onOpenChange,
  vehicles,
  drivers,
  optionsLoading,
  optionsError,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicles: VehicleOption[];
  drivers: DriverOption[];
  optionsLoading: boolean;
  optionsError: string | null;
  onCreated: (trip: TripView) => void;
}) {
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const update = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    const payload: CreateTripPayload = {
      vehicleId: form.vehicleId,
      driverId: form.driverId,
      ...(form.referenceNumber.trim()
        ? { referenceNumber: form.referenceNumber.trim() }
        : {}),
      ...(form.scheduledAt
        ? { scheduledAt: new Date(form.scheduledAt).toISOString() }
        : {}),
      pickup: {
        address: form.pickupAddress.trim(),
        lat: Number(form.pickupLat),
        lng: Number(form.pickupLng),
      },
      dropoff: {
        address: form.dropoffAddress.trim(),
        lat: Number(form.dropoffLat),
        lng: Number(form.dropoffLng),
      },
    };

    try {
      const response = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as TripView | ApiErrorBody;
      if (!response.ok) {
        throw new Error(getApiErrorMessage(body as ApiErrorBody));
      }
      onCreated(body as TripView);
      setForm(initialForm);
      onOpenChange(false);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "The trip could not be created.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a trip</DialogTitle>
          <DialogDescription>
            Assign a vehicle and driver, then define the collection route.
          </DialogDescription>
        </DialogHeader>

        <form className="mt-6 grid gap-6" onSubmit={handleSubmit}>
          {optionsError ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-[10px] border border-destructive/30 bg-destructive/5 p-3 text-sm"
            >
              <WarningCircleIcon
                size={18}
                className="mt-0.5 shrink-0 text-destructive"
              />
              {optionsError}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Vehicle" htmlFor="vehicle-select">
              <SearchSelect
                id="vehicle-select"
                value={form.vehicleId}
                onValueChange={(value) => update("vehicleId", value)}
                options={vehicles.map((vehicle) => ({
                  value: vehicle.id,
                  label: vehicle.registrationNumber,
                  description: `${vehicle.make} ${vehicle.model}, ${vehicle.customer.name}`,
                  searchText: `${vehicle.color ?? ""} ${vehicle.customer.name}`,
                }))}
                placeholder={
                  optionsLoading ? "Loading vehicles..." : "Select vehicle"
                }
                searchPlaceholder="Search registration or owner"
                disabled={optionsLoading || Boolean(optionsError)}
              />
            </Field>
            <Field label="Driver" htmlFor="driver-select">
              <SearchSelect
                id="driver-select"
                value={form.driverId}
                onValueChange={(value) => update("driverId", value)}
                options={drivers.map((driver) => ({
                  value: driver.id,
                  label: driver.name,
                  description: driver.vendor.name,
                  searchText: `${driver.externalReference ?? ""} ${driver.phone ?? ""}`,
                }))}
                placeholder={
                  optionsLoading ? "Loading drivers..." : "Select driver"
                }
                searchPlaceholder="Search driver or vendor"
                disabled={optionsLoading || Boolean(optionsError)}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Reference number"
              htmlFor="reference-number"
              helper="Optional. A reference will be generated if left blank."
            >
              <input
                id="reference-number"
                className={inputClass}
                value={form.referenceNumber}
                onChange={(event) =>
                  update("referenceNumber", event.target.value)
                }
                maxLength={100}
                placeholder="TRIP-2026-..."
              />
            </Field>
            <Field
              label="Scheduled collection"
              htmlFor="scheduled-at"
              helper="Optional. Times use your current timezone."
            >
              <input
                id="scheduled-at"
                type="datetime-local"
                className={inputClass}
                value={form.scheduledAt}
                onChange={(event) => update("scheduledAt", event.target.value)}
              />
            </Field>
          </div>

          <RouteFields
            title="Pickup"
            prefix="pickup"
            address={form.pickupAddress}
            lat={form.pickupLat}
            lng={form.pickupLng}
            update={update}
          />
          <RouteFields
            title="Dropoff"
            prefix="dropoff"
            address={form.dropoffAddress}
            lat={form.dropoffLat}
            lng={form.dropoffLng}
            update={update}
          />

          {submitError ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {submitError}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                submitting ||
                optionsLoading ||
                !form.vehicleId ||
                !form.driverId
              }
            >
              {submitting ? "Creating..." : "Create trip"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RouteFields({
  title,
  prefix,
  address,
  lat,
  lng,
  update,
}: {
  title: string;
  prefix: "pickup" | "dropoff";
  address: string;
  lat: string;
  lng: string;
  update: (field: keyof FormState, value: string) => void;
}) {
  const addressField = `${prefix}Address` as keyof FormState;
  const latField = `${prefix}Lat` as keyof FormState;
  const lngField = `${prefix}Lng` as keyof FormState;
  return (
    <fieldset className="grid gap-4 rounded-xl border border-border p-4">
      <legend className="px-1 text-sm font-semibold">{title}</legend>
      <Field label="Address" htmlFor={`${prefix}-address`}>
        <input
          id={`${prefix}-address`}
          className={inputClass}
          required
          maxLength={500}
          value={address}
          onChange={(event) => update(addressField, event.target.value)}
          placeholder={
            prefix === "pickup" ? "Collection address" : "Delivery address"
          }
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Latitude" htmlFor={`${prefix}-latitude`}>
          <input
            id={`${prefix}-latitude`}
            className={inputClass}
            type="number"
            required
            min={-90}
            max={90}
            step="any"
            value={lat}
            onChange={(event) => update(latField, event.target.value)}
            placeholder="25.2048"
          />
        </Field>
        <Field label="Longitude" htmlFor={`${prefix}-longitude`}>
          <input
            id={`${prefix}-longitude`}
            className={inputClass}
            type="number"
            required
            min={-180}
            max={180}
            step="any"
            value={lng}
            onChange={(event) => update(lngField, event.target.value)}
            placeholder="55.2708"
          />
        </Field>
      </div>
    </fieldset>
  );
}

function Field({
  label,
  htmlFor,
  helper,
  children,
}: {
  label: string;
  htmlFor: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <label htmlFor={htmlFor} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {helper ? (
        <p className="text-xs leading-5 text-muted-foreground">{helper}</p>
      ) : null}
    </div>
  );
}
