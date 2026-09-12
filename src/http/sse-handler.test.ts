import { describe, expect, it, vi } from "vitest";
import type { TripPosition } from "@/db/schema";
import type { AppContainer } from "@/lib/container";
import type { PositionNotificationHandler } from "@/services/position-events";
import type { TripListNotificationHandler } from "@/services/trip-list-events";
import type { TripView } from "@/services/trip-service";
import {
  formatPositionEvent,
  formatTripUpdatedEvent,
  tripEventsHandler,
  tripListEventsHandler,
} from "./sse-handler";

const tripId = "00000000-0000-4000-8000-000000000001";
const vendorId = "00000000-0000-4000-8000-000000000002";
const otherVendorId = "00000000-0000-4000-8000-000000000003";

function position(id: number): TripPosition {
  return {
    id,
    tripId,
    latitude: 25.2,
    longitude: 55.3,
    recordedAt: new Date("2026-09-10T10:00:00Z"),
    receivedAt: new Date("2026-09-10T10:00:01Z"),
    speed: 12,
    source: "vendor",
    sourceEventId: `event-${id}`,
  };
}

describe("trip SSE handler", () => {
  it("formats stable SSE position events", () => {
    expect(formatPositionEvent(position(11))).toContain(
      "id: 11\nevent: position\ndata:",
    );
  });

  it("replays missed positions then delivers live notifications", async () => {
    let notificationHandler: PositionNotificationHandler | undefined;
    const unsubscribe = vi.fn();
    const app = {
      tripService: { get: vi.fn().mockResolvedValue({}) },
      positionRepository: {
        listAfter: vi.fn().mockResolvedValue([position(11)]),
        findById: vi.fn().mockResolvedValue(position(12)),
      },
      positionEvents: {
        subscribe: vi.fn(
          async (_tripId: string, handler: PositionNotificationHandler) => {
            notificationHandler = handler;
            return unsubscribe;
          },
        ),
      },
    } as unknown as AppContainer;
    const controller = new AbortController();
    const request = new Request(
      `http://localhost/api/trips/${tripId}/events`,
      {
        headers: { "Last-Event-ID": "10" },
        signal: controller.signal,
      },
    );

    const response = await tripEventsHandler(tripId, request, app);
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    const connected = await reader.read();
    expect(decoder.decode(connected.value)).toBe(": connected\n\n");
    const replay = await reader.read();
    expect(decoder.decode(replay.value)).toContain("id: 11");
    expect(app.positionRepository.listAfter).toHaveBeenCalledWith(
      tripId,
      10,
    );

    await notificationHandler?.({ tripId, positionId: 12 });
    const live = await reader.read();
    expect(decoder.decode(live.value)).toContain("id: 12");

    await reader.cancel();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});

function tripView(): TripView {
  return {
    trip: {
      id: tripId,
      referenceNumber: "TRIP-1",
      vehicleId: "00000000-0000-4000-8000-000000000004",
      vendorId,
      driverId: null,
      status: "created",
      pickupAddress: "Dubai",
      pickupLatitude: 25.2,
      pickupLongitude: 55.3,
      dropoffAddress: "Sharjah",
      dropoffLatitude: 25.35,
      dropoffLongitude: 55.42,
      scheduledAt: null,
      startedAt: null,
      completedAt: null,
      cancelledAt: null,
      version: 1,
      createdAt: new Date("2026-09-10T10:00:00Z"),
      updatedAt: new Date("2026-09-10T10:00:00Z"),
    },
    vehicle: {
      id: "vehicle",
      registrationNumber: "A-1",
      make: "Nissan",
      model: "Patrol",
      color: null,
    },
    customer: { id: "customer", name: "Customer" },
    driver: null,
    vendor: { id: vendorId, name: "Vendor" },
    latestPosition: null,
  };
}

describe("trip list SSE handler", () => {
  it("formats trip.updated events", () => {
    const trip = tripView();
    expect(
      formatTripUpdatedEvent({
        type: "created",
        to: "created",
        trip,
      }),
    ).toContain("event: trip.updated\ndata:");
  });

  it("delivers matching live updates and ignores other vendors", async () => {
    let notificationHandler: TripListNotificationHandler | undefined;
    const unsubscribe = vi.fn();
    const trip = tripView();
    const app = {
      tripService: { get: vi.fn().mockResolvedValue(trip) },
      tripListEvents: {
        subscribe: vi.fn(async (handler: TripListNotificationHandler) => {
          notificationHandler = handler;
          return unsubscribe;
        }),
      },
    } as unknown as AppContainer;
    const controller = new AbortController();
    const request = new Request(
      `http://localhost/api/trips/events?vendorId=${vendorId}`,
      { signal: controller.signal },
    );

    const response = await tripListEventsHandler(request, app);
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    const connected = await reader.read();
    expect(decoder.decode(connected.value)).toBe(": connected\n\n");

    await notificationHandler?.({
      tripId,
      vendorId: otherVendorId,
      type: "created",
      to: "created",
    });
    await notificationHandler?.({
      tripId,
      vendorId,
      type: "created",
      to: "created",
    });
    const live = await reader.read();
    expect(decoder.decode(live.value)).toContain("event: trip.updated");
    expect(app.tripService.get).toHaveBeenCalledOnce();
    expect(app.tripService.get).toHaveBeenCalledWith(tripId);

    await reader.cancel();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
