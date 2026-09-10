"use client";

import { useEffect, useState } from "react";
import { makeDriverLocationPayload } from "@/lib/driver-location";
import type { TripView } from "@/lib/operations-types";

export type DriverLocationStatus =
  | "idle"
  | "requesting"
  | "sharing"
  | "unavailable";

export function useDriverLocation(
  trip: TripView | null,
  enabled: boolean,
) {
  const [status, setStatus] = useState<DriverLocationStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const tripId = trip?.trip.id;
  const inTransit = trip?.trip.status === "in_transit";

  useEffect(() => {
    if (!enabled || !tripId || !inTransit) {
      return;
    }
    if (!("geolocation" in navigator)) {
      const unsupportedTimer = window.setTimeout(() => {
        setStatus("unavailable");
        setError("This browser does not support location sharing.");
      }, 0);
      return () => window.clearTimeout(unsupportedTimer);
    }

    let active = true;
    const requestingTimer = window.setTimeout(() => {
      setStatus("requesting");
      setError(null);
    }, 0);

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (!active) return;
        setStatus("sharing");
        setError(null);
        void fetch(`/api/trips/${tripId}/location`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            makeDriverLocationPayload(
              position,
              `browser-${crypto.randomUUID()}`,
            ),
          ),
        })
          .then(async (response) => {
            if (!response.ok && active) {
              setStatus("unavailable");
              setError("Your location could not be sent. We will keep trying.");
            }
          })
          .catch(() => {
            if (!active) return;
            setStatus("unavailable");
            setError("Your location could not be sent. We will keep trying.");
          });
      },
      (reason) => {
        if (!active) return;
        setStatus("unavailable");
        setError(
          reason.code === reason.PERMISSION_DENIED
            ? "Allow location access to continue this trip."
            : "Your current location is unavailable. We will keep trying.",
        );
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5_000,
        timeout: 15_000,
      },
    );

    return () => {
      active = false;
      window.clearTimeout(requestingTimer);
      navigator.geolocation.clearWatch(watchId);
    };
  }, [enabled, inTransit, tripId]);

  return enabled && inTransit
    ? { status, error }
    : { status: "idle" as const, error: null };
}
