"use client";

import { useEffect, useRef, useState } from "react";
import { MapPinLineIcon } from "@phosphor-icons/react";
import mapboxgl from "mapbox-gl";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import type { TripView } from "@/lib/operations-types";

const markerIconPaths = {
  pickup:
    "M128,16a88.1,88.1,0,0,0-88,88c0,75.3,80,132.17,83.41,134.55a8,8,0,0,0,9.18,0C136,236.17,216,179.3,216,104A88.1,88.1,0,0,0,128,16Zm0,56a32,32,0,1,1-32,32A32,32,0,0,1,128,72Z",
  dropoff:
    "M227.32,48.75A8,8,0,0,0,218.76,50c-28,24.22-51.72,12.48-79.21-1.13C111.07,34.76,78.78,18.79,42.76,50h0A8,8,0,0,0,40,56V224a8,8,0,0,0,16,0V179.77c26.79-21.16,49.87-9.75,76.45,3.41,16.4,8.11,34.06,16.85,53,16.85,13.93,0,28.54-4.75,43.82-18a8,8,0,0,0,2.76-6V56A8,8,0,0,0,227.32,48.75ZM56,160.44V109.88c16.85-11.28,32.64-11.59,48-7.34v51.74C88.87,150.47,72.87,150.71,56,160.44ZM104,50.87c9.25,2.83,18.61,7.45,28.45,12.32,11.26,5.57,23.11,11.43,35.55,14.56v51.74c15.35,4.25,31.14,3.94,48-7.35v50.11c-16.87,13.32-32.27,13.72-48,8.91V129.49c-21.62-6-42.38-21-64-26.95Z",
  vehicle:
    "M240,104H229.2L201.42,41.5A16,16,0,0,0,186.8,32H69.2a16,16,0,0,0-14.62,9.5L26.8,104H16a8,8,0,0,0,0,16h8v80a16,16,0,0,0,16,16H64a16,16,0,0,0,16-16v-8h96v8a16,16,0,0,0,16,16h24a16,16,0,0,0,16-16V120h8a8,8,0,0,0,0-16ZM80,152H56a8,8,0,0,1,0-16H80a8,8,0,0,1,0,16Zm120,0H176a8,8,0,0,1,0-16h24a8,8,0,0,1,0,16ZM44.31,104,69.2,48H186.8l24.89,56Z",
} as const;

function markerElement(kind: "pickup" | "dropoff" | "vehicle") {
  const element = document.createElement("div");
  element.setAttribute(
    "aria-label",
    kind === "vehicle"
      ? "Latest vehicle position"
      : kind === "pickup"
        ? "Pickup location"
        : "Drop-off location",
  );
  element.className =
    kind === "vehicle"
      ? "relative grid size-8 place-items-center rounded-[10px] border-2 border-[#fffafa] bg-primary text-primary-foreground shadow-[0_5px_16px_rgba(122,26,34,.38)] transition-transform duration-500"
      : kind === "pickup"
        ? "relative grid size-7 place-items-center rounded-full border-2 border-[#fffafa] bg-background text-foreground shadow-[0_4px_12px_rgb(20_22_26/30%)]"
        : "relative grid size-7 place-items-center rounded-full border-2 border-[#fffafa] bg-foreground text-background shadow-[0_4px_12px_rgb(20_22_26/30%)]";

  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 256 256");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("class", kind === "vehicle" ? "size-4" : "size-3.5");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", markerIconPaths[kind]);
  path.setAttribute("fill", "currentColor");
  icon.append(path);
  element.append(icon);

  if (kind !== "vehicle") {
    const label = document.createElement("span");
    label.className =
      "pointer-events-none absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface/95 px-2 py-1 text-[11px] font-semibold text-foreground shadow-[0_4px_12px_rgb(20_22_26/20%)]";
    label.textContent = kind === "pickup" ? "Pickup" : "Drop-off";
    element.append(label);
  }

  return element;
}

export function OperationsMap({ trip }: { trip: TripView | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const lastFitTripRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  useEffect(() => {
    if (!containerRef.current || !token) return;

    mapboxgl.accessToken = token;
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: dark
        ? "mapbox://styles/mapbox/dark-v11"
        : "mapbox://styles/mapbox/light-v11",
      center: [55.32, 25.25],
      zoom: 9.5,
      attributionControl: true,
    });
    map.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }),
      "top-right",
    );
    map.on("load", () => setReady(true));
    map.on("error", (event) => {
      console.error("Mapbox error:", event.error);
      setMapError(
        event.error?.message ??
          "The map could not be loaded. Trip details remain available.",
      );
    });
    mapRef.current = map;

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      mapRef.current = null;
      map.remove();
    };
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !trip) return;

    markersRef.current.forEach((marker) => marker.remove());
    const pickup: [number, number] = [
      trip.trip.pickupLongitude,
      trip.trip.pickupLatitude,
    ];
    const dropoff: [number, number] = [
      trip.trip.dropoffLongitude,
      trip.trip.dropoffLatitude,
    ];
    const current: [number, number] | null = trip.latestPosition
      ? [trip.latestPosition.longitude, trip.latestPosition.latitude]
      : null;

    markersRef.current = [
      new mapboxgl.Marker({ element: markerElement("pickup") })
        .setLngLat(pickup)
        .addTo(map),
      new mapboxgl.Marker({ element: markerElement("dropoff") })
        .setLngLat(dropoff)
        .addTo(map),
      ...(current
        ? [
            new mapboxgl.Marker({ element: markerElement("vehicle") })
              .setLngLat(current)
              .addTo(map),
          ]
        : []),
    ];

    if (lastFitTripRef.current !== trip.trip.id) {
      const bounds = new mapboxgl.LngLatBounds(pickup, pickup);
      bounds.extend(dropoff);
      if (current) bounds.extend(current);
      map.fitBounds(bounds, {
        padding: { top: 88, right: 88, bottom: 88, left: 88 },
        maxZoom: 13,
        duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : 650,
      });
      lastFitTripRef.current = trip.trip.id;
    }
  }, [ready, trip]);

  if (!token) {
    return (
      <EmptyState
        className="h-full min-h-72 bg-surface-strong p-8"
        icon={<MapPinLineIcon className="text-primary" />}
        title="Mapbox token required"
        description="Add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to display live trip maps."
      />
    );
  }

  return (
    <div className="relative h-full min-h-72 bg-surface-strong">
      <div ref={containerRef} className="h-full w-full" />
      {!trip ? (
        <EmptyState
          className="pointer-events-none absolute inset-0 bg-background/70 p-8 backdrop-blur-sm"
          icon={<MapPinLineIcon />}
          title="Select a trip"
          description="Pickup, drop-off, and live vehicle position will appear here."
        />
      ) : null}
      {mapError ? (
        <InlineAlert className="absolute bottom-4 left-4 right-4 bg-background/95 shadow-lg">
          {mapError}
        </InlineAlert>
      ) : null}
    </div>
  );
}
