import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDriverLocationOutbox,
  createMemoryStorage,
  DRIVER_LOCATION_OUTBOX_CAP,
} from "./driver-location-outbox";

afterEach(() => {
  vi.useRealTimers();
});

describe("driver location outbox", () => {
  it("stores the GPS timestamp, not the enqueue wall clock", () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse("2026-09-10T12:00:00Z"));
    const outbox = createDriverLocationOutbox(createMemoryStorage());
    const recordedAt = Date.parse("2026-09-10T10:00:00Z");

    const item = outbox.enqueue("trip-1", positionAt(recordedAt, 25.2, 55.3));

    expect(item).toMatchObject({
      lat: 25.2,
      lng: 55.3,
      timestamp: "2026-09-10T10:00:00.000Z",
      eventId: `browser-trip-1-${recordedAt}`,
    });
    expect(item?.timestamp).not.toBe(new Date().toISOString());
  });

  it("does not store a duplicate eventId", () => {
    const outbox = createDriverLocationOutbox(createMemoryStorage());
    const recordedAt = Date.parse("2026-09-10T10:00:00Z");

    expect(
      outbox.enqueue("trip-1", positionAt(recordedAt, 25.2, 55.3)),
    ).not.toBeNull();
    expect(
      outbox.enqueue("trip-1", positionAt(recordedAt, 25.4, 55.5)),
    ).toBeNull();
    expect(outbox.size("trip-1")).toBe(1);
    expect(outbox.peek("trip-1")).toMatchObject({
      lat: 25.2,
      lng: 55.3,
    });
  });

  it("drops the oldest item when the cap is exceeded", () => {
    const outbox = createDriverLocationOutbox(createMemoryStorage());
    const start = Date.parse("2026-09-10T10:00:00Z");

    for (let index = 0; index <= DRIVER_LOCATION_OUTBOX_CAP; index += 1) {
      outbox.enqueue(
        "trip-1",
        positionAt(start + index * 5_000, 25, 55),
      );
    }

    expect(outbox.size("trip-1")).toBe(DRIVER_LOCATION_OUTBOX_CAP);
    expect(outbox.peek("trip-1")?.eventId).toBe(
      `browser-trip-1-${start + 5_000}`,
    );
  });

  it("acks only the matching item and keeps chronological order", () => {
    const outbox = createDriverLocationOutbox(createMemoryStorage());
    const first = Date.parse("2026-09-10T10:00:00Z");
    const second = first + 5_000;
    const third = first + 10_000;

    outbox.enqueue("trip-1", positionAt(third, 25.3, 55.3));
    outbox.enqueue("trip-1", positionAt(first, 25.1, 55.1));
    outbox.enqueue("trip-1", positionAt(second, 25.2, 55.2));

    outbox.ack("trip-1", `browser-trip-1-${second}`);

    expect(outbox.load("trip-1").map((item) => item.eventId)).toEqual([
      `browser-trip-1-${first}`,
      `browser-trip-1-${third}`,
    ]);
  });
});

function positionAt(timestamp: number, lat: number, lng: number) {
  return {
    coords: {
      latitude: lat,
      longitude: lng,
      speed: null,
    } as GeolocationCoordinates,
    timestamp,
  };
}
