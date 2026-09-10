"use client";

import { useEffect, useState } from "react";
import { makeDriverLocationPayload } from "@/lib/driver-location";
import type { TripView } from "@/lib/operations-types";

const LOCATION_SEND_INTERVAL_MS = 5_000;

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
    let requestInFlight = false;
    let lastSentAt = 0;
    let queuedPosition: GeolocationPosition | null = null;
    let sendTimer: number | null = null;
    const requestingTimer = window.setTimeout(() => {
      setStatus("requesting");
      setError(null);
    }, 0);

    function sendPosition(position: GeolocationPosition) {
      if (!active) return;
      requestInFlight = true;
      lastSentAt = Date.now();

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
        })
        .finally(() => {
          requestInFlight = false;
          if (!active || !queuedPosition) return;
          const nextPosition = queuedPosition;
          queuedPosition = null;
          schedulePosition(nextPosition);
        });
    }

    function schedulePosition(position: GeolocationPosition) {
      if (!active) return;
      setStatus("sharing");
      setError(null);
      queuedPosition = position;

      if (requestInFlight) return;

      const waitTime = Math.max(
        0,
        LOCATION_SEND_INTERVAL_MS - (Date.now() - lastSentAt),
      );
      if (waitTime === 0) {
        queuedPosition = null;
        sendPosition(position);
        return;
      }
      if (sendTimer !== null) return;

      sendTimer = window.setTimeout(() => {
        sendTimer = null;
        const nextPosition = queuedPosition;
        queuedPosition = null;
        if (nextPosition) sendPosition(nextPosition);
      }, waitTime);
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        schedulePosition(position);
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
      if (sendTimer !== null) window.clearTimeout(sendTimer);
      navigator.geolocation.clearWatch(watchId);
    };
  }, [enabled, inTransit, tripId]);

  return enabled && inTransit
    ? { status, error }
    : { status: "idle" as const, error: null };
}
