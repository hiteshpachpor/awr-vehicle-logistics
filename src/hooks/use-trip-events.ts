"use client";

import { useEffect, useRef, useState } from "react";
import type { Position } from "@/lib/operations-types";

export type StreamStatus =
  | "idle"
  | "connecting"
  | "live"
  | "reconnecting"
  | "unavailable";

export function useTripEvents(
  tripId: string | null,
  onPosition: (position: Position) => void,
) {
  const [connection, setConnection] = useState<{
    tripId: string;
    status: StreamStatus;
  } | null>(null);
  const callbackRef = useRef(onPosition);

  useEffect(() => {
    callbackRef.current = onPosition;
  }, [onPosition]);

  useEffect(() => {
    if (!tripId) return;

    let failures = 0;
    const source = new EventSource(`/api/trips/${tripId}/events`);
    source.onopen = () => {
      failures = 0;
      setConnection({ tripId, status: "live" });
    };
    source.addEventListener("position", (event) => {
      try {
        callbackRef.current(JSON.parse(event.data) as Position);
      } catch {
        setConnection({ tripId, status: "unavailable" });
      }
    });
    source.onerror = () => {
      failures += 1;
      setConnection({
        tripId,
        status: failures > 4 ? "unavailable" : "reconnecting",
      });
    };

    return () => {
      source.close();
    };
  }, [tripId]);

  if (!tripId) return "idle";
  return connection?.tripId === tripId ? connection.status : "connecting";
}
