"use client";

import type { TripListUpdate } from "@/lib/operations-types";

const channelName = "awr-trip-list-updates";

export function broadcastTripListUpdate(update: TripListUpdate) {
  try {
    const channel = new BroadcastChannel(channelName);
    channel.postMessage(update);
    channel.close();
  } catch {
    // Some browsers block BroadcastChannel in private contexts.
  }
}

export function subscribeTripListBroadcast(
  onUpdate: (update: TripListUpdate) => void,
) {
  try {
    const channel = new BroadcastChannel(channelName);
    channel.onmessage = (event: MessageEvent<TripListUpdate>) => {
      if (event.data?.trip?.trip?.id) {
        onUpdate(event.data);
      }
    };
    return () => channel.close();
  } catch {
    return () => undefined;
  }
}
