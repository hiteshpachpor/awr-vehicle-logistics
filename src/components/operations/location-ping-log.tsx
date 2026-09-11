"use client";

import {
  BroadcastIcon,
  MapPinIcon,
} from "@phosphor-icons/react";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import type { Position } from "@/lib/operations-types";
import {
  formatCoordinates,
  formatDateTime,
  formatPositionSource,
  formatSpeed,
} from "@/lib/operations-ui";

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
      className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface"
    >
      <div className="flex min-h-14 items-center justify-between gap-4 border-b border-border px-4">
        <div className="min-w-0">
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
        <InlineAlert className="m-4">{error}</InlineAlert>
      ) : positions.length ? (
        <ol className="min-h-0 flex-1 divide-y divide-border/70 overflow-y-auto">
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
                  <MapPinIcon size={14} weight="duotone" className="shrink-0" />
                  {formatCoordinates(position.latitude, position.longitude)}
                </span>
                <span className="ml-auto flex items-center gap-3">
                  <span className="tabular-nums">
                  {formatSpeed(position.speed, "—")}
                  </span>
                  <span
                    aria-hidden="true"
                    className="h-3 w-px bg-border"
                  />
                  <span className="flex items-center gap-1.5">
                  <BroadcastIcon
                      size={13}
                      weight="duotone"
                      className="shrink-0"
                  />
                  {formatPositionSource(position.source)}
                  </span>
                </span>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          icon={<BroadcastIcon weight="duotone" />}
          title="No location pings yet"
          description="Reports will appear here when the trip starts moving."
        />
      )}
    </section>
  );
}
