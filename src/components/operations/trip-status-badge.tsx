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
        "shrink-0 rounded-full border px-2 py-1 text-[11px] font-semibold",
        statusClassNames[status],
      )}
    >
      {tripStatusLabels[status]}
    </span>
  );
}
