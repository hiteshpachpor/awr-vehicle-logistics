"use client";

import { useEffect, useRef } from "react";
import type { TripListUpdate } from "@/lib/operations-types";
import { subscribeTripListBroadcast } from "@/lib/trip-list-sync";

export function useTripListEvents({
  enabled,
  vendorId,
  onUpdate,
  onSync,
}: {
  enabled: boolean;
  vendorId?: string;
  onUpdate: (update: TripListUpdate) => void;
  onSync: () => void;
}) {
  const updateRef = useRef(onUpdate);
  const syncRef = useRef(onSync);

  useEffect(() => {
    updateRef.current = onUpdate;
    syncRef.current = onSync;
  }, [onSync, onUpdate]);

  useEffect(() => {
    if (!enabled) return;

    const params = vendorId
      ? `?vendorId=${encodeURIComponent(vendorId)}`
      : "";
    const source = new EventSource(`/api/trips/events${params}`);
    source.onopen = () => {
      syncRef.current();
    };
    source.addEventListener("trip.updated", (event) => {
      try {
        updateRef.current(JSON.parse(event.data) as TripListUpdate);
      } catch {
        // Malformed payloads are ignored; reconnect refetch repairs the list.
      }
    });

    const unsubscribeBroadcast = subscribeTripListBroadcast((update) => {
      updateRef.current(update);
    });

    function syncWhenVisible() {
      if (document.visibilityState === "visible") {
        syncRef.current();
      }
    }

    document.addEventListener("visibilitychange", syncWhenVisible);
    window.addEventListener("pageshow", syncWhenVisible);

    return () => {
      source.close();
      unsubscribeBroadcast();
      document.removeEventListener("visibilitychange", syncWhenVisible);
      window.removeEventListener("pageshow", syncWhenVisible);
    };
  }, [enabled, vendorId]);
}
