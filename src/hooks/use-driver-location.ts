"use client";

import { useEffect, useState } from "react";
import { createDriverLocationOutbox } from "@/lib/driver-location-outbox";
import type { TripView } from "@/lib/operations-types";

const LOCATION_SAMPLE_INTERVAL_MS = 5_000;
const SEND_BACKOFF_MS = [1_000, 2_000, 5_000, 15_000, 30_000] as const;

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
  const [pendingCount, setPendingCount] = useState(0);
  const tripId = trip?.trip.id;
  const inTransit = trip?.trip.status === "in_transit";

  useEffect(() => {
    if (!enabled || !tripId || !inTransit) {
      return;
    }

    const activeTripId = tripId;
    const outbox = createDriverLocationOutbox();
    const hasGeolocation = "geolocation" in navigator;
    let active = true;
    let latestFix: GeolocationPosition | null = null;
    let requestInFlight = false;
    let sampleTimer: number | null = null;
    let backoffTimer: number | null = null;
    let backoffIndex = 0;
    let settled = false;

    const requestingTimer = window.setTimeout(() => {
      setPendingCount(outbox.size(activeTripId));
      if (!active || settled) return;
      setStatus(hasGeolocation ? "requesting" : "unavailable");
      setError(
        hasGeolocation
          ? null
          : "This browser does not support location sharing.",
      );
    }, 0);

    function syncPending() {
      if (active) setPendingCount(outbox.size(activeTripId));
    }

    function sampleLatestFix() {
      if (!active || !latestFix) return;
      outbox.enqueue(activeTripId, latestFix);
      syncPending();
      flush();
    }

    function scheduleBackoff() {
      requestInFlight = false;
      if (!active || backoffTimer !== null) return;
      const wait =
        SEND_BACKOFF_MS[Math.min(backoffIndex, SEND_BACKOFF_MS.length - 1)];
      backoffIndex += 1;
      backoffTimer = window.setTimeout(() => {
        backoffTimer = null;
        flush();
      }, wait);
    }

    function flushNow() {
      if (backoffTimer !== null) {
        window.clearTimeout(backoffTimer);
        backoffTimer = null;
      }
      backoffIndex = 0;
      flush();
    }

    function flush() {
      if (!active || requestInFlight) return;
      const item = outbox.peek(activeTripId);
      if (!item) return;

      requestInFlight = true;
      void fetch(`/api/trips/${activeTripId}/location`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      })
        .then((response) => {
          if (!active) return;
          if (response.ok) {
            outbox.ack(activeTripId, item.eventId);
            backoffIndex = 0;
            settled = true;
            setStatus("sharing");
            setError(null);
            syncPending();
            requestInFlight = false;
            flush();
            return;
          }
          settled = true;
          setStatus("unavailable");
          setError("Your location could not be sent. We will keep trying.");
          scheduleBackoff();
        })
        .catch(() => {
          if (!active) return;
          settled = true;
          setStatus("unavailable");
          setError("Your location could not be sent. We will keep trying.");
          scheduleBackoff();
        });
    }

    function handleOnline() {
      flushNow();
    }

    window.addEventListener("online", handleOnline);
    flush();

    if (!hasGeolocation) {
      return () => {
        active = false;
        window.clearTimeout(requestingTimer);
        window.removeEventListener("online", handleOnline);
        if (backoffTimer !== null) window.clearTimeout(backoffTimer);
        sendKeepalive(activeTripId, outbox);
      };
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (!active) return;
        latestFix = position;
        if (sampleTimer === null) {
          sampleLatestFix();
          sampleTimer = window.setInterval(
            sampleLatestFix,
            LOCATION_SAMPLE_INTERVAL_MS,
          );
        }
      },
      (reason) => {
        if (!active) return;
        settled = true;
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
      if (sampleTimer !== null) window.clearInterval(sampleTimer);
      if (backoffTimer !== null) window.clearTimeout(backoffTimer);
      window.removeEventListener("online", handleOnline);
      navigator.geolocation.clearWatch(watchId);
      sendKeepalive(activeTripId, outbox);
    };
  }, [enabled, inTransit, tripId]);

  return enabled && inTransit
    ? { status, error, pendingCount }
    : { status: "idle" as const, error: null, pendingCount: 0 };
}

function sendKeepalive(
  tripId: string,
  outbox: ReturnType<typeof createDriverLocationOutbox>,
) {
  const item = outbox.peek(tripId);
  if (!item) return;
  void fetch(`/api/trips/${tripId}/location`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item),
    keepalive: true,
  });
}
