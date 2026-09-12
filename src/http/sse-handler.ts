import { NextResponse } from "next/server";
import { z } from "zod";
import type { TripPosition } from "@/db/schema";
import type { AppContainer } from "@/lib/container";
import type { TripView } from "@/services/trip-service";
import type { TripListNotification } from "@/services/trip-list-events";
import { errorResponse } from "./responses";

const idSchema = z.uuid();
const cursorSchema = z.coerce.number().int().nonnegative();
const encoder = new TextEncoder();

const sseHeaders = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const;

export function formatPositionEvent(position: TripPosition) {
  return `id: ${position.id}\nevent: position\ndata: ${JSON.stringify(position)}\n\n`;
}

export function formatTripUpdatedEvent(event: {
  type: TripListNotification["type"];
  from?: TripListNotification["from"];
  to?: TripListNotification["to"];
  trip: TripView;
}) {
  return `event: trip.updated\ndata: ${JSON.stringify(event)}\n\n`;
}

export async function tripEventsHandler(
  id: string,
  request: Request,
  container: AppContainer,
) {
  try {
    const tripId = idSchema.parse(id);
    await container.tripService.get(tripId);
    const cursorHeader = request.headers.get("last-event-id");
    const afterId = cursorHeader ? cursorSchema.parse(cursorHeader) : 0;
    let cleanup: (() => void) | undefined;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let closed = false;
        let replaying = true;
        let highestSentId = afterId;
        const pendingIds: number[] = [];
        let liveQueue = Promise.resolve();

        const sendPosition = async (positionId: number) => {
          if (closed || positionId <= highestSentId) {
            return;
          }
          const position =
            await container.positionRepository.findById(positionId);
          if (!position || position.tripId !== tripId || closed) {
            return;
          }
          controller.enqueue(encoder.encode(formatPositionEvent(position)));
          highestSentId = Math.max(highestSentId, position.id);
        };

        const unsubscribe = await container.positionEvents.subscribe(
          tripId,
          ({ positionId }) => {
            if (replaying) {
              pendingIds.push(positionId);
              return;
            }
            liveQueue = liveQueue.then(() => sendPosition(positionId));
          },
        );

        const heartbeat = setInterval(() => {
          if (!closed) {
            controller.enqueue(encoder.encode(": heartbeat\n\n"));
          }
        }, 15_000);
        controller.enqueue(encoder.encode(": connected\n\n"));

        cleanup = () => {
          if (closed) {
            return;
          }
          closed = true;
          clearInterval(heartbeat);
          unsubscribe();
        };
        request.signal.addEventListener(
          "abort",
          () => {
            cleanup?.();
            controller.close();
          },
          { once: true },
        );

        const missed = await container.positionRepository.listAfter(
          tripId,
          afterId,
        );
        for (const position of missed) {
          if (closed) {
            break;
          }
          controller.enqueue(encoder.encode(formatPositionEvent(position)));
          highestSentId = Math.max(highestSentId, position.id);
        }
        replaying = false;
        for (const positionId of [...new Set(pendingIds)].sort(
          (left, right) => left - right,
        )) {
          await sendPosition(positionId);
        }
      },
      cancel() {
        cleanup?.();
      },
    });

    return new NextResponse(stream, {
      headers: sseHeaders,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function tripListEventsHandler(
  request: Request,
  container: AppContainer,
) {
  try {
    const vendorParam = new URL(request.url).searchParams.get("vendorId");
    const vendorId = vendorParam ? idSchema.parse(vendorParam) : undefined;
    let cleanup: (() => void) | undefined;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let closed = false;
        let liveQueue = Promise.resolve();

        const sendUpdate = async (notification: TripListNotification) => {
          if (closed) {
            return;
          }
          if (vendorId && notification.vendorId !== vendorId) {
            return;
          }
          try {
            const trip = await container.tripService.get(notification.tripId);
            if (closed || (vendorId && trip.trip.vendorId !== vendorId)) {
              return;
            }
            controller.enqueue(
              encoder.encode(
                formatTripUpdatedEvent({
                  type: notification.type,
                  from: notification.from,
                  to: notification.to,
                  trip,
                }),
              ),
            );
          } catch (error) {
            if (!closed) {
              console.error("Failed to push trip list SSE event", error);
            }
          }
        };

        const unsubscribe = await container.tripListEvents.subscribe(
          (notification) => {
            liveQueue = liveQueue
              .then(() => sendUpdate(notification))
              .catch(() => undefined);
          },
        );

        const heartbeat = setInterval(() => {
          if (!closed) {
            controller.enqueue(encoder.encode(": heartbeat\n\n"));
          }
        }, 15_000);
        controller.enqueue(encoder.encode(": connected\n\n"));

        cleanup = () => {
          if (closed) {
            return;
          }
          closed = true;
          clearInterval(heartbeat);
          unsubscribe();
        };
        request.signal.addEventListener(
          "abort",
          () => {
            cleanup?.();
            controller.close();
          },
          { once: true },
        );
      },
      cancel() {
        cleanup?.();
      },
    });

    return new NextResponse(stream, {
      headers: sseHeaders,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
