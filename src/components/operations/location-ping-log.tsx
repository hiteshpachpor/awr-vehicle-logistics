"use client";

import {
  BroadcastIcon,
  MapPinIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import type { Position } from "@/lib/operations-types";
import { formatDateTime } from "@/lib/operations-ui";

export function LocationPingLog({
  positions,
  loading,
  error,
}: {
  positions: Position[];
  loading: boolean;
  error: string | null;
}) {
  return (
    <section
      aria-labelledby="location-pings-title"
      className="flex min-h-0 flex-1 flex-col bg-surface lg:overflow-hidden"
    >
      <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
        <div>
          <h2 id="location-pings-title" className="text-sm font-semibold">
            Location pings
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Most recent reports first
          </p>
        </div>
        {!loading && !error ? (
          <span className="text-xs font-semibold text-muted-foreground">
            {positions.length} {positions.length === 1 ? "ping" : "pings"}
          </span>
        ) : null}
      </div>

      {loading ? (
        <div className="grid gap-px bg-border" aria-label="Loading pings">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-16 animate-pulse bg-surface px-4 py-3"
            >
              <div className="h-3 w-2/3 rounded bg-muted" />
              <div className="mt-2 h-3 w-1/3 rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div
          role="alert"
          className="flex items-start gap-2 p-4 text-sm text-destructive"
        >
          <WarningCircleIcon size={18} className="mt-0.5 shrink-0" />
          {error}
        </div>
      ) : positions.length ? (
        <ol className="divide-y divide-border/70 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          {positions.map((position) => (
            <li
              key={position.id}
              className="grid gap-2 px-4 py-2.5 sm:grid-cols-[minmax(165px,.8fr)_minmax(280px,1.5fr)] sm:items-center sm:gap-5"
            >
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground/85">
                  <time dateTime={position.recordedAt}>
                    {formatDateTime(position.recordedAt)}
                  </time>
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Received{" "}
                  <time dateTime={position.receivedAt}>
                    {formatDateTime(position.receivedAt)}
                  </time>
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-2 tabular-nums">
                  <MapPinIcon size={14} className="shrink-0" />
                  {position.latitude.toFixed(4)}, {position.longitude.toFixed(4)}
                </span>
                <span className="ml-auto flex items-center gap-3">
                  <span className="tabular-nums">
                  {position.speed === null
                    ? "—"
                    : `${position.speed.toFixed(1)} km/h`}
                  </span>
                  <span
                    aria-hidden="true"
                    className="h-3 w-px bg-border"
                  />
                  <span className="flex items-center gap-1.5">
                  <BroadcastIcon
                      size={13}
                      className="shrink-0"
                  />
                  {position.source === "simulator" ? "Simulation" : "Vendor"}
                  </span>
                </span>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="p-6 text-center">
          <BroadcastIcon
            size={24}
            className="mx-auto text-muted-foreground"
          />
          <p className="mt-2 text-sm font-semibold">No location pings yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Reports will appear here when the trip starts moving.
          </p>
        </div>
      )}
    </section>
  );
}
