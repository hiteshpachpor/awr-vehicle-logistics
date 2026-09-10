"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CircleNotchIcon,
  LinkIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/input";
import { SearchSelect } from "@/components/ui/search-select";
import { getApiErrorMessage } from "@/lib/operations-ui";
import type {
  ApiErrorBody,
  CreateTripPayload,
  CustomerOption,
  GoogleMapsLocationResponse,
  TripView,
  VehicleOption,
  VendorOption,
} from "@/lib/operations-types";

type FormState = {
  customerId: string;
  vehicleId: string;
  vendorId: string;
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
  customerId: "",
  vehicleId: "",
  vendorId: "",
  referenceNumber: "",
  scheduledAt: "",
  pickupAddress: "",
  pickupLat: "",
  pickupLng: "",
  dropoffAddress: "",
  dropoffLat: "",
  dropoffLng: "",
};

export function CreateTripForm() {
  const router = useRouter();
  const selectedCustomerRef = useRef("");
  const [form, setForm] = useState(initialForm);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [vehicleError, setVehicleError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const update = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setSubmitError(null);
  };

  useEffect(() => {
    const controller = new AbortController();

    async function loadOptions() {
      try {
        const [customersResponse, vendorsResponse] = await Promise.all([
          fetch("/api/customers", {
            cache: "no-store",
            signal: controller.signal,
          }),
          fetch("/api/vendors", {
            cache: "no-store",
            signal: controller.signal,
          }),
        ]);
        const customersBody = (await customersResponse.json()) as
          | { data: CustomerOption[] }
          | ApiErrorBody;
        const vendorsBody = (await vendorsResponse.json()) as
          | { data: VendorOption[] }
          | ApiErrorBody;
        if (!customersResponse.ok || !("data" in customersBody)) {
          throw new Error(getApiErrorMessage(customersBody as ApiErrorBody));
        }
        if (!vendorsResponse.ok || !("data" in vendorsBody)) {
          throw new Error(getApiErrorMessage(vendorsBody as ApiErrorBody));
        }
        setCustomers(customersBody.data);
        setVendors(vendorsBody.data);
      } catch (error) {
        if (controller.signal.aborted) return;
        setOptionsError(
          error instanceof Error
            ? error.message
            : "Customers and vendors could not be loaded.",
        );
      } finally {
        if (!controller.signal.aborted) setOptionsLoading(false);
      }
    }

    void loadOptions();
    return () => controller.abort();
  }, []);

  async function selectCustomer(customerId: string) {
    selectedCustomerRef.current = customerId;
    setSubmitError(null);
    setForm((current) => ({
      ...current,
      customerId,
      vehicleId: "",
    }));
    setVehicles([]);
    setVehiclesLoading(true);
    setVehicleError(null);

    try {
      const response = await fetch(
        `/api/vehicles?customerId=${encodeURIComponent(customerId)}`,
        { cache: "no-store" },
      );
      const body = (await response.json()) as
        | { data: VehicleOption[] }
        | ApiErrorBody;
      if (!response.ok || !("data" in body)) {
        throw new Error(getApiErrorMessage(body as ApiErrorBody));
      }
      if (selectedCustomerRef.current !== customerId) return;
      setVehicles(body.data);
      setForm((current) => ({
        ...current,
        vehicleId: body.data[0]?.id ?? "",
      }));
    } catch (error) {
      if (selectedCustomerRef.current !== customerId) return;
      setVehicleError(
        error instanceof Error
          ? error.message
          : "Vehicles could not be loaded.",
      );
    } finally {
      if (selectedCustomerRef.current === customerId) {
        setVehiclesLoading(false);
      }
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    const payload: CreateTripPayload = {
      vehicleId: form.vehicleId,
      vendorId: form.vendorId,
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
      router.push(
        `/ops/trips?created=${encodeURIComponent((body as TripView).trip.referenceNumber)}`,
      );
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "The trip could not be created.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="grid gap-6" onSubmit={handleSubmit}>
          {optionsError || vehicleError ? (
            <InlineAlert>
              {optionsError ?? vehicleError}
            </InlineAlert>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Customer" htmlFor="customer-select">
              <SearchSelect
                id="customer-select"
                value={form.customerId}
                onValueChange={(value) => void selectCustomer(value)}
                options={customers.map((customer) => ({
                  value: customer.id,
                  label: customer.name,
                }))}
                placeholder={
                  optionsLoading ? "Loading customers..." : "Select customer"
                }
                searchPlaceholder="Search customers"
                disabled={optionsLoading || Boolean(optionsError)}
              />
            </FormField>
            <FormField label="Vehicle" htmlFor="vehicle-select">
              <SearchSelect
                id="vehicle-select"
                value={form.vehicleId}
                onValueChange={(value) => update("vehicleId", value)}
                options={vehicles.map((vehicle) => ({
                  value: vehicle.id,
                  label: vehicle.registrationNumber,
                  description: `${vehicle.make} ${vehicle.model}`,
                  searchText: vehicle.color ?? "",
                }))}
                placeholder={
                  !form.customerId
                    ? "Select a customer first"
                    : vehiclesLoading
                      ? "Loading vehicles..."
                      : "Select vehicle"
                }
                searchPlaceholder="Search registration or model"
                disabled={
                  !form.customerId ||
                  vehiclesLoading ||
                  Boolean(vehicleError)
                }
              />
            </FormField>
          </div>

          <FormField label="Logistics vendor" htmlFor="vendor-select">
            <SearchSelect
              id="vendor-select"
              value={form.vendorId}
              onValueChange={(value) => update("vendorId", value)}
              options={vendors.map((vendor) => ({
                value: vendor.id,
                label: vendor.name,
              }))}
              placeholder={
                optionsLoading ? "Loading vendors..." : "Select vendor"
              }
              searchPlaceholder="Search vendors"
              disabled={optionsLoading || Boolean(optionsError)}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Reference number"
              htmlFor="reference-number"
              helper="Optional. A reference will be generated if left blank."
            >
              <Input
                id="reference-number"
                className="bg-surface"
                aria-describedby="reference-number-description"
                value={form.referenceNumber}
                onChange={(event) =>
                  update("referenceNumber", event.target.value)
                }
                maxLength={100}
                placeholder="TRIP-2026-..."
              />
            </FormField>
            <FormField
              label="Scheduled collection"
              htmlFor="scheduled-at"
              helper="Optional. Times use your current timezone."
            >
              <Input
                id="scheduled-at"
                type="datetime-local"
                className="bg-surface"
                aria-describedby="scheduled-at-description"
                value={form.scheduledAt}
                onChange={(event) => update("scheduledAt", event.target.value)}
              />
            </FormField>
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
            <InlineAlert
              title="Trip couldn’t be created"
              className="border-destructive/40 bg-destructive/10 p-4 shadow-[0_6px_18px_rgb(165_29_40/8%)]"
            >
              <p>{submitError}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose another vehicle or finish its active trip before trying
                again.
              </p>
            </InlineAlert>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                submitting ||
                optionsLoading ||
                !form.vehicleId ||
                !form.vendorId
              }
            >
              {submitting ? "Creating..." : "Create trip"}
            </Button>
          </div>
    </form>
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
  const [mapsUrl, setMapsUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const addressField = `${prefix}Address` as keyof FormState;
  const latField = `${prefix}Lat` as keyof FormState;
  const lngField = `${prefix}Lng` as keyof FormState;

  async function importGoogleMapsLocation() {
    if (!mapsUrl.trim()) {
      setImportError("Paste a Google Maps link to import this location.");
      return;
    }

    setImporting(true);
    setImportError(null);

    try {
      const response = await fetch("/api/google-maps/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: mapsUrl.trim() }),
      });
      const body = (await response.json()) as
        | GoogleMapsLocationResponse
        | ApiErrorBody;
      if (!response.ok) {
        throw new Error(
          getApiErrorMessage(
            body as ApiErrorBody,
            "This Google Maps link could not be imported.",
          ),
        );
      }

      const location = (body as GoogleMapsLocationResponse).data;
      update(addressField, location.name);
      update(latField, String(location.lat));
      update(lngField, String(location.lng));
    } catch (error) {
      setImportError(
        error instanceof Error
          ? error.message
          : "This Google Maps link could not be imported.",
      );
    } finally {
      setImporting(false);
    }
  }

  return (
    <fieldset className="grid gap-4 rounded-xl border border-border p-4">
      <legend className="px-1 text-sm font-semibold">{title}</legend>
      <FormField
        label="Google Maps link"
        htmlFor={`${prefix}-maps-url`}
        helper="Paste a place link to fill the address and coordinates."
      >
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="relative">
            <LinkIcon
              size={18}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id={`${prefix}-maps-url`}
              className="bg-surface pl-10"
              type="text"
              inputMode="url"
              autoComplete="off"
              value={mapsUrl}
              onChange={(event) => {
                setMapsUrl(event.target.value);
                setImportError(null);
              }}
              placeholder="https://maps.app.goo.gl/..."
              disabled={importing}
              aria-invalid={Boolean(importError)}
              aria-describedby={`${prefix}-maps-url-description${
                importError ? ` ${prefix}-maps-error` : ""
              }`}
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            className="h-11"
            disabled={importing || !mapsUrl.trim()}
            onClick={importGoogleMapsLocation}
          >
            {importing ? (
              <CircleNotchIcon
                size={17}
                aria-hidden="true"
                className="animate-spin"
              />
            ) : null}
            {importing ? "Importing..." : "Import location"}
          </Button>
        </div>
        {importError ? (
          <p
            id={`${prefix}-maps-error`}
            role="alert"
            className="text-xs font-medium leading-5 text-destructive"
          >
            {importError}
          </p>
        ) : null}
      </FormField>
      <FormField label="Address" htmlFor={`${prefix}-address`}>
        <Input
          id={`${prefix}-address`}
          className="bg-surface"
          required
          maxLength={500}
          value={address}
          onChange={(event) => update(addressField, event.target.value)}
          placeholder={
            prefix === "pickup" ? "Collection address" : "Delivery address"
          }
        />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Latitude" htmlFor={`${prefix}-latitude`}>
          <Input
            id={`${prefix}-latitude`}
            className="bg-surface"
            type="number"
            required
            min={-90}
            max={90}
            step="any"
            value={lat}
            onChange={(event) => update(latField, event.target.value)}
            placeholder="25.2048"
          />
        </FormField>
        <FormField label="Longitude" htmlFor={`${prefix}-longitude`}>
          <Input
            id={`${prefix}-longitude`}
            className="bg-surface"
            type="number"
            required
            min={-180}
            max={180}
            step="any"
            value={lng}
            onChange={(event) => update(lngField, event.target.value)}
            placeholder="55.2708"
          />
        </FormField>
      </div>
    </fieldset>
  );
}
