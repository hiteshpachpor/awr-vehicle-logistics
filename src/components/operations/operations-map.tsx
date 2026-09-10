"use client";

import { useEffect, useRef, useState } from "react";
import { MapPinLineIcon, WarningCircleIcon } from "@phosphor-icons/react";
import mapboxgl from "mapbox-gl";
import type { TripView } from "@/lib/operations-types";

function markerElement(kind: "pickup" | "dropoff" | "vehicle") {
  const element = document.createElement("div");
  element.setAttribute(
    "aria-label",
    kind === "vehicle"
      ? "Latest vehicle position"
      : kind === "pickup"
        ? "Pickup location"
        : "Dropoff location",
  );
  element.className =
    kind === "vehicle"
      ? "size-4 rounded-full border-[3px] border-[#fffafa] bg-primary shadow-[0_4px_14px_rgba(122,26,34,.35)] transition-transform duration-500"
      : "size-3 rounded-full border-2 border-[#fffafa] bg-zinc-700 shadow-md dark:bg-zinc-300";
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
    map.on("error", () => {
      setMapError("The map could not be loaded. Trip details remain available.");
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

    const route = {
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: current
          ? [pickup, current, dropoff]
          : [pickup, dropoff],
      },
    };
    const existing = map.getSource("trip-route") as
      | mapboxgl.GeoJSONSource
      | undefined;
    if (existing) {
      existing.setData(route);
    } else {
      map.addSource("trip-route", { type: "geojson", data: route });
      map.addLayer({
        id: "trip-route-line",
        type: "line",
        source: "trip-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": darkMapColor(),
          "line-width": 4,
          "line-opacity": 0.78,
        },
      });
    }

    if (lastFitTripRef.current !== trip.trip.id) {
      const bounds = new mapboxgl.LngLatBounds(pickup, pickup);
      bounds.extend(dropoff);
      if (current) bounds.extend(current);
      map.fitBounds(bounds, {
        padding: { top: 64, right: 64, bottom: 64, left: 64 },
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
      <div className="grid h-full min-h-72 place-items-center bg-surface-strong p-8 text-center">
        <div className="max-w-sm">
          <MapPinLineIcon
            size={28}
            className="mx-auto mb-3 text-primary"
          />
          <p className="font-semibold">Mapbox token required</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to display live trip maps.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-72 bg-surface-strong">
      <div ref={containerRef} className="absolute inset-0" />
      {!trip ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-background/70 p-8 text-center backdrop-blur-sm">
          <div>
            <MapPinLineIcon
              size={28}
              className="mx-auto mb-3 text-muted-foreground"
            />
            <p className="font-semibold">Select a trip</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Route and live vehicle position will appear here.
            </p>
          </div>
        </div>
      ) : null}
      {mapError ? (
        <div
          role="alert"
          className="absolute bottom-4 left-4 right-4 flex items-start gap-2 rounded-[10px] border border-destructive/30 bg-background/95 p-3 text-sm shadow-lg"
        >
          <WarningCircleIcon
            size={18}
            className="mt-0.5 shrink-0 text-destructive"
          />
          {mapError}
        </div>
      ) : null}
    </div>
  );
}

function darkMapColor() {
  return getComputedStyle(document.documentElement)
    .getPropertyValue("--primary")
    .trim();
}
