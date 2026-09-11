import type { TripStatus } from "@/lib/operations-types";
import { tripStatusLabels } from "@/lib/operations-ui";
import { cn } from "@/lib/utils";

const statusClassNames: Record<TripStatus, string> = {
  created:
    "border-status-scheduled/30 bg-status-scheduled/10 text-status-scheduled",
  in_transit:
    "border-status-transit/30 bg-status-transit/10 text-status-transit",
  completed:
    "border-status-completed/30 bg-status-completed/10 text-status-completed",
  cancelled:
    "border-status-cancelled/30 bg-status-cancelled/10 text-status-cancelled",
};

export function TripStatusBadge({ status }: { status: TripStatus }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-[5px] border px-1.5 text-[10px] font-medium leading-none uppercase tracking-[0.04em]",
        statusClassNames[status],
      )}
    >
      {tripStatusLabels[status]}
    </span>
  );
}
